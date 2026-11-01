/* Escale : taux de change à jour, statistiques par catégorie et comptes entre amis.
 *
 * Taux de change : récupérés une fois toutes les 12 h (source open.er-api.com, données publiques,
 * aucune donnée personnelle envoyée) et gardés sur l'appareil pour fonctionner hors connexion.
 * Sans réseau et sans taux enregistrés, on garde les taux indicatifs intégrés à l'appli.
 *
 * Comptes entre amis (façon Tricount) : chaque voyage peut avoir des participants (t.membres).
 * Une dépense indique qui a payé (d.by, 'me' pour toi) et pour qui (d.split, liste d'identifiants).
 * Les remboursements effectués sont notés dans t.reglements.
 */
'use strict';
SV.cloudOff = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M7 18h10a4 4 0 0 0 .7-7.9A6 6 0 0 0 6.2 9 4.5 4.5 0 0 0 7 18zM3 3l18 18"/></svg>';
SV.swapArr = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

/* ---------- taux de change ---------- */
const RATES_KEY = 'escale:rates', RATES_TTL = 12 * 3600e3;
let RATES = null; // { at, rates: { USD: 1.08, ... } } pour 1 €
const BASE_RATES = Object.fromEntries(Object.values(COUNTRIES).filter(c => c.code).map(c => [c.code, c.rate]));
function applyRates(r) {
  if (!r || !r.rates) return; RATES = r;
  Object.values(COUNTRIES).forEach(c => { if (c.code && c.code !== 'EUR' && r.rates[c.code]) c.rate = r.rates[c.code]; });
}
async function loadRates(force) {
  try { const c = JSON.parse(localStorage.getItem(RATES_KEY) || 'null'); if (c && !RATES) applyRates(c); if (c && !force && Date.now() - c.at < RATES_TTL) return; } catch (_) { }
  if (!navigator.onLine) return;
  try {
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 8000);
    const res = await fetch('https://open.er-api.com/v6/latest/EUR', { signal: ctl.signal, credentials: 'omit', referrerPolicy: 'no-referrer' }); clearTimeout(to);
    const j = await res.json(); if (j.result !== 'success' || !j.rates) return;
    const r = { at: Date.now(), rates: j.rates }; applyRates(r);
    try { localStorage.setItem(RATES_KEY, JSON.stringify(r)); } catch (_) { }
    if (typeof started !== 'undefined' && started) refresh();
  } catch (_) { /* hors connexion ou service indisponible : on garde les taux connus */ }
}
const rateFor = code => code === 'EUR' ? 1 : (RATES && RATES.rates[code]) || BASE_RATES[code] || 1;
const fmtRate = r => r >= 100 ? Math.round(r).toLocaleString('fr-FR') : r.toLocaleString('fr-FR', { maximumFractionDigits: r < 1 ? 4 : 2 });
function rateNote() {
  if (!RATES) return 'taux indicatif';
  const d = new Date(RATES.at), today = new Date().toDateString() === d.toDateString();
  return `taux du ${today ? "jour" : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
}
/** Devises proposées dans « Autre » : les plus utiles en voyage, puis celles des pays connus. */
function curList() {
  const top = ['USD', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD', 'MAD', 'TND', 'DZD', 'THB', 'TRY'];
  const all = [...new Set([...top, ...Object.values(COUNTRIES).map(c => c.code).filter(Boolean)])].filter(c => c !== 'EUR');
  return all;
}
loadRates();
addEventListener('online', () => loadRates());

/* ---------- statistiques par catégorie ---------- */
const CAT_COL = { logement: '#2E5E3E', repas: '#F0B23C', transport: '#5B8DB8', activites: '#B8452C', shopping: '#9C7BC4' };
function donutSVG(parts, total, label) {
  const R = 52, W = 16, L = 2 * Math.PI * R; let off = 0;
  const arcs = parts.filter(p => p.v > 0).map(p => { const len = p.v / total * L, gap = parts.filter(x => x.v > 0).length > 1 ? 2 : 0;
    const a = `<circle r="${R}" cx="70" cy="70" fill="none" stroke="${p.col}" stroke-width="${W}" stroke-dasharray="${Math.max(0, len - gap)} ${L}" stroke-dashoffset="${-off}" transform="rotate(-90 70 70)"><title>${esc(p.n)} : ${fmt(p.v)}</title></circle>`; off += len; return a; }).join('');
  return `<svg class="st-donut" viewBox="0 0 140 140" role="img" aria-label="${esc(label)}"><circle r="${R}" cx="70" cy="70" fill="none" stroke="var(--gray)" stroke-width="${W}"/>${arcs}
    <text x="70" y="66" text-anchor="middle" class="dv">${fmt(total)}</text><text x="70" y="84" text-anchor="middle" class="dl">ta part</text></svg>`;
}
function statsHTML(t) {
  const c = catsOf(t), total = Object.values(c).reduce((a, b) => a + b, 0);
  if (!total) return `<div class="sec"><h2>Statistiques</h2></div><div class="st-box empty"><p class="small">Les graphiques apparaîtront dès ta première dépense.</p></div>`;
  const parts = Object.keys(CATS).map(k => ({ k, n: CATS[k].n, v: c[k], col: CAT_COL[k] })).sort((a, b) => b.v - a.v);
  const d = daysOf(t), max = Math.max(...d, 1), f = info(t), avg = d.reduce((a, b) => a + b, 0) / Math.max(1, d.filter((v, i) => i < (f.jour || f.jours)).length);
  const bars = d.length > 1 ? `<div class="sec st-sub"><h3>Par jour, hors logement</h3><span class="small num">moyenne ${fmt(avg)}</span></div>
    <div class="st-bars" style="--n:${d.length}">${d.map((v, i) => `<div class="st-bar" title="Jour ${i + 1} : ${fmt(v)}"><i style="height:${Math.max(2, v / max * 100)}%" class="${v > avg * 1.4 ? 'hi' : ''}"></i><span>${d.length <= 16 || i % Math.ceil(d.length / 12) === 0 ? i + 1 : ''}</span></div>`).join('')}</div>` : '';
  return `<div class="sec"><h2>Statistiques</h2><span class="small">en euros</span></div>
   <div class="st-box"><div class="st-row">${donutSVG(parts, total, 'Répartition des dépenses par catégorie')}
     <ul class="st-leg">${parts.map(p => `<li><i style="background:${p.col}"></i><span>${p.n}</span><b class="num">${Math.round(p.v / total * 100)} %</b><em class="num">${fmt(p.v)}</em></li>`).join('')}</ul></div>${bars}</div>`;
}

/* ---------- comptes entre amis ---------- */
const memberName = (t, id) => id === 'me' ? 'Moi' : ((t.membres || []).find(m => m.id === id) || { n: 'Ancien membre' }).n;
function balances(t) {
  const ids = ['me', ...(t.membres || []).map(m => m.id)], bal = Object.fromEntries(ids.map(i => [i, 0])); let group = 0;
  t.depenses.forEach(d => { const by = d.by || 'me', sp = d.split && d.split.length ? d.split : (by !== 'me' ? ['me'] : null); if (!sp) return;
    group += d.eur; if (by in bal) bal[by] += d.eur; sp.forEach(i => { if (i in bal) bal[i] -= d.eur / sp.length; }); });
  (t.reglements || []).forEach(r => { if (r.from in bal) bal[r.from] += r.eur; if (r.to in bal) bal[r.to] -= r.eur; });
  return { bal, group };
}
/** Le moins de remboursements possible pour que tout le monde soit quitte. */
function transfers(bal) {
  const deb = Object.entries(bal).filter(([, v]) => v < -0.005).map(([i, v]) => [i, -v]).sort((a, b) => b[1] - a[1]);
  const cre = Object.entries(bal).filter(([, v]) => v > 0.005).map(([i, v]) => [i, v]).sort((a, b) => b[1] - a[1]);
  const out = []; let a = 0, b = 0;
  while (a < deb.length && b < cre.length) { const m = Math.min(deb[a][1], cre[b][1]); if (m >= 0.01) out.push({ from: deb[a][0], to: cre[b][0], eur: Math.round(m * 100) / 100 });
    deb[a][1] -= m; cre[b][1] -= m; if (deb[a][1] < 0.005) a++; if (cre[b][1] < 0.005) b++; }
  return out;
}
function comptesHTML(t) {
  const M = t.membres || [];
  if (!M.length) return `<div class="emptycard tc"><b>Voyage entre amis ?</b><p>Ajoute les personnes qui partent avec toi. Tu noteras qui a payé quoi et pour qui, et Escale calcule qui doit combien à qui.</p><button class="btn2 g wide" data-act="members" data-trip="${t.id}">${SV.userPlus}Ajouter des amis</button></div>`;
  const { bal, group } = balances(t), tr = transfers(bal), shared = t.depenses.filter(d => d.split || (d.by && d.by !== 'me')).slice().sort((a, b) => b.j - a.j);
  return `<div class="sec"><h2>Participants</h2><button class="more" data-act="members" data-trip="${t.id}">Gérer</button></div>
   <div class="tc-who">${['me', ...M.map(m => m.id)].map(id => { const v = bal[id] || 0; return `<div class="tc-wb"><span class="av">${esc(memberName(t, id).slice(0, 1).toUpperCase())}</span><b>${esc(memberName(t, id))}</b><em class="num ${v > 0.005 ? 'pos' : v < -0.005 ? 'neg' : ''}">${v > 0.005 ? '+ ' : v < -0.005 ? '− ' : ''}${fmt(Math.abs(v))}</em></div>`; }).join('')}</div>
   <p class="small">Dépenses communes : <b class="num">${fmt(group)}</b>. En vert, ce qu'on doit à la personne, en rouge ce qu'elle doit.</p>
   <div class="sec"><h2>Pour être quittes</h2></div>
   ${tr.length ? `<div class="group">${tr.map(x => `<div class="tc-row"><span>${x.from === 'me' ? `Tu dois <b class="num">${fmt(x.eur)}</b> à <b>${esc(memberName(t, x.to))}</b>` : x.to === 'me' ? `<b>${esc(memberName(t, x.from))}</b> te doit <b class="num">${fmt(x.eur)}</b>` : `<b>${esc(memberName(t, x.from))}</b> doit <b class="num">${fmt(x.eur)}</b> à <b>${esc(memberName(t, x.to))}</b>`}</span><button class="pill" data-act="settle" data-trip="${t.id}" data-from="${x.from}" data-to="${x.to}" data-eur="${x.eur}">Remboursé</button></div>`).join('')}</div>`
     : `<div class="emptyj">Tout le monde est quitte.</div>`}
   <div class="sec"><h2>Dépenses partagées</h2><button class="pill dark" data-act="addExp" data-trip="${t.id}">${SV.plus}Dépense</button></div>
   <div class="group dexp">${shared.map(d => `<button class="exp" data-act="editExp" data-trip="${t.id}" data-id="${d.id}"><span class="ic">${ico(d.c)}</span><span class="m"><b>${esc(d.l)}</b><span>${esc(memberName(t, d.by || 'me'))} a payé pour ${d.split ? (d.split.length === M.length + 1 ? 'tout le monde' : d.split.map(i => esc(memberName(t, i))).join(', ')) : 'toi'}</span></span><span class="p num">${fmt(d.eur)}<span>ta part ${fmt(myPart(d))}</span></span></button>`).join('') || `<p class="small" style="padding:14px">Aucune dépense partagée. Quand tu ajoutes une dépense, choisis qui a payé et pour qui.</p>`}</div>
   ${(t.reglements || []).length ? `<div class="sec"><h2>Remboursements</h2></div><div class="group">${t.reglements.slice().reverse().map(r => `<div class="tc-row done"><span>${esc(memberName(t, r.from))} a remboursé <b class="num">${fmt(r.eur)}</b> à ${esc(memberName(t, r.to))}</span><button class="link" data-act="unsettle" data-trip="${t.id}" data-id="${r.id}">Annuler</button></div>`).join('')}</div>` : ''}`;
}
function membersSheet(tid) {
  const t = trip(tid); t.membres = t.membres || [];
  const draw = p => { p.querySelector('#m-list').innerHTML = t.membres.map(m => { const used = t.depenses.some(d => d.by === m.id || (d.split || []).includes(m.id));
      return `<div class="mrow"><span class="av">${esc(m.n.slice(0, 1).toUpperCase())}</span><input value="${esc(m.n)}" maxlength="30" data-id="${m.id}" aria-label="Prénom"><button type="button" class="x" data-rm="${m.id}" ${used ? 'disabled title="Utilisé dans des dépenses"' : ''} aria-label="Retirer">${SV.x}</button></div>`; }).join('') || '<p class="small">Personne pour l\'instant.</p>';
    p.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { t.membres = t.membres.filter(m => m.id !== b.dataset.rm); draw(p); });
    p.querySelectorAll('#m-list input').forEach(i => i.oninput = () => { const m = t.membres.find(x => x.id === i.dataset.id); if (m) m.n = i.value.trim().slice(0, 30) || m.n; }); };
  openPanel(`<h2>Qui part avec toi ?</h2><p class="small">${esc(place(t))}. Ajoute juste un prénom : tes amis n'ont pas besoin d'avoir Escale. Leurs noms restent dans ton carnet privé.</p>
   <div id="m-list" class="mlist"></div>
   <form class="madd" id="m-form"><input id="m-new" maxlength="30" placeholder="Prénom, ex. Léa" autocomplete="off"><button class="pill dark" type="submit">${SV.plus}Ajouter</button></form>
   <button class="btn full" id="m-ok">Enregistrer<i>${SV.arrow}</i></button>${CLOSE()}`, p => {
    draw(p);
    p.querySelector('#m-form').onsubmit = e => { e.preventDefault(); const i = p.querySelector('#m-new'), n = i.value.trim().slice(0, 30); if (!n) return;
      if (t.membres.length >= 20) { toast('20 personnes maximum'); return; }
      if (n.toLowerCase() === 'moi' || t.membres.some(m => m.n.toLowerCase() === n.toLowerCase())) { toast('Ce prénom est déjà dans la liste'); return; }
      t.membres.push({ id: uid().slice(0, 8), n }); i.value = ''; draw(p); i.focus(); };
    p.querySelector('#m-ok').onclick = () => { const i = p.querySelector('#m-new'); if (i.value.trim()) p.querySelector('#m-form').requestSubmit(); save(); closePanel(); dTab = 'comptes'; if (current === 'carnet' && openId === t.id) openTrip(t.id, true); else openTrip(t.id); toast('Participants enregistrés'); };
  });
}
ACT.members = d => membersSheet(d.trip);
ACT.settle = d => { const t = trip(d.trip); t.reglements = t.reglements || []; t.reglements.push({ id: uid().slice(0, 8), from: d.from, to: d.to, eur: +d.eur, at: new Date().toISOString().slice(0, 10) }); save(); refresh(); toast(`${memberName(t, d.from)} a remboursé ${fmt(+d.eur)}`); };
ACT.unsettle = d => { const t = trip(d.trip); t.reglements = (t.reglements || []).filter(r => r.id !== d.id); save(); refresh(); toast('Remboursement annulé'); };
['members'].forEach(k => { const f = ACT[k]; ACT[k] = fromPanel(f); });
