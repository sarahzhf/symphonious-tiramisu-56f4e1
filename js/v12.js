/* Escale v1.2 : budget dans chaque carnet, écran « Mes dépenses » avec filtres par mois et par dates,
 * raccourcis de l'accueil, filtres des voyages, légende de la carte, scan de ticket, contact. */
'use strict';
SV.scan = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><path d="M8.5 7.5h7v9l-1.2-.8-1.2.8-1.1-.8-1.1.8-1.2-.8-1.2.8z"/><path d="M10.5 10.5h3M10.5 13h3"/></svg>';
SV.mail = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M4 7l8 6 8-6"/></svg>';
SV.mapI = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"><path d="M9 5L3.5 7v12.5L9 17.5l6 2 5.5-2V5L15 7z"/><path d="M9 5v12.5M15 7v12.5"/></svg>';
const CONTACT = 'hello.escale.app@gmail.com';
const isPro = () => !!(typeof PRO !== 'undefined' && PRO);
let PRO = false;
async function loadPro() { try { const { data } = await sb.from('pro_members').select('until').eq('user_id', ME.id).maybeSingle(); PRO = !!(data && (!data.until || data.until >= TODAY)); } catch (_) { } }

/* ---------- filtres de dates ---------- */
let DF = { m: null, from: null, to: null };
const expDate = (t, d) => addDays(t.du, d.j - 1);
const passDF = date => (!DF.m || date.slice(0, 7) === DF.m) && (!DF.from || date >= DF.from) && (!DF.to || date <= DF.to);
const monthName = m => { const s = new Date(m + '-15').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }); return s[0].toUpperCase() + s.slice(1); };
function filterBar(dates) {
  const months = [...new Set(dates.map(x => x.slice(0, 7)))].sort().reverse();
  const range = DF.from || DF.to;
  return `<div class="dfbar">${months.length > 1 || DF.m ? `<button class="${!DF.m && !range ? 'on' : ''}" data-act="dfMonth" data-m="">Tout</button>${months.map(m => `<button class="${DF.m === m ? 'on' : ''}" data-act="dfMonth" data-m="${m}">${monthName(m)}</button>`).join('')}` : ''}
    <button class="dates ${range ? 'on' : ''}" data-act="dfDates">${SV.cal}${range ? `${DF.from ? fd(DF.from) : '…'} au ${DF.to ? fd(DF.to) : '…'}` : 'Choisir des dates'}</button>${range ? `<button class="clr" data-act="dfClear" aria-label="Effacer les dates">${SV.x}</button>` : ''}</div>`;
}
ACT.dfMonth = d => { DF = { m: d.m || null, from: null, to: null }; refresh(); };
ACT.dfClear = () => { DF = { m: null, from: null, to: null }; refresh(); };
ACT.dfDates = () => openPanel(`<h2>Filtrer par dates</h2><p class="small">Affiche seulement les dépenses entre ces deux jours.</p>
  <div class="two"><label class="fld"><span>Du</span><input id="df-a" type="date" value="${DF.from || ''}"></label><label class="fld"><span>Au</span><input id="df-b" type="date" value="${DF.to || ''}"></label></div>
  <button class="btn full" id="df-ok">Appliquer<i>${SV.arrow}</i></button>${CLOSE()}`, p => {
  p.querySelector('#df-ok').onclick = () => { const a = p.querySelector('#df-a').value || null, b = p.querySelector('#df-b').value || null;
    if (a && b && b < a) { toast('La fin doit suivre le début'); return; } DF = { m: null, from: a, to: b }; closePanel(); refresh(); };
}, { nofocus: true });

const expRow = (t, d, withTrip) => `<button class="exp" data-act="editExp" data-trip="${t.id}" data-id="${d.id}"><span class="ic">${ico(d.c)}</span><span class="m"><b>${esc(d.l)}</b><span>${withTrip ? esc(short(t)) + ', ' : ''}${CATS[d.c].n}${d.split || (d.by && d.by !== 'me') ? `, payé par ${esc(memberName(t, d.by || 'me'))}${d.split ? `, ta part ${fmt(myPart(d))}` : ''}` : ''}</span></span><span class="p num">${fmt(d.split ? myPart(d) : d.eur)}${d.v != null ? `<span>${fmtD(d, t)}</span>` : d.split ? `<span>sur ${fmt(d.eur)}</span>` : ''}</span>${PENDING.has(d.id) ? `<em class="pend" title="En attente d'envoi">${SV.cloudOff}</em>` : ''}</button>`;
function byDateHTML(items, withTrip) {
  const g = {}; items.forEach(x => (g[x.date] = g[x.date] || []).push(x));
  return Object.keys(g).sort().reverse().map(dt => { const L = g[dt], tot = L.reduce((a, x) => a + myPart(x.d), 0);
    return `<div class="dayh"><span>${new Date(dt + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}${!withTrip ? `, jour ${L[0].d.j}` : ''}</span><span class="num">${fmt(tot)}</span></div><div class="group">${L.map(x => expRow(x.t, x.d, withTrip)).join('')}</div>`; }).join('');
}

/* ---------- budget d'un voyage (onglet du carnet) ---------- */
function tripBudgetHTML(t) {
  const f = info(t), c = catsOf(t), s = spentOf(t), b = budgetsOf(t), left = t.budget - s, remDays = f.enCours ? f.jours - f.jour + 1 : f.futur ? f.jours : 0, per = remDays ? left / remDays : 0, p = projection(t), loc = C(t).rate !== 1;
  const all = t.depenses.map(d => ({ t, d, date: expDate(t, d) })), list = all.filter(x => (!catF || x.d.c === catF) && passDF(x.date));
  return `<div class="flipcard"><div class="inner">
     <div class="face a"><div class="top"><span>${f.futur ? 'Budget du voyage' : f.enCours ? `Il te reste, jour ${f.jour} sur ${f.jours}` : 'Bilan du voyage'}</span>${loc ? `<button class="swap" data-act="flip">Voir en ${esc(C(t).cur)}</button>` : ''}</div>
       <p class="big num">${fmt(f.enCours || f.futur ? left : s)}</p>
       <div class="track"><i style="width:${pct(s, t.budget)}%"></i>${f.enCours ? `<u style="left:${f.jour / f.jours * 100}%"></u>` : ''}</div>
       <div class="row num"><span>${fmt(s)} dépensés</span><span>sur ${fmt(t.budget)}</span></div>
       <div class="pills">${f.enCours || f.futur ? `<div class="s"><b class="num">${fmt(per)}</b><span>par jour ${f.futur ? 'sur place' : "jusqu'au retour"}</span></div><div><b class="num">${remDays} jours</b><span>${f.futur ? 'de voyage' : 'restants'}</span></div>` : `<div class="s"><b class="num">${fmt(s / f.jours)}</b><span>par jour en moyenne</span></div><div><b class="num">${s - t.budget > 0 ? '+ ' : '− '}${fmt(Math.abs(s - t.budget))}</b><span>par rapport au budget</span></div>`}</div>
       ${p.worst ? `<div class="warn">${SV.warn || '!'}<span>Au rythme actuel, <b>${CATS[p.worst.k].n.toLowerCase()}</b> finira vers ${fmt(p.worst.proj)} pour ${fmt(b[p.worst.k])} prévus.</span></div>` : ''}
       <div class="actions"><button class="pill" data-act="budget" data-trip="${t.id}">Modifier le budget</button></div></div>
     ${loc ? `<div class="face b"><div class="top"><span>En monnaie locale, 1 € = ${fmtRate(C(t).rate)} ${esc(C(t).cur)} (${rateNote()})</span><button class="swap" data-act="flip">Voir en euros</button></div>
       <p class="big num">${fmtL((f.enCours || f.futur ? left : s) * C(t).rate, t)}</p>
       <div class="pills"><div><b class="num">${fmtL(per * C(t).rate, t)}</b><span>par jour</span></div><div><b class="num">${fmtL(s * C(t).rate, t)}</b><span>déjà dépensés</span></div></div></div>` : ''}
   </div></div>
   ${statsHTML(t)}
   <div class="sec"><h2>Par catégorie</h2><span class="small">${catF ? 'filtre actif' : 'touche pour filtrer'}</span></div><div class="group">
   ${Object.keys(CATS).map(k => `<button class="cat ${catF === k ? 'on' : ''}" data-act="catFilter" data-k="${k}"><span class="ic">${ico(k)}</span><span><span class="n"><span>${CATS[k].n}</span><em class="num">sur ${fmt(b[k])}</em></span><span class="mb"><i class="${c[k] > b[k] ? 'over' : ''}" style="width:${pct(c[k], b[k])}%"></i></span></span><span class="v num">${fmt(c[k])}</span></button>`).join('')}</div>
   <div class="sec"><h2>${list.length} dépense${list.length > 1 ? 's' : ''}</h2>${catF || DF.m || DF.from || DF.to ? `<button class="link" data-act="dfAll">Tout afficher</button>` : `<button class="pill dark" data-act="addExp" data-trip="${t.id}">${SV.plus}Dépense</button>`}</div>
   ${all.length ? filterBar(all.map(x => x.date)) : ''}
   ${list.length ? byDateHTML(list, false) : `<div class="emptyj">Aucune dépense ${catF || DF.m || DF.from ? 'pour ce filtre' : 'pour ce voyage'}.<br><button class="pill dark" style="margin-top:12px" data-act="addExp" data-trip="${t.id}">${SV.plus}Ajouter une dépense</button></div>`}`;
}
ACT.dfAll = () => { catF = null; DF = { m: null, from: null, to: null }; refresh(); };

/* ---------- toutes mes dépenses (accueil) ---------- */
let gTrip = null;
function renderDepenses(keep) {
  const sc = $('s-depenses'), y = keep ? sc.scrollTop : 0;
  if (!S.trips.length) { sc.innerHTML = `<div class="navrow"><button class="iconbtn" data-act="back" aria-label="Retour">${SV.back}</button></div><h1 class="bigtitle sans">Mes dépenses</h1><div class="emptycard"><b>Aucun voyage pour l'instant</b><p>Crée un voyage pour suivre tes dépenses.</p><button class="btn2 g wide" data-act="newTrip">${SV.plus}Créer un voyage</button></div>`; return; }
  if (gTrip && !trip(gTrip)) gTrip = null;
  const all = S.trips.filter(t => !gTrip || t.id === gTrip).flatMap(t => t.depenses.map(d => ({ t, d, date: expDate(t, d) })));
  const inDates = all.filter(x => passDF(x.date)), list = inDates.filter(x => !catF || x.d.c === catF);
  const tot = list.reduce((a, x) => a + myPart(x.d), 0), cats = {}; Object.keys(CATS).forEach(k => cats[k] = 0); inDates.forEach(x => cats[x.d.c] += myPart(x.d));
  const mx = Math.max(1, ...Object.values(cats)), ndays = new Set(list.map(x => x.date)).size;
  sc.innerHTML = `<div class="navrow"><button class="iconbtn" data-act="back" aria-label="Retour">${SV.back}</button><button class="pill dark" data-act="addExp">${SV.plus}Dépense</button></div>
   <h1 class="bigtitle sans">Mes dépenses</h1>
   <div class="tripchips"><button class="${!gTrip ? 'on' : ''}" data-act="gTrip" data-t="">Tous les voyages</button>${sorted().map(x => `<button class="${x.id === gTrip ? 'on' : ''}" data-act="gTrip" data-t="${x.id}">${flag(x.pays)}${esc(short(x))}</button>`).join('')}</div>
   ${filterBar(all.map(x => x.date))}
   <div class="gsum"><div><b class="num">${fmt(tot)}</b><span>ta part${DF.m ? ', ' + monthName(DF.m).toLowerCase() : DF.from || DF.to ? ', sur la période' : ''}</span></div><div><b class="num">${list.length}</b><span>dépense${list.length > 1 ? 's' : ''}</span></div><div><b class="num">${fmt(ndays ? tot / ndays : 0)}</b><span>par jour de dépense</span></div></div>
   <div class="sec"><h2>Par catégorie</h2><span class="small">${catF ? 'filtre actif' : 'touche pour filtrer'}</span></div>
   <div class="group">${Object.keys(CATS).map(k => `<button class="cat ${catF === k ? 'on' : ''}" data-act="catFilter" data-k="${k}"><span class="ic">${ico(k)}</span><span><span class="n"><span>${CATS[k].n}</span><em class="num">${inDates.length && tot ? Math.round(cats[k] / Math.max(1, Object.values(cats).reduce((a, b) => a + b, 0)) * 100) + ' %' : ''}</em></span><span class="mb"><i style="width:${cats[k] / mx * 100}%"></i></span></span><span class="v num">${fmt(cats[k])}</span></button>`).join('')}</div>
   <div class="sec"><h2>Le détail</h2>${catF || DF.m || DF.from || DF.to || gTrip ? `<button class="link" data-act="gAll">Tout afficher</button>` : ''}</div>
   ${list.length ? byDateHTML(list, !gTrip) : `<div class="emptyj">Aucune dépense pour ce filtre.</div>`}<div style="height:120px"></div>`;
  if (keep) sc.scrollTop = y; const on = sc.querySelector('.tripchips .on'); on && on.scrollIntoView({ inline: 'center', block: 'nearest' });
}
ACT.gTrip = d => { gTrip = d.t || null; DF = { m: null, from: null, to: null }; renderDepenses(true); };
ACT.gAll = () => { gTrip = null; catF = null; DF = { m: null, from: null, to: null }; renderDepenses(true); };

/* ---------- raccourcis de l'accueil ---------- */
function homeTiles() {
  const m = TODAY.slice(0, 7), month = S.trips.reduce((a, t) => a + t.depenses.filter(d => expDate(t, d).slice(0, 7) === m).reduce((x, d) => x + myPart(d), 0), 0);
  const nPays = new Set(S.trips.map(t => t.pays)).size;
  return `<div class="tiles">
    <button class="tile t-ia" data-act="go" data-to="ia"><i>${SV.spark}</i><b>Assistant</b><span>Pose une question sur tes voyages et ton budget</span></button>
    <div class="tcol"><button class="tile t-map" data-act="go" data-to="carte"><i>${SV.mapI}</i><b>Ma carte</b><span>${nPays} pays, ${S.envies.length} envie${S.envies.length > 1 ? 's' : ''}</span></button>
    <button class="tile t-dep" data-act="go" data-to="depenses"><i>${SV.wallet}</i><b>Mes dépenses</b><span class="num">${fmt(month)} ce mois-ci</span></button></div></div>`;
}

/* ---------- onglet Voyages : statut + années en défilement ---------- */
let vS = 'all', vY = 'all';
function renderCards() {
  const years = [...new Set(S.trips.map(x => D(x.du).getFullYear()))].sort((a, b) => b - a);
  if (vY !== 'all' && !years.includes(+vY)) vY = 'all';
  const days = S.trips.reduce((a, t) => a + info(t).jours, 0);
  $('s-carnets').innerHTML = `
   <div class="vtop"><button class="iconbtn" data-act="back" aria-label="Retour">${SV.back}</button><h1>Mes voyages</h1><div class="r"><button class="iconbtn" data-act="go" data-to="journal" aria-label="Journal">${SV.book}</button><button class="iconbtn" data-act="newTrip" aria-label="Nouveau voyage">${SV.plus}</button></div></div>
   <div class="vsearch">${SV.globe}<div><b>${S.trips.length} carnet${S.trips.length > 1 ? 's' : ''}, ${new Set(S.trips.map(x => x.pays)).size} pays</b><span>${days} jours de voyage, ${fmt(S.trips.reduce((a, x) => a + spentOf(x), 0))} dépensés</span></div></div>
   ${S.trips.length ? `<div class="vchips">${[['all', 'Tous'], ['cur', 'En cours'], ['fut', 'À venir'], ['past', 'Passés'], ['fav', 'Favoris']].map(([k, l]) => `<button data-act="vs" data-v="${k}" class="${vS === k ? 'on' : ''}">${l}</button>`).join('')}</div>
   ${years.length > 1 ? `<div class="ywheel" id="ywheel" aria-label="Année"><div class="yw-in">${[['all', 'Toutes les années'], ...years.map(y => [String(y), String(y)])].map(([k, l]) => `<button data-y="${k}" class="${vY === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>` : ''}` : ''}
   <div class="vlist" id="vlist"></div>`;
  renderVList();
  const w = $('ywheel'); if (!w) return;
  const pickCenter = () => { const r = w.getBoundingClientRect(), mid = r.left + r.width / 2; let best = null, bd = 1e9;
    w.querySelectorAll('button').forEach(b => { const br = b.getBoundingClientRect(), dd = Math.abs(br.left + br.width / 2 - mid); if (dd < bd) { bd = dd; best = b; } });
    if (best && best.dataset.y !== vY) { vY = best.dataset.y; w.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === best)); renderVList(); if (navigator.vibrate) try { navigator.vibrate(5); } catch (_) { } } };
  const on = w.querySelector('.on'); if (on) w.scrollLeft = on.offsetLeft - w.clientWidth / 2 + on.offsetWidth / 2;
  let tm = null; w.addEventListener('scroll', () => { clearTimeout(tm); tm = setTimeout(pickCenter, 90); }, { passive: true });
  w.querySelectorAll('button').forEach(b => b.onclick = () => w.scrollTo({ left: b.offsetLeft - w.clientWidth / 2 + b.offsetWidth / 2, behavior: REDUCED ? 'auto' : 'smooth' }));
}
function renderVList() {
  const list = sorted().filter(t => { const f = info(t); return (vS === 'all' || (vS === 'fav' && t.fav) || (vS === 'cur' && f.enCours) || (vS === 'fut' && f.futur) || (vS === 'past' && !f.enCours && !f.futur)) && (vY === 'all' || String(D(t.du).getFullYear()) === vY); });
  $('vlist').innerHTML = list.map(t => { const f = info(t), s = spentOf(t);
     return `<div class="vcard"><div style="position:relative">${phHTML(t.cover, `${t.id}|cover`, 'Ajouter une couverture')}<button class="heart ${t.fav ? 'on' : ''}" data-act="fav" data-trip="${t.id}" aria-label="Favori">${t.fav ? SV.heartF : SV.heart}</button></div>
       <button class="bd" data-open="${t.id}"><span class="l1"><b>${esc(place(t))}</b><span class="num">${SV.star}${photosCount(t)}</span></span><span class="l2">${esc(C(t).n)}, ${fd(t.du)} au ${fd(t.au)} ${D(t.du).getFullYear()}, ${f.jours} jours</span>
       <span class="l3 num">${f.futur ? `Budget <b>${fmt(t.budget)}</b>` : s <= t.budget ? `<s>${fmt(t.budget)}</s><b>${fmt(s)}</b> dépensés` : `<b>${fmt(s)}</b> dépensés, budget ${fmt(t.budget)}`}</span></button></div>`; }).join('')
    + (list.length ? '' : `<p class="small" style="padding:24px 4px">Aucun voyage pour ce filtre.</p>`)
    + `<button class="vcard new" data-act="newTrip">${SV.plus}Nouveau voyage</button>`;
}
ACT.vs = d => { vS = d.v; document.querySelectorAll('.vchips button').forEach(b => b.classList.toggle('on', b.dataset.v === d.v)); renderVList(); };

/* ---------- carte : couleurs et légende cliquable ---------- */
const MAPCOL = { c: '#2E5E3E', v: '#6FA27D', w: '#F2C46B' };
let mapShow = 'all', _wp = null;
function wishPattern(ctx) { if (_wp) return _wp; const c = document.createElement('canvas'); c.width = c.height = 8; const x = c.getContext('2d');
  x.strokeStyle = 'rgba(176,112,20,.55)'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(0, 8); x.lineTo(8, 0); x.moveTo(-2, 2); x.lineTo(2, -2); x.moveTo(6, 10); x.lineTo(10, 6); x.stroke(); return (_wp = ctx.createPattern(c, 'repeat')); }
function mapLegend() {
  const nv = new Set(S.trips.map(t => t.pays)).size, nw = S.envies.length, cur = currentTrip();
  return `<div class="mlegend" role="tablist" aria-label="Afficher">
    <button class="${mapShow === 'all' ? 'on' : ''}" data-act="mapShow" data-v="all">Tout</button>
    <button class="${mapShow === 'v' ? 'on' : ''}" data-act="mapShow" data-v="v"><i class="v"></i>Visités <b class="num">${nv}</b></button>
    <button class="${mapShow === 'w' ? 'on' : ''}" data-act="mapShow" data-v="w"><i class="w"></i>Envies <b class="num">${nw}</b></button>
    ${cur ? `<span class="cur"><i class="c"></i>En cours</span>` : ''}</div>`;
}
ACT.mapShow = d => { mapShow = d.v; $('s-carte').dataset.show = d.v; document.querySelectorAll('.mlegend button').forEach(b => b.classList.toggle('on', b.dataset.v === d.v)); };

/* ---------- scan de ticket ---------- */
let scanCb = null;
function scanTicket(p, cb) { scanCb = cb; const i = $('scanfile'); i.value = ''; i.click(); }
$('scanfile').addEventListener('change', async e => {
  const f = e.target.files[0], cb = scanCb; if (!f || !cb) return;
  const btn = document.querySelector('#e-scan'); if (btn) { btn.classList.add('busy'); btn.querySelector('em').textContent = 'Lecture du ticket…'; }
  try {
    const img = await shrink(f, isPro() ? 1600 : 2000);
    let r = null;
    if (isPro() && navigator.onLine) { try { r = await scanAI(img); } catch (err) { console.warn('scan IA', err); } }
    if (!r) r = parseReceipt(await ocrLocal(img));
    if (!r.amount && !r.date) toast('Ticket difficile à lire, complète à la main'); else { cb(r); toast(`Ticket lu${r.amount ? ' : ' + r.amount + (r.currency ? ' ' + r.currency : '') : ''}, vérifie avant d'ajouter`); }
  } catch (err) { console.warn(err); toast('Lecture impossible, complète à la main'); }
  finally { if (btn) { btn.classList.remove('busy'); btn.querySelector('em').textContent = isPro() ? 'Lecture par l’IA, montant, date et commerce' : 'Remplit le montant et la date'; } }
});
async function shrink(file, max) {
  const im = await new Promise((res, rej) => { const i = new Image(), u = URL.createObjectURL(file); i.onload = () => { URL.revokeObjectURL(u); res(i); }; i.onerror = rej; i.src = u; });
  const k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
  const x = c.getContext('2d'); x.filter = 'grayscale(1) contrast(1.35)'; x.drawImage(im, 0, 0, c.width, c.height); return c;
}
let OCR = null;
async function ocrLocal(canvas) {
  if (!window.Tesseract) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'vendor/tesseract/tesseract.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  if (!OCR) OCR = await Tesseract.createWorker('fra', 1, { workerPath: 'vendor/tesseract/worker.min.js', corePath: 'vendor/tesseract/', langPath: 'vendor/tesseract/lang', gzip: false, workerBlobURL: false, cacheMethod: 'none' });
  const { data } = await OCR.recognize(canvas); return data.text || '';
}
/** Trouve le total, la date et le commerce dans le texte d'un ticket. */
function parseReceipt(txt) {
  const lines = txt.split(/\n/).map(l => l.trim()).filter(Boolean), num = s => { const m = s.replace(/\s/g, '').replace(/[oO](?=\d)|(?<=\d)[oO]/g, '0').match(/(\d{1,6})[.,](\d{2})(?!\d)/g); return m ? m.map(x => +x.replace(',', '.')) : []; };
  let amount = null;
  for (const re of [/(total\s*(ttc|à payer|a payer|eur|€)?|montant\s*(ttc|dû|du)?|net\s*à\s*payer|à\s*payer|carte|cb|amount|tota)/i]) {
    for (let i = lines.length - 1; i >= 0 && !amount; i--) if (re.test(lines[i]) && !/sous[- ]?total|tva|hors|ht\b/i.test(lines[i])) { const n = num(lines[i]).concat(lines[i + 1] ? num(lines[i + 1]) : []); if (n.length) amount = Math.max(...n); }
  }
  if (!amount) { const all = lines.flatMap(num).filter(n => n < 100000); if (all.length) amount = Math.max(...all); }
  let date = null; const dm = txt.match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/) || null, iso = txt.match(/(20\d{2})[\/.\-](\d{1,2})[\/.\-](\d{1,2})/);
  if (iso) date = `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  else if (dm) { let y = dm[3]; if (y.length === 2) y = '20' + y; const d = +dm[1], m = +dm[2]; if (d <= 31 && m <= 12) date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }
  const currency = /€|eur\b/i.test(txt) ? 'EUR' : /\$|usd/i.test(txt) ? 'USD' : /£|gbp/i.test(txt) ? 'GBP' : /\bdh\b|mad/i.test(txt) ? 'MAD' : /chf/i.test(txt) ? 'CHF' : null;
  const merchant = (lines.find(l => /[a-zà-ÿ]{3,}/i.test(l) && !/ticket|facture|bienvenue|merci|tel|siret|tva/i.test(l)) || '').replace(/[^\p{L}\p{N}' &.-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
  const low = txt.toLowerCase().replace(/merci de votre visite|a bientot|à bientôt/g, ''), has = re => re.test(low);
  const category = has(/h[oô]tel|airbnb|riad|hostel|auberge|booking/) ? 'logement' : has(/restaurant|resto|caf[eé]|boulangerie|pizz|\bbar\b|brasserie|menu|boisson|snack|croissant|sandwich/) ? 'repas' : has(/taxi|uber|sncf|\btrain|m[eé]tro|\bbus\b|essence|carburant|gazole|parking|p[eé]age/) ? 'transport' : has(/mus[eé]e|billet|entr[eé]e|\bvisite|excursion|\bspa\b|hammam/) ? 'activites' : has(/boutique|magasin|souvenir|v[eê]tement|pharmacie/) ? 'shopping' : null;
  return { amount: amount ? Math.round(amount * 100) / 100 : null, date, currency, merchant: merchant || null, category };
}
async function scanAI(canvas) {
  const b64 = canvas.toDataURL('image/jpeg', .8).split(',')[1];
  const { data, error } = await sb.functions.invoke('scan-ticket', { body: { image: b64 } });
  if (error || !data) throw error || new Error('vide'); return data;
}

/* ---------- nous contacter ---------- */
ACT.contact = () => openPanel(`<h2>Nous contacter</h2><p class="small">Une question, un souci ou une idée pour Escale ? Écris-nous à <b>${CONTACT}</b>, on répond sous 48 h.</p>
  <div class="menulist">${[['Une question', 'Question'], ['Signaler un problème', 'Problème'], ['Proposer une idée', 'Idée']].map(([l, s]) => `<a href="mailto:${CONTACT}?subject=${encodeURIComponent('Escale : ' + s)}&body=${encodeURIComponent('\n\n---\nVersion : ' + (CFG.appVersion || '1.2') + '\nAppareil : ' + navigator.userAgent.slice(0, 120))}">${SV.mail}${l}</a>`).join('')}</div>
  <button class="ghostbtn" id="ct-copy">Copier l'adresse</button>${CLOSE('Fermer')}`, p => { p.querySelector('#ct-copy').onclick = () => copyText(CONTACT, 'Adresse copiée'); }, { nofocus: true });
SCREENS.carnets = renderCards;
