/* Escale : connexion à Supabase, données de l'utilisateur, synchronisation et photos.
 *
 * Fonctionnement :
 *  - S contient les voyages, dépenses, pages et envies de la personne connectée.
 *  - Toute modification de l'interface appelle save() : la différence avec le dernier
 *    état confirmé par le serveur (SNAP) est envoyée à Supabase (ajouts, modifications,
 *    suppressions). Hors connexion, les modifications attendent et repartent ensuite.
 *  - Une copie locale (cet appareil uniquement) permet d'ouvrir l'appli sans réseau.
 *    Elle est effacée à la déconnexion et à la suppression du compte.
 *  - Les photos sont stockées dans un espace privé : l'appli obtient des liens
 *    temporaires (1 h) uniquement pour les photos qu'on a le droit de voir.
 */
'use strict';
const CFG = window.ESCALE_CONFIG || {};
const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce', storageKey: 'escale-auth' },
});

let ME = null;            // utilisateur connecté (auth)
let PROFILE = null;       // profil public
let SETTINGS = null;      // réglages privés
let S = { user: '', trips: [], envies: [] };
let SNAP = null;          // dernier état confirmé par le serveur
const VIS_TO_DB = { public: 'public', amis: 'friends', prive: 'private' };
const VIS_FROM_DB = { public: 'public', friends: 'amis', private: 'prive' };

/* ---------- correspondance appli <-> base ---------- */
const ROW = {
  trips: t => ({ id: t.id, country_code: t.pays, city: t.ville || null, start_date: t.du, end_date: t.au, budget: Number(t.budget) || 0,
    category_budgets: t.budgets || null, places: t.lieux || [], is_favorite: !!t.fav, album_visibility: VIS_TO_DB[t.vis || 'prive'], cover_path: t.cover || null,
    members: t.membres || [], settlements: t.reglements || [] }),
  expenses: ([t, d]) => ({ id: d.id, trip_id: t.id, day: d.j, label: d.l, category: d.c,
    amount_local: d.v == null ? null : Number(d.v), currency: d.v == null ? null : (d.cur || C(t).code || null), amount_eur: Math.round(Number(d.eur) * 100) / 100,
    paid_by: d.by || 'me', split: d.split || null }),
  journal_entries: ([t, e]) => ({ id: e.id, trip_id: t.id, day: e.j, title: e.t, note: e.n || '', photo_paths: e.photos }),
  wishes: w => ({ id: w.id, country_code: w.pays, note: w.note || '' }),
};
const LIST = {
  trips: () => S.trips,
  expenses: () => S.trips.flatMap(t => t.depenses.map(d => [t, d])),
  journal_entries: () => S.trips.flatMap(t => t.entrees.map(e => [t, e])),
  wishes: () => S.envies,
};
// colonnes modifiables (les autres sont figées par la base)
const UPDATABLE = {
  trips: ['country_code', 'city', 'start_date', 'end_date', 'budget', 'category_budgets', 'places', 'is_favorite', 'album_visibility', 'cover_path', 'members', 'settlements'],
  expenses: ['day', 'label', 'category', 'amount_local', 'currency', 'amount_eur', 'paid_by', 'split'],
  journal_entries: ['day', 'title', 'note', 'photo_paths'],
  wishes: ['note'],
};
const ORDER_INS = ['trips', 'expenses', 'journal_entries', 'wishes'];
const ORDER_DEL = ['expenses', 'journal_entries', 'wishes', 'trips'];

function fromDb(trips, exps, entries, wishes) {
  const T = trips.map(r => ({ id: r.id, pays: r.country_code, ville: r.city || '', membres: r.members || [], reglements: r.settlements || [], du: r.start_date, au: r.end_date, budget: Number(r.budget),
    budgets: r.category_budgets || null, lieux: r.places || [], fav: r.is_favorite, vis: VIS_FROM_DB[r.album_visibility] || 'prive',
    cover: r.cover_path, entrees: [], depenses: [] }));
  const byId = Object.fromEntries(T.map(t => [t.id, t]));
  exps.forEach(r => { const t = byId[r.trip_id]; if (t) t.depenses.push({ id: r.id, j: r.day, l: r.label, c: r.category, v: r.amount_local == null ? null : Number(r.amount_local), cur: r.amount_local == null || r.currency === C(t).code ? null : r.currency, eur: Number(r.amount_eur), by: r.paid_by || 'me', split: r.split || null, at: r.created_at }); });
  entries.forEach(r => { const t = byId[r.trip_id]; if (t) t.entrees.push({ id: r.id, j: r.day, t: r.title, n: r.note, photos: r.photo_paths || [] }); });
  T.forEach(t => { t.entrees.sort((a, b) => a.j - b.j); t.depenses.sort((a, b) => (a.at || '').localeCompare(b.at || '')); });
  return { trips: T, envies: wishes.map(r => ({ id: r.id, pays: r.country_code, note: r.note })) };
}
function snapshotOf(state) {
  const old = S; S = state;
  const snap = Object.fromEntries(ORDER_INS.map(n => [n, Object.fromEntries(LIST[n]().map(x => { const r = ROW[n](x); return [r.id, JSON.stringify(r)]; }))]));
  S = old; return snap;
}

/* ---------- cache local (cet appareil) ---------- */
const cacheKey = () => ME ? 'escale:cache:' + ME.id : null;
function writeCache() { try { if (ME && SNAP) localStorage.setItem(cacheKey(), JSON.stringify({ S, SNAP, PROFILE, SETTINGS, at: Date.now() })); } catch (e) { /* quota : sans gravité */ } }
function readCache() { try { const r = localStorage.getItem(cacheKey()); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
function wipeLocal() { try { Object.keys(localStorage).filter(k => k.startsWith('escale:') || k === 'escale-auth' || k.startsWith('escale-auth') || k.startsWith('sb-')).forEach(k => localStorage.removeItem(k)); sessionStorage.clear(); } catch (e) { } }

/* ---------- chargement ---------- */
async function loadProfile() {
  const [p, s] = await Promise.all([
    sb.from('profiles').select('*').eq('id', ME.id).single(),
    sb.from('account_settings').select('*').eq('user_id', ME.id).single(),
  ]);
  if (p.error) throw p.error; if (s.error) throw s.error;
  PROFILE = p.data; SETTINGS = s.data; S.user = (PROFILE.display_name || '').split(' ')[0];
}
async function loadData() {
  const q = (t, o) => sb.from(t).select('*').order(o || 'created_at').limit(5000);
  const [t, e, j, w] = await Promise.all([q('trips', 'start_date'), q('expenses'), q('journal_entries'), q('wishes')]);
  for (const r of [t, e, j, w]) if (r.error) throw r.error;
  const fresh = fromDb(t.data, e.data, j.data, w.data);
  S = { user: S.user, ...fresh }; SNAP = snapshotOf(S); writeCache();
}
/** Identifiants des éléments modifiés sur l'appareil et pas encore confirmés par le serveur. */
function pendingIds() { const out = new Set(); if (!SNAP) return out; const cur = snapshotOf(S);
  ORDER_INS.forEach(n => { Object.entries(cur[n]).forEach(([id, j]) => { if (SNAP[n][id] !== j) out.add(id); }); Object.keys(SNAP[n]).forEach(id => { if (!(id in cur[n])) out.add(id); }); }); return out; }
const hasPending = () => { if (!SNAP) return false; const cur = snapshotOf(S); return ORDER_INS.some(n => JSON.stringify(cur[n]) !== JSON.stringify(SNAP[n])); };

/* ---------- synchronisation ---------- */
let syncTimer = null, syncing = false, again = false, backoff = 0;
function save() { writeCache(); updatePending(); clearTimeout(syncTimer); syncTimer = setTimeout(sync, 350); }
/* indicateur hors connexion : nombre de modifications en attente d'envoi */
let PENDING = new Set(), wasOffline = false;
function updatePending() {
  PENDING = pendingIds(); const n = PENDING.size, bar = document.querySelector('.offline-bar'); if (!bar) return;
  bar.textContent = n ? `Hors connexion : ${n} modification${n > 1 ? 's' : ''} enregistrée${n > 1 ? 's' : ''} sur ton téléphone, envoyée${n > 1 ? 's' : ''} au retour du réseau.` : 'Hors connexion : tu peux continuer à noter tes dépenses, elles seront envoyées au retour du réseau.';
}
async function sync() {
  if (!ME || !SNAP) return;
  if (syncing) { again = true; return; }
  syncing = true; again = false;
  try {
    const cur = snapshotOf(S);
    for (const n of ORDER_INS) {
      const ins = Object.entries(cur[n]).filter(([id]) => !(id in SNAP[n])).map(([, j]) => JSON.parse(j));
      if (ins.length) { const r = await sb.from(n).insert(ins); if (r.error) throw r.error; ins.forEach(x => SNAP[n][x.id] = JSON.stringify(x)); }
      for (const [id, j] of Object.entries(cur[n])) {
        if (!(id in SNAP[n]) || SNAP[n][id] === j) continue;
        const row = JSON.parse(j), patch = Object.fromEntries(UPDATABLE[n].filter(k => k in row).map(k => [k, row[k]]));
        const r = await sb.from(n).update(patch).eq('id', id); if (r.error) throw r.error; SNAP[n][id] = j;
      }
    }
    for (const n of ORDER_DEL) {
      const del = Object.keys(SNAP[n]).filter(id => !(id in cur[n]));
      if (del.length) { const r = await sb.from(n).delete().in('id', del); if (r.error) throw r.error; del.forEach(id => delete SNAP[n][id]); }
    }
    backoff = 0; setOnline(true); writeCache(); flushMediaDeletes();
    const had = PENDING.size; updatePending(); if (had && wasOffline) { wasOffline = false; toast('Connexion retrouvée : tout est synchronisé'); if (typeof refresh === 'function') refresh(); }
  } catch (e) {
    if (isNetwork(e)) { setOnline(false); backoff = Math.min(60000, (backoff || 2500) * 2); setTimeout(sync, backoff); }
    else {
      console.warn('sync', e);
      toast(e.code === 'P0429' ? e.message : "Une modification n'a pas pu être enregistrée, on recharge tes carnets.");
      try { await loadData(); refresh(); } catch (_) { }
    }
  } finally { syncing = false; if (again) sync(); }
}
const isNetwork = e => !e || e.name === 'TypeError' || /fetch|network|Failed to fetch|Load failed/i.test(e.message || '') || e.status === 0;
function setOnline(on) { if (!on) { wasOffline = true; updatePending(); } document.body.classList.toggle('offline', !on); }
// nouvelle tentative régulière tant que quelque chose attend (réseau capricieux en voyage)
setInterval(() => { if (ME && SNAP && !syncing && PENDING.size && navigator.onLine) sync(); }, 30000);
addEventListener('online', () => { setOnline(true); sync(); });
addEventListener('offline', () => setOnline(false));

/* ---------- photos ---------- */
const URLS = new Map();     // chemin -> {url, exp}
const WAIT = new Set();
let signTimer = null;
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
function M(path) { if (!path) return ''; if (/^(data:|blob:)/.test(path)) return path; const c = URLS.get(path); if (c && c.exp > Date.now()) return c.url; WAIT.add(path); clearTimeout(signTimer); signTimer = setTimeout(signWaiting, 30); return ''; }
/** Balise image pour un chemin du stockage privé : le lien temporaire est ajouté dès qu'il est obtenu. */
function IMG(path, alt = '', cls = '') { if (!path) return ''; const u = M(path); return `<img ${cls ? `class="${cls}" ` : ''}data-p="${esc(path)}" src="${u || BLANK}" alt="${esc(alt)}" loading="lazy" decoding="async"${u ? '' : ' data-wait="1"'}>`; }
async function signWaiting() {
  const list = [...WAIT].filter(p => !URLS.has(p) || URLS.get(p).exp <= Date.now()); WAIT.clear(); if (!list.length) return;
  for (let i = 0; i < list.length; i += 100) {
    const part = list.slice(i, i + 100);
    const { data, error } = await sb.storage.from('media').createSignedUrls(part, 3600);
    if (error) { if (isNetwork(error)) setTimeout(() => { part.forEach(p => WAIT.add(p)); signWaiting(); }, 5000); continue; }
    data.forEach(x => { if (x.signedUrl) URLS.set(x.path, { url: x.signedUrl, exp: Date.now() + 3300e3 }); else URLS.set(x.path, { url: '', exp: Date.now() + 600e3 }); });
  }
  document.querySelectorAll('img[data-wait]').forEach(im => { const c = URLS.get(im.dataset.p); if (c) { im.removeAttribute('data-wait'); if (c.url) im.src = c.url; else { const ph = im.closest('.ph'); if (ph) ph.classList.remove('has'); im.remove(); } } });
}
new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1 && (n.matches?.('img[data-wait]') || n.querySelector?.('img[data-wait]'))) { (n.matches('img[data-wait]') ? [n] : n.querySelectorAll('img[data-wait]')).forEach(im => M(im.dataset.p)); } })
  .observe(document.documentElement, { childList: true, subtree: true });

/** Redimensionne, retire les métadonnées (position GPS, appareil) et envoie une photo. */
async function uploadPhoto(file, kind) {
  if (!ME) throw new Error('non connecté');
  if (!/^image\//.test(file.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) throw new Error("Ce fichier n'est pas une image");
  if (file.size > 40e6) throw new Error('Image trop lourde (40 Mo maximum)');
  const bmp = await new Promise((res, rej) => { const img = new Image(), u = URL.createObjectURL(file); img.onload = () => { URL.revokeObjectURL(u); res(img); }; img.onerror = () => { URL.revokeObjectURL(u); rej(new Error("Ce fichier n'est pas une image lisible")); }; img.src = u; });
  const max = 1600, k = Math.min(1, max / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  let q = 0.82, blob = await new Promise(r => c.toBlob(r, 'image/jpeg', q));
  while (blob && blob.size > 2.8e6 && q > 0.4) { q -= 0.12; blob = await new Promise(r => c.toBlob(r, 'image/jpeg', q)); }
  if (!blob) throw new Error('Conversion impossible');
  const path = `${ME.id}/${kind}/${uid().replace(/-/g, '')}.jpg`;
  const { error } = await sb.storage.from('media').upload(path, blob, { contentType: 'image/jpeg', upsert: false, cacheControl: '3600' });
  if (error) throw new Error(isNetwork(error) ? 'Pas de connexion, réessaie plus tard' : "L'envoi de la photo a échoué");
  URLS.set(path, { url: URL.createObjectURL(blob), exp: Date.now() + 3300e3 });
  return path;
}
// photos retirées : supprimées du stockage après confirmation, si plus rien ne les utilise
const DROP = new Set();
function releaseMedia(path) { if (path && !/^(data:|blob:)/.test(path)) DROP.add(path); }
async function flushMediaDeletes() {
  if (!DROP.size) return;
  const list = [...DROP]; DROP.clear();
  const used = new Set([...S.trips.flatMap(t => [t.cover, ...t.entrees.flatMap(e => e.photos)]), PROFILE && PROFILE.avatar_path, PROFILE && PROFILE.cover_path].filter(Boolean));
  const r = await sb.from('post_photos').select('path').in('path', list);
  (r.data || []).forEach(x => used.add(x.path));
  const gone = list.filter(p => !used.has(p) && p.startsWith(ME.id + '/'));
  if (gone.length) await sb.storage.from('media').remove(gone);
}

/* ---------- appels serveur ---------- */
async function rpc(name, args) { const { data, error } = await sb.rpc(name, args || {}); if (error) throw error; return data; }
const errMsg = e => (e && (e.message || e.error_description)) || 'Erreur inattendue';
