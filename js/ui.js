/* Escale : interface principale (voyages, dépenses, journal, carte, assistant). */
'use strict';

/* ---------- calculs ---------- */
const fmt = n => Math.round(n || 0).toLocaleString('fr-FR') + ' €';
const C = t => COUNTRIES[t.pays] || COUNTRIES.FR;
/** Nom affiché d'un voyage : la ville si elle est renseignée, sinon le pays (roadtrip). */
const place = t => (t && t.ville) || C(t).n;
const fmtL = (n, t) => Math.round(n).toLocaleString('fr-FR') + ' ' + C(t).cur;
const trip = id => S.trips.find(t => t.id === id);
const sorted = () => S.trips.slice().sort((a, b) => D(b.du) - D(a.du));
const currentTrip = () => S.trips.find(t => info(t).enCours) || null;
function budgetsOf(t) { if (t.budgets) return t.budgets; const b = {}; Object.keys(CATS).forEach(k => b[k] = Math.round(t.budget * CATS[k].pct)); return b; }
function catsOf(t) { const c = {}; Object.keys(CATS).forEach(k => c[k] = 0); t.depenses.forEach(d => c[d.c] += myPart(d)); return c; }
const spentOf = t => Object.values(catsOf(t)).reduce((a, b) => a + b, 0);
function daysOf(t) { const n = Math.max(1, info(t).jour || info(t).jours), a = Array(n).fill(0); t.depenses.forEach(d => { if (d.c !== 'logement' && d.j <= n) a[d.j - 1] += myPart(d); }); return a; }
function projection(t) { const f = info(t); if (!f.enCours) return {}; const c = catsOf(t), b = budgetsOf(t); let worst = null;
  Object.keys(CATS).forEach(k => { if (k === 'logement') return; const proj = c[k] / f.jour * f.jours, over = proj - b[k]; if (over > 0 && (!worst || over > worst.over)) worst = { k, proj, over }; }); return { worst }; }
function noteFor(t) {
  const f = info(t), c = catsOf(t), s = spentOf(t);
  if (s === 0) return 'Ajoute tes premières dépenses : je te dirai où part ton argent et si tu tiens ton budget.';
  if (f.enCours) { const p = projection(t); return p.worst ? `Au rythme actuel, le poste ${CATS[p.worst.k].n.toLowerCase()} finira autour de ${fmt(p.worst.proj)} pour ${fmt(budgetsOf(t)[p.worst.k])} prévus. Le reste suit le budget.` : 'Toutes les catégories suivent le budget pour l’instant.'; }
  if (f.futur) return 'Le voyage n’a pas encore commencé.';
  const diff = s - t.budget, pct = t.budget ? Math.round(Math.abs(diff) / t.budget * 100) : 0, big = Object.entries(c).filter(([k]) => k !== 'logement').sort((a, b) => b[1] - a[1])[0];
  return diff <= 0 ? `Voyage bouclé ${pct} % sous le budget. Hors logement, ton plus gros poste a été ${CATS[big[0]].n.toLowerCase()} (${fmt(big[1])}).` : `Dépassement de ${fmt(diff)}, soit ${pct} %. Le logement pèse ${Math.round(c.logement / s * 100)} % du total.`;
}
const caps = s => s.toUpperCase();
const photosCount = t => (t.cover ? 1 : 0) + t.entrees.reduce((a, e) => a + e.photos.filter(Boolean).length, 0);
const short = t => place(t).split(' et ')[0];
/** Ta part d'une dépense : tout si elle n'est pas partagée, sinon ta part du partage. */
const myPart = d => !d.split || !d.split.length ? (d.by && d.by !== 'me' ? 0 : d.eur) : d.split.includes('me') ? d.eur / d.split.length : 0;
/** Montant en devise affiché pour une dépense (devise du pays ou autre devise choisie). */
const fmtD = (d, t) => d.cur ? (Math.round(d.v * 100) / 100).toLocaleString('fr-FR') + ' ' + d.cur : fmtL(d.v, t);
const pct = (a, b) => b ? Math.min(100, a / b * 100) : 0;

/* ---------- photos ---------- */
let photoTarget = null;
function phHTML(src, target, label = 'Ajouter une photo') {
  return `<div class="ph ${src ? 'has' : ''}">${src ? IMG(src) : ''}<button class="add" data-photo="${esc(target)}" aria-label="${esc(label)}">${SV.cam}<span>${esc(label)}</span></button>${src ? `<button class="rm" data-rmphoto="${esc(target)}" aria-label="Retirer la photo">${SV.x}</button>` : ''}</div>`;
}
function getPhoto(target) { const [id, kind, ei, pi] = target.split('|'); const t = trip(id); if (!t) return null; if (kind === 'cover') return t.cover; const e = t.entrees.find(x => x.id === ei); return e ? e.photos[+pi] : null; }
function setPhoto(target, val) {
  const [id, kind, ei, pi] = target.split('|'); const t = trip(id); if (!t) return;
  const old = getPhoto(target); if (old && old !== val) releaseMedia(old);
  if (kind === 'cover') t.cover = val; else { const e = t.entrees.find(x => x.id === ei); if (e) e.photos[+pi] = val; }
}
const kindOf = target => target.startsWith('me|') ? target.split('|')[1] : target.startsWith('compose|') || target.startsWith('chal|') ? 'post' : target.split('|')[1] === 'cover' ? 'trip' : 'journal';
function pickPhoto(target) { photoTarget = target; $('file').value = ''; $('file').click(); }
$('file').addEventListener('change', async e => {
  const f = e.target.files[0], target = photoTarget; if (!f || !target) return;
  toast('Envoi de la photo…');
  try { const path = await uploadPhoto(f, kindOf(target)); await onPhoto(target, path); }
  catch (err) { toast(errMsg(err)); }
});
async function onPhoto(target, path) { setPhoto(target, path); save(); refresh(); toast('Photo ajoutée'); }

/* ---------- clics ---------- */
document.addEventListener('click', e => {
  const p = e.target.closest('[data-photo]'); if (p) { e.stopPropagation(); pickPhoto(p.dataset.photo); return; }
  const r = e.target.closest('[data-rmphoto]'); if (r) { e.stopPropagation(); setPhoto(r.dataset.rmphoto, null); save(); refresh(); toast('Photo retirée'); return; }
  const a = e.target.closest('[data-act]'); if (a) { e.stopPropagation(); const f = ACT[a.dataset.act]; if (f) Promise.resolve(f(a.dataset, a, e)).catch(err => { console.warn(err); toast(errMsg(err)); }); return; }
  const o = e.target.closest('[data-open]'); if (o) { openTrip(o.dataset.open); return; }
  const g = e.target.closest('[data-go]'); if (g) { go(g.dataset.go); return; }
  const cl = e.target.closest('[data-close]'); if (cl) { closePanel(); return; }
}, true);
const ACT = {
  newTrip: () => tripSheet(), addExp: d => expSheet(d.trip || (currentTrip() || sorted()[0]).id, null, !d.trip), addPage: d => pageSheet(d.trip || (currentTrip() || sorted()[0]).id),
  addWish: () => wishSheet(),
  rmWish: d => { S.envies = S.envies.filter(w => w.id !== d.id); save(); refresh(); toast('Envie retirée'); },
  go: d => go(d.to), back: () => go(prev && prev !== current ? prev : 'home'),
  editTrip: d => tripSheet(d.trip), budget: d => budgetSheet(d.trip), pageMenu: d => pageMenu(d.trip, d.entry),
  addSlot: d => { const t = trip(d.trip), e = t.entrees.find(x => x.id === d.entry); if (e.photos.length < 6) { e.photos.push(null); save(); refresh(); } },
  addPlace: d => placeInput(d.trip),
  rmPlace: d => { const t = trip(d.trip), l = t.lieux[+d.i]; t.lieux.splice(+d.i, 1); save(); refresh(); if (l) toast(`${l} retiré des lieux`); },
  fav: d => { const t = trip(d.trip); t.fav = !t.fav; save(); refresh(); toast(t.fav ? 'Ajouté aux favoris' : 'Retiré des favoris'); },
  share: d => { const t = trip(d.trip), txt = `${place(t)}, ${fd(t.du)} au ${fd(t.au)} : ${fmt(spentOf(t))} pour ${info(t).jours} jours.`; copyText(txt, 'Résumé du carnet copié'); },
  depTrip: d => { dTab = 'depenses'; openTrip(d.trip); }, editExp: d => expSheet(d.trip, d.id),
  catFilter: d => { catF = catF === d.k ? null : d.k; refresh(); },
  flip: (d, a) => a.closest('.flipcard').classList.toggle('on'), ask: d => { go('ia'); ask(d.q); },
};
function copyText(txt, ok) { try { navigator.clipboard.writeText(txt).then(() => toast(ok), () => toast('Copie impossible sur cet appareil')); } catch (e) { toast('Copie impossible sur cet appareil'); } }
const fromPanel = fn => (d = {}) => { if ($('panel').classList.contains('open') && !d.keep) { closePanel(); setTimeout(() => fn(d), 380); } else fn(d); };

/* ---------- fenêtres ---------- */
function openPanel(html, mount, opts = {}) {
  const p = $('panel'); p.innerHTML = `<div class="grab"></div>` + html; $('scrim').hidden = false;
  requestAnimationFrame(() => p.classList.add('open')); mount && mount(p);
  if (!opts.nofocus) setTimeout(() => { const f = p.querySelector('input:not([type=checkbox]),select,textarea'); f && f.focus({ preventScroll: true }); }, 350);
}
function closePanel() { $('panel').classList.remove('open'); setTimeout(() => { if (!$('panel').classList.contains('open')) $('scrim').hidden = true; }, 350); }
$('scrim').onclick = closePanel;
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('panel').classList.contains('open')) closePanel(); });
function confirmIn(p, text, yes, label = 'Supprimer') { const old = p.querySelector('.confirm'); if (old) old.remove(); const d = document.createElement('div'); d.className = 'confirm'; d.innerHTML = `<span>${esc(text)}</span><button class="no">Annuler</button><button class="yes">${esc(label)}</button>`; p.appendChild(d); d.querySelector('.no').onclick = () => d.remove(); d.querySelector('.yes').onclick = yes; d.scrollIntoView({ block: 'nearest' }); }
const CLOSE = label => `<button class="ghostbtn" data-close>${label || 'Annuler'}</button>`;

function tripSheet(id) {
  const t = id ? trip(id) : null;
  openPanel(`<h2>${t ? 'Modifier le voyage' : 'Nouveau voyage'}</h2><p class="small">${t ? 'Change les infos de ce carnet.' : 'Un carnet se crée avec des emplacements vides pour tes photos.'} Les champs marqués <span class="req">*</span> sont obligatoires.</p>
   <label class="fld" data-f="pays"><span>Pays <span class="req">*</span></span><input id="f-pays" list="pays-list" autocomplete="off" maxlength="40" placeholder="Tape un pays, ex. Italie" value="${t ? esc(C(t).n) : ''}" required>${paysList()}<em class="ferr"></em></label>
   <label class="fld" data-f="ville"><span>Ville ou région <i class="opt">facultatif</i></span><input id="f-ville" maxlength="80" value="${t ? esc(t.ville) : ''}" placeholder="Ex. Naples, ou laisse vide pour un roadtrip"></label>
   <div class="two"><label class="fld" data-f="du"><span>Départ <span class="req">*</span></span><input id="f-du" type="date" required value="${t ? t.du : addDays(TODAY, 30)}"><em class="ferr"></em></label><label class="fld" data-f="au"><span>Retour <span class="req">*</span></span><input id="f-au" type="date" required value="${t ? t.au : addDays(TODAY, 36)}"><em class="ferr"></em></label></div>
   <label class="fld" data-f="bud"><span>Budget total en euros <span class="req">*</span></span><input id="f-bud" type="number" inputmode="numeric" min="0" max="10000000" required value="${t ? t.budget : 900}"><em class="ferr"></em></label>
   <button class="btn full" id="f-ok">${t ? 'Enregistrer' : 'Créer le carnet'}<i>${SV.arrow}</i></button>
   ${t ? `<button class="danger" id="f-del">Supprimer ce carnet</button>` : ''}${CLOSE()}`, p => {
    const bad = (k, msg) => { const f = p.querySelector(`[data-f="${k}"]`); f.classList.add('bad'); f.querySelector('.ferr').textContent = msg; return true; };
    p.querySelectorAll('.fld input').forEach(i => i.addEventListener('input', () => { const f = i.closest('.fld'); f.classList.remove('bad'); const e = f.querySelector('.ferr'); if (e) e.textContent = ''; }));
    p.querySelector('#f-ok').onclick = () => {
      p.querySelectorAll('.fld.bad').forEach(f => { f.classList.remove('bad'); f.querySelector('.ferr').textContent = ''; });
      const ville = p.querySelector('#f-ville').value.trim(), du = p.querySelector('#f-du').value, au = p.querySelector('#f-au').value, bt = p.querySelector('#f-bud').value, b = +bt, praw = p.querySelector('#f-pays').value.trim(), pays = paysCode(praw);
      let ko = false;
      if (!praw) ko = bad('pays', 'Indique le pays du voyage');
      else if (!pays) ko = bad('pays', 'Pays non reconnu, choisis-le dans les suggestions');
      if (!du) ko = bad('du', 'Indique la date de départ');
      if (!au) ko = bad('au', 'Indique la date de retour');
      else if (du && D(au) < D(du)) ko = bad('au', 'Le retour doit suivre le départ');
      else if (du && diffDays(du, au) > 365) ko = bad('au', 'Un voyage dure un an au maximum');
      if (bt === '' || !(b >= 0) || b > 1e7) ko = bad('bud', 'Indique un budget, même approximatif (0 accepté)');
      if (ko) { const f = p.querySelector('.fld.bad input'); f && f.focus(); toast('Il manque des informations'); return; }
      if (t) { Object.assign(t, { pays, ville, du, au, budget: b }); if (t.budgets) { const tot = Object.values(t.budgets).reduce((a, c) => a + c, 0); if (tot !== b) t.budgets = null; } save(); closePanel(); refresh(); toast('Carnet mis à jour'); }
      else { const nt = { id: uid(), pays, ville, du, au, budget: b, cover: null, fav: false, vis: 'prive', lieux: [], membres: [], reglements: [], entrees: [{ id: uid(), j: 1, t: 'Premier jour', n: '', photos: [null, null] }], depenses: [] };
        S.trips.push(nt); S.envies = S.envies.filter(w => w.pays !== pays); save(); closePanel(); setTimeout(() => openTrip(nt.id), 380); toast('Carnet créé'); }
    };
    const del = p.querySelector('#f-del'); if (del) del.onclick = () => confirmIn(p, 'Supprimer ce carnet, ses dépenses et ses photos ?', () => {
      [t.cover, ...t.entrees.flatMap(e => e.photos)].forEach(releaseMedia);
      S.trips = S.trips.filter(x => x.id !== t.id); save(); closePanel(); go('home'); toast('Carnet supprimé'); });
  });
}
function expSheet(tid, eid, pick) {
  let t = trip(tid); const d = eid ? t.depenses.find(x => x.id === eid) : null;
  // E = euros, L = devise du pays, X = autre devise (ex. dollars au Cambodge, roadtrip sur plusieurs pays)
  let cur = d ? (d.v == null ? 'E' : d.cur ? 'X' : 'L') : (C(t).rate !== 1 ? 'L' : 'E'), xcur = d && d.cur ? d.cur : 'USD', cat = d ? d.c : 'repas';
  let by = d ? d.by || 'me' : 'me', split = d && d.split ? d.split.slice() : null;
  openPanel(`<h2>${d ? 'Modifier la dépense' : 'Nouvelle dépense'}</h2>
   ${d || !pick ? `<p class="small etrip">${flag(t.pays)}Dans le carnet <b>${esc(place(t))}</b></p>` : `<label class="fld"><span>Voyage</span><select id="e-trip">${sorted().map(x => `<option value="${x.id}" ${x.id === tid ? 'selected' : ''}>${esc(place(x))}</option>`).join('')}</select></label>`}
   <button type="button" class="scanbtn" id="e-scan">${SV.scan}<span><b>Scanner un ticket</b><em>${isPro() ? 'Lecture par l’IA, montant, date et commerce' : 'Remplit le montant et la date'}</em></span></button>
   <div style="display:flex;justify-content:center;margin-top:12px"><div class="seg" id="e-cur"></div></div>
   <div class="xcur" id="e-xwrap" hidden><select id="e-x" aria-label="Devise">${curList().map(c => `<option value="${c}" ${c === xcur ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
   <div class="amount"><input id="e-amt" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0" aria-label="Montant" value="${d ? (d.v != null ? d.v : Math.round(d.eur * 100) / 100) : ''}"></div>
   <p class="conv num" id="e-conv"></p>
   <div class="fld"><span>Catégorie</span><div class="picker" id="e-cat">${Object.keys(CATS).map(k => `<button class="pill ${k === cat ? 'on' : ''}" data-c="${k}" type="button">${CATS[k].n}</button>`).join('')}</div></div>
   <div class="two"><label class="fld"><span>Description</span><input id="e-lbl" maxlength="80" value="${d ? esc(d.l) : ''}" placeholder="Ex. Dîner à Gion"></label><label class="fld"><span>Jour</span><select id="e-day"></select></label></div>
   <div id="e-grp"></div>
   ${!navigator.onLine ? `<p class="offnote">${SV.cloudOff}Hors connexion : la dépense est gardée sur ton téléphone et partira toute seule au retour du réseau.</p>` : ''}
   <button class="btn full" id="e-ok">${d ? 'Enregistrer' : 'Ajouter au carnet'}<i>${SV.arrow}</i></button>
   ${d ? `<button class="danger" id="e-del">Supprimer cette dépense</button>` : ''}${CLOSE()}`, p => {
    const rate = () => cur === 'L' ? C(t).rate : cur === 'X' ? rateFor(xcur) : 1;
    const curName = () => cur === 'L' ? C(t).cur : cur === 'X' ? xcur : '€';
    const segs = () => { const l = C(t).rate !== 1;
      if (cur === 'L' && !l) cur = 'E';
      p.querySelector('#e-cur').innerHTML = `<button type="button" data-v="E" class="${cur === 'E' ? 'on' : ''}">Euros</button>` + (l ? `<button type="button" data-v="L" class="${cur === 'L' ? 'on' : ''}">${esc(C(t).cur)}</button>` : '') + `<button type="button" data-v="X" class="${cur === 'X' ? 'on' : ''}">Autre</button>`;
      p.querySelector('#e-xwrap').hidden = cur !== 'X';
      p.querySelectorAll('#e-cur button').forEach(b => b.onclick = () => { cur = b.dataset.v; segs(); conv(); }); };
    const days = () => { const n = info(t).jours, cd = info(t).enCours ? info(t).jour : 1; p.querySelector('#e-day').innerHTML = Array.from({ length: n }, (_, i) => `<option value="${i + 1}" ${(d ? d.j : cd) === i + 1 ? 'selected' : ''}>Jour ${i + 1}, ${fd(addDays(t.du, i))}</option>`).join(''); };
    const conv = () => { const v = +p.querySelector('#e-amt').value, r = rate(); const out = p.querySelector('#e-conv');
      if (!v) { out.textContent = cur === 'E' ? '' : `1 € = ${fmtRate(r)} ${curName()}, ${rateNote()}`; return; }
      out.textContent = cur === 'E' ? (C(t).rate !== 1 ? `soit ${fmtL(v * C(t).rate, t)}, ${rateNote()}` : '') : `soit ${(v / r).toFixed(2).replace('.', ',')} €, 1 € = ${fmtRate(r)} ${curName()} (${rateNote()})`; };
    const grp = () => { const box = p.querySelector('#e-grp'), M = t.membres || []; if (!M.length) { box.innerHTML = `<button type="button" class="link small" id="e-addm">${SV.userPlus}Dépense partagée ? Ajoute des amis au voyage</button>`; box.querySelector('#e-addm').onclick = () => { closePanel(); setTimeout(() => membersSheet(t.id), 380); }; return; }
      const all = ['me', ...M.map(m => m.id)]; if (!split) split = all.slice();
      box.innerHTML = `<div class="fld"><span>Payé par</span><div class="picker" id="e-by">${all.map(id => `<button type="button" class="pill ${by === id ? 'on' : ''}" data-id="${id}">${esc(memberName(t, id))}</button>`).join('')}</div></div>
        <div class="fld"><span>Pour qui <i class="opt">touche pour retirer</i></span><div class="picker" id="e-sp">${all.map(id => `<button type="button" class="pill ${split.includes(id) ? 'on' : ''}" data-id="${id}">${esc(memberName(t, id))}</button>`).join('')}</div><em class="small" id="e-each"></em></div>`;
      box.querySelectorAll('#e-by .pill').forEach(b => b.onclick = () => { by = b.dataset.id; grp(); });
      box.querySelectorAll('#e-sp .pill').forEach(b => b.onclick = () => { const id = b.dataset.id; split = split.includes(id) ? split.filter(x => x !== id) : [...split, id]; if (!split.length) { split = [id]; toast('Au moins une personne'); } grp(); });
      each(); };
    const each = () => { const e = p.querySelector('#e-each'); if (!e || !split) return; const v = +p.querySelector('#e-amt').value / rate(); e.textContent = v ? `${fmt(v / split.length)} par personne (${split.length})` : ''; };
    segs(); days(); conv(); grp();
    p.querySelector('#e-scan').onclick = () => scanTicket(p, r => {
      if (r.amount) p.querySelector('#e-amt').value = r.amount;
      if (r.currency) { const c = r.currency.toUpperCase(); if (c === 'EUR') cur = 'E'; else if (c === C(t).code) cur = 'L'; else if (curList().includes(c)) { cur = 'X'; xcur = c; p.querySelector('#e-x').value = c; } }
      if (r.date) { const j = diffDays(t.du, r.date) + 1; if (j >= 1 && j <= info(t).jours) p.querySelector('#e-day').value = j; }
      if (r.merchant && !p.querySelector('#e-lbl').value) p.querySelector('#e-lbl').value = r.merchant.slice(0, 80);
      if (r.category && CATS[r.category]) { const b = p.querySelector(`#e-cat [data-c="${r.category}"]`); b && b.click(); }
      segs(); conv(); each();
    });
    p.querySelector('#e-amt').oninput = () => { conv(); each(); };
    p.querySelector('#e-x').onchange = e => { xcur = e.target.value; conv(); each(); };
    const ts = p.querySelector('#e-trip'); if (ts) ts.onchange = () => { t = trip(ts.value); cur = C(t).rate !== 1 ? 'L' : 'E'; by = 'me'; split = null; segs(); days(); conv(); grp(); };
    p.querySelectorAll('#e-cat .pill').forEach(b => b.onclick = () => { cat = b.dataset.c; p.querySelectorAll('#e-cat .pill').forEach(x => x.classList.toggle('on', x === b)); });
    p.querySelector('#e-ok').onclick = () => {
      const v = +p.querySelector('#e-amt').value; if (!(v > 0) || v > 1e9) { toast('Indique un montant'); p.querySelector('#e-amt').focus(); return; }
      const eur = v / rate(); if (eur > 1e7) { toast('Montant trop élevé'); return; }
      const M = t.membres || [], shared = M.length && split && !(split.length === 1 && split[0] === 'me' && by === 'me');
      const rec = { j: +p.querySelector('#e-day').value, l: p.querySelector('#e-lbl').value.trim().slice(0, 80) || CATS[cat].n, c: cat, v: cur === 'E' ? null : v, cur: cur === 'X' ? xcur : null, eur, by: M.length ? by : 'me', split: shared ? split : null };
      if (d) { Object.assign(d, rec); save(); closePanel(); refresh(); toast(navigator.onLine ? 'Dépense mise à jour' : 'Dépense mise à jour sur ton téléphone'); return; }
      t.depenses.push({ id: uid(), ...rec, at: new Date().toISOString() }); save(); flyAndDone(rec, t);
    };
    const del = p.querySelector('#e-del'); if (del) del.onclick = () => confirmIn(p, 'Supprimer cette dépense ?', () => { t.depenses = t.depenses.filter(x => x.id !== d.id); save(); closePanel(); refresh(); toast('Dépense supprimée'); });
  });
}
function flyAndDone(rec, t) {
  const ph = $('phone').getBoundingClientRect(), from = $('e-ok').getBoundingClientRect(), nb = current === 'carnet' ? document.querySelector('#dock .l') : document.querySelector('nav [data-go=carnets]'), to = nb.getBoundingClientRect();
  const f = document.createElement('div'); f.className = 'flyer num'; f.textContent = (rec.v != null ? fmtD(rec, t) : fmt(rec.eur)) + '  ' + rec.l; $('phone').appendChild(f);
  f.style.left = (from.left - ph.left + from.width / 2 - 70) + 'px'; f.style.top = (from.top - ph.top - 40) + 'px'; closePanel();
  const done = () => { f.remove(); nb.classList.remove('ping'); void nb.offsetWidth; nb.classList.add('ping'); if (current === 'depenses') renderDepenses(true); else if (current === 'carnet' && openId === t.id) refresh(); else { dTab = 'depenses'; openTrip(t.id); } toast(navigator.onLine ? 'Dépense ajoutée' : 'Dépense notée, elle partira au retour du réseau'); };
  if (window.gsap && !REDUCED && !document.querySelector('nav').hidden) gsap.timeline({ onComplete: done }).to(f, { y: -60, rotation: -5, scale: 1.08, duration: .35, ease: 'power2.out' }).to(f, { x: to.left - from.left + to.width / 2 - from.width / 2, y: to.top - from.top + 40, scale: .2, opacity: 0, duration: .6, ease: 'power2.in' });
  else done();
}
function pageSheet(tid, eid) {
  const t = trip(tid), e = eid ? t.entrees.find(x => x.id === eid) : null, n = info(t).jours;
  let k = e ? e.photos.length : 2;
  openPanel(`<h2>${e ? 'Modifier la page' : 'Nouvelle page'}</h2><p class="small">${esc(place(t))}</p>
   <label class="fld"><span>Titre</span><input id="p-t" maxlength="80" value="${e ? esc(e.t) : ''}" placeholder="Ex. Balade à Trastevere"></label>
   <label class="fld"><span>Ton souvenir</span><textarea id="p-n" maxlength="2000" placeholder="Ce que tu veux retenir de cette journée">${e ? esc(e.n) : ''}</textarea></label>
   <div class="two"><label class="fld"><span>Jour</span><select id="p-j">${Array.from({ length: n }, (_, i) => `<option value="${i + 1}" ${(e ? e.j : Math.min(n, (info(t).jour || 1))) === i + 1 ? 'selected' : ''}>Jour ${i + 1}, ${fd(addDays(t.du, i))}</option>`).join('')}</select></label>
   <div class="fld"><span>Emplacements photo</span><div class="seg" id="p-k">${[1, 2, 3, 4].map(i => `<button type="button" data-k="${i}" class="${i === k ? 'on' : ''}">${i}</button>`).join('')}</div></div></div>
   <button class="btn full" id="p-ok">${e ? 'Enregistrer' : 'Ajouter la page'}<i>${SV.arrow}</i></button>
   ${e ? `<button class="danger" id="p-del">Supprimer cette page</button>` : ''}${CLOSE()}`, p => {
    p.querySelectorAll('#p-k button').forEach(b => b.onclick = () => { k = +b.dataset.k; p.querySelectorAll('#p-k button').forEach(x => x.classList.toggle('on', x === b)); });
    p.querySelector('#p-ok').onclick = () => { const ti = p.querySelector('#p-t').value.trim(); if (!ti) { toast('Donne un titre à la page'); return; }
      const rec = { t: ti.slice(0, 80), n: p.querySelector('#p-n').value.trim().slice(0, 2000), j: +p.querySelector('#p-j').value };
      if (e) { Object.assign(e, rec); if (k > e.photos.length) e.photos = e.photos.concat(Array(k - e.photos.length).fill(null)); else if (k < e.photos.length) { const kept = e.photos.filter(Boolean); e.photos = kept.slice(0, Math.max(k, kept.length)).concat(Array(Math.max(0, k - kept.length)).fill(null)); } }
      else t.entrees.push({ id: uid(), ...rec, photos: Array(k).fill(null) });
      t.entrees.sort((a, b) => a.j - b.j); save(); closePanel(); refresh(); toast(e ? 'Page mise à jour' : 'Page ajoutée, ajoute tes photos'); };
    const del = p.querySelector('#p-del'); if (del) del.onclick = () => confirmIn(p, 'Supprimer cette page et ses photos ?', () => { e.photos.forEach(releaseMedia); t.entrees = t.entrees.filter(x => x.id !== e.id); save(); closePanel(); refresh(); toast('Page supprimée'); });
  });
}
function pageMenu(tid, eid) {
  openPanel(`<h2>Cette page</h2><div class="menulist">
    <button id="m-edit">${SV.edit}Modifier le texte et le jour</button>
    <button id="m-photo">${SV.cam}Ajouter un emplacement photo</button>
    <button id="m-del" class="red">${SV.trash}Supprimer la page</button></div>${CLOSE('Fermer')}`, p => {
    p.querySelector('#m-edit').onclick = () => { closePanel(); setTimeout(() => pageSheet(tid, eid), 360); };
    p.querySelector('#m-photo').onclick = () => { ACT.addSlot({ trip: tid, entry: eid }); closePanel(); };
    p.querySelector('#m-del').onclick = () => confirmIn(p, 'Supprimer cette page ?', () => { const t = trip(tid), e = t.entrees.find(x => x.id === eid); if (e) e.photos.forEach(releaseMedia); t.entrees = t.entrees.filter(x => x.id !== eid); save(); closePanel(); refresh(); toast('Page supprimée'); });
  }, { nofocus: true });
}
function budgetSheet(tid) {
  const t = trip(tid), b = budgetsOf(t);
  openPanel(`<h2>Budget</h2><p class="small">${esc(place(t))}, en euros</p>
   <label class="fld"><span>Budget total</span><input id="b-tot" type="number" inputmode="numeric" min="0" value="${t.budget}"></label>
   ${Object.keys(CATS).map(k => `<label class="fld"><span>${CATS[k].n}</span><input data-k="${k}" class="b-cat" type="number" inputmode="numeric" min="0" value="${b[k]}"></label>`).join('')}
   <p class="small" id="b-sum" style="margin-top:10px"></p>
   <button class="btn full" id="b-ok">Enregistrer<i>${SV.arrow}</i></button>${CLOSE()}`, p => {
    const sum = () => { const s = [...p.querySelectorAll('.b-cat')].reduce((a, i) => a + (+i.value || 0), 0); p.querySelector('#b-sum').textContent = `Total des catégories : ${fmt(s)}${s !== +p.querySelector('#b-tot').value ? ', différent du budget total' : ''}`; };
    p.querySelectorAll('input').forEach(i => i.oninput = sum); sum();
    p.querySelector('#b-ok').onclick = () => { const tot = +p.querySelector('#b-tot').value; if (!(tot > 0) || tot > 1e7) { toast('Indique un budget'); return; }
      t.budget = tot; t.budgets = {}; p.querySelectorAll('.b-cat').forEach(i => t.budgets[i.dataset.k] = Math.max(0, Math.min(1e7, +i.value || 0))); save(); closePanel(); refresh(); toast('Budget mis à jour'); };
  });
}
function wishSheet() {
  openPanel(`<h2>Nouvelle envie</h2><p class="small">Elle apparaîtra sur ta carte et ton globe.</p>
   <label class="fld"><span>Pays</span><input id="w-p" list="pays-list" autocomplete="off" maxlength="40" placeholder="Tape un pays, ex. Mexique">${paysList()}</label>
   <label class="fld"><span>Note</span><input id="w-n" maxlength="80" placeholder="Ex. Pour mes 30 ans"></label>
   <button class="btn full" id="w-ok">Ajouter l'envie<i>${SV.arrow}</i></button>${CLOSE()}`, p => {
    p.querySelector('#w-ok').onclick = () => { const pays = paysCode(p.querySelector('#w-p').value); if (!pays) { toast('Pays non reconnu, choisis-le dans les suggestions'); return; }
      if (S.envies.some(w => w.pays === pays)) { toast('Ce pays est déjà dans tes envies'); return; }
      S.envies.push({ id: uid(), pays, note: p.querySelector('#w-n').value.trim().slice(0, 80) }); save(); closePanel(); refresh(); toast('Envie ajoutée'); };
  });
}
function placeInput(tid) {
  const wrap = document.querySelector('.screen:not([hidden]) .tags'), btn = wrap && wrap.querySelector('[data-act=addPlace]'); if (!btn) return;
  const inp = document.createElement('input'); inp.placeholder = 'Nouveau lieu'; inp.maxLength = 60; btn.replaceWith(inp); inp.focus();
  let fired = false; const done = () => { if (fired) return; fired = true; const v = inp.value.trim().slice(0, 60); const t = trip(tid); if (v && t.lieux.length < 50 && !t.lieux.includes(v)) { t.lieux.push(v); save(); } refresh(); };
  inp.onkeydown = e => { if (e.key === 'Enter') done(); if (e.key === 'Escape') { fired = true; refresh(); } }; inp.onblur = done;
}

/* ---------- fiche voyage ---------- */
let openId = null, dTab = 'apercu';
function openTrip(id, keep) {
  const t = trip(id); if (!t) return; if (openId !== id && !keep) dTab = 'apercu'; openId = id;
  const sc = $('s-carnet'), y = keep ? sc.scrollTop : 0;
  const f = info(t), c = catsOf(t), s = spentOf(t), diff = s - t.budget, pc = t.budget ? Math.round(Math.abs(diff) / t.budget * 100) : 0, d = daysOf(t), b = budgetsOf(t);
  const status = f.futur ? `Départ dans ${diffDays(TODAY, t.du)} jours` : f.enCours ? `En cours, jour ${f.jour} sur ${f.jours}` : diff <= 0 ? 'Budget tenu' : 'Budget dépassé';
  const allPh = [[t.cover, `${t.id}|cover`], ...t.entrees.flatMap(e => e.photos.map((p, i) => [p, `${t.id}|e|${e.id}|${i}`]))];
  const dayMap = {}; d.forEach((v, i) => dayMap[i + 1] = v);
  const top = Object.entries(c).sort((a, b2) => b2[1] - a[1])[0];
  let body = '';
  if (dTab === 'apercu') body = `
    <div class="igrid num"><button data-act="dtab" data-v="journal"><i>${SV.cal}</i><b>${f.jours} jours</b><span>${fd(t.du)}</span></button><button data-act="dtab" data-v="journal"><i>${SV.page}</i><b>${t.entrees.length} page${t.entrees.length > 1 ? 's' : ''}</b><span>Journal</span></button><button data-act="dtab" data-v="photos"><i>${SV.img}</i><b>${photosCount(t)}</b><span>Photo${photosCount(t) > 1 ? 's' : ''}</span></button><button data-act="dtab" data-v="depenses"><i>${SV.wallet}</i><b>${fmt(f.futur ? t.budget / f.jours : s / Math.max(1, f.jour))}</b><span>par jour</span></button></div>
    <div class="sec"><h2>À propos de ce voyage</h2><button class="more" data-act="editTrip" data-trip="${t.id}">Modifier</button></div>
    <p class="about">${t.entrees[0] && t.entrees[0].n ? esc(t.entrees[0].n) + ' ' : ''}${t.entrees.length} page${t.entrees.length > 1 ? 's' : ''} de souvenirs, ${t.lieux.length} lieu${t.lieux.length > 1 ? 'x' : ''} noté${t.lieux.length > 1 ? 's' : ''} et ${photosCount(t)} photo${photosCount(t) > 1 ? 's' : ''}.</p>
    <div class="tags">${t.lieux.map((l, i) => `<span class="pill">${esc(l)}<button class="x" data-act="rmPlace" data-trip="${t.id}" data-i="${i}" aria-label="Retirer ${esc(l)}">${SV.x.replace('<svg', '<svg width="11" height="11"')}</button></span>`).join('')}<button class="pill add" data-act="addPlace" data-trip="${t.id}">${SV.plus}Lieu</button></div>
    <div class="sec"><h2>Album</h2><button class="more" data-act="albumVis" data-trip="${t.id}">${esc(VISN[t.vis || 'prive'])}</button></div>
    <p class="small">${t.vis === 'public' ? 'Tout le monde peut voir les photos et les pages de ce carnet (jamais les dépenses).' : t.vis === 'amis' ? 'Tes amis peuvent voir les photos et les pages de ce carnet (jamais les dépenses).' : 'Ce carnet est privé : toi seule le vois.'}</p>
    <div class="sec"><h2>Budget</h2><button class="more" data-act="budget" data-trip="${t.id}">Modifier</button></div>
    <div class="bud num"><div class="t"><b>${fmt(s)}</b><span>sur ${fmt(t.budget)}</span></div><div class="tr"><i class="${s > t.budget ? 'ko' : ''}" style="width:${pct(s, t.budget)}%"></i></div><div class="rw"><span>${f.futur ? 'Pas encore de dépenses' : f.enCours ? fmt(t.budget - s) + ' restants' : (diff <= 0 ? pc + ' % sous le budget' : pc + ' % au-dessus')}</span><span>${top[1] ? 'plus gros poste : ' + CATS[top[0]].n.toLowerCase() : ''}</span></div></div>
    <div class="sec"><h2>Moments</h2><button class="more" data-act="dtab" data-v="photos">Tout voir</button></div>
    <div class="mstrip">${allPh.slice(0, 12).map(([p, tg]) => phHTML(p, tg)).join('')}</div>
    <div class="ai-note"><b>Le mot de l'assistant</b>${esc(noteFor(t))}<button class="askcta" data-act="ask" data-q="Est-ce que je tiens mon budget pour ${esc(short(t))} ?">${SV.spark}Poser une question sur ce voyage</button></div>`;
  else if (dTab === 'journal') body = `
    <div class="sec"><h2>${t.entrees.length} page${t.entrees.length > 1 ? 's' : ''}</h2><button class="pill dark" data-act="addPage" data-trip="${t.id}">${SV.plus}Page</button></div>
    ${t.entrees.length ? t.entrees.map(e => `<div class="entry" id="en-${e.id}">
      <div class="hd"><div class="dt"><b>${D(addDays(t.du, e.j - 1)).getDate()}</b>${D(addDays(t.du, e.j - 1)).toLocaleDateString('fr-FR', { month: 'short' })}</div><div><h3>${esc(e.t)}</h3>${e.n ? `<p class="note">${esc(e.n)}</p>` : ''}</div><button class="menu" data-act="pageMenu" data-trip="${t.id}" data-entry="${e.id}" aria-label="Options de la page">${SV.dots}</button></div>
      <div class="photos">${e.photos.map((p, i) => phHTML(p, `${t.id}|e|${e.id}|${i}`)).join('')}${e.photos.length < 6 ? `<button class="more" data-act="addSlot" data-trip="${t.id}" data-entry="${e.id}">${SV.plus}Cadre</button>` : ''}</div>
      <p class="spent num">Jour ${e.j}, dépenses hors logement : <b>${fmt(dayMap[e.j] || 0)}</b></p></div>`).join('') : `<div class="emptyj">Aucune page pour l'instant.</div>`}`;
  else if (dTab === 'depenses') { const list = t.depenses.slice().sort((a, b2) => b2.j - a.j);
    body = tripBudgetHTML(t); if (false) body = `<div class="sec"><h2>Par catégorie</h2><button class="more" data-act="budget" data-trip="${t.id}">Budget</button></div>
    <div class="group">${Object.keys(CATS).map(k => `<div class="cat"><span class="ic">${ico(k)}</span><span><span class="n"><span>${CATS[k].n}</span><em class="num">sur ${fmt(b[k])}</em></span><span class="mb"><i class="${c[k] > b[k] ? 'over' : ''}" style="width:${pct(c[k], b[k])}%"></i></span></span><span class="v num">${fmt(c[k])}</span></div>`).join('')}</div>
    <div class="sec"><h2>${list.length} dépense${list.length > 1 ? 's' : ''}</h2><button class="pill dark" data-act="addExp" data-trip="${t.id}">${SV.plus}Dépense</button></div>
    <div class="group dexp">${list.map(dd => `<button class="exp" data-act="editExp" data-trip="${t.id}" data-id="${dd.id}"><span class="ic">${ico(dd.c)}</span><span class="m"><b>${esc(dd.l)}</b><span>Jour ${dd.j}, ${CATS[dd.c].n}</span></span><span class="p num">${fmt(dd.eur)}${dd.v != null ? `<span>${fmtD(dd, t)}</span>` : ''}</span>${PENDING.has(dd.id) ? `<em class="pend" title="En attente d'envoi">${SV.cloudOff}</em>` : ''}</button>`).join('') || `<p class="small" style="padding:14px">Aucune dépense pour l'instant.</p>`}</div>`; }
  else if (dTab === 'comptes') body = comptesHTML(t);
  else body = `<div class="sec"><h2>${photosCount(t)} photos</h2><button class="pill dark" data-act="photoTrip" data-trip="${t.id}">${SV.plus}Photo</button></div><div class="photogrid">${allPh.map(([p, tg]) => phHTML(p, tg)).join('')}</div>`;
  sc.innerHTML = `
   <div class="dhero">${phHTML(t.cover, `${t.id}|cover`, 'Ajouter une couverture')}<span class="sh"></span>
     <div class="dtb"><button data-act="back" aria-label="Retour">${SV.back}</button><span class="sp"></span>
       <button data-photo="${t.id}|cover" aria-label="Changer la couverture">${SV.cam}</button>
       <button class="${t.fav ? 'on' : ''}" data-act="fav" data-trip="${t.id}" aria-label="Favori">${t.fav ? SV.heartF : SV.heart}</button>
       <button data-act="share" data-trip="${t.id}" aria-label="Copier le résumé">${SV.share}</button></div>
     <div class="dtitle"><h1>${esc(place(t))}</h1><p class="m"><span>${SV.place}${esc(C(t).n)}</span><span>${SV.cal}${f.jours} jours, ${fd(t.du)} au ${fd(t.au)}</span></p><p class="r">${SV.star}<b>${status}</b><span>${f.futur || f.enCours ? '' : '(' + pc + ' % ' + (diff <= 0 ? 'sous le' : 'au-dessus du') + ' budget)'}</span></p></div></div>
   <div class="dsheet"><div class="dtabs">${[['apercu', 'Aperçu'], ['journal', 'Journal'], ['depenses', 'Budget'], ['comptes', 'Entre amis'], ['photos', 'Photos']].map(([k, l]) => `<button data-act="dtab" data-v="${k}" class="${dTab === k ? 'on' : ''}">${l}</button>`).join('')}</div>${body}<div style="height:110px"></div></div>`;
  const act = { apercu: ['addExp', 'Ajouter une dépense'], journal: ['addPage', 'Nouvelle page'], depenses: ['addExp', 'Ajouter une dépense'], photos: ['photoTrip', 'Ajouter une photo'], comptes: (t.membres || []).length ? ['addExp', 'Dépense partagée'] : ['members', 'Inviter des amis'] }[dTab];
  $('dock').innerHTML = `<div class="l num"><b>${fmt(f.futur ? t.budget : s)}</b><small>${f.futur ? 'de budget' : f.enCours ? 'dépensés à ce jour' : 'dépensés'}</small></div><button class="btn" data-act="${act[0]}" data-trip="${t.id}">${act[1]}<i>${SV.right}</i></button>`;
  if (!keep) { go('carnet', 'flip'); sc.scrollTop = 0; } else sc.scrollTop = y;
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { root: sc, threshold: .2 });
  sc.querySelectorAll('.entry').forEach(el => io.observe(el));
}
const VISN = { public: 'Public', amis: 'Amis', prive: 'Privé' };
ACT.dtab = d => { dTab = d.v; const sc = $('s-carnet'); openTrip(openId, true); const top = sc.querySelector('.dsheet').offsetTop - 60; if (sc.scrollTop > top) sc.scrollTop = top; };
ACT.photoTrip = d => { const t = trip(d.trip); if (!t.cover) { pickPhoto(`${t.id}|cover`); return; } for (const e of t.entrees) { const i = e.photos.findIndex(p => !p); if (i >= 0) { pickPhoto(`${t.id}|e|${e.id}|${i}`); return; } } const e = t.entrees[t.entrees.length - 1]; if (!e) { pageSheet(t.id); return; } e.photos.push(null); save(); pickPhoto(`${t.id}|e|${e.id}|${e.photos.length - 1}`); };
ACT.albumVis = d => { const t = trip(d.trip);
  openPanel(`<h2>Qui peut voir cet album ?</h2><p class="small">Les photos et les pages du journal. Tes dépenses et ton budget restent toujours privés.</p><div class="visopts">${[['public', 'Public', 'Tout le monde', SV.globeS], ['amis', 'Amis', 'Tes amis seulement', SV.users], ['prive', 'Privé', 'Toi seule', SV.lock]].map(([k, n, s2, ic]) => `<button class="${(t.vis || 'prive') === k ? 'on' : ''}" data-act="setAlbumVis" data-trip="${t.id}" data-v="${k}">${ic}${n}<span>${s2}</span></button>`).join('')}</div>${CLOSE('Fermer')}`, null, { nofocus: true }); };
ACT.setAlbumVis = d => { const t = trip(d.trip); t.vis = d.v; save(); closePanel(); refresh(); toast(`Album ${short(t)} : ${VISN[d.v]}`); };

/* ---------- budget ---------- */
let depId = null, catF = null;
function renderDepenses(keep) {
  const sc = $('s-depenses'), y = keep ? sc.scrollTop : 0;
  if (!S.trips.length) { sc.innerHTML = `<h1 class="bigtitle sans">Budget</h1><div class="emptycard"><b>Aucun voyage pour l'instant</b><p>Crée un voyage pour suivre ton budget, tes dépenses par jour et par catégorie, avec conversion de devise.</p><button class="btn2 g wide" data-act="newTrip">${SV.plus}Créer un voyage</button></div>`; return; }
  if (!depId || !trip(depId)) depId = (currentTrip() || sorted()[0]).id;
  const t = trip(depId), f = info(t), c = catsOf(t), s = spentOf(t), b = budgetsOf(t), left = t.budget - s, remDays = f.enCours ? f.jours - f.jour + 1 : f.futur ? f.jours : 0, per = remDays ? left / remDays : 0, p = projection(t), loc = C(t).rate !== 1;
  const list = t.depenses.filter(d => !catF || d.c === catF), byDay = {}; list.forEach(d => (byDay[d.j] = byDay[d.j] || []).push(d));
  sc.innerHTML = `
   <h1 class="bigtitle sans">Budget</h1>
   <div class="tripchips">${sorted().map(x => `<button class="${x.id === t.id ? 'on' : ''}" data-dep="${x.id}">${flag(x.pays)}${esc(short(x))}</button>`).join('')}</div>
   <div class="titlebar"><h1>${esc(place(t))}</h1><button class="pill dark" data-act="addExp" data-trip="${t.id}">${SV.plus}Dépense</button></div>
   <div class="flipcard" id="flipcard"><div class="inner">
     <div class="face a"><div class="top"><span>${f.futur ? 'Budget du voyage' : f.enCours ? `Il te reste, jour ${f.jour} sur ${f.jours}` : 'Bilan du voyage'}</span>${loc ? `<button class="swap" data-act="flip">Voir en ${esc(C(t).cur)}</button>` : ''}</div>
       <p class="big num" data-count="${Math.round(f.enCours || f.futur ? left : s)}">${fmt(f.enCours || f.futur ? left : s)}</p>
       <div class="track"><i style="width:${pct(s, t.budget)}%"></i>${f.enCours ? `<u style="left:${f.jour / f.jours * 100}%"></u>` : ''}</div>
       <div class="row num"><span>${fmt(s)} dépensés</span><span>sur ${fmt(t.budget)}</span></div>
       <div class="pills">${f.enCours || f.futur ? `<div class="s"><b class="num">${fmt(per)}</b><span>par jour ${f.futur ? 'sur place' : "jusqu'au retour"}</span></div><div><b class="num">${remDays} jours</b><span>${f.futur ? 'de voyage' : 'restants'}</span></div>` : `<div class="s"><b class="num">${fmt(s / f.jours)}</b><span>par jour en moyenne</span></div><div><b class="num">${s - t.budget > 0 ? '+ ' : '− '}${fmt(Math.abs(s - t.budget))}</b><span>par rapport au budget</span></div>`}</div>
       ${p.worst ? `<div class="warn">${SV.warn || '!'}<span>Au rythme actuel, <b>${CATS[p.worst.k].n.toLowerCase()}</b> finira vers ${fmt(p.worst.proj)} pour ${fmt(b[p.worst.k])} prévus.</span></div>` : ''}
       <div class="actions"><button class="pill" data-act="budget" data-trip="${t.id}">Modifier le budget</button><button class="pill" data-open="${t.id}">Ouvrir le carnet</button></div>
     </div>
     ${loc ? `<div class="face b"><div class="top"><span>En monnaie locale, 1 € = ${fmtRate(C(t).rate)} ${esc(C(t).cur)} (${rateNote()})</span><button class="swap" data-act="flip">Voir en euros</button></div>
       <p class="big num">${fmtL((f.enCours || f.futur ? left : s) * C(t).rate, t)}</p>
       <div class="pills"><div><b class="num">${fmtL(per * C(t).rate, t)}</b><span>par jour</span></div><div><b class="num">${fmtL(s * C(t).rate, t)}</b><span>déjà dépensés</span></div></div></div>` : ''}
   </div></div>
   ${statsHTML(t)}
   <div class="sec"><h2>Par catégorie</h2><span class="small">${catF ? 'filtre actif' : 'touche pour filtrer'}</span></div><div class="group">
   ${Object.keys(CATS).map(k => `<button class="cat ${catF === k ? 'on' : ''}" data-act="catFilter" data-k="${k}"><span class="ic">${ico(k)}</span><span><span class="n"><span>${CATS[k].n}</span><em class="num">sur ${fmt(b[k])}</em></span><span class="mb"><i class="${c[k] > b[k] ? 'over' : ''}" style="width:${pct(c[k], b[k])}%"></i></span></span><span class="v num">${fmt(c[k])}</span></button>`).join('')}
   </div><div class="sec"><h2>Le détail</h2>${catF ? `<button class="link" data-act="catFilter" data-k="${catF}">Tout afficher</button>` : ''}</div>
   ${Object.keys(byDay).length ? Object.keys(byDay).sort((a, b2) => b2 - a).map(j => { const L = byDay[j], tot = L.reduce((a, d) => a + myPart(d), 0);
     return `<div class="dayh"><span>Jour ${j}, ${fd(addDays(t.du, j - 1))}</span><span class="num">${fmt(tot)}</span></div><div class="group">` + L.slice().reverse().map(d => `<button class="exp" data-act="editExp" data-trip="${t.id}" data-id="${d.id}"><span class="ic">${ico(d.c)}</span><span class="m"><b>${esc(d.l)}</b><span>${CATS[d.c].n}${d.split || (d.by && d.by !== 'me') ? `, payé par ${esc(memberName(t, d.by || 'me'))}${d.split ? `, ta part ${fmt(myPart(d))}` : ''}` : ', touche pour modifier'}</span></span><span class="p num">${fmt(d.eur)}${d.v != null ? `<span>${fmtD(d, t)}</span>` : ''}</span>${PENDING.has(d.id) ? `<em class="pend" title="En attente d'envoi">${SV.cloudOff}</em>` : ''}</button>`).join('') + '</div>'; }).join('')
     : `<div class="emptyj">Aucune dépense ${catF ? 'dans cette catégorie' : 'pour ce voyage'}.<br><button class="pill dark" style="margin-top:12px" data-act="addExp" data-trip="${t.id}">${SV.plus}Ajouter une dépense</button></div>`}`;
  sc.querySelectorAll('[data-dep]').forEach(bn => bn.onclick = () => { depId = bn.dataset.dep; catF = null; renderDepenses(); });
  if (keep) sc.scrollTop = y; else countUp(sc.querySelector('[data-count]'));
  const on = sc.querySelector('.tripchips .on'); on && on.scrollIntoView({ inline: 'center', block: 'nearest' });
}
function countUp(el) { if (!el || REDUCED) return; const end = +el.dataset.count, t0 = performance.now(), dur = 900;
  const step = t => { const k = Math.min(1, (t - t0) / dur); el.textContent = fmt(end * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); }

/* ---------- assistant ---------- */
function renderScope() {
  const pages = S.trips.reduce((a, t) => a + t.entrees.length, 0), deps = S.trips.reduce((a, t) => a + t.depenses.length, 0);
  $('scope').innerHTML = `${SETTINGS && SETTINGS.ai_enabled ? 'L’assistant lit les totaux de tes voyages et de tes dépenses, jamais tes notes, tes photos ni tes amis.' : 'Mode simple : les réponses sont calculées sur ton téléphone. Active l’assistant IA dans les réglages pour des réponses plus riches.'}<div class="chips"><span>${S.trips.length} carnets</span><span>${pages} pages</span><span>${deps} dépenses</span><span>${S.envies.length} envies</span></div>`;
}
const SUGG = () => { const t = currentTrip(), past = sorted().filter(x => !info(x).enCours && !info(x).futur);
  return [t ? `Est-ce que je tiens mon budget à ${short(t)} ?` : null, past.length ? "Quel voyage m'a coûté le plus cher par jour ?" : null, past.length > 1 ? `Compare ${short(past[0])} et ${short(past[past.length - 1])}` : null, S.envies[0] ? `Combien prévoir pour ${C(S.envies[0]).n} ?` : null, 'Où est-ce que je dépense le plus ?'].filter(Boolean); };
function renderSugg() { $('sugg').innerHTML = SUGG().map(s => `<button class="pill" type="button">${esc(s)}</button>`).join(''); $('sugg').querySelectorAll('button').forEach(b => b.onclick = () => ask(b.textContent)); }
let turns = [], asking = false;
function bubble(cls, text) { const d = document.createElement('div'); d.className = 'msg ' + cls; d.textContent = text; $('chat').appendChild(d); $('s-ia').scrollTop = 1e6; return d; }
function greet() { $('chat').innerHTML = ''; bubble('ai', S.trips.length ? `Bonjour ${S.user}. Demande-moi où part ton argent, compare deux voyages ou prépare le prochain.` : `Bonjour ${S.user}. Crée ton premier voyage et ajoute quelques dépenses : je pourrai ensuite te dire où part ton argent.`); }
$('clearChat').onclick = () => { turns = []; greet(); toast('Conversation effacée'); };
function local(q) {
  if (!S.trips.length) return "Tu n'as encore aucun voyage. Crée ton premier carnet avec le bouton +, ajoute quelques dépenses, et je pourrai te dire où part ton argent.";
  try {
    q = q.toLowerCase(); const past = S.trips.filter(t => !info(t).futur && !info(t).enCours && spentOf(t) > 0);
    const perDay = past.map(t => [t, spentOf(t) / info(t).jours]).sort((a, b) => b[1] - a[1]);
    const named = S.trips.filter(t => q.includes(short(t).toLowerCase()));
    if (q.includes('plus cher') && perDay.length) return `Par jour, c'est ${place(perDay[0][0])} qui a coûté le plus : ${fmt(perDay[0][1])} en moyenne. Le moins cher est ${perDay[perDay.length - 1][0].ville}, avec ${fmt(perDay[perDay.length - 1][1])} par jour.`;
    if (q.includes('compare') && named.length >= 2) { const [a, b] = named; return `${place(a)} : ${fmt(spentOf(a))} en ${info(a).jours} jours, soit ${fmt(spentOf(a) / info(a).jours)} par jour. ${place(b)} : ${fmt(spentOf(b))} en ${info(b).jours} jours, soit ${fmt(spentOf(b) / info(b).jours)} par jour.`; }
    if (q.includes('budget')) { const t = named[0] || currentTrip() || sorted()[0]; const s = spentOf(t), f = info(t); return `Tu as dépensé ${fmt(s)} sur ${fmt(t.budget)} pour ${place(t)}.${f.enCours ? ` Il te reste ${fmt((t.budget - s) / (f.jours - f.jour + 1))} par jour jusqu'au retour.` : ''}`; }
    if (q.includes('prévoir') && perDay.length) { const avg = perDay.reduce((a, [, v]) => a + v, 0) / perDay.length; return `D'après tes carnets, tu dépenses en moyenne ${fmt(avg)} par jour. Pour une semaine, prévois autour de ${fmt(avg * 7)}, à ajuster selon le coût de la vie sur place.`; }
    if (q.includes('plus')) { const tot = {}; S.trips.forEach(t => Object.entries(catsOf(t)).forEach(([k, v]) => tot[k] = (tot[k] || 0) + v)); const top = Object.entries(tot).filter(([k]) => k !== 'logement').sort((a, b) => b[1] - a[1])[0]; if (top && top[1] > 0) return `Hors logement, ton plus gros poste sur tous tes voyages est ${CATS[top[0]].n.toLowerCase()}, avec ${fmt(top[1])} au total.`; }
    return 'Je peux répondre sur tes carnets, tes dépenses et tes budgets. Essaie une des suggestions juste au-dessus.';
  } catch (e) { return "Je n'ai pas assez de données pour répondre à ça. Ajoute des dépenses à tes voyages, ou essaie une des suggestions."; }
}
async function ask(q) {
  q = (q || '').trim().slice(0, 500); if (!q) { $('askIn').focus(); toast('Écris ta question ou touche une suggestion'); return; }
  if (asking) return; $('askIn').value = '';
  bubble('me', q); const out = bubble('ai', ''); out.innerHTML = '<span class="thinking">Je feuillette tes carnets…</span>';
  if (!(SETTINGS && SETTINGS.ai_enabled)) { setTimeout(() => { out.textContent = local(q); $('s-ia').scrollTop = 1e6; }, 400); return; }
  asking = true;
  try {
    const { data, error } = await sb.functions.invoke('assistant', { body: { question: q, history: turns.slice(-6) } });
    if (error) { let msg = 'L’assistant est indisponible, voici une réponse simple : ' + local(q); try { const j = await error.context.json(); if (j && j.error && error.context.status !== 502) msg = j.error; } catch (_) { } out.textContent = msg; }
    else { out.textContent = data.answer; turns.push({ role: 'user', content: q }, { role: 'assistant', content: data.answer }); }
  } catch (e) { out.textContent = local(q); }
  finally { asking = false; $('s-ia').scrollTop = 1e6; }
}
$('askForm').onsubmit = e => { e.preventDefault(); ask($('askIn').value); };

/* ---------- accueil ---------- */
let homeF = 'all';
function renderHome() {
  const cur = currentTrip(), next = S.trips.filter(x => info(x).futur).sort((a, b) => D(a.du) - D(b.du))[0], t = cur || next || sorted()[0];
  const heroT = (t && t.cover) ? t : (S.trips.find(x => x.cover) || t);
  const years = [...new Set(S.trips.map(x => D(x.du).getFullYear()))].sort((a, b) => b - a);
  const exps = cur ? cur.depenses.slice().reverse().slice(0, 3) : [];
  const first = !S.trips.length;
  $('s-home').innerHTML = `
   <div class="hhero ${heroT && heroT.cover ? '' : 'nophoto'}">${heroT && heroT.cover ? phHTML(heroT.cover, `${heroT.id}|cover`, 'Ajouter une photo') : ''}<span class="hshade"></span>
     <div class="htop"><span class="logo">${SV.planeO}Escale</span><div class="r"><button class="ghost-ic" data-act="go" data-to="carte" aria-label="Carte">${SV.globe}</button><button class="ghost-ic" data-act="go" data-to="ia" aria-label="Assistant">${SV.spark}</button><button class="ghost-ic bellbtn" data-act="notifs" aria-label="Notifications">${SV.bell}<span class="bdg" id="notifBadge" hidden></span></button><button class="avatar" data-act="go" data-to="profil" aria-label="Mon profil">${PROFILE && PROFILE.avatar_path ? IMG(PROFILE.avatar_path) : esc((S.user[0] || 'E').toUpperCase())}</button></div></div>
     <div class="htext"><h1>${first ? `Bienvenue,<br>${esc(S.user)}.` : 'Tes voyages,<br>ton histoire.'}</h1><p>${first ? 'Crée ton premier carnet : photos, souvenirs et dépenses au même endroit.' : 'Carnets, photos et dépenses de chacune de tes escales.'}</p>
       ${first ? `<button class="hcta" data-act="newTrip">${SV.plus}Créer mon premier voyage</button>` : `<label class="hsearch" for="q">${SV.search}<input id="q" placeholder="Chercher un voyage, un lieu" autocomplete="off" maxlength="60"><button type="button" data-act="go" data-to="carnets" aria-label="Voir mes voyages">${SV.right}</button></label>`}</div></div>
   <div class="hsheet">
     ${first ? `<div class="steps"><div class="step"><b>1</b><span><strong>Crée un voyage</strong>Pays, dates et budget.</span></div><div class="step"><b>2</b><span><strong>Note tes dépenses</strong>En euros ou en monnaie locale, en deux secondes.</span></div><div class="step"><b>3</b><span><strong>Garde tes souvenirs</strong>Pages, photos, lieux, et partage avec tes amis si tu veux.</span></div></div>` : `
     <div class="chipsrow" id="homeChips">${[['all', 'Tous'], ['cur', 'En cours'], ['fut', 'À venir'], ['fav', 'Favoris'], ...years.map(y => [String(y), String(y)])].map(([k, l]) => `<button data-hf="${k}" class="${homeF === k ? 'on' : ''}">${l}</button>`).join('')}</div>
     ${homeTiles()}
     <div class="sec"><h2>Mes voyages</h2><button class="more" data-act="go" data-to="carnets">Tout voir</button></div>
     <div class="dest" id="picks"></div>
     ${t ? `<div class="sec"><h2>${cur ? 'En ce moment' : next ? 'Prochain départ' : 'Dernier voyage'}</h2><button class="more" data-open="${t.id}">Ouvrir</button></div>
     <div class="rec" data-open="${t.id}">${phHTML(t.cover, `${t.id}|cover`, 'Ajouter une photo')}<span class="sh"></span>
       <button class="heart ${t.fav ? 'on' : ''}" data-act="fav" data-trip="${t.id}" aria-label="Favori">${t.fav ? SV.heartF : SV.heart}</button>
       <div class="tx"><span class="badge">${SV.leaf}${cur ? `En cours, jour ${info(t).jour} sur ${info(t).jours}` : next ? `Départ dans ${diffDays(TODAY, t.du)} jours` : 'Terminé'}</span>
         <h3>${esc(place(t))} ${flag(t.pays)}</h3><p class="sub">${esc(C(t).n)}, ${fd(t.du)} au ${fd(t.au)}</p>
         <p class="row num"><span>${SV.page}${t.entrees.length} page${t.entrees.length > 1 ? 's' : ''}</span><span>${SV.clock}${info(t).jours} jours</span><span>${cur ? `Reste <b>${fmt(t.budget - spentOf(t))}</b>` : `Budget <b>${fmt(t.budget)}</b>`}</span></p></div></div>` : ''}
     ${exps.length ? `<div class="sec"><h2>Dernières dépenses</h2><button class="more" data-act="go" data-to="depenses">Tout voir</button></div>
     <div class="xlist">${exps.map(d => `<button class="xrow" data-act="editExp" data-trip="${cur.id}" data-id="${d.id}"><span class="ic">${ico(d.c)}</span><span class="m"><b>${esc(d.l)}</b><span>${esc(short(cur))}, jour ${d.j}, ${CATS[d.c].n}</span><strong class="num">${fmt(d.eur)}</strong></span><span class="r"><span>${d.v != null ? fmtL(d.v, cur) : ''}</span><span>${SV.dots.replace('<svg', '<svg width="16" height="16"')}</span></span></button>`).join('')}</div>` : ''}`}
     <div class="sec"><h2>Mes envies</h2><button class="more" data-act="addWish">Ajouter</button></div>
     <div class="wishes">${S.envies.map(w => `<span class="pill">${flag(w.pays)}${esc(C(w).n)}${w.note ? `<span class="small">${esc(w.note)}</span>` : ''}<button class="x" data-act="rmWish" data-id="${w.id}" aria-label="Retirer ${esc(C(w).n)}">${SV.x.replace('<svg', '<svg width="11" height="11"')}</button></span>`).join('')}<button class="pill add" data-act="addWish">${SV.plus}Une envie</button></div>
   </div>`;
  if (!first) {
    document.querySelectorAll('#homeChips button').forEach(b => b.onclick = () => { homeF = b.dataset.hf; document.querySelectorAll('#homeChips button').forEach(x => x.classList.toggle('on', x === b)); renderPicks($('q').value); });
    renderPicks(''); $('q').addEventListener('input', e => renderPicks(e.target.value));
  }
  if (typeof updateBadges === 'function') updateBadges();
}
function renderPicks(q) {
  q = (q || '').trim().toLowerCase();
  const list = sorted().filter(t => { const f = info(t); return homeF === 'all' || (homeF === 'cur' && f.enCours) || (homeF === 'fut' && f.futur) || (homeF === 'fav' && t.fav) || String(D(t.du).getFullYear()) === homeF; })
    .filter(t => !q || norm(place(t) + ' ' + C(t).n + ' ' + t.lieux.join(' ')).includes(norm(q)));
  $('picks').innerHTML = list.map(t => `<div class="dcard">${phHTML(t.cover, `${t.id}|cover`, 'Photo')}<span class="sh"></span><button class="open" data-open="${t.id}"><b>${esc(short(t))}</b><span>${esc(C(t).n)}</span><em class="num">${SV.star}${photosCount(t)} photo${photosCount(t) > 1 ? 's' : ''}</em></button></div>`).join('')
    + (list.length ? '' : `<p class="small" style="padding:30px 0">Aucun voyage ne correspond.</p>`)
    + `<button class="dcard new" data-act="newTrip"><i>${SV.plus}</i>Nouveau</button>`;
}

/* ---------- liste des voyages ---------- */
let vF = 'all';
function renderCards() {
  const years = [...new Set(S.trips.map(x => D(x.du).getFullYear()))].sort((a, b) => b - a);
  const list = sorted().filter(t => vF === 'all' || (vF === 'fav' && t.fav) || (vF === 'cur' && info(t).enCours) || String(D(t.du).getFullYear()) === vF);
  const days = S.trips.reduce((a, t) => a + info(t).jours, 0);
  $('s-carnets').innerHTML = `
   <div class="vtop"><button class="iconbtn" data-act="back" aria-label="Retour">${SV.back}</button><h1>Mes voyages</h1><div class="r"><button class="iconbtn" data-act="go" data-to="journal" aria-label="Journal">${SV.book}</button><button class="iconbtn" data-act="go" data-to="carte" aria-label="Carte">${SV.globe}</button><button class="iconbtn" data-act="newTrip" aria-label="Nouveau voyage">${SV.plus}</button></div></div>
   <div class="vsearch">${SV.globe}<div><b>${S.trips.length} carnet${S.trips.length > 1 ? 's' : ''}, ${new Set(S.trips.map(x => x.pays)).size} pays</b><span>${days} jours de voyage, ${fmt(S.trips.reduce((a, x) => a + spentOf(x), 0))} dépensés</span></div></div>
   ${S.trips.length ? `<div class="vchips">${[['all', 'Tous'], ['fav', 'Favoris'], ['cur', 'En cours'], ...years.map(y => [String(y), String(y)])].map(([k, l]) => `<button data-act="vf" data-v="${k}" class="${vF === k ? 'on' : ''}">${l}</button>`).join('')}</div>` : ''}
   <div class="vlist">${list.map(t => { const f = info(t), s = spentOf(t);
     return `<div class="vcard"><div style="position:relative">${phHTML(t.cover, `${t.id}|cover`, 'Ajouter une couverture')}<button class="heart ${t.fav ? 'on' : ''}" data-act="fav" data-trip="${t.id}" aria-label="Favori">${t.fav ? SV.heartF : SV.heart}</button></div>
       <button class="bd" data-open="${t.id}"><span class="l1"><b>${esc(place(t))}</b><span class="num">${SV.star}${photosCount(t)}</span></span><span class="l2">${esc(C(t).n)}, ${fd(t.du)} au ${fd(t.au)} ${D(t.du).getFullYear()}, ${f.jours} jours</span>
       <span class="l3 num">${f.futur ? `Budget <b>${fmt(t.budget)}</b>` : s <= t.budget ? `<s>${fmt(t.budget)}</s><b>${fmt(s)}</b> dépensés` : `<b>${fmt(s)}</b> dépensés, budget ${fmt(t.budget)}`}</span></button></div>`; }).join('')}
     <button class="vcard new" data-act="newTrip">${SV.plus}Nouveau voyage</button></div>`;
}
ACT.vf = d => { vF = d.v; renderCards(); };

/* ---------- journal ---------- */
let jId = null, jView = 'pages';
function renderJournal() {
  if (!jId || !trip(jId)) jId = (currentTrip() || sorted()[0] || {}).id;
  const t = trip(jId), sc = $('s-journal');
  if (!t) { sc.innerHTML = `<div class="navrow"><button class="iconbtn" data-act="back" aria-label="Retour">${SV.back}</button></div><h1 class="bigtitle sans">Journal</h1><div class="emptycard"><b>Pas encore de journal</b><p>Crée ton premier voyage pour commencer à écrire tes souvenirs.</p><button class="btn2 g wide" data-act="newTrip">${SV.plus}Créer un voyage</button></div>`; return; }
  sc.innerHTML = `
   <div class="navrow"><button class="iconbtn" data-act="back" aria-label="Retour">${SV.back}</button><button class="picker-btn" data-act="pickJournal">${flag(t.pays)}${esc(short(t))} ${SV.down}</button><button class="pill dark" data-act="addPage" data-trip="${t.id}">${SV.plus}Page</button></div>
   <h1 class="bigtitle sans" style="margin-top:8px">Journal</h1>
   <div class="filters"><button class="${jView === 'pages' ? 'on' : ''}" data-act="jview" data-v="pages">Moments</button><button class="${jView === 'photos' ? 'on' : ''}" data-act="jview" data-v="photos">Photos</button><button class="${jView === 'lieux' ? 'on' : ''}" data-act="jview" data-v="lieux">Lieux</button></div>
   ${jView === 'pages' ? (t.entrees.length ? `<div class="tl">${t.entrees.map(e => `<div class="jentry">
       <div class="h"><span class="d">${caps(fd(addDays(t.du, e.j - 1)))}</span><div><h3>${esc(e.t)}</h3>${e.n ? `<p class="n">${esc(e.n)}</p>` : ''}</div><button class="menu" data-act="pageMenu" data-trip="${t.id}" data-entry="${e.id}" aria-label="Options">${SV.dots}</button></div>
       <div class="gal">${e.photos.map((p, i) => phHTML(p, `${t.id}|e|${e.id}|${i}`)).join('')}${e.photos.length < 6 ? `<button class="slot" data-act="addSlot" data-trip="${t.id}" data-entry="${e.id}" aria-label="Ajouter un cadre">${SV.plus}</button>` : ''}</div>
       <p class="sp num">Jour ${e.j}, ${fmt(daysOf(t)[e.j - 1] || 0)} dépensés hors logement</p></div>`).join('')}</div>`
       : `<div class="emptyj">Pas encore de page. Ajoute ton premier moment.<br><button class="pill dark" style="margin-top:12px" data-act="addPage" data-trip="${t.id}">${SV.plus}Ajouter une page</button></div>`)
   : jView === 'photos' ? `<div class="photogrid">${phHTML(t.cover, `${t.id}|cover`)}${t.entrees.flatMap(e => e.photos.map((p, i) => phHTML(p, `${t.id}|e|${e.id}|${i}`))).join('')}</div><p class="small" style="margin-top:12px">${photosCount(t)} photos. Touche un cadre gris pour en ajouter.</p>`
   : `<div class="tags">${t.lieux.map((l, i) => `<span class="pill">${esc(l)}<button class="x" data-act="rmPlace" data-trip="${t.id}" data-i="${i}" aria-label="Retirer ${esc(l)}">${SV.x.replace('<svg', '<svg width="11" height="11"')}</button></span>`).join('')}<button class="pill add" data-act="addPlace" data-trip="${t.id}">${SV.plus}Lieu</button></div>`}
   <button class="btn full" data-open="${t.id}" style="margin-top:24px">Ouvrir la fiche du voyage<i>${SV.arrow}</i></button>`;
}
ACT.jview = d => { jView = d.v; renderJournal(); };
ACT.pickJournal = () => openPanel(`<h2>Choisir un voyage</h2><div class="menulist">${sorted().map(t => `<button data-act="setJournal" data-trip="${t.id}">${flag(t.pays)}${esc(place(t))}<span class="small" style="margin-left:auto">${fd(t.du)}</span></button>`).join('')}</div>${CLOSE()}`, null, { nofocus: true });
ACT.setJournal = d => { jId = d.trip; closePanel(); renderJournal(); };

/* ---------- carte à plat ---------- */
let mapSel = null, mapT = { x: 0, y: 0, k: 1 }, mapBuilt = false, mproj = null;
let mapMode = (() => { try { return localStorage.getItem('escale:map') || 'globe'; } catch (e) { return 'globe'; } })();
const mapToggle = () => `<div class="mtoggle" role="tablist"><button class="${mapMode === 'globe' ? 'on' : ''}" data-act="mapMode" data-v="globe">${SV.globe}Globe 3D</button><button class="${mapMode === 'plan' ? 'on' : ''}" data-act="mapMode" data-v="plan">${SV.flatmap}Plan</button></div>`;
ACT.mapMode = d => { if (d.v === mapMode) return; mapMode = d.v; try { localStorage.setItem('escale:map', d.v); } catch (e) { } mapBuilt = false; renderCarte(); };
const mapItems = () => [...S.trips.map(t => ({ t, wish: false })), ...S.envies.map(w => ({ t: w, wish: true }))];
const pinHTML = ({ t, wish }, extra = '') => `<button class="mpin ${wish ? 'wish' : ''} ${!wish && t.id === mapSel ? 'on' : ''}" ${extra} data-pin="${wish ? '' : t.id}" data-wish="${wish ? esc(C(t).n) : ''}" aria-label="${wish ? 'Envie : ' + esc(C(t).n) : esc(place(t))}"><span class="c">${!wish && t.cover ? IMG(t.cover) : flag(t.pays)}</span></button>`;
function renderCarte() {
  if (mapMode !== 'plan') return renderGlobe();
  const sc = $('s-carte');
  if (!window.d3 || !window.topojson) { sc.innerHTML = `<div style="padding:70px 20px"><h1 class="bigtitle">Carte</h1><p class="small" style="margin-top:12px">La carte n'a pas pu se charger.</p></div>`; return; }
  const W = 1400, H = 720;
  if (!mproj) mproj = d3.geoNaturalEarth1().fitExtent([[0, 0], [W, H]], { type: 'Sphere' });
  const feats = topojson.feature(WORLD, WORLD.objects.countries).features.filter(f => f.id !== '010');
  const path = d3.geoPath(mproj), cur = currentTrip(), visited = new Set(S.trips.map(t => C(t).iso)), wish = new Set(S.envies.map(w => C(w).iso));
  if (!mapSel || !trip(mapSel)) mapSel = (cur || sorted()[0] || {}).id;
  sc.innerHTML = `<div class="mapwrap" id="mapwrap"><div class="mapinner" id="mapinner"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-label="Carte du monde de tes voyages">${feats.map(f => `<path class="land ${cur && f.id === C(cur).iso ? 'c' : visited.has(f.id) ? 'v' : wish.has(f.id) ? 'w' : ''}" d="${path(f)}"/>`).join('')}</svg>
     ${mapItems().map(it => { const [x, y] = mproj(C(it.t).ll); return pinHTML(it, `style="left:${x}px;top:${y}px"`) + `<span class="mlabel ${it.wish ? 'wish' : ''}" style="left:${x}px;top:${y}px">${esc(it.wish ? C(it.t).n : short(it.t))}</span>`; }).join('')}</div></div>
   <div class="maphead"><h1 class="bigtitle">Carte</h1></div>
   ${mapToggle()}${mapLegend()}
   <div class="zoom"><button data-act="zoom" data-z="1.4" aria-label="Zoomer">${SV.plus}</button><button data-act="zoom" data-z="0.7" aria-label="Dézoomer">${SV.minus}</button><button data-act="zoomAll" aria-label="Tout afficher">${SV.globe}</button></div>
   <div id="mapcard"></div>`;
  const wrap = $('mapwrap');
  if (!mapBuilt) { mapBuilt = true; const t = trip(mapSel); centerOn(t ? C(t).ll : [10, 40], t ? 2.2 : .62, false); }
  applyMap();
  let p0 = null, start = null, moved = false;
  wrap.addEventListener('pointerdown', e => { p0 = { x: e.clientX, y: e.clientY }; start = { ...mapT }; moved = false; });
  wrap.addEventListener('pointermove', e => { if (!p0) return; const dx = e.clientX - p0.x, dy = e.clientY - p0.y; if (Math.abs(dx) + Math.abs(dy) > 4) { if (!moved) { moved = true; try { wrap.setPointerCapture(e.pointerId); } catch (_) { } } mapT.x = start.x + dx; mapT.y = start.y + dy; applyMap(); } });
  const end = e => { if (!p0) return; const was = moved; p0 = null; if (!was) { const pin = e.target.closest('.mpin'); if (pin) { if (pin.dataset.pin) { if (mapSel === pin.dataset.pin && pin.classList.contains('on')) { openTrip(mapSel); return; } mapSel = pin.dataset.pin; document.querySelectorAll('.mpin').forEach(x => x.classList.toggle('on', x === pin)); renderMapCard(); } else toast(pin.dataset.wish + ' est dans tes envies'); } } };
  wrap.addEventListener('pointerup', end); wrap.addEventListener('pointercancel', () => p0 = null);
  wrap.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.deltaY < 0 ? 1.15 : .87, e.clientX, e.clientY); }, { passive: false });
  renderMapCard();
}
function applyMap() { const el = $('mapinner'); if (el) el.style.transform = `translate(${mapT.x}px,${mapT.y}px) scale(${mapT.k})`; document.querySelectorAll('#mapinner .mpin,#mapinner .mlabel').forEach(p => { p.style.transform = (p.classList.contains('mlabel') ? 'translate(10px,-6px) ' : '') + `scale(${1 / mapT.k})`; p.style.transformOrigin = p.classList.contains('mpin') ? '50% 100%' : '0 50%'; }); }
function centerOn(ll, k, anim) { const wrap = $('mapwrap'); if (!wrap) return; const r = wrap.getBoundingClientRect(), [x, y] = mproj(ll); const to = { k, x: r.width / 2 - x * k, y: r.height * .48 - y * k };
  if (anim && window.gsap && !REDUCED) gsap.to(mapT, { ...to, duration: .8, ease: 'power2.inOut', onUpdate: applyMap }); else { Object.assign(mapT, to); applyMap(); } }
function zoomAt(f, cx, cy) { const r = $('mapwrap').getBoundingClientRect(), px = (cx ?? r.left + r.width / 2) - r.left, py = (cy ?? r.top + r.height / 2) - r.top, k = Math.max(.6, Math.min(8, mapT.k * f)); mapT.x = px - (px - mapT.x) * (k / mapT.k); mapT.y = py - (py - mapT.y) * (k / mapT.k); mapT.k = k; applyMap(); }
ACT.zoom = d => { if (mapMode === 'globe' && $('gwrap')) { const z = Math.max(.8, Math.min(4, GL.z * (+d.z > 1 ? 1.4 : 1 / 1.4))); GL.fly = null; if (window.gsap && !REDUCED) gsap.to(GL, { z, duration: .35, ease: 'power2.out' }); else GL.z = z; return; } zoomAt(+d.z); };
ACT.zoomAll = () => { if (mapMode === 'globe' && $('gwrap')) { const t = trip(mapSel); glFly(t ? C(t).ll : [10, 35], 1); return; } centerOn([20, 30], .62, true); };
function renderMapCard() { const t = trip(mapSel), host = $('mapcard'); if (!host) return; if (!t) { host.innerHTML = S.trips.length ? '' : `<div class="mapcard"><div class="m"><h3>Ta carte est vide</h3><p class="small">Chaque voyage ajoute un repère sur la carte.</p></div><button class="go" data-act="newTrip" aria-label="Créer un voyage">${SV.plus}</button></div>`; return; } const f = info(t);
  host.innerHTML = `<div class="mapcard">${phHTML(t.cover, `${t.id}|cover`)}<div class="m"><h3>${esc(place(t))}</h3><p class="small">${esc(C(t).n)}, ${f.enCours ? 'en cours' : f.futur ? 'à venir' : 'visité'} le ${fd(t.du)} ${D(t.du).getFullYear()}</p><p class="small num">${fmt(f.futur ? t.budget : spentOf(t))}, ${f.jours} jours</p></div><button class="go" data-open="${t.id}" aria-label="Ouvrir ${esc(place(t))}">${SV.chev}</button></div>`;
  if (mapMode === 'plan') centerOn(C(t).ll, Math.max(mapT.k, 2.2), true); }

/* ---------- globe 3D ---------- */
const GL = { rot: [-15, -38, 0], vel: 0, drag: false, idle: true, fly: null, z: 1, run: false, sel: null };
let glFeats, glGrat, glProj, glPath, glCtx, glPins = [], glW = 0, glH = 0, glDpr = 1;
function renderGlobe() {
  const sc = $('s-carte');
  if (!window.d3 || !window.topojson) { sc.innerHTML = `<div style="padding:70px 20px"><h1 class="bigtitle">Carte</h1><p class="small" style="margin-top:12px">Le globe n'a pas pu se charger.</p></div>${mapToggle()}`; return; }
  if (!glFeats) { glFeats = topojson.feature(WORLD, WORLD.objects.countries).features.filter(f => f.id !== '010'); glGrat = d3.geoGraticule10(); glProj = d3.geoOrthographic().clipAngle(90).precision(.5); }
  const items = mapItems();
  if (!mapSel || !trip(mapSel)) mapSel = (currentTrip() || sorted()[0] || {}).id;
  sc.innerHTML = `<div class="gwrap" id="gwrap"><canvas id="gcv2"></canvas><div class="gpins2" id="gpins2">${items.map(it => pinHTML(it, 'data-act="gpin"')).join('')}</div></div>
   <div class="maphead"><h1 class="bigtitle">Carte</h1></div>
   ${mapToggle()}${mapLegend()}
   <div class="zoom"><button data-act="zoom" data-z="1.4" aria-label="Zoomer">${SV.plus}</button><button data-act="zoom" data-z="0.7" aria-label="Dézoomer">${SV.minus}</button><button data-act="zoomAll" aria-label="Recentrer">${SV.globe}</button></div>
   <div id="mapcard"></div>`;
  glPins = [...sc.querySelectorAll('.gpins2 .mpin')].map((b, i) => ({ b, ll: C(items[i].t).ll }));
  glCtx = $('gcv2').getContext('2d'); glPath = d3.geoPath(glProj, glCtx); glW = 0;
  const box = $('gwrap'), pts = new Map(); let pinch = null;
  box.addEventListener('pointerdown', e => { if (e.target.closest('.mpin')) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); try { box.setPointerCapture(e.pointerId); } catch (_) { }
    GL.drag = true; GL.idle = false; GL.fly = null; GL.vel = 0;
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: GL.z }; } });
  box.addEventListener('pointermove', e => { const o = pts.get(e.pointerId); if (!o) return; const dx = e.clientX - o.x, dy = e.clientY - o.y; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size >= 2 && pinch) { const [a, b] = [...pts.values()]; GL.z = Math.max(.8, Math.min(4, pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d)); return; }
    const k = .32 / GL.z; GL.rot[0] += dx * k; GL.rot[1] = Math.max(-75, Math.min(75, GL.rot[1] - dy * k)); GL.vel = dx * k; });
  const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (!pts.size) GL.drag = false; };
  box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
  box.addEventListener('wheel', e => { e.preventDefault(); GL.z = Math.max(.8, Math.min(4, GL.z * (e.deltaY < 0 ? 1.12 : .89))); }, { passive: false });
  if (!GL.run) { GL.run = true; requestAnimationFrame(glLoop); addEventListener('resize', () => glW = 0); }
  const t = trip(mapSel); if (t && !GL.placed) { GL.placed = true; GL.rot = [-C(t).ll[0], -C(t).ll[1] + 8, 0]; }
  renderMapCard();
}
function glDraw() {
  const box = $('gwrap'), cv = $('gcv2'); if (!box || !cv) return;
  if (!glW) { const r = box.getBoundingClientRect(); glW = r.width; glH = r.height; glDpr = Math.min(2, devicePixelRatio || 1); cv.width = glW * glDpr; cv.height = glH * glDpr; }
  const W = glW, H = glH; if (!W) return; const R = Math.min(W * .46, H * .36) * GL.z, cx = W / 2, cy = H * .5, ctx = glCtx;
  glProj.scale(R).translate([cx, cy]).rotate(GL.rot);
  ctx.setTransform(glDpr, 0, 0, glDpr, 0, 0); ctx.clearRect(0, 0, W, H);
  let g = ctx.createRadialGradient(cx, cy, R * .95, cx, cy, R * 1.22); g.addColorStop(0, 'rgba(46,94,62,.16)'); g.addColorStop(1, 'rgba(46,94,62,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.22, 0, 7); ctx.fill();
  g = ctx.createRadialGradient(cx - R * .35, cy - R * .4, R * .1, cx, cy, R); g.addColorStop(0, '#EEF4F3'); g.addColorStop(1, '#C2D4D3');
  ctx.beginPath(); glPath({ type: 'Sphere' }); ctx.fillStyle = g; ctx.fill();
  ctx.beginPath(); glPath(glGrat); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = .6; ctx.stroke();
  const visited = new Set(S.trips.map(t => C(t).iso)), cur = currentTrip(), curIso = cur ? C(cur).iso : null, wish = new Set(S.envies.map(w => C(w).iso));
  glFeats.forEach(f => { ctx.beginPath(); glPath(f); const kind = f.id === curIso ? 'c' : visited.has(f.id) ? 'v' : wish.has(f.id) ? 'w' : '', show = kind && (mapShow === 'all' || (mapShow === 'w' ? kind === 'w' : kind !== 'w'));
    ctx.fillStyle = show ? MAPCOL[kind] : '#FBFAF7'; ctx.fill(); if (show && kind === 'w') { ctx.fillStyle = wishPattern(ctx); ctx.fill(); } ctx.strokeStyle = 'rgba(120,125,115,.35)'; ctx.lineWidth = .5; ctx.stroke(); });
  g = ctx.createRadialGradient(cx - R * .3, cy - R * .35, R * .2, cx, cy, R * 1.02); g.addColorStop(0, 'rgba(255,255,255,.14)'); g.addColorStop(.7, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(15,25,20,.25)');
  ctx.beginPath(); glPath({ type: 'Sphere' }); ctx.fillStyle = g; ctx.fill();
  const center = [-GL.rot[0], -GL.rot[1]];
  glPins.forEach(({ b, ll }) => { const dist = d3.geoDistance(ll, center), vis = dist < 1.45, [x, y] = glProj(ll), depth = Math.cos(Math.min(dist, 1.57));
    b.style.transform = `translate(${x}px,${y}px) scale(${.55 + .45 * depth})`; b.style.opacity = vis ? Math.min(1, depth * 1.8) : 0; b.style.pointerEvents = vis ? 'auto' : 'none'; b.style.zIndex = Math.round(depth * 100) + (b.classList.contains('on') ? 100 : 0); });
}
function glLoop() {
  if (current === 'carte' && mapMode === 'globe' && $('gcv2')) {
    if (GL.fly) { const k = Math.min(1, (performance.now() - GL.fly.t0) / GL.fly.dur), e = d3.easeCubicInOut(k); GL.rot = GL.fly.r(e); if (GL.fly.z) GL.z = GL.fly.z(e); if (k >= 1) GL.fly = null; }
    else if (!GL.drag) { if (Math.abs(GL.vel) > .01) { GL.rot[0] += GL.vel; GL.vel *= .94; } else if (GL.idle && !REDUCED) GL.rot[0] += .06; }
    glDraw();
  }
  requestAnimationFrame(glLoop);
}
function glFly(ll, z) { GL.idle = false; const to = [-ll[0], -ll[1] + 8, 0], from = GL.rot.slice(); while (to[0] - from[0] > 180) to[0] -= 360; while (from[0] - to[0] > 180) to[0] += 360;
  if (REDUCED) { GL.rot = to; if (z) GL.z = z; return; } GL.fly = { r: d3.interpolate(from, to), z: z ? d3.interpolate(GL.z, z) : null, t0: performance.now(), dur: 1100 }; }
ACT.gpin = d => { if (!d.pin) { const w = S.envies.find(x => C(x).n === d.wish); toast(`${d.wish} est dans tes envies${w && w.note ? ' : ' + w.note : ''}`); if (w) glFly(C(w).ll); return; }
  if (d.pin === mapSel && GL.sel === d.pin) { openTrip(d.pin); return; }
  mapSel = d.pin; GL.sel = d.pin; document.querySelectorAll('#gpins2 .mpin').forEach(x => x.classList.toggle('on', x.dataset.pin === d.pin)); renderMapCard(); glFly(C(trip(d.pin)).ll, Math.max(GL.z, 1.6)); };

/* ---------- navigation ---------- */
let current = 'home', prev = 'home';
const SCREENS = { home: renderHome, journal: renderJournal, carte: renderCarte, carnets: renderCards, depenses: () => renderDepenses() };
function go(s, mode) {
  if (!$('s-' + s)) return;
  if (s !== current) prev = current;
  current = s;
  document.querySelectorAll('.screen').forEach(x => { x.hidden = x.id !== 's-' + s; x.classList.remove('enter', 'push', 'flip'); });
  const el = $('s-' + s); if (s !== 'carnet') el.scrollTop = 0; void el.offsetWidth; el.classList.add(mode === 'flip' ? 'push' : (mode || 'enter'));
  const tab = { home: 'home', carnets: 'carnets', carnet: 'carnets', journal: 'carnets', carte: 'carte', depenses: 'home', ia: 'home', fil: 'fil', profil: 'profil', ami: 'fil' }[s];
  $('s-carte').dataset.show = mapShow;
  document.querySelectorAll('nav [data-go]').forEach(b => b.classList.toggle('on', b.dataset.go === tab));
  document.querySelector('nav').hidden = s === 'carnet';
  $('fab').hidden = ['carnet', 'ia', 'carte', 'ami', 'fil', 'profil'].includes(s);
  $('askbar').hidden = s !== 'ia'; $('dock').hidden = s !== 'carnet';
  if (SCREENS[s]) SCREENS[s]();
  if (s === 'ia') { renderScope(); renderSugg(); if (!$('chat').children.length) greet(); }
}
function refresh() { if (current === 'carnet') openTrip(openId, true); else if (current === 'depenses') renderDepenses(true); else if (current === 'ia') renderScope(); else if (SCREENS[current]) SCREENS[current](); }
function toast(m) { const t = $('toast'); t.textContent = m; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2800); }

/* ---------- menu + ---------- */
const noTrip = () => { if (S.trips.length) return false; closePanel(); setTimeout(() => { tripSheet(); toast("Crée d'abord ton premier voyage"); }, $('panel').classList.contains('open') ? 380 : 0); return true; };
ACT.plusMenu = () => { const t = currentTrip() || sorted()[0];
  openPanel(`<h2>Ajouter</h2><p class="small">${t ? 'Au voyage ' + esc(place(t)) : ''}</p><div class="menulist">
    <button data-act="compose">${SV.send}Publier un souvenir</button>
    <button data-act="addExp">${SV.receipt}Une dépense</button>
    <button data-act="addPage">${SV.page}Une page de journal</button>
    <button data-act="photoNow">${SV.cam}Une photo</button>
    <button data-act="newTrip">${SV.plane}Un nouveau voyage</button>
    <button data-act="addWish">${SV.heart}Une envie</button></div>${CLOSE()}`, null, { nofocus: true }); };
['addExp', 'newTrip', 'addWish', 'addPage'].forEach(k => { const f = ACT[k]; ACT[k] = fromPanel(f); });
ACT.photoNow = fromPanel(() => { const t = currentTrip() || sorted()[0]; ACT.photoTrip({ trip: t.id }); });
['addExp', 'addPage', 'photoNow', 'photoTrip'].forEach(k => { const f = ACT[k]; ACT[k] = d => { if (noTrip()) return; return f(d || {}); }; });
SV.minus = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/></svg>';
SV.warn = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17v.5"/></svg>';
