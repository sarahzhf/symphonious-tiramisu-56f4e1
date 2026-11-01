/* Escale : réseau social (fil, publications, réactions, commentaires, amis, défis, notifications).
 * Toutes les règles de visibilité sont appliquées par la base de données : l'appli
 * n'affiche que ce que le serveur accepte de lui donner. Tout texte venant d'un autre
 * membre est échappé avant affichage. */
'use strict';
const VIS = { public: { n: 'Public', d: 'Tout le monde', ic: () => SV.globeS }, friends: { n: 'Amis', d: 'Tes amis seulement', ic: () => SV.users }, private: { n: 'Privé', d: 'Toi seule', ic: () => SV.lock } };
const visTag = v => `<span class="vis">${VIS[v].ic()}${VIS[v].n}</span>`;
const RX = ['❤️', '😍', '😭', '🙌', '🔥'];
const AVC = ['#2E5E3E', '#B8452C', '#3C6E8F', '#8A6A3B', '#6B4E8A', '#2F7C78', '#9A4E64'];
const CC = { logement: '#2E5E3E', repas: '#6E9A78', transport: '#A9C4AF', activites: '#3C6E8F', shopping: '#B9D2E6' };
const POSTS = new Map();
function ago(iso) { const m = Math.round((Date.now() - new Date(iso)) / 6e4); if (m < 1) return "à l'instant"; if (m < 60) return `il y a ${m} min`; const h = Math.round(m / 60); if (h < 24) return `il y a ${h} h`; const d = Math.round(h / 24); if (d < 7) return `il y a ${d} j`; return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); }
const hue = id => { let h = 0; for (const c of String(id || '')) h = (h * 31 + c.charCodeAt(0)) | 0; return AVC[Math.abs(h) % AVC.length]; };
const initials = n => esc(String(n || '?').trim().split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase());
function avatar(u, cls = '') { u = u || {}; return `<span class="av ${cls}" style="background:${hue(u.id || u.handle)}">${u.avatar_path ? IMG(u.avatar_path) : initials(u.display_name)}</span>`; }
const meUser = () => ({ id: ME.id, display_name: PROFILE.display_name, handle: PROFILE.handle, avatar_path: PROFILE.avatar_path });
const first = n => esc(String(n || '').split(' ')[0]);

/* ---------- carte de publication ---------- */
function postCard(p) {
  POSTS.set(p.id, p);
  const mine = p.author_id === ME.id, u = { id: p.author_id, ...p.author };
  const tot = Object.values(p.reactions || {}).reduce((a, b) => a + b, 0), top = Object.entries(p.reactions || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([e]) => esc(e)).join('');
  const n = p.photos.length;
  return `<article class="post" data-post="${p.id}">
   <div class="ph-head">${avatar(u)}<button class="who" data-act="openUser" data-u="${p.author_id}"><b>${esc(u.display_name)}</b><span>${p.country_code ? flag(p.country_code) : ''}${esc(p.place)}, ${ago(p.created_at)}, ${visTag(p.visibility)}</span></button><button class="more2" data-act="postMenu" data-p="${p.id}" aria-label="Options">${SV.dots}</button></div>
   <div class="car"><div class="track2" data-count="${n}">${p.photos.map(ph => `<div class="slide">${IMG(ph, p.place)}</div>`).join('') || '<div class="slide"></div>'}</div>
     ${n > 1 ? `<span class="cnt">1 / ${n}</span>` : ''}${mine && p.trip_id && trip(p.trip_id) ? `<button class="place" data-open="${p.trip_id}">${SV.book}Voir le carnet</button>` : `<span class="place">${SV.place}${esc(p.place)}</span>`}</div>
   <div class="pact"><button class="${p.my_reaction === '❤️' ? 'liked' : ''}" data-act="react" data-p="${p.id}" data-e="❤️" aria-label="J'aime">${p.my_reaction && p.my_reaction !== '❤️' ? `<span class="rx">${esc(p.my_reaction)}</span>` : (p.my_reaction === '❤️' ? SV.heartF : SV.heart)}</button>
     <button data-act="tray" data-p="${p.id}" aria-label="Réagir">${SV.smile}</button>
     <button data-act="focusC" data-p="${p.id}" aria-label="Commenter">${SV.comment}${p.comment_count || ''}</button>
     <button data-act="sharePost" data-p="${p.id}" aria-label="Partager">${SV.send}</button><span class="sp"></span>
     <button data-act="savePost" data-p="${p.id}" aria-label="${p.saved ? 'Retirer des enregistrements' : 'Enregistrer'}">${p.saved ? SV.saveF : SV.save}</button></div>
   <div class="tray" hidden>${[...RX, ...(p.my_reaction && !RX.includes(p.my_reaction) ? [p.my_reaction] : [])].map(e => `<button class="${p.my_reaction === e ? 'on' : ''}" data-act="react" data-p="${p.id}" data-e="${esc(e)}" aria-label="Réagir ${esc(e)}">${esc(e)}</button>`).join('')}<button class="plusE" data-act="emojiPick" data-p="${p.id}" aria-label="Choisir un autre émoji">${SV.plus}</button></div>
   ${mine && p.visibility === 'private' ? `<div class="private-note">${SV.lock}Visible uniquement par toi. Change la visibilité dans les options.</div>` : ''}
   ${p.challenge ? `<div class="chalbadge">${SV.target}${p.challenge.from_id === ME.id ? 'Ton défi, relevé' : `Défi lancé par ${first(p.challenge.from)}`} : ${esc(p.challenge.place)}</div>` : ''}
   ${p.budget_summary ? budHTML(p) : ''}
   <div class="pbody">${tot ? `<p class="rsum"><span class="em">${top}</span>${tot} réaction${tot > 1 ? 's' : ''}${p.my_reaction ? ', dont la tienne' : ''}</p>` : ''}
     ${p.caption ? `<p class="cap"><b>${first(u.display_name)}</b>${esc(p.caption)}</p>` : ''}
     ${(p.comments || []).map(c => `<p class="cm"><b>${first(c.display_name)}</b>${esc(c.body)}</p>`).join('')}${(p.comments || []).length ? `<button class="allc rxc" data-act="allComments" data-p="${p.id}">${SV.smile}Réagir aux commentaires</button>` : ''}
     ${p.comment_count > (p.comments || []).length ? `<button class="allc" data-act="allComments" data-p="${p.id}">Voir les ${p.comment_count} commentaires</button>` : ''}
     <p class="time">${ago(p.created_at)}</p></div>
   <form class="cform" data-cform="${p.id}">${avatar(meUser(), 'sm')}<input aria-label="Commenter" maxlength="1000" placeholder="Ajouter un commentaire…" autocomplete="off"><button>Publier</button></form>
  </article>`;
}
function budHTML(p) { const b = p.budget_summary, ent = Object.entries(b.cats || {}).filter(([, v]) => v > 0).sort((a, c) => c[1] - a[1]);
  return `<div class="pbud"><div class="t"><b class="num">${fmt(b.total)}</b><span>${b.jours} jour${b.jours > 1 ? 's' : ''}, ${fmt(b.total / Math.max(1, b.jours))} par jour</span></div>
   <div class="bar">${ent.map(([k, v]) => `<i style="flex:${+v};background:${CC[k]}"></i>`).join('')}</div>
   <div class="lg">${ent.slice(0, 4).map(([k, v]) => `<span><i style="background:${CC[k]}"></i>${CATS[k].n} ${fmt(v)}</span>`).join('')}</div>
   ${p.author_id !== ME.id ? `<button class="cmp" data-act="compareBud" data-p="${p.id}">${SV.scale}Comparer avec mes voyages</button>` : ''}</div>`; }
function rerenderPost(id) { const p = POSTS.get(id); if (!p) return; document.querySelectorAll(`[data-post="${id}"]`).forEach(el => { const tmp = document.createElement('div'); tmp.innerHTML = postCard(p); el.replaceWith(tmp.firstElementChild); }); }
async function reloadPost(id) { const r = await rpc('feed', { p_scope: 'one', p_user: id }); if (r && r[0]) { POSTS.set(id, r[0]); rerenderPost(id); } else { POSTS.delete(id); document.querySelectorAll(`[data-post="${id}"]`).forEach(el => el.remove()); } }
document.addEventListener('scroll', e => { const t = e.target; if (t.classList && t.classList.contains('track2')) { const c = t.parentNode.querySelector('.cnt'); if (c) c.textContent = (Math.round(t.scrollLeft / t.clientWidth) + 1) + ' / ' + t.dataset.count; } }, true);
document.addEventListener('submit', async e => { const f = e.target.closest('[data-cform]'); if (!f) return; e.preventDefault();
  const inp = f.querySelector('input'), t = inp.value.trim(); if (!t) { inp.focus(); toast("Écris d'abord ton commentaire"); return; }
  const { error } = await sb.from('comments').insert({ post_id: f.dataset.cform, body: t.slice(0, 1000) });
  if (error) { toast(error.code === 'P0429' ? error.message : 'Commentaire impossible'); return; }
  inp.value = ''; await reloadPost(f.dataset.cform); toast('Commentaire publié'); });
const visEl = sel => [...document.querySelectorAll(sel)].find(e => e.closest('#panel.open') || (!$('panel').classList.contains('open') && e.closest('.screen:not([hidden])')));
ACT.react = async d => { const p = POSTS.get(d.p); const next = p.my_reaction === d.e ? null : d.e;
  const r = { ...(p.reactions || {}) }; if (p.my_reaction) { r[p.my_reaction] = (r[p.my_reaction] || 1) - 1; if (r[p.my_reaction] <= 0) delete r[p.my_reaction]; } if (next) r[next] = (r[next] || 0) + 1;
  POSTS.set(p.id, { ...p, reactions: r, my_reaction: next }); rerenderPost(p.id);
  try { await rpc('react', { p_post: p.id, p_emoji: next }); } catch (e) { POSTS.set(p.id, p); rerenderPost(p.id); toast(errMsg(e)); } };
ACT.tray = d => { const card = visEl(`[data-post="${d.p}"]`); const t = card && card.querySelector('.tray'); if (t) t.hidden = !t.hidden; };
ACT.focusC = d => { const card = visEl(`[data-post="${d.p}"]`); const i = card && card.querySelector('.cform input'); if (i) { i.scrollIntoView({ block: 'center', behavior: 'smooth' }); i.focus({ preventScroll: true }); } };
ACT.savePost = async d => { const p = POSTS.get(d.p), on = !p.saved;
  const { error } = on ? await sb.from('saved_posts').insert({ post_id: p.id }) : await sb.from('saved_posts').delete().eq('post_id', p.id).eq('user_id', ME.id);
  if (error) { toast('Action impossible'); return; } POSTS.set(p.id, { ...p, saved: on }); rerenderPost(p.id); toast(on ? 'Enregistré dans ton profil' : 'Retiré des enregistrements'); };
ACT.sharePost = d => { const p = POSTS.get(d.p); if (p.author_id === ME.id && p.visibility === 'private') { toast('Cette publication est privée : rends-la publique ou visible par tes amis pour la partager'); return; }
  copyText(`${p.author.display_name} sur Escale : ${p.place}. ${p.caption}`.slice(0, 500), 'Texte de la publication copié'); };
ACT.allComments = async d => { const list = await rpc('post_comments', { p_post: d.p }); const p = POSTS.get(d.p); await loadCRx(list.map(c => c.id));
  openPanel(`<h2>Commentaires</h2><div class="flist">${list.map(c => `<div class="frow" data-crow="${c.id}">${avatar({ id: c.author_id, display_name: c.display_name, avatar_path: c.avatar_path }, 'sm')}<div class="m"><b>${esc(c.display_name)}</b><span class="wrap">${esc(c.body)}</span>${cRxHTML(c.id)}</div>${c.author_id === ME.id || p.author_id === ME.id ? `<button class="btn2" data-act="delComment" data-c="${c.id}" data-p="${d.p}" aria-label="Supprimer le commentaire">${SV.trash}</button>` : ''}</div>`).join('') || '<p class="small">Aucun commentaire.</p>'}</div>${CLOSE('Fermer')}`, null, { nofocus: true }); };
/* réactions aux commentaires : une réaction par personne et par commentaire */
const CRX = new Map(); // id du commentaire -> { counts: {emoji: n}, mine: emoji|null }
async function loadCRx(ids) { if (!ids.length) return; try { const { data } = await sb.from('comment_reactions').select('comment_id,emoji,user_id').in('comment_id', ids);
  ids.forEach(id => CRX.set(id, { counts: {}, mine: null })); (data || []).forEach(r => { const x = CRX.get(r.comment_id); x.counts[r.emoji] = (x.counts[r.emoji] || 0) + 1; if (r.user_id === ME.id) x.mine = r.emoji; }); } catch (e) { } }
function cRxHTML(id) { const x = CRX.get(id) || { counts: {}, mine: null }, ent = Object.entries(x.counts).sort((a, b) => b[1] - a[1]);
  return `<div class="crx">${ent.map(([e, n]) => `<button class="${x.mine === e ? 'on' : ''}" data-act="cReact" data-c="${id}" data-e="${esc(e)}">${esc(e)}<b class="num">${n}</b></button>`).join('')}<button class="add" data-act="cTray" data-c="${id}" aria-label="Réagir au commentaire">${x.mine ? '' : SV.smile}${x.mine ? 'Changer' : 'Réagir'}</button><span class="ctray" hidden>${RX.map(e => `<button data-act="cReact" data-c="${id}" data-e="${e}" aria-label="Réagir ${e}">${e}</button>`).join('')}</span></div>`; }
ACT.cTray = (d, a) => { const t = a.parentNode.querySelector('.ctray'); t.hidden = !t.hidden; };
ACT.cReact = async (d, a) => { const x = CRX.get(d.c) || { counts: {}, mine: null }, old = { counts: { ...x.counts }, mine: x.mine }, next = x.mine === d.e ? null : d.e;
  if (x.mine) { x.counts[x.mine]--; if (x.counts[x.mine] <= 0) delete x.counts[x.mine]; } if (next) x.counts[next] = (x.counts[next] || 0) + 1; x.mine = next; CRX.set(d.c, x);
  const row = a.closest('[data-crow]'); const draw = () => { const el = row && row.querySelector('.crx'); if (el) el.outerHTML = cRxHTML(d.c); }; draw();
  try { const r = next ? await sb.from('comment_reactions').upsert({ comment_id: d.c, user_id: ME.id, emoji: next }, { onConflict: 'comment_id,user_id' }) : await sb.from('comment_reactions').delete().eq('comment_id', d.c).eq('user_id', ME.id);
    if (r.error) throw r.error; } catch (e) { CRX.set(d.c, old); draw(); toast(isNetwork(e) ? 'Pas de connexion' : 'Réaction impossible'); } };
ACT.delComment = async d => { const { error } = await sb.from('comments').delete().eq('id', d.c); if (error) { toast('Suppression impossible'); return; } closePanel(); await reloadPost(d.p); toast('Commentaire supprimé'); };
ACT.postMenu = d => { const p = POSTS.get(d.p);
  if (p.author_id !== ME.id) return openPanel(`<h2>Publication de ${first(p.author.display_name)}</h2><div class="menulist">
    <button data-act="openUser" data-u="${p.author_id}">${SV.users}Voir son profil</button>
    <button data-act="report" data-kind="post" data-id="${p.id}">${SV.warn}Signaler cette publication</button>
    <button data-act="blockUser" data-u="${p.author_id}" class="red">${SV.lock}Bloquer ${first(p.author.display_name)}</button></div>${CLOSE('Fermer')}`, null, { nofocus: true });
  openPanel(`<h2>Ta publication</h2><p class="small">Qui peut la voir ?</p><div class="visopts">${Object.entries(VIS).map(([k, v]) => `<button class="${p.visibility === k ? 'on' : ''}" data-act="setPostVis" data-p="${p.id}" data-v="${k}">${v.ic()}${v.n}<span>${v.d}</span></button>`).join('')}</div>
   <label class="fld"><span>Légende</span><textarea id="pm-cap" maxlength="2200">${esc(p.caption)}</textarea></label><button class="btn full" id="pm-ok">Enregistrer<i>${SV.right}</i></button><button class="danger" id="pm-del">Supprimer la publication</button>${CLOSE('Fermer')}`, pp => {
    pp.querySelector('#pm-ok').onclick = async () => { const { error } = await sb.from('posts').update({ caption: pp.querySelector('#pm-cap').value.trim().slice(0, 2200) }).eq('id', p.id); if (error) { toast('Modification impossible'); return; } closePanel(); await reloadPost(p.id); toast('Publication mise à jour'); };
    pp.querySelector('#pm-del').onclick = () => confirmIn(pp, 'Supprimer cette publication ?', async () => { const { error } = await sb.from('posts').delete().eq('id', p.id); if (error) { toast('Suppression impossible'); return; }
      p.photos.filter(x => x.split('/')[1] === 'post').forEach(releaseMedia); flushMediaDeletes(); POSTS.delete(p.id); closePanel(); document.querySelectorAll(`[data-post="${p.id}"]`).forEach(el => el.remove()); toast('Publication supprimée'); });
  }, { nofocus: true }); };
ACT.setPostVis = async d => { const { error } = await sb.from('posts').update({ visibility: d.v }).eq('id', d.p); if (error) { toast('Modification impossible'); return; }
  document.querySelectorAll('#panel .visopts button').forEach(b => b.classList.toggle('on', b.dataset.v === d.v)); await reloadPost(d.p); toast(`Visibilité : ${VIS[d.v].n}`); };

/* émojis */
const EMO = { 'Voyage': ['✈️', '🌍', '🗺️', '🏝️', '🏔️', '🌅', '🚆', '🧳', '📸', '🗼', '⛩️', '🏛️', '🌊', '☀️', '🌸', '🍃'], 'Émotions': ['😂', '🥹', '🤩', '😮', '🥰', '😎', '🤯', '😅', '🙏', '👏', '💯', '✨', '💚', '💙', '🤍', '😢'], 'Nourriture': ['🍜', '🍣', '🍕', '🥐', '🍷', '🍹', '☕', '🍦', '🌮', '🥘', '🍓', '🧁', '🥂', '🍵', '🍤', '🥗'] };
const isEmoji = s => /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(s) && !/[\p{L}\p{N}<>"'&]/u.test(s);
function firstGrapheme(s) { try { return [...new Intl.Segmenter('fr', { granularity: 'grapheme' }).segment(s.trim())][0]?.segment || ''; } catch (e) { return [...s.trim()][0] || ''; } }
const recentEmo = () => { try { return JSON.parse(localStorage.getItem('escale:emo') || '[]'); } catch (e) { return []; } };
ACT.emojiPick = d => { const p = POSTS.get(d.p), rec = recentEmo().filter(e => !RX.includes(e));
  const grid = list => `<div class="emo-grid">${list.map(e => `<button class="${p.my_reaction === e ? 'on' : ''}" data-act="pickEmoji" data-p="${p.id}" data-e="${esc(e)}" aria-label="Réagir ${esc(e)}">${esc(e)}</button>`).join('')}</div>`;
  openPanel(`<h2>Réagir</h2>${rec.length ? `<p class="emo-sec">Récents</p>${grid(rec.slice(0, 8))}` : ''}${Object.entries(EMO).map(([k, v]) => `<p class="emo-sec">${k}</p>${grid(v)}`).join('')}
    <p class="emo-sec">N'importe quel émoji</p><form class="emo-free" id="emoF"><input id="emoI" maxlength="16" placeholder="Tape ou colle un émoji" autocomplete="off" aria-label="Émoji"><button>OK</button></form>${CLOSE('Fermer')}`, pp => {
    pp.querySelector('#emoF').onsubmit = e => { e.preventDefault(); const g = firstGrapheme(pp.querySelector('#emoI').value); if (!g || !isEmoji(g)) { toast("Ce n'est pas un émoji"); return; } ACT.pickEmoji({ p: p.id, e: g }); };
  }, { nofocus: true }); };
ACT.pickEmoji = d => { try { localStorage.setItem('escale:emo', JSON.stringify([d.e, ...recentEmo().filter(x => x !== d.e)].slice(0, 8))); } catch (e) { } closePanel(); const p = POSTS.get(d.p); if (p.my_reaction !== d.e) ACT.react(d); };

/* comparaison de budget */
function bilanOf(t) { const c = catsOf(t), f = info(t), j = f.enCours ? Math.max(1, f.jour) : f.jours; return { total: Math.round(Object.values(c).reduce((a, b) => a + b, 0)), jours: j, cats: Object.fromEntries(Object.entries(c).map(([k, v]) => [k, Math.round(v)])) }; }
ACT.compareBud = d => { const p = POSTS.get(d.p), b = p.budget_summary, u = first(p.author.display_name);
  const past = S.trips.filter(t => !info(t).futur && spentOf(t) > 0), same = past.filter(t => t.pays === p.country_code), ref = same.length ? same : past;
  if (!ref.length) { toast('Ajoute des dépenses à un voyage pour comparer'); return; }
  const myDays = ref.reduce((a, t) => a + bilanOf(t).jours, 0), myPD = ref.reduce((a, t) => a + spentOf(t), 0) / Math.max(1, myDays), herPD = b.total / Math.max(1, b.jours);
  const myC = {}; ref.forEach(t => Object.entries(catsOf(t)).forEach(([k, v]) => myC[k] = (myC[k] || 0) + v / Math.max(1, myDays)));
  const herC = Object.fromEntries(Object.entries(b.cats || {}).map(([k, v]) => [k, v / Math.max(1, b.jours)]));
  const mx = Math.max(...Object.keys(CATS).map(k => Math.max(myC[k] || 0, herC[k] || 0)), 1), diff = myPD ? Math.round((herPD - myPD) / myPD * 100) : 0;
  openPanel(`<h2>Toi et ${u}</h2><p class="small">${same.length ? `Comparé à ${same.length > 1 ? 'tes voyages' : 'ton voyage'} en ${esc(C(ref[0]).n)}` : 'Comparé à la moyenne de tes voyages'}, par jour.</p>
   <div class="cmpgrid num"><div><span>${u}, ${esc(p.place)}</span><b>${fmt(herPD)}</b><span>par jour</span></div><div><span>Toi</span><b>${fmt(myPD)}</b><span>par jour</span></div></div>
   <p class="small" style="margin-top:12px">${Math.abs(diff) < 5 ? 'Vous dépensez à peu près pareil.' : diff > 0 ? `${u} a dépensé ${diff} % de plus que toi par jour.` : `${u} a dépensé ${-diff} % de moins que toi par jour.`}</p>
   ${Object.keys(CATS).map(k => `<div class="cmprow"><span>${CATS[k].n}</span><div class="cbars"><i class="b" style="width:${(herC[k] || 0) / mx * 100}%"></i><i class="a" style="width:${(myC[k] || 0) / mx * 100}%"></i></div></div>`).join('')}
   <div class="cmpleg"><span><i style="background:#9DBFA6"></i>${u}</span><span><i style="background:var(--green)"></i>Toi</span></div>${CLOSE('Fermer')}`, null, { nofocus: true }); };

/* ---------- fil ---------- */
let fView = 'amis', FEED = [], feedMore = false, fQ = '', fAuto = 0;
const postWhere = p => norm(`${p.place || ''} ${p.country_code && COUNTRIES[p.country_code] ? COUNTRIES[p.country_code].n : ''}`);
/** Affiche le fil filtré par ville ou pays, et charge plus de publications si le filtre en trouve peu. */
function drawFeed() {
  const box = $('feedbox'); if (!box) return; const q = norm(fQ.trim());
  const list = q ? FEED.filter(p => postWhere(p).includes(q)) : FEED;
  const places = [...new Map(FEED.filter(p => p.country_code && COUNTRIES[p.country_code]).map(p => [p.country_code, COUNTRIES[p.country_code].n])).entries()].slice(0, 12);
  const fp = $('fplaces'); if (fp) fp.innerHTML = places.length > 1 ? places.map(([k, n]) => `<button class="${q && norm(n) === q ? 'on' : ''}" data-act="fqSet" data-v="${esc(n)}">${flag(k)}${esc(n)}</button>`).join('') : '';
  box.innerHTML = `<div class="feed">${list.map(postCard).join('') || (q ? `<div class="emptyfeed">Aucune publication pour « ${esc(fQ.trim())} »${feedMore ? ', on cherche plus loin…' : '.'}</div>` : `<div class="emptyfeed">${fView === 'amis' ? 'Rien pour l’instant. Ajoute des amis ou publie ton premier souvenir.<br><button class="btn2 g" data-act="findFriends" style="margin-top:12px">' + SV.userPlus + 'Trouver des amis</button>' : 'Aucune publication publique pour le moment.'}</div>`)}</div>${feedMore ? '<button class="btn2 wide" data-act="feedMore" style="margin-top:14px">Voir plus</button>' : ''}`;
  if (q && list.length < 5 && feedMore && fAuto < 4) { fAuto++; renderFil(true); } else if (!q) fAuto = 0;
}
ACT.fqSet = d => { const i = $('fq'); fQ = norm(fQ) === norm(d.v) ? '' : d.v; if (i) { i.value = fQ; i.nextElementSibling.hidden = !fQ; } fAuto = 0; drawFeed(); };
ACT.fqClear = () => { fQ = ''; const i = $('fq'); if (i) { i.value = ''; i.nextElementSibling.hidden = true; i.focus(); } drawFeed(); };
async function renderFil(more) {
  const sc = $('s-fil');
  if (!more) sc.innerHTML = `<div class="fhead"><h1>Fil</h1><div class="r"><button class="iconbtn" data-act="openChals" aria-label="Défis">${SV.target}<span class="bdg" id="chalBadge" hidden></span></button><button class="iconbtn" data-act="findFriends" aria-label="Trouver des amis">${SV.userPlus}</button><button class="iconbtn" data-act="compose" aria-label="Publier">${SV.plus}</button></div></div>
   <div class="stories" id="stories"></div>
   <div class="seg2"><button class="${fView === 'amis' ? 'on' : ''}" data-act="fview" data-v="amis">Mes amis</button><button class="${fView === 'decouvrir' ? 'on' : ''}" data-act="fview" data-v="decouvrir">Découvrir</button><button class="${fView === 'defis' ? 'on' : ''}" data-act="fview" data-v="defis">Défis</button></div>
   ${fView !== 'defis' ? `<label class="fsearch">${SV.search}<input id="fq" placeholder="Filtrer par ville ou pays, ex. Lisbonne" autocomplete="off" maxlength="40" value="${esc(fQ)}"><button type="button" data-act="fqClear" aria-label="Effacer" ${fQ ? '' : 'hidden'}>${SV.x}</button></label><div class="fplaces" id="fplaces"></div>` : ''}
   <div id="feedbox"><div class="loading">Chargement…</div></div>`;
  const fq = $('fq'); if (fq) fq.oninput = () => { fQ = fq.value; fq.nextElementSibling.hidden = !fQ; drawFeed(); };
  updateBadges(); renderStories();
  if (fView === 'defis') return renderDefis();
  try {
    const before = more && FEED.length ? FEED[FEED.length - 1].created_at : null;
    const list = await rpc('feed', { p_scope: fView === 'amis' ? 'friends' : 'discover', p_before: before, p_limit: 15 });
    FEED = more ? FEED.concat(list) : list; feedMore = list.length === 15;
    if (current !== 'fil') return;
    drawFeed(); return;
    $('feedbox').innerHTML = `<div class="feed">${FEED.map(postCard).join('') || `<div class="emptyfeed">${fView === 'amis' ? 'Rien pour l’instant. Ajoute des amis ou publie ton premier souvenir.<br><button class="btn2 g" data-act="findFriends" style="margin-top:12px">' + SV.userPlus + 'Trouver des amis</button>' : 'Aucune publication publique pour le moment.'}</div>`}</div>${feedMore ? '<button class="btn2 wide" data-act="feedMore" style="margin-top:14px">Voir plus</button>' : ''}`;
  } catch (e) { $('feedbox').innerHTML = `<div class="emptyfeed">${isNetwork(e) ? 'Pas de connexion. Le fil revient dès que le réseau est là.' : 'Le fil ne peut pas être chargé pour le moment.'}</div>`; }
}
async function renderStories() { try { const fr = (await rpc('my_friends')).filter(f => f.relation === 'friend'); const el = $('stories'); if (!el) return;
  el.innerHTML = `<button class="story" data-act="compose"><span class="addme">${SV.plus}</span><span>Publier</span></button>` + fr.map(f => `<button class="story" data-act="openUser" data-u="${f.id}"><span class="ring">${avatar(f)}</span><span>${first(f.display_name)}</span></button>`).join(''); } catch (e) { } }
ACT.fview = d => { fView = d.v; renderFil(); };
ACT.feedMore = () => renderFil(true);
ACT.openChals = () => { fView = 'defis'; if (current === 'fil') renderFil(); else go('fil'); };
ACT.findFriends = () => { pTab = 'amis'; if (current === 'profil') renderProfil(); else go('profil'); };

/* ---------- publier ---------- */
let comp = null;
ACT.compose = fromPanel(d => {
  if (noTrip()) return;
  const t = trip(d.trip) || currentTrip() || sorted()[0];
  comp = { trip: t.id, sel: [], extra: [], vis: (SETTINGS && SETTINGS.default_visibility) || 'friends', bud: false, chal: d.chal || null };
  const ch = d.chal ? CHALS.find(c => c.id === d.chal) : null;
  openPanel(`<h2>${ch ? 'Relever le défi' : 'Publier un souvenir'}</h2>${ch ? `<p class="small">${SV.target} ${esc(ch.place)}, lancé par ${first(ch.other.display_name)}</p>` : ''}
   <label class="fld"><span>Voyage</span><select id="cp-trip">${sorted().map(x => `<option value="${x.id}" ${x.id === t.id ? 'selected' : ''}>${esc(place(x))}</option>`).join('')}</select></label>
   <div class="fld"><span>Photos (6 maximum)</span><div class="pick-grid" id="cp-grid"></div></div>
   <label class="fld"><span>Légende</span><textarea id="cp-cap" maxlength="2200" placeholder="Raconte ce moment">${ch ? esc(`Défi de ${String(ch.other.display_name).split(' ')[0]} relevé : ${ch.place}.`) : ''}</textarea></label>
   <button type="button" class="togrow" id="cp-bud" aria-pressed="false"><div><b>Joindre le bilan des dépenses</b><span>Total, coût par jour et répartition par catégorie</span></div><i class="sw"></i></button>
   <div class="fld"><span>Qui peut voir ?</span><div class="visopts" id="cp-vis"></div></div>
   <button class="btn full" id="cp-ok">Publier<i>${SV.right}</i></button>${CLOSE()}`, p => {
    p.querySelector('#cp-trip').onchange = e => { comp.trip = e.target.value; comp.sel = []; renderCompGrid(); };
    const b = p.querySelector('#cp-bud'); b.onclick = () => { comp.bud = !comp.bud; b.classList.toggle('on', comp.bud); b.setAttribute('aria-pressed', comp.bud); };
    renderCompGrid(); renderCompVis();
    p.querySelector('#cp-ok').onclick = async () => {
      if (!comp.sel.length) { toast('Choisis au moins une photo'); return; }
      const btn = p.querySelector('#cp-ok'); btn.disabled = true;
      try {
        const tt = trip(comp.trip);
        const { data: post, error } = await sb.from('posts').insert({ trip_id: tt.id, country_code: ch && ch.country_code ? ch.country_code : tt.pays, place: (ch ? ch.place : short(tt)).slice(0, 80), caption: p.querySelector('#cp-cap').value.trim().slice(0, 2200), visibility: comp.vis, budget_summary: comp.bud ? bilanOf(tt) : null, challenge_id: comp.chal }).select('id').single();
        if (error) throw error;
        const ph = await sb.from('post_photos').insert(comp.sel.map((path, i) => ({ post_id: post.id, position: i, path })));
        if (ph.error) { await sb.from('posts').delete().eq('id', post.id); throw ph.error; }
        if (comp.chal) { await rpc('challenge_action', { p_id: comp.chal, p_action: 'complete', p_post: post.id }); celebrate('Défi relevé !', `${first(ch.other.display_name)} va voir ta photo`); }
        closePanel(); fView = comp.chal ? 'defis' : 'amis'; if (current === 'fil') renderFil(); else go('fil'); toast(`Publié, visibilité : ${VIS[comp.vis].n}`);
      } catch (e) { btn.disabled = false; toast(e.code === 'P0429' ? e.message : 'Publication impossible : ' + errMsg(e)); }
    };
  });
});
function compPool(t) { return [t.cover, ...t.entrees.flatMap(e => e.photos)].filter(Boolean); }
function renderCompGrid() { const g = $('cp-grid'); if (!g) return; const pool = [...new Set([...comp.extra, ...compPool(trip(comp.trip))])];
  g.innerHTML = pool.map(src => { const i = comp.sel.indexOf(src); return `<button type="button" class="${i >= 0 ? 'on' : ''}" data-act="compSel" data-src="${esc(src)}">${IMG(src)}<span class="n">${i >= 0 ? i + 1 : ''}</span></button>`; }).join('') + `<button type="button" class="imp" data-photo="compose|new" aria-label="Importer une photo">${SV.cam}Importer</button>`; }
function renderCompVis() { const v = $('cp-vis'); if (!v) return; v.innerHTML = Object.entries(VIS).map(([k, x]) => `<button type="button" class="${comp.vis === k ? 'on' : ''}" data-act="compVis" data-v="${k}">${x.ic()}${x.n}<span>${x.d}</span></button>`).join(''); }
ACT.compSel = d => { const i = comp.sel.indexOf(d.src); if (i >= 0) comp.sel.splice(i, 1); else if (comp.sel.length < 6) comp.sel.push(d.src); else toast('6 photos maximum'); renderCompGrid(); };
ACT.compVis = d => { comp.vis = d.v; renderCompVis(); };
function celebrate(title, sub) { const el = document.createElement('div'); el.className = 'celebrate'; el.innerHTML = `<div><i>🎉</i><b>${esc(title)}</b><span>${esc(sub)}</span></div>`; document.body.appendChild(el); setTimeout(() => el.remove(), 2000); }

// photos du profil et du composeur
const _onPhoto = onPhoto;
onPhoto = async (target, path) => {
  const [id, kind] = target.split('|');
  if (id === 'compose') { if (comp) { comp.extra.unshift(path); if (comp.sel.length < 6) comp.sel.push(path); renderCompGrid(); } toast('Photo ajoutée'); return; }
  if (id === 'me') { const col = kind === 'avatar' ? 'avatar_path' : 'cover_path', old = PROFILE[col];
    const { error } = await sb.from('profiles').update({ [col]: path }).eq('id', ME.id); if (error) { toast('Mise à jour impossible'); return; }
    PROFILE[col] = path; if (old) { releaseMedia(old); flushMediaDeletes(); } writeCache(); refreshSocial(); if (current === 'home') renderHome(); toast(kind === 'avatar' ? 'Photo de profil mise à jour' : 'Couverture mise à jour'); return; }
  return _onPhoto(target, path);
};

/* ---------- profils ---------- */
let pTab = 'posts', amiId = null, aTab = 'posts', PROF = null;
async function profileHTML(id) {
  const me = id === ME.id, tab = me ? pTab : aTab;
  const pr = await rpc('get_profile', { p_user: id });
  if (!pr) return `<div class="navrow"><button class="iconbtn" data-act="back" aria-label="Retour">${SV.back}</button></div><div class="emptyfeed" style="margin-top:40px">Ce profil n'est pas disponible.</div>`;
  PROF = pr;
  let body = '';
  if (tab === 'posts') { const list = await rpc('feed', { p_scope: 'user', p_user: id, p_limit: 50 }); list.forEach(p => POSTS.set(p.id, p));
    body = list.length ? `<div class="pgrid">${list.map(p => `<button data-act="openPost" data-p="${p.id}" aria-label="${esc(p.place)}">${p.photos[0] ? IMG(p.photos[0]) : ''}${p.photos.length > 1 ? `<span class="mul">${SV.multi}</span>` : ''}${me ? `<span class="vi">${VIS[p.visibility].ic()}</span>` : ''}<span class="lk">❤️ ${Object.values(p.reactions || {}).reduce((a, b) => a + b, 0)}</span></button>`).join('')}</div>` : `<div class="emptyj">${me ? "Tu n'as encore rien publié." : 'Aucune publication visible.'}</div>`; }
  else if (tab === 'albums') {
    if (me) body = S.trips.length ? `<div class="albums">${sorted().map(t => `<div class="album">${phHTML(t.cover, `${t.id}|cover`)}<button class="open" data-open="${t.id}"><b>${esc(short(t))}</b><span>${photosCount(t)} photos, ${D(t.du).getFullYear()}</span></button><button class="vis pill" data-act="albumVis" data-trip="${t.id}" aria-label="Changer la visibilité">${VIS[VIS_TO_DB[t.vis || 'prive']].ic()}${VISN[t.vis || 'prive']}</button></div>`).join('')}</div><p class="demo-note">Touche la pastille d'un album pour choisir qui peut le voir. Tes dépenses restent toujours privées.</p>` : `<div class="emptyj">Crée un voyage pour avoir ton premier album.</div>`;
    else { const al = await rpc('get_albums', { p_user: id }); body = al.length ? `<div class="albums">${al.map(a => `<div class="album"><div class="ph ${a.cover_path ? 'has' : ''}">${a.cover_path ? IMG(a.cover_path) : ''}</div><button class="open" data-act="openAlbum" data-trip="${a.id}"><b>${esc(a.city)}</b><span>${a.photo_count} photos, ${new Date(a.start_date).getFullYear()}</span></button></div>`).join('')}</div>` : `<div class="emptyj">Aucun album partagé avec toi.</div>`; }
  }
  else if (tab === 'amis') body = await friendsTab();
  else { const list = await rpc('feed', { p_scope: 'saved', p_limit: 50 }); body = `<div class="feed">${list.map(postCard).join('') || '<div class="emptyfeed">Enregistre des publications avec le marque-page pour les retrouver ici.</div>'}</div>`; }
  const rel = pr.relation;
  const actions = me ? `<button class="btn2" data-act="editProfile">${SV.edit}Modifier</button><button class="btn2 g" data-act="compose">${SV.plus}Publier</button>`
    : rel === 'friend' ? `<button class="btn2" data-act="unfriend" data-u="${id}">${SV.check}Amis</button><button class="btn2 g" data-act="newChal" data-u="${id}">${SV.target}Défier</button>`
    : rel === 'sent' ? `<button class="btn2" data-act="cancelReq" data-u="${id}">Demande envoyée</button>`
    : rel === 'received' ? `<button class="btn2 g" data-act="acceptReq" data-u="${id}">${SV.check}Accepter</button><button class="btn2" data-act="declineReq" data-u="${id}">Refuser</button>`
    : `<button class="btn2 g" data-act="addFriend" data-u="${id}">${SV.userPlus}Ajouter</button>`;
  return `<div class="pcover">${me ? phHTML(PROFILE.cover_path, 'me|cover', 'Couverture') : `<div class="ph ${pr.cover_path ? 'has' : ''}">${pr.cover_path ? IMG(pr.cover_path) : ''}</div>`}
     <div class="tb2">${me ? '<span></span>' : `<button data-act="back" aria-label="Retour">${SV.back}</button>`}${me ? `<button data-act="profile" aria-label="Réglages">${SV.menu}</button>` : `<button data-act="userMenu" data-u="${id}" aria-label="Options">${SV.dots}</button>`}</div></div>
   <div class="pmain"><div class="prow"><div class="avw">${avatar(pr, 'lg')}${me ? `<button class="camb" data-photo="me|avatar" aria-label="Changer la photo de profil">${SV.cam}</button>` : ''}</div><div class="btns">${actions}</div></div>
     <h1 class="pname">${esc(pr.display_name)}</h1><p class="phandle">@${esc(pr.handle)}</p>${pr.bio ? `<p class="pbio">${esc(pr.bio)}</p>` : ''}
     <div class="pstats num"><button data-act="${me ? 'ptab' : 'atab'}" data-v="albums" data-scroll="1"><b>${me ? S.trips.length : pr.albums}</b><span>${me ? 'Voyages' : 'Albums'}</span></button><button data-act="paysList" data-u="${id}"><b>${me ? new Set(S.trips.map(t => t.pays)).size : pr.countries}</b><span>Pays</span></button>${me ? `<button data-act="ptab" data-v="amis" data-scroll="1"><b>${pr.friends}</b><span>Amis</span></button>` : `<div class="stat"><b>${pr.friends}</b><span>Amis</span></div>`}<button data-act="${me ? 'ptab' : 'atab'}" data-v="posts" data-scroll="1"><b>${pr.posts}</b><span>Publications</span></button></div>
     <div class="ptabs">${(me ? [['posts', 'Publications'], ['albums', 'Albums'], ['amis', 'Amis'], ['saved', 'Enregistrés']] : [['posts', 'Publications'], ['albums', 'Albums']]).map(([k, l]) => `<button data-act="${me ? 'ptab' : 'atab'}" data-v="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
     ${body}
     ${!me && rel !== 'friend' ? `<p class="demo-note">Tu vois seulement ce que ${first(pr.display_name)} partage publiquement. Une fois amis, tu verras aussi ce qu'il ou elle réserve à ses amis.</p>` : ''}</div>`;
}
async function friendsTab() {
  const all = await rpc('my_friends'), fr = all.filter(f => f.relation === 'friend'), rec = all.filter(f => f.relation === 'received'), sent = all.filter(f => f.relation === 'sent');
  const q = (window._fq || '').trim(); let found = [];
  if (q.length >= 2) found = await rpc('search_profiles', { q });
  return `<label class="fsearch" for="fq">${SV.search}<input id="fq" maxlength="40" placeholder="Chercher par nom ou @identifiant" value="${esc(q)}" autocomplete="off"></label>
   ${q.length >= 2 ? `<div class="sec"><h2>Résultats</h2></div><div class="flist">${found.map(friendRow).join('') || '<p class="small">Personne trouvé. Vérifie l’identifiant, ou la personne a choisi de ne pas apparaître dans la recherche.</p>'}</div>` : ''}
   ${rec.length ? `<div class="sec"><h2>Demandes reçues (${rec.length})</h2></div><div class="flist">${rec.map(friendRow).join('')}</div>` : ''}
   <div class="sec"><h2>Mes amis (${fr.length})</h2></div><div class="flist">${fr.map(friendRow).join('') || '<p class="small">Cherche tes amis par leur nom ou leur @identifiant.</p>'}</div>
   ${sent.length ? `<div class="sec"><h2>Demandes envoyées</h2></div><div class="flist">${sent.map(friendRow).join('')}</div>` : ''}
   <button class="btn2 wide" data-act="inviteFriend" style="margin-top:16px">${SV.send}Inviter un ami sur Escale</button>`;
}
function friendRow(x) {
  const btn = x.relation === 'friend' ? `<button class="btn2" data-act="unfriend" data-u="${x.id}">Retirer</button>`
    : x.relation === 'sent' ? `<button class="btn2" data-act="cancelReq" data-u="${x.id}">Annuler</button>`
    : x.relation === 'received' ? `<button class="btn2 g" data-act="acceptReq" data-u="${x.id}">Accepter</button><button class="btn2" data-act="declineReq" data-u="${x.id}" aria-label="Refuser">${SV.x}</button>`
    : `<button class="btn2 g" data-act="addFriend" data-u="${x.id}">${SV.userPlus}Ajouter</button>`;
  return `<div class="frow">${avatar(x)}<button class="m" data-act="openUser" data-u="${x.id}"><b>${esc(x.display_name)}</b><span>@${esc(x.handle)}</span></button>${btn}</div>`;
}
let profBusy = 0;
async function renderProfil() { const n = ++profBusy; const html = await profileHTML(ME.id).catch(e => `<div class="emptyfeed" style="margin-top:60px">${isNetwork(e) ? 'Pas de connexion.' : 'Profil indisponible.'}</div>`); if (n !== profBusy || current !== 'profil') return; $('s-profil').innerHTML = html; bindSearch(); }
async function renderAmi() { const n = ++profBusy; const html = await profileHTML(amiId).catch(() => '<div class="emptyfeed" style="margin-top:60px">Profil indisponible.</div>'); if (n !== profBusy || current !== 'ami') return; $('s-ami').innerHTML = html; }
let fqTimer = null;
function bindSearch() { const q = $('fq'); if (!q) return; q.oninput = e => { window._fq = e.target.value; clearTimeout(fqTimer); fqTimer = setTimeout(async () => { await renderProfil(); const n = $('fq'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 350); }; }
function refreshSocial() { if (current === 'fil') renderFil(); else if (current === 'profil') renderProfil(); else if (current === 'ami') renderAmi(); }
ACT.ptab = async d => { pTab = d.v; await renderProfil(); if (d.scroll) { const t = $('s-profil').querySelector('.ptabs'); t && t.scrollIntoView({ behavior: 'smooth', block: 'start' }); } };
ACT.atab = async d => { aTab = d.v; await renderAmi(); if (d.scroll) { const t = $('s-ami').querySelector('.ptabs'); t && t.scrollIntoView({ behavior: 'smooth', block: 'start' }); } };
ACT.noop = () => { };
ACT.openUser = d => { if ($('panel').classList.contains('open')) closePanel(); if (d.u === ME.id) { if (current === 'profil') $('s-profil').scrollTo({ top: 0, behavior: 'smooth' }); else go('profil'); return; } if (current === 'ami' && amiId === d.u) { $('s-ami').scrollTo({ top: 0, behavior: 'smooth' }); return; } amiId = d.u; aTab = 'posts'; go('ami'); };
ACT.openPost = async d => { let p = POSTS.get(d.p); if (!p) { const r = await rpc('feed', { p_scope: 'one', p_user: d.p }); p = r && r[0]; } if (!p) { toast("Cette publication n'est plus disponible"); return; } openPanel(`<div class="inpanel">${postCard(p)}</div>${CLOSE('Fermer')}`, null, { nofocus: true }); };
ACT.openAlbum = async d => { const a = await rpc('get_album', { p_trip: d.trip }); if (!a) { toast('Album indisponible'); return; }
  openPanel(`<h2>${esc(a.city)}</h2><p class="small">${flag(a.country_code)} ${esc((COUNTRIES[a.country_code] || {}).n || a.country_code)}, ${fd(a.start_date)} au ${fd(a.end_date)}</p>
   ${a.cover_path ? `<div class="alb-cover">${IMG(a.cover_path)}</div>` : ''}${(a.places || []).length ? `<div class="tags">${a.places.map(l => `<span class="pill">${esc(l)}</span>`).join('')}</div>` : ''}
   ${a.entries.map(e => `<div class="alb-entry"><p class="caps">Jour ${e.day}</p><h3>${esc(e.title)}</h3>${e.note ? `<p class="small wrap">${esc(e.note)}</p>` : ''}<div class="alb-ph">${(e.photos || []).filter(Boolean).map(ph => IMG(ph)).join('')}</div></div>`).join('') || '<p class="small">Pas encore de pages.</p>'}${CLOSE('Fermer')}`, null, { nofocus: true }); };
async function relAct(fn, msg) { try { await fn(); toast(msg); refreshSocial(); updateBadges(); } catch (e) { toast(errMsg(e)); } }
ACT.addFriend = d => relAct(async () => { const r = await rpc('request_friend', { p_target: d.u }); if (r === 'accepted') toast('Vous êtes maintenant amis'); }, 'Demande envoyée');
ACT.acceptReq = d => relAct(() => rpc('respond_friend', { p_requester: d.u, p_accept: true }), 'Vous êtes maintenant amis');
ACT.declineReq = d => relAct(() => rpc('respond_friend', { p_requester: d.u, p_accept: false }), 'Demande refusée');
ACT.cancelReq = d => relAct(() => rpc('remove_friend', { p_other: d.u }), 'Demande annulée');
ACT.unfriend = d => openPanel(`<h2>Retirer de tes amis ?</h2><p class="small" style="line-height:1.5">Cette personne ne verra plus tes publications réservées aux amis, et tu ne verras plus les siennes. Les défis en cours entre vous seront annulés.</p><button class="danger" data-act="unfriendOk" data-u="${d.u}" style="margin-top:16px">Retirer de mes amis</button>${CLOSE()}`, null, { nofocus: true });
ACT.unfriendOk = d => { closePanel(); relAct(() => rpc('remove_friend', { p_other: d.u }), 'Retiré de tes amis'); };
ACT.inviteFriend = () => { const txt = `Je tiens mes carnets de voyage sur Escale. Rejoins-moi : ${CFG.siteUrl || location.origin} (mon identifiant : @${PROFILE.handle})`; if (navigator.share) navigator.share({ title: 'Escale', text: txt }).catch(() => { }); else copyText(txt, 'Invitation copiée, colle-la dans un message'); };
ACT.userMenu = d => openPanel(`<h2>Options</h2><div class="menulist"><button data-act="report" data-kind="user" data-id="${d.u}">${SV.warn}Signaler ce profil</button><button data-act="blockUser" data-u="${d.u}" class="red">${SV.lock}Bloquer</button></div>${CLOSE('Fermer')}`, null, { nofocus: true });
ACT.blockUser = d => openPanel(`<h2>Bloquer ce membre ?</h2><p class="small" style="line-height:1.5">Vous ne verrez plus vos profils, publications et commentaires respectifs, et cette personne ne pourra plus te contacter. Votre amitié et vos défis seront supprimés. Tu peux débloquer depuis tes réglages.</p><button class="danger" data-act="blockOk" data-u="${d.u}" style="margin-top:16px">Bloquer</button>${CLOSE()}`, null, { nofocus: true });
ACT.blockOk = async d => { closePanel(); try { await rpc('block_user', { p_target: d.u }); toast('Membre bloqué'); if (current === 'ami') go('fil'); else refreshSocial(); } catch (e) { toast(errMsg(e)); } };
const REASONS = [['spam', 'Spam ou publicité'], ['harcelement', 'Harcèlement ou intimidation'], ['contenu_choquant', 'Contenu choquant ou inapproprié'], ['usurpation', "Usurpation d'identité"], ['donnees_personnelles', 'Publication de mes données personnelles'], ['autre', 'Autre raison']];
ACT.report = d => { let reason = null; openPanel(`<h2>Signaler</h2><p class="small">Ton signalement est anonyme pour la personne concernée. Nous l'examinons rapidement.</p><div class="menulist" id="rp">${REASONS.map(([k, l]) => `<button type="button" data-r="${k}">${l}</button>`).join('')}</div><label class="fld"><span>Précisions (facultatif)</span><textarea id="rp-d" maxlength="500"></textarea></label><button class="btn full" id="rp-ok">Envoyer le signalement<i>${SV.right}</i></button>${CLOSE()}`, p => {
  p.querySelectorAll('#rp button').forEach(b => b.onclick = () => { reason = b.dataset.r; p.querySelectorAll('#rp button').forEach(x => x.classList.toggle('on', x === b)); });
  p.querySelector('#rp-ok').onclick = async () => { if (!reason) { toast('Choisis un motif'); return; } const { error } = await sb.from('reports').insert({ target_kind: d.kind, target_id: d.id, reason, details: p.querySelector('#rp-d').value.trim().slice(0, 500) }); if (error) { toast(error.code === 'P0429' ? error.message : 'Signalement impossible'); return; } closePanel(); toast('Merci, ton signalement a été envoyé'); };
}, { nofocus: true }); };
ACT.paysList = async d => { const me = d.u === ME.id;
  const list = me ? [...new Set(S.trips.map(t => t.pays))].map(k => ({ k, sub: S.trips.filter(t => t.pays === k).map(short).join(', ') })) : [...new Set([...(await rpc('get_albums', { p_user: d.u })).map(a => a.country_code), ...[...POSTS.values()].filter(p => p.author_id === d.u && p.country_code).map(p => p.country_code)])].map(k => ({ k, sub: '' }));
  openPanel(`<h2>${me ? 'Mes pays' : 'Ses pays'}</h2><p class="small">${list.length} pays</p><div class="flist" style="margin-top:12px">${list.map(x => `<div class="frow"><span class="av flagav">${flag(x.k)}</span><div class="m"><b>${esc((COUNTRIES[x.k] || {}).n || x.k)}</b><span>${esc(x.sub)}</span></div></div>`).join('') || '<p class="small">Aucun pays pour l’instant.</p>'}</div>${me && list.length ? `<button class="btn2 g wide" data-act="go" data-to="carte" style="margin-top:12px">${SV.globe}Voir sur le globe</button>` : ''}${CLOSE('Fermer')}`, null, { nofocus: true }); };
ACT.editProfile = () => { const m = PROFILE;
  openPanel(`<h2>Modifier le profil</h2>
   <label class="fld"><span>Nom affiché</span><input id="ep-n" maxlength="40" value="${esc(m.display_name)}"></label>
   <label class="fld"><span>Identifiant</span><input id="ep-h" maxlength="24" value="${esc(m.handle)}" autocapitalize="none" spellcheck="false"></label>
   <label class="fld"><span>Bio</span><textarea id="ep-b" maxlength="200">${esc(m.bio)}</textarea></label>
   <div class="fld"><span>Visibilité par défaut de tes publications</span><div class="visopts" id="ep-v">${Object.entries(VIS).map(([k, v]) => `<button class="${SETTINGS.default_visibility === k ? 'on' : ''}" data-v="${k}" type="button">${v.ic()}${v.n}<span>${v.d}</span></button>`).join('')}</div></div>
   <button class="btn full" id="ep-ok">Enregistrer<i>${SV.right}</i></button>${CLOSE()}`, p => {
    let dv = SETTINGS.default_visibility; p.querySelectorAll('#ep-v button').forEach(b => b.onclick = () => { dv = b.dataset.v; p.querySelectorAll('#ep-v button').forEach(x => x.classList.toggle('on', x === b)); });
    p.querySelector('#ep-ok').onclick = async () => {
      const name = p.querySelector('#ep-n').value.trim(), h = p.querySelector('#ep-h').value.trim().replace(/^@/, '').toLowerCase(), bio = p.querySelector('#ep-b').value.trim();
      if (!name) { toast('Indique un nom'); return; }
      try {
        if (h !== m.handle) await rpc('set_handle', { p_handle: h });
        const a = await sb.from('profiles').update({ display_name: name.slice(0, 40), bio: bio.slice(0, 200) }).eq('id', ME.id); if (a.error) throw a.error;
        const b = await sb.from('account_settings').update({ default_visibility: dv }).eq('user_id', ME.id); if (b.error) throw b.error;
        await loadProfile(); writeCache(); closePanel(); refreshSocial(); toast('Profil mis à jour');
      } catch (e) { toast(errMsg(e)); }
    };
  }); };

/* ---------- défis ---------- */
let CHALS = [];
function dueTag(c) { if (c.status === 'done') return `<span class="due ok">Relevé</span>`; if (c.status === 'declined') return `<span class="due">Refusé</span>`;
  const h = (new Date(c.due_at) - Date.now()) / 36e5; if (h < 0) return `<span class="due">Expiré</span>`; return `<span class="due ${h < 36 ? 'hot' : ''}">${h < 24 ? `Encore ${Math.max(1, Math.round(h))} h` : `Encore ${Math.ceil(h / 24)} j`}</span>`; }
function chalCard(c) { const inc = c.to_id === ME.id, o = c.other || {}, n = first(o.display_name), expired = c.status === 'open' && new Date(c.due_at) < Date.now();
  let acts = '';
  if (c.status === 'open' && !expired) acts = inc ? `<div class="acts"><button class="btn2 g" data-act="chalDo" data-c="${c.id}">${SV.cam}Relever le défi</button><button class="btn2" data-act="chalDecline" data-c="${c.id}">Refuser</button></div>` : `<div class="acts"><button class="btn2" data-act="chalExtend" data-c="${c.id}" ${c.extensions_used >= 3 ? 'disabled' : ''}>Prolonger de 3 jours</button><button class="btn2" data-act="chalCancel" data-c="${c.id}">Annuler</button></div>`;
  if (expired) acts = `<div class="acts"><button class="btn2" data-act="chalExtend" data-c="${c.id}" ${c.extensions_used >= 3 ? 'disabled' : ''}>${inc ? 'Prolonger de 3 jours' : 'Prolonger de 3 jours'}</button>${inc ? '' : `<button class="btn2" data-act="chalCancel" data-c="${c.id}">Retirer</button>`}</div>`;
  const proof = c.status === 'done' ? `<div class="proof">${c.photo ? IMG(c.photo) : ''}<div><b>${inc ? 'Tu as relevé ce défi' : `${n} a relevé ton défi`}</b>${ago(c.completed_at || c.created_at)}</div>${c.post_id ? `<button class="btn2" data-act="openPost" data-p="${c.post_id}">Voir</button>` : ''}</div>` : '';
  return `<div class="chal ${c.status}" data-chal="${c.id}"><div class="h">${avatar(o)}<button class="m" data-act="openUser" data-u="${o.id}"><b>${inc ? `${n} te défie` : `Défi envoyé à ${n}`}</b><span>${ago(c.created_at)}</span></button>${dueTag(c)}</div>
   <h3>${SV.target}${esc(c.place)}</h3>${c.note ? `<p class="note">${esc(c.note)}</p>` : ''}${c.country_code ? `<p class="ctx">${flag(c.country_code)} ${esc((COUNTRIES[c.country_code] || {}).n || '')}</p>` : ''}${acts}${proof}</div>`; }
async function loadChals() { CHALS = await rpc('my_challenges'); return CHALS; }
async function renderDefis() {
  try { await loadChals(); } catch (e) { $('feedbox').innerHTML = '<div class="emptyfeed">Les défis ne peuvent pas être chargés pour le moment.</div>'; return; }
  if (current !== 'fil' || fView !== 'defis') return;
  const inc = CHALS.filter(c => c.to_id === ME.id), out = CHALS.filter(c => c.from_id === ME.id), open = inc.filter(c => c.status === 'open');
  $('feedbox').innerHTML = `<div class="chstats num"><div><b>${open.length}</b><span>à relever</span></div><div><b>${inc.filter(c => c.status === 'done').length}</b><span>relevés</span></div><div><b>${out.length}</b><span>envoyés</span></div></div>
   <button class="btn2 g newchal" data-act="newChal">${SV.target}Défier un ami</button>
   <div class="sec"><h2>À relever</h2></div>${open.map(chalCard).join('') || `<div class="emptyfeed">Aucun défi en cours. Tes amis peuvent t'en lancer depuis ton profil.</div>`}
   <div class="sec"><h2>Envoyés</h2></div>${out.map(chalCard).join('') || `<div class="emptyfeed">Lance un défi à un ami : un lieu, une photo, un délai.</div>`}
   ${inc.filter(c => c.status !== 'open').length ? `<div class="sec"><h2>Historique</h2></div>${inc.filter(c => c.status !== 'open').map(chalCard).join('')}` : ''}`;
}
ACT.chalDo = d => ACT.compose({ chal: d.c });
ACT.chalDecline = d => inlineConfirm(d.c, 'Oui, refuser', () => rpc('challenge_action', { p_id: d.c, p_action: 'decline' }), 'Défi refusé');
ACT.chalCancel = d => inlineConfirm(d.c, 'Oui, annuler le défi', () => rpc('challenge_action', { p_id: d.c, p_action: 'cancel' }), 'Défi annulé');
ACT.chalExtend = async d => { try { await rpc('challenge_action', { p_id: d.c, p_action: 'extend' }); toast('Délai prolongé de 3 jours'); renderDefis(); } catch (e) { toast(errMsg(e)); } };
function inlineConfirm(id, label, fn, msg) { const card = document.querySelector(`.screen:not([hidden]) [data-chal="${id}"]`), a = card && card.querySelector('.acts'); if (!a) return;
  const box = document.createElement('div'); box.className = 'acts'; box.innerHTML = `<button class="btn2">Garder</button><button class="btn2 g">${esc(label)}</button>`; a.replaceWith(box);
  box.children[0].onclick = () => renderDefis(); box.children[1].onclick = async () => { try { await fn(); toast(msg); } catch (e) { toast(errMsg(e)); } renderDefis(); updateBadges(); }; }
ACT.newChal = fromPanel(async d => {
  const fr = (await rpc('my_friends')).filter(f => f.relation === 'friend');
  if (!fr.length) { toast("Ajoute d'abord des amis pour les défier"); return; }
  let to = d.u && fr.some(f => f.id === d.u) ? d.u : fr[0].id, dl = 7;
  openPanel(`<h2>Lancer un défi</h2><p class="small">Ton ami devra prendre une photo à cet endroit avant la fin du délai.</p>
   <div class="fld"><span>Qui défier ?</span><div class="frchips" id="nc-to">${fr.map(f => `<button type="button" data-u="${f.id}" class="${f.id === to ? 'on' : ''}">${avatar(f)}${first(f.display_name)}</button>`).join('')}</div></div>
   <label class="fld"><span>Le lieu à photographier</span><input id="nc-place" maxlength="120" placeholder="Ex. le pont de Galata à Istanbul" autocomplete="off"></label>
   <label class="fld"><span>Pays (facultatif)</span><input id="nc-pays" list="pays-list" maxlength="40" autocomplete="off" placeholder="Tape un pays">${paysList()}</label>
   <label class="fld"><span>La consigne</span><textarea id="nc-note" maxlength="300" placeholder="Ex. au lever du soleil, sans personne dans le cadre"></textarea></label>
   <div class="fld"><span>Délai</span><div class="dlseg" id="nc-dl">${[[3, '3 jours'], [7, '1 semaine'], [30, '1 mois']].map(([v, l]) => `<button type="button" data-v="${v}" class="${v === dl ? 'on' : ''}">${l}</button>`).join('')}</div></div>
   <button class="btn full" id="nc-ok">Envoyer le défi<i>${SV.right}</i></button>${CLOSE()}`, p => {
    p.querySelectorAll('#nc-to button').forEach(b => b.onclick = () => { to = b.dataset.u; p.querySelectorAll('#nc-to button').forEach(x => x.classList.toggle('on', x === b)); });
    p.querySelectorAll('#nc-dl button').forEach(b => b.onclick = () => { dl = +b.dataset.v; p.querySelectorAll('#nc-dl button').forEach(x => x.classList.toggle('on', x === b)); });
    p.querySelector('#nc-ok').onclick = async () => { const place = p.querySelector('#nc-place').value.trim(); if (!place) { toast('Indique le lieu à photographier'); return; }
      const pv = p.querySelector('#nc-pays').value.trim(), pays = pv ? paysCode(pv) : null; if (pv && !pays) { toast('Pays non reconnu, choisis-le dans les suggestions'); return; }
      const { error } = await sb.from('challenges').insert({ to_id: to, place: place.slice(0, 120), country_code: pays, note: p.querySelector('#nc-note').value.trim().slice(0, 300), due_at: new Date(Date.now() + dl * 864e5).toISOString() });
      if (error) { toast(error.code === 'P0429' ? error.message : 'Défi impossible : ' + errMsg(error)); return; }
      closePanel(); fView = 'defis'; if (current === 'fil') renderFil(); else go('fil'); toast(`Défi envoyé à ${fr.find(f => f.id === to).display_name.split(' ')[0]}`); };
  });
});

/* ---------- notifications ---------- */
const NK = { friend_request: 'veut devenir ton ami', friend_accept: 'a accepté ta demande', reaction: 'a réagi à ta publication', comment: 'a commenté ta publication', challenge: "t'a lancé un défi", challenge_done: 'a relevé ton défi' };
let lastBadge = 0;
async function updateBadges(force) {
  if (!ME || (!force && Date.now() - lastBadge < 20000)) return; lastBadge = Date.now();
  try { const [n, c] = await Promise.all([sb.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null), sb.from('challenges').select('id', { count: 'exact', head: true }).eq('to_id', ME.id).eq('status', 'open').gt('due_at', new Date().toISOString())]);
    const nb = $('notifBadge'); if (nb) { nb.hidden = !n.count; nb.textContent = n.count > 9 ? '9+' : n.count; }
    const cb = $('chalBadge'); if (cb) { cb.hidden = !c.count; cb.textContent = c.count; }
    document.querySelector('nav [data-go=fil]')?.classList.toggle('dot', !!(n.count || c.count));
  } catch (e) { }
}
ACT.notifs = async () => { const list = await rpc('my_notifications', { p_limit: 50 });
  openPanel(`<h2>Notifications</h2><div class="flist">${list.map(n => `<button class="frow nrow ${n.read ? '' : 'unread'}" data-act="openNotif" data-k="${n.kind}" data-u="${n.actor ? n.actor.id : ''}" data-p="${n.post_id || ''}">${avatar(n.actor || {})}<span class="m"><b>${esc(n.actor ? n.actor.display_name : 'Un membre')}</b><span>${NK[n.kind]}, ${ago(n.created_at)}</span></span></button>`).join('') || '<p class="small">Rien de nouveau pour le moment.</p>'}</div>${CLOSE('Fermer')}`, null, { nofocus: true });
  if (list.some(n => !n.read)) { await sb.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null); lastBadge = 0; updateBadges(true); } };
ACT.openNotif = d => { closePanel(); setTimeout(() => { if (d.p) ACT.openPost({ p: d.p }); else if (d.k === 'challenge' || d.k === 'challenge_done') ACT.openChals(); else if (d.u) ACT.openUser({ u: d.u }); }, 380); };
setInterval(() => { if (document.visibilityState === 'visible') updateBadges(true); }, 60000);

SCREENS.fil = () => renderFil(); SCREENS.profil = () => renderProfil(); SCREENS.ami = () => renderAmi();
const _refreshUi = refresh;
refresh = function () { if (['fil', 'profil', 'ami'].includes(current)) refreshSocial(); else _refreshUi(); };
