// Escale : assistant IA (fonction serveur Supabase).
// La clé d'API reste ici, côté serveur, jamais dans l'appli.
//
// Mise en place (une seule fois) :
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   supabase functions deploy assistant
//
// Ce qui est envoyé à l'IA : la question et un résumé chiffré des voyages (pays, dates, budgets,
// totaux par catégorie). Jamais les notes, les photos, l'e-mail, le nom ni les prénoms des amis.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const MODEL = Deno.env.get('ASSISTANT_MODEL') ?? 'claude-haiku-5-5';
const API_VERSION = Deno.env.get('ANTHROPIC_VERSION') ?? '2023-06-01';
const DAILY_LIMIT = Number(Deno.env.get('ASSISTANT_DAILY_LIMIT') ?? '30');
const ALLOWED = (Deno.env.get('ALLOWED_ORIGINS') ?? '*').split(',').map(s => s.trim());

const cors = (origin: string | null) => ({
  'Access-Control-Allow-Origin': ALLOWED.includes('*') ? '*' : (origin && ALLOWED.includes(origin) ? origin : ALLOWED[0]),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
});
const json = (body: unknown, status: number, h: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...h, 'Content-Type': 'application/json' } });

const CATS: Record<string, string> = { logement: 'Logement', repas: 'Repas', transport: 'Transport', activites: 'Activités', shopping: 'Shopping' };

Deno.serve(async req => {
  const h = cors(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers: h });
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405, h);

  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) return json({ error: "L'assistant IA n'est pas encore configuré." }, 503, h);

  const auth = req.headers.get('Authorization') ?? '';
  const url = Deno.env.get('SUPABASE_URL')!;
  const userDb = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: { user } } = await userDb.auth.getUser();
  if (!user) return json({ error: 'Connecte-toi pour utiliser l’assistant.' }, 401, h);

  let body: { question?: string; history?: { role: string; content: string }[] };
  try { body = await req.json(); } catch { return json({ error: 'Requête invalide' }, 400, h); }
  const question = String(body.question ?? '').trim().slice(0, 500);
  if (!question) return json({ error: 'Pose ta question.' }, 400, h);

  // consentement : l'assistant IA doit être activé dans les réglages
  const { data: set } = await userDb.from('account_settings').select('ai_enabled').eq('user_id', user.id).single();
  if (!set?.ai_enabled) return json({ error: "Active l'assistant IA dans les réglages pour l'utiliser." }, 403, h);

  // limite quotidienne
  const today = new Date().toISOString().slice(0, 10);
  const { data: use } = await admin.from('ai_usage').select('count').eq('user_id', user.id).eq('day', today).maybeSingle();
  if ((use?.count ?? 0) >= DAILY_LIMIT) return json({ error: `Tu as posé ${DAILY_LIMIT} questions aujourd'hui, reviens demain.` }, 429, h);

  // résumé chiffré, lu avec les droits de la personne connectée
  const [{ data: trips }, { data: exps }] = await Promise.all([
    userDb.from('trips').select('id,country_code,city,start_date,end_date,budget,places,members').order('start_date'),
    userDb.from('expenses').select('trip_id,category,amount_eur,day,paid_by,split'),
  ]);
  const now = today;
  const summary = (trips ?? []).map(t => {
    const mine = (exps ?? []).filter(e => e.trip_id === t.id);
    const byCat: Record<string, number> = {};
    let total = 0;
    for (const e of mine) {
      const sp = Array.isArray(e.split) && e.split.length ? e.split : null;
      const part = !sp ? (e.paid_by && e.paid_by !== 'me' ? 0 : Number(e.amount_eur)) : sp.includes('me') ? Number(e.amount_eur) / sp.length : 0;
      byCat[CATS[e.category] ?? e.category] = Math.round(((byCat[CATS[e.category] ?? e.category] ?? 0) + part) * 100) / 100;
      total += part;
    }
    const days = Math.round((Date.parse(t.end_date) - Date.parse(t.start_date)) / 864e5) + 1;
    const status = now < t.start_date ? 'à venir' : now > t.end_date ? 'terminé' : 'en cours';
    return {
      voyage: t.city || `roadtrip ${t.country_code}`, pays: t.country_code, du: t.start_date, au: t.end_date, jours: days, statut: status,
      budget_eur: Number(t.budget), depense_eur: Math.round(total * 100) / 100, par_categorie_eur: byCat,
      nb_participants: 1 + (Array.isArray(t.members) ? t.members.length : 0), lieux_notes: (t.places ?? []).length,
    };
  });

  const system = `Tu es l'assistant d'Escale, une appli de carnet de voyage. Tu réponds en français, de façon chaleureuse, concrète et brève (5 phrases maximum, pas de listes à puces, pas de tiret cadratin).
Tu t'appuies uniquement sur les données ci-dessous (montants en euros, "depense_eur" est la part personnelle de l'utilisateur). Si une information manque, dis-le simplement.
Tu ne donnes pas de conseil financier ou d'investissement. Nous sommes le ${today}.
Données de l'utilisateur : ${JSON.stringify(summary)}`;

  const history = (Array.isArray(body.history) ? body.history : []).slice(-6)
    .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map(m => ({ role: m.role, content: m.content.slice(0, 1500) }));

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': API_VERSION, 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 400, system, messages: [...history, { role: 'user', content: question }] }),
  });
  if (!r.ok) { console.error('anthropic', r.status, await r.text()); return json({ error: 'Assistant momentanément indisponible' }, 502, h); }
  const out = await r.json();
  const answer = (out.content ?? []).filter((c: { type: string }) => c.type === 'text').map((c: { text: string }) => c.text).join('').trim();

  await admin.from('ai_usage').upsert({ user_id: user.id, day: today, count: (use?.count ?? 0) + 1 });
  return json({ answer: answer || "Je n'ai pas de réponse pour l'instant." }, 200, h);
});
