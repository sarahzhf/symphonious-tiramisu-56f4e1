// Escale : lecture d'un ticket de caisse par l'IA (réservé aux membres PRO).
// Déploiement : supabase functions deploy scan-ticket   (utilise le même secret ANTHROPIC_API_KEY)
// L'image est envoyée à l'IA puis oubliée : elle n'est pas stockée.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const MODEL = Deno.env.get('ASSISTANT_MODEL') ?? 'claude-haiku-5-5';
const API_VERSION = Deno.env.get('ANTHROPIC_VERSION') ?? '2023-06-01';
const DAILY_LIMIT = Number(Deno.env.get('SCAN_DAILY_LIMIT') ?? '40');
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const key = Deno.env.get('ANTHROPIC_API_KEY'); if (!key) return json({ error: 'Non configuré' }, 503);
  const url = Deno.env.get('SUPABASE_URL')!;
  const userDb = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: { user } } = await userDb.auth.getUser(); if (!user) return json({ error: 'Connexion requise' }, 401);

  const today = new Date().toISOString().slice(0, 10);
  const { data: pro } = await admin.from('pro_members').select('until').eq('user_id', user.id).maybeSingle();
  if (!pro || (pro.until && pro.until < today)) return json({ error: 'Réservé à Escale PRO' }, 403);

  const { data: use } = await admin.from('ai_usage').select('count').eq('user_id', user.id).eq('day', today).maybeSingle();
  if ((use?.count ?? 0) >= DAILY_LIMIT) return json({ error: 'Limite du jour atteinte' }, 429);

  let image = '';
  try { image = String((await req.json()).image ?? ''); } catch { return json({ error: 'Requête invalide' }, 400); }
  if (!image || image.length > 4_000_000) return json({ error: 'Image manquante ou trop lourde' }, 400);

  const prompt = `Lis ce ticket de caisse ou cette facture. Réponds UNIQUEMENT avec un objet JSON, sans texte autour :
{"amount": nombre total payé TTC ou null, "currency": code ISO 4217 (EUR, USD, MAD...) ou null, "date": "AAAA-MM-JJ" ou null, "merchant": nom court du commerce ou null, "category": une valeur parmi "logement","repas","transport","activites","shopping" ou null}`;
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'x-api-key': key, 'anthropic-version': API_VERSION, 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 200, messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } }, { type: 'text', text: prompt }] }] }),
  });
  if (!r.ok) { console.error('anthropic', r.status, await r.text()); return json({ error: 'Lecture indisponible' }, 502); }
  const out = await r.json(), text = (out.content ?? []).map((c: { text?: string }) => c.text ?? '').join('');
  let res: Record<string, unknown> = {};
  try { res = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)); } catch { return json({ error: 'Ticket illisible' }, 422); }
  await admin.from('ai_usage').upsert({ user_id: user.id, day: today, count: (use?.count ?? 0) + 1 });
  const cats = ['logement', 'repas', 'transport', 'activites', 'shopping'];
  return json({
    amount: typeof res.amount === 'number' && res.amount > 0 && res.amount < 1e7 ? Math.round(res.amount * 100) / 100 : null,
    currency: typeof res.currency === 'string' && /^[A-Z]{3}$/.test(res.currency) ? res.currency : null,
    date: typeof res.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(res.date) ? res.date : null,
    merchant: typeof res.merchant === 'string' ? res.merchant.slice(0, 60) : null,
    category: cats.includes(res.category as string) ? res.category : null,
  });
});
