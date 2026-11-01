/* Escale : inscription, connexion, double authentification, conditions d'utilisation,
 * accueil guidé, réglages (confidentialité, sécurité, données) et démarrage de l'appli. */
'use strict';
const TERMS = CFG.termsVersion || '2026-11';
SV.eye = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const gate = () => $('gate');
function showGate(html, mount) { const g = gate(); g.innerHTML = `<div class="gwrapx"><div class="gbrand">${SV.planeO}<span>Escale</span></div>${html}<p class="glegal"><a href="legal/cgu.html" target="_blank" rel="noopener">Conditions</a> · <a href="legal/confidentialite.html" target="_blank" rel="noopener">Confidentialité</a> · <a href="legal/mentions-legales.html" target="_blank" rel="noopener">Mentions légales</a></p></div>`; g.hidden = false; document.body.classList.add('gated'); mount && mount(g); const f = g.querySelector('input:not([type=checkbox])'); f && setTimeout(() => f.focus(), 50); }
function hideGate() { gate().hidden = true; gate().innerHTML = ''; document.body.classList.remove('gated'); }
const busy = (btn, on) => { if (!btn) return; btn.disabled = on; btn.classList.toggle('busy', on); };
const pwRules = p => [[p.length >= 10, '10 caractères minimum'], [/[a-z]/.test(p), 'une minuscule'], [/[A-Z]/.test(p), 'une majuscule'], [/[0-9]/.test(p), 'un chiffre']];
const pwOk = p => pwRules(p).every(r => r[0]);
const emailOk = e => /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(e);
function authError(e) {
  const m = (e && e.message || '').toLowerCase();
  if (m.includes('invalid login')) return 'E-mail ou mot de passe incorrect.';
  if (m.includes('email not confirmed')) return "Ton adresse n'est pas encore confirmée : ouvre le lien reçu par e-mail.";
  if (m.includes('already registered') || m.includes('already been registered')) return 'Impossible de créer ce compte. Si tu en as déjà un, connecte-toi.';
  if (m.includes('rate limit') || m.includes('too many') || (e && e.status === 429)) return 'Trop de tentatives. Patiente quelques minutes avant de réessayer.';
  if (m.includes('weak') || m.includes('password should')) return 'Mot de passe trop faible : 10 caractères avec majuscule, minuscule et chiffre.';
  if (isNetwork(e)) return 'Pas de connexion internet.';
  return 'Une erreur est survenue, réessaie.';
}
const googleBtn = () => CFG.googleEnabled ? `<button class="gbtn google" data-auth="google" type="button"><svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>Continuer avec Google</button><div class="gor"><span>ou</span></div>` : '';

/* ---------- écrans d'accès ---------- */
function welcome() {
  showGate(`<div class="ghero"><h1>Tes voyages,<br>ton histoire.</h1><p>Carnets, photos et dépenses de chacune de tes escales, à garder pour toi ou à partager avec tes amis.</p></div>
    <button class="gbtn primary" data-auth="signup">Créer un compte</button><button class="gbtn" data-auth="login">J'ai déjà un compte</button>${CFG.googleEnabled ? '<div class="gor"><span>ou</span></div>' + googleBtn().replace('<div class="gor"><span>ou</span></div>', '') : ''}`, bindAuth);
}
function signupForm(prefill = {}) {
  showGate(`<button class="gback" data-auth="welcome" aria-label="Retour">${SV.back}</button><h2>Créer un compte</h2>${googleBtn()}
    <form id="su" novalidate>
      <label class="fld"><span>Prénom ou nom affiché</span><input id="su-n" maxlength="40" autocomplete="given-name" required value="${esc(prefill.n || '')}"></label>
      <label class="fld"><span>Identifiant (pour que tes amis te trouvent)</span><div class="handle"><b>@</b><input id="su-h" maxlength="24" autocapitalize="none" spellcheck="false" autocomplete="username" placeholder="ex. sarah.voyage" value="${esc(prefill.h || '')}"></div></label>
      <label class="fld"><span>E-mail</span><input id="su-e" type="email" maxlength="254" autocomplete="email" required value="${esc(prefill.e || '')}"></label>
      <label class="fld"><span>Mot de passe</span><div class="pw"><input id="su-p" type="password" maxlength="72" autocomplete="new-password" required><button type="button" class="eye" data-auth="eye" aria-label="Afficher le mot de passe">${SV.eye}</button></div></label>
      <ul class="pwrules" id="su-r"></ul>
      <label class="check"><input type="checkbox" id="su-age"><span>J'ai 15 ans ou plus.</span></label>
      <label class="check"><input type="checkbox" id="su-cgu"><span>J'accepte les <a href="legal/cgu.html" target="_blank" rel="noopener">conditions d'utilisation</a> et j'ai lu la <a href="legal/confidentialite.html" target="_blank" rel="noopener">politique de confidentialité</a>.</span></label>
      <p class="gerr" id="su-err" role="alert"></p>
      <button class="gbtn primary" id="su-ok">Créer mon compte</button>
    </form><p class="gswitch">Déjà inscrite ? <button data-auth="login" class="lnk">Se connecter</button></p>`, g => {
    bindAuth(g);
    const p = g.querySelector('#su-p'), rules = () => { g.querySelector('#su-r').innerHTML = pwRules(p.value).map(([ok, l]) => `<li class="${ok ? 'ok' : ''}">${ok ? SV.check : ''}${l}</li>`).join(''); };
    p.oninput = rules; rules();
    g.querySelector('#su-n').oninput = e => { const h = g.querySelector('#su-h'); if (!h.dataset.touched) h.value = norm(e.target.value).replace(/ /g, '.').slice(0, 20); };
    g.querySelector('#su-h').oninput = e => { e.target.dataset.touched = 1; e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ''); };
    g.querySelector('#su').onsubmit = async ev => { ev.preventDefault();
      const n = g.querySelector('#su-n').value.trim(), h = g.querySelector('#su-h').value.trim(), e = g.querySelector('#su-e').value.trim().toLowerCase(), pw = p.value, err = g.querySelector('#su-err');
      err.textContent = '';
      if (!n) return err.textContent = 'Indique ton prénom.';
      if (!/^[a-z0-9._]{3,24}$/.test(h)) return err.textContent = 'Identifiant : 3 à 24 caractères, lettres minuscules, chiffres, point ou tiret bas.';
      if (!emailOk(e)) return err.textContent = 'Adresse e-mail invalide.';
      if (!pwOk(pw)) return err.textContent = 'Le mot de passe ne respecte pas les règles.';
      if (!g.querySelector('#su-age').checked) return err.textContent = 'Escale est réservée aux personnes de 15 ans ou plus.';
      if (!g.querySelector('#su-cgu').checked) return err.textContent = "Tu dois accepter les conditions d'utilisation.";
      const btn = g.querySelector('#su-ok'); busy(btn, true);
      try { sessionStorage.setItem('escale:pending-terms', JSON.stringify({ v: TERMS, age: true })); } catch (_) { }
      const { data, error } = await sb.auth.signUp({ email: e, password: pw, options: { data: { display_name: n, handle: h }, emailRedirectTo: CFG.siteUrl || location.origin } });
      busy(btn, false);
      if (error) return err.textContent = authError(error);
      if (!data.session) return checkEmail(e);
      await afterLogin();
    };
  });
}
function checkEmail(email) {
  showGate(`<div class="gicon">${SV.send}</div><h2>Vérifie ta boîte mail</h2><p class="gtext">Nous avons envoyé un lien de confirmation à <b>${esc(email)}</b>. Ouvre-le pour activer ton compte, puis reviens ici.</p>
    <button class="gbtn primary" data-auth="login">J'ai confirmé, me connecter</button><button class="gbtn" id="ce-again">Renvoyer l'e-mail</button><p class="gerr" id="ce-msg" role="status"></p>`, g => {
    bindAuth(g);
    g.querySelector('#ce-again').onclick = async () => { const { error } = await sb.auth.resend({ type: 'signup', email, options: { emailRedirectTo: CFG.siteUrl || location.origin } }); g.querySelector('#ce-msg').textContent = error ? authError(error) : 'E-mail renvoyé.'; };
  });
}
function loginForm() {
  showGate(`<button class="gback" data-auth="welcome" aria-label="Retour">${SV.back}</button><h2>Se connecter</h2>${googleBtn()}
    <form id="li" novalidate><label class="fld"><span>E-mail</span><input id="li-e" type="email" maxlength="254" autocomplete="email" required></label>
      <label class="fld"><span>Mot de passe</span><div class="pw"><input id="li-p" type="password" maxlength="72" autocomplete="current-password" required><button type="button" class="eye" data-auth="eye" aria-label="Afficher le mot de passe">${SV.eye}</button></div></label>
      <p class="gerr" id="li-err" role="alert"></p><button class="gbtn primary" id="li-ok">Se connecter</button></form>
    <p class="gswitch"><button data-auth="forgot" class="lnk">Mot de passe oublié ?</button></p><p class="gswitch">Pas encore de compte ? <button data-auth="signup" class="lnk">Créer un compte</button></p>`, g => {
    bindAuth(g);
    g.querySelector('#li').onsubmit = async ev => { ev.preventDefault(); const e = g.querySelector('#li-e').value.trim().toLowerCase(), pw = g.querySelector('#li-p').value, err = g.querySelector('#li-err'); err.textContent = '';
      if (!emailOk(e) || !pw) return err.textContent = 'Indique ton e-mail et ton mot de passe.';
      const btn = g.querySelector('#li-ok'); busy(btn, true);
      const { error } = await sb.auth.signInWithPassword({ email: e, password: pw }); busy(btn, false);
      if (error) return err.textContent = authError(error);
      await afterLogin(); };
  });
}
function forgotForm() {
  showGate(`<button class="gback" data-auth="login" aria-label="Retour">${SV.back}</button><h2>Mot de passe oublié</h2><p class="gtext">Indique ton e-mail : si un compte existe, tu recevras un lien pour choisir un nouveau mot de passe.</p>
    <form id="fo" novalidate><label class="fld"><span>E-mail</span><input id="fo-e" type="email" maxlength="254" autocomplete="email"></label><p class="gerr" id="fo-err" role="status"></p><button class="gbtn primary" id="fo-ok">Recevoir le lien</button></form>`, g => {
    bindAuth(g);
    g.querySelector('#fo').onsubmit = async ev => { ev.preventDefault(); const e = g.querySelector('#fo-e').value.trim().toLowerCase(), m = g.querySelector('#fo-err'); if (!emailOk(e)) return m.textContent = 'Adresse e-mail invalide.';
      const btn = g.querySelector('#fo-ok'); busy(btn, true); const { error } = await sb.auth.resetPasswordForEmail(e, { redirectTo: (CFG.siteUrl || location.origin) + '/?reset=1' }); busy(btn, false);
      m.textContent = error && (error.status === 429) ? authError(error) : 'Si un compte existe pour cette adresse, un e-mail vient de partir. Pense à regarder dans les indésirables.'; };
  });
}
function newPasswordForm() {
  showGate(`<h2>Nouveau mot de passe</h2><form id="np" novalidate><label class="fld"><span>Nouveau mot de passe</span><div class="pw"><input id="np-p" type="password" maxlength="72" autocomplete="new-password"><button type="button" class="eye" data-auth="eye" aria-label="Afficher le mot de passe">${SV.eye}</button></div></label><ul class="pwrules" id="np-r"></ul><p class="gerr" id="np-err" role="alert"></p><button class="gbtn primary" id="np-ok">Enregistrer</button></form>`, g => {
    bindAuth(g); const p = g.querySelector('#np-p'), rules = () => { g.querySelector('#np-r').innerHTML = pwRules(p.value).map(([ok, l]) => `<li class="${ok ? 'ok' : ''}">${ok ? SV.check : ''}${l}</li>`).join(''); }; p.oninput = rules; rules();
    g.querySelector('#np').onsubmit = async ev => { ev.preventDefault(); if (!pwOk(p.value)) return g.querySelector('#np-err').textContent = 'Le mot de passe ne respecte pas les règles.';
      const { error } = await sb.auth.updateUser({ password: p.value }); if (error) return g.querySelector('#np-err').textContent = authError(error);
      history.replaceState(null, '', location.pathname); toast('Mot de passe modifié'); await afterLogin(); };
  });
}
async function mfaForm() {
  const { data } = await sb.auth.mfa.listFactors(); const f = (data && data.totp || []).find(x => x.status === 'verified'); if (!f) return afterLogin(true);
  showGate(`<div class="gicon">${SV.lock}</div><h2>Double authentification</h2><p class="gtext">Saisis le code à 6 chiffres affiché par ton application d'authentification.</p>
    <form id="mf" novalidate><input id="mf-c" class="otp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]*" aria-label="Code"><p class="gerr" id="mf-err" role="alert"></p><button class="gbtn primary" id="mf-ok">Valider</button></form><p class="gswitch"><button data-auth="logout" class="lnk">Se déconnecter</button></p>`, g => {
    bindAuth(g);
    g.querySelector('#mf').onsubmit = async ev => { ev.preventDefault(); const code = g.querySelector('#mf-c').value.replace(/\D/g, ''); if (code.length !== 6) return g.querySelector('#mf-err').textContent = 'Le code contient 6 chiffres.';
      const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: f.id, code }); if (error) return g.querySelector('#mf-err').textContent = 'Code incorrect ou expiré.';
      await afterLogin(true); };
  });
}
function termsScreen() {
  let pend = {}; try { pend = JSON.parse(sessionStorage.getItem('escale:pending-terms') || '{}'); } catch (_) { }
  const update = SETTINGS && SETTINGS.terms_version && SETTINGS.terms_version !== TERMS;
  showGate(`<h2>${update ? 'Nos conditions évoluent' : 'Avant de commencer'}</h2><p class="gtext">${update ? "Merci de relire et d'accepter la nouvelle version pour continuer." : 'Quelques choix rapides sur tes données. Tu pourras les changer à tout moment dans les réglages.'}</p>
    <div class="gcard"><b>Ce que nous faisons de tes données</b><ul><li>Tes voyages, dépenses et notes sont privés par défaut.</li><li>Tu choisis pour chaque publication et chaque album qui peut les voir.</li><li>Nous ne vendons pas tes données et il n'y a pas de publicité.</li><li>Tu peux télécharger ou effacer toutes tes données quand tu veux.</li></ul></div>
    <label class="check"><input type="checkbox" id="tm-age" ${pend.age ? 'checked' : ''}><span>J'ai 15 ans ou plus.</span></label>
    <label class="check"><input type="checkbox" id="tm-cgu" ${pend.v === TERMS ? 'checked' : ''}><span>J'accepte les <a href="legal/cgu.html" target="_blank" rel="noopener">conditions d'utilisation</a> et j'ai lu la <a href="legal/confidentialite.html" target="_blank" rel="noopener">politique de confidentialité</a>.</span></label>
    <label class="check"><input type="checkbox" id="tm-disc" checked><span>Mes amis peuvent me trouver en cherchant mon nom ou mon identifiant. <small>(facultatif)</small></span></label>
    <p class="gerr" id="tm-err" role="alert"></p><button class="gbtn primary" id="tm-ok">Continuer</button><p class="gswitch"><button data-auth="logout" class="lnk">Se déconnecter</button></p>`, g => {
    bindAuth(g);
    g.querySelector('#tm-ok').onclick = async () => { const err = g.querySelector('#tm-err');
      if (!g.querySelector('#tm-age').checked) return err.textContent = 'Escale est réservée aux personnes de 15 ans ou plus.';
      if (!g.querySelector('#tm-cgu').checked) return err.textContent = "Tu dois accepter les conditions d'utilisation pour continuer.";
      try { await rpc('accept_terms', { p_version: TERMS, p_age_ok: true, p_discoverable: g.querySelector('#tm-disc').checked }); try { sessionStorage.removeItem('escale:pending-terms'); } catch (_) { }
        await loadProfile(); await afterLogin(true); } catch (e) { err.textContent = errMsg(e); } };
  });
}
const SLIDES = [
  ['Tes carnets de voyage', 'Un carnet par voyage : pages de souvenirs, photos et lieux, jour après jour.', SV.book],
  ['Ton budget, en direct', 'Note une dépense en deux secondes, en euros ou en monnaie locale. Escale te dit combien il te reste par jour.', SV.wallet],
  ['Partage, à ta façon', 'Publie tes souvenirs pour tes amis ou pour tout le monde, lance-leur des défis photo. Rien n’est public sans ton choix.', SV.users],
];
function onboarding(i = 0) {
  const [t, d, ic] = SLIDES[i];
  showGate(`<div class="slide1"><div class="gicon big">${ic}</div><h2>${t}</h2><p class="gtext">${d}</p></div><div class="sdots">${SLIDES.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
    <button class="gbtn primary" id="ob-next">${i < SLIDES.length - 1 ? 'Suivant' : 'Créer mon premier voyage'}</button>${i < SLIDES.length - 1 ? '<button class="gbtn" id="ob-skip">Passer</button>' : ''}`, g => {
    const done = async () => { await sb.from('account_settings').update({ onboarding_done: true }).eq('user_id', ME.id); SETTINGS.onboarding_done = true; writeCache(); hideGate(); go('home'); if (!S.trips.length) setTimeout(() => tripSheet(), 300); };
    g.querySelector('#ob-next').onclick = () => i < SLIDES.length - 1 ? onboarding(i + 1) : done();
    const sk = g.querySelector('#ob-skip'); if (sk) sk.onclick = async () => { await sb.from('account_settings').update({ onboarding_done: true }).eq('user_id', ME.id); SETTINGS.onboarding_done = true; hideGate(); go('home'); };
  });
}
function bindAuth(g) { g.querySelectorAll('[data-auth]').forEach(b => b.onclick = async e => { e.preventDefault(); const a = b.dataset.auth;
  if (a === 'welcome') welcome(); else if (a === 'signup') signupForm(); else if (a === 'login') loginForm(); else if (a === 'forgot') forgotForm();
  else if (a === 'logout') logout();
  else if (a === 'eye') { const i = b.parentNode.querySelector('input'); i.type = i.type === 'password' ? 'text' : 'password'; b.setAttribute('aria-label', i.type === 'password' ? 'Afficher le mot de passe' : 'Masquer le mot de passe'); }
  else if (a === 'google') { const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: CFG.siteUrl || location.origin } }); if (error) toast(authError(error)); } }); }

/* ---------- après connexion ---------- */
let started = false;
async function afterLogin(skipMfa) {
  // hors connexion, getUser() échoue : on rouvre l'appli avec la session gardée sur l'appareil
  let user = null, offlineStart = false;
  try { const r = await sb.auth.getUser(); user = r.data && r.data.user; if (!user && r.error && isNetwork(r.error)) throw r.error; }
  catch (e) { const { data: { session } } = await sb.auth.getSession(); user = session && session.user; offlineStart = !!user; }
  if (!user) return welcome();
  ME = user;
  if (!skipMfa && !offlineStart) { try { const { data } = await sb.auth.mfa.getAuthenticatorAssuranceLevel(); if (data && data.nextLevel === 'aal2' && data.currentLevel !== 'aal2') return mfaForm(); } catch (_) { } }
  const cache = readCache();
  try { await loadProfile(); }
  catch (e) { if (cache && isNetwork(e)) { PROFILE = cache.PROFILE; SETTINGS = cache.SETTINGS; S.user = (PROFILE.display_name || '').split(' ')[0]; setOnline(false); } else { toast('Connexion au serveur impossible'); return welcome(); } }
  if (!SETTINGS.terms_accepted_at || SETTINGS.terms_version !== TERMS) return termsScreen();
  if (cache && cache.SNAP) { S = { user: S.user, trips: cache.S.trips, envies: cache.S.envies }; SNAP = cache.SNAP; }
  try { if (cache && hasPending()) await sync(); await loadData(); } catch (e) { if (!cache) { toast('Tes carnets ne peuvent pas être chargés. Vérifie ta connexion.'); } setOnline(!isNetwork(e)); }
  loadPro();
  if (!SETTINGS.onboarding_done) return onboarding(0);
  hideGate(); started = true; go(current && $('s-' + current) && current !== 'carnet' ? current : 'home'); updateBadges(true);
}
async function logout(scope) { try { await sb.auth.signOut(scope ? { scope } : undefined); } catch (_) { } wipeLocal(); location.replace(location.pathname); }
sb.auth.onAuthStateChange((ev, session) => {
  if (ev === 'PASSWORD_RECOVERY') { setTimeout(newPasswordForm, 0); }
  if (ev === 'SIGNED_OUT' && started) { wipeLocal(); location.replace(location.pathname); }
});
let lastLoad = Date.now();
document.addEventListener('visibilitychange', async () => { if (document.visibilityState !== 'visible' || !started) return;
  if (hasPending()) { sync(); return; }
  if (Date.now() - lastLoad > 60000) { lastLoad = Date.now(); try { await loadData(); if (!$('panel').classList.contains('open') && !['fil', 'profil', 'ami'].includes(current)) refresh(); } catch (_) { } }
  updateBadges(true); });

/* ---------- réglages ---------- */
ACT.profile = () => { let ko = 0; try { ko = Math.round((localStorage.getItem(cacheKey()) || '').length / 1024); } catch (e) { }
  openPanel(`<h2>Réglages</h2><p class="small">${esc(PROFILE.display_name)}, @${esc(PROFILE.handle)} · ${esc(ME.email || '')}</p>
   <p class="setsec">Profil et confidentialité</p><div class="menulist">
    <button data-act="editProfile">${SV.edit}Modifier mon profil</button>
    <button data-act="setPrivacy">${SV.lock}Confidentialité</button>
    <button data-act="setAI">${SV.spark}Assistant IA<span class="small" style="margin-left:auto">${SETTINGS.ai_enabled ? 'activé' : 'désactivé'}</span></button></div>
   <p class="setsec">Sécurité</p><div class="menulist">
    <button data-act="setPassword">${SV.lock}Changer mon mot de passe</button>
    <button data-act="setMfa">${SV.check}Double authentification</button>
    <button data-act="logoutAll">${SV.users}Me déconnecter de tous les appareils</button></div>
   <p class="setsec">Mes données</p><div class="menulist">
    <button data-act="exportData">${SV.down}Télécharger toutes mes données</button>
    <button data-act="deleteAccount" class="red">${SV.trash}Supprimer mon compte</button></div>
   <p class="setsec">Aide</p><div class="menulist">
    <button data-act="contact">${SV.mail}Nous contacter<span class="small" style="margin-left:auto">${CONTACT}</span></button></div>
   <p class="setsec">Informations</p><div class="menulist">
    <a href="legal/confidentialite.html" target="_blank" rel="noopener">${SV.page}Politique de confidentialité</a>
    <a href="legal/cgu.html" target="_blank" rel="noopener">${SV.page}Conditions d'utilisation</a>
    <a href="legal/mentions-legales.html" target="_blank" rel="noopener">${SV.page}Mentions légales</a>
    <a href="mailto:${esc(CFG.contactEmail || '')}">${SV.send}Nous contacter</a></div>
   <p class="setmeta">Une copie de tes carnets (${ko} Ko) est gardée sur cet appareil pour fonctionner hors connexion. Elle est effacée quand tu te déconnectes.</p>
   <button class="danger" data-act="logout">Se déconnecter</button>${CLOSE('Fermer')}`, null, { nofocus: true }); };
ACT.logout = () => logout();
ACT.logoutAll = () => openPanel(`<h2>Déconnecter tous les appareils ?</h2><p class="small" style="line-height:1.5">Tu seras déconnectée partout, y compris ici. Utile si tu as perdu un téléphone ou utilisé un ordinateur partagé.</p><button class="danger" data-act="logoutAllOk" style="margin-top:16px">Tout déconnecter</button>${CLOSE()}`, null, { nofocus: true });
ACT.logoutAllOk = () => logout('global');
ACT.setPrivacy = async () => { const { data: bl } = await sb.from('blocks').select('blocked_id, created_at'); const ids = (bl || []).map(b => b.blocked_id);
  const prof = ids.length ? (await sb.from('profiles').select('id,display_name,handle,avatar_path').in('id', ids)).data || [] : [];
  openPanel(`<h2>Confidentialité</h2>
   <button type="button" class="togrow ${PROFILE.discoverable ? 'on' : ''}" id="pv-disc"><div><b>Apparaître dans la recherche</b><span>Tes amis peuvent te trouver par ton nom ou ton identifiant</span></div><i class="sw"></i></button>
   <p class="small" style="margin-top:14px">Visibilité par défaut de tes publications : <b>${VIS[SETTINGS.default_visibility].n}</b>. Tu la changes dans « Modifier mon profil », et pour chaque publication.</p>
   <p class="small" style="margin-top:8px">Tes albums sont privés tant que tu ne choisis pas « Amis » ou « Public » sur chacun. Tes dépenses et tes budgets ne sont jamais visibles par les autres.</p>
   <p class="setsec">Comptes bloqués</p><div class="flist">${prof.map(u => `<div class="frow">${avatar(u)}<div class="m"><b>${esc(u.display_name)}</b><span>@${esc(u.handle)}</span></div><button class="btn2" data-act="unblock" data-u="${u.id}">Débloquer</button></div>`).join('') || '<p class="small">Aucun.</p>'}</div>${CLOSE('Fermer')}`, p => {
    p.querySelector('#pv-disc').onclick = async e => { const b = e.currentTarget, v = !PROFILE.discoverable; try { await rpc('set_discoverable', { p_value: v }); PROFILE.discoverable = v; b.classList.toggle('on', v); toast(v ? 'Tu apparais dans la recherche' : 'Tu n’apparais plus dans la recherche'); } catch (er) { toast(errMsg(er)); } };
  }, { nofocus: true }); };
ACT.unblock = async d => { try { await rpc('unblock_user', { p_target: d.u }); toast('Membre débloqué'); ACT.setPrivacy(); } catch (e) { toast(errMsg(e)); } };
ACT.setAI = () => openPanel(`<h2>Assistant IA</h2><p class="small" style="line-height:1.55">Quand l'assistant est activé, tes questions et un résumé chiffré de tes voyages (pays, dates, budgets et totaux de dépenses par catégorie) sont envoyés à notre sous-traitant Anthropic pour générer la réponse. Tes notes, tes photos, ton e-mail et tes amis ne sont jamais envoyés. Ces données ne servent pas à entraîner de modèle. Sans activation, l'assistant fonctionne en mode simple, directement sur ton téléphone.</p>
   <button type="button" class="togrow ${SETTINGS.ai_enabled ? 'on' : ''}" id="ai-t"><div><b>Activer l'assistant IA</b><span>Tu peux le désactiver à tout moment</span></div><i class="sw"></i></button>${CLOSE('Fermer')}`, p => {
  p.querySelector('#ai-t').onclick = async e => { const b = e.currentTarget, v = !SETTINGS.ai_enabled; try { await rpc('set_ai_consent', { p_enabled: v }); SETTINGS.ai_enabled = v; writeCache(); b.classList.toggle('on', v); toast(v ? 'Assistant IA activé' : 'Assistant IA désactivé'); if (current === 'ia') renderScope(); } catch (er) { toast(errMsg(er)); } };
}, { nofocus: true });
ACT.setPassword = () => { const hasPw = (ME.app_metadata && (ME.app_metadata.providers || [ME.app_metadata.provider])).includes('email');
  openPanel(`<h2>Changer mon mot de passe</h2>${hasPw ? `<label class="fld"><span>Mot de passe actuel</span><input id="cp-old" type="password" maxlength="72" autocomplete="current-password"></label>` : '<p class="small">Tu te connectes avec Google : tu peux ajouter un mot de passe pour te connecter aussi avec ton e-mail.</p>'}
   <label class="fld"><span>Nouveau mot de passe</span><input id="cp-new" type="password" maxlength="72" autocomplete="new-password"></label><ul class="pwrules" id="cp-r"></ul>
   <button class="btn full" id="cp-ok">Enregistrer<i>${SV.right}</i></button>${CLOSE()}`, p => {
    const n = p.querySelector('#cp-new'), r = () => { p.querySelector('#cp-r').innerHTML = pwRules(n.value).map(([ok, l]) => `<li class="${ok ? 'ok' : ''}">${ok ? SV.check : ''}${l}</li>`).join(''); }; n.oninput = r; r();
    p.querySelector('#cp-ok').onclick = async () => { if (!pwOk(n.value)) { toast('Le nouveau mot de passe ne respecte pas les règles'); return; }
      if (hasPw) { const { error } = await sb.auth.signInWithPassword({ email: ME.email, password: p.querySelector('#cp-old').value }); if (error) { toast('Mot de passe actuel incorrect'); return; } }
      const { error } = await sb.auth.updateUser({ password: n.value }); if (error) { toast(authError(error)); return; } closePanel(); toast('Mot de passe modifié'); };
  }); };
ACT.setMfa = async () => { const { data } = await sb.auth.mfa.listFactors(); const f = (data && data.totp || []).find(x => x.status === 'verified');
  if (f) return openPanel(`<h2>Double authentification</h2><p class="small" style="line-height:1.5">Elle est activée : un code de ton application d'authentification t'est demandé à chaque connexion.</p><button class="danger" id="mfa-off" style="margin-top:16px">Désactiver</button>${CLOSE('Fermer')}`, p => {
    p.querySelector('#mfa-off').onclick = () => confirmIn(p, 'Désactiver la double authentification ?', async () => { const { error } = await sb.auth.mfa.unenroll({ factorId: f.id }); if (error) { toast('Pour désactiver, reconnecte-toi avec ton code puis réessaie'); return; } closePanel(); toast('Double authentification désactivée'); }, 'Désactiver'); }, { nofocus: true });
  for (const x of (data && data.all || []).filter(x => x.status !== 'verified')) await sb.auth.mfa.unenroll({ factorId: x.id });
  const { data: en, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Escale ' + new Date().toISOString().slice(0, 10) });
  if (error) { toast('Activation impossible pour le moment'); return; }
  openPanel(`<h2>Activer la double authentification</h2><p class="small" style="line-height:1.5">1. Scanne ce code avec une application comme Google Authenticator, 1Password ou Authy.<br>2. Saisis le code à 6 chiffres qu'elle affiche.</p>
   <div class="qr"><img alt="Code QR de configuration" src="${esc(en.totp.qr_code)}"></div><p class="small center">Ou saisis cette clé : <code class="secret">${esc(en.totp.secret)}</code></p>
   <label class="fld"><span>Code à 6 chiffres</span><input id="mfa-c" class="otp" inputmode="numeric" maxlength="6" autocomplete="one-time-code"></label>
   <button class="btn full" id="mfa-ok">Activer<i>${SV.right}</i></button>${CLOSE()}`, p => {
    p.querySelector('#mfa-ok').onclick = async () => { const code = p.querySelector('#mfa-c').value.replace(/\D/g, ''); const { error: er } = await sb.auth.mfa.challengeAndVerify({ factorId: en.id, code }); if (er) { toast('Code incorrect, réessaie'); return; } closePanel(); toast('Double authentification activée'); };
  }); };
ACT.exportData = () => openPanel(`<h2>Télécharger mes données</h2><p class="small" style="line-height:1.55">Tu reçois un fichier ZIP avec toutes tes données au format JSON (compte, profil, consentements, voyages, dépenses, journal, envies, publications, commentaires, réactions, amis, défis) et toutes tes photos.</p><p class="small" id="ex-st" role="status"></p><button class="btn full" id="ex-ok">Préparer le fichier<i>${SV.down}</i></button>${CLOSE()}`, p => {
  p.querySelector('#ex-ok').onclick = async () => { const st = p.querySelector('#ex-st'), btn = p.querySelector('#ex-ok'); busy(btn, true);
    try { st.textContent = 'Lecture de tes données…'; const data = await rpc('export_my_data'); const zip = new JSZip();
      zip.file('escale-donnees.json', JSON.stringify(data, null, 2));
      zip.file('LISEZMOI.txt', `Export Escale du ${new Date().toLocaleString('fr-FR')}\n\nescale-donnees.json : toutes tes données, au format JSON.\nphotos/ : tes photos originales telles qu'elles sont stockées.\n\nPour toute question : ${CFG.contactEmail || ''}\n`);
      const files = data.media_files || []; let n = 0;
      for (let i = 0; i < files.length; i += 50) { const part = files.slice(i, i + 50); const { data: urls } = await sb.storage.from('media').createSignedUrls(part, 600);
        for (const u of (urls || [])) { if (!u.signedUrl) continue; const r = await fetch(u.signedUrl); if (r.ok) { zip.file('photos/' + u.path.split('/').slice(1).join('/'), await r.blob()); } n++; st.textContent = `Photos : ${n} sur ${files.length}`; } }
      st.textContent = 'Création du fichier…'; const blob = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `escale-mes-donnees-${new Date().toISOString().slice(0, 10)}.zip`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      st.textContent = 'Fichier téléchargé.'; toast('Tes données sont téléchargées'); }
    catch (e) { st.textContent = 'Export impossible : ' + errMsg(e); }
    busy(btn, false); };
}, { nofocus: true });
ACT.deleteAccount = () => { const hasPw = (ME.app_metadata && (ME.app_metadata.providers || [ME.app_metadata.provider])).includes('email');
  openPanel(`<h2>Supprimer mon compte</h2><p class="small" style="line-height:1.55">Cette action est <b>définitive</b>. Ton compte, tes voyages, tes dépenses, ton journal, tes photos, tes publications, tes commentaires, tes réactions, tes amitiés et tes défis seront effacés immédiatement de nos serveurs. Pense à télécharger tes données avant.</p>
   ${hasPw ? `<label class="fld"><span>Ton mot de passe</span><input id="da-p" type="password" maxlength="72" autocomplete="current-password"></label>` : ''}
   <label class="fld"><span>Écris SUPPRIMER pour confirmer</span><input id="da-c" maxlength="12" autocapitalize="characters" autocomplete="off"></label>
   <button class="danger" id="da-ok" style="margin-top:16px">Supprimer définitivement</button>${CLOSE()}`, p => {
    p.querySelector('#da-ok').onclick = async () => { const btn = p.querySelector('#da-ok');
      if (p.querySelector('#da-c').value.trim().toUpperCase() !== 'SUPPRIMER') { toast('Écris SUPPRIMER pour confirmer'); return; }
      if (hasPw) { const { error } = await sb.auth.signInWithPassword({ email: ME.email, password: p.querySelector('#da-p').value }); if (error) { toast('Mot de passe incorrect'); return; } }
      busy(btn, true); const { data, error } = await sb.functions.invoke('delete-account', { body: { confirm: 'SUPPRIMER' } }); busy(btn, false);
      if (error || !data || !data.deleted) { toast('La suppression a échoué, réessaie ou contacte-nous'); return; }
      wipeLocal(); try { await sb.auth.signOut({ scope: 'local' }); } catch (_) { } started = false; closePanel(); showGate(`<div class="gicon">${SV.check}</div><h2>Compte supprimé</h2><p class="gtext">Ton compte et toutes tes données ont été effacés de nos serveurs. Merci d'avoir voyagé avec Escale.</p><button class="gbtn primary" id="bye">Fermer</button>`, g => g.querySelector('#bye').onclick = () => location.replace(location.pathname)); };
  }); };

/* ---------- démarrage ---------- */
(async function boot() {
  if (!CFG.supabaseUrl || !CFG.supabaseAnonKey) { showGate('<h2>Configuration manquante</h2><p class="gtext">Renseigne js/config.js avec l’adresse et la clé publique de ton projet Supabase.</p>'); return; }
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
  const isReset = new URLSearchParams(location.search).has('reset');
  const { data: { session } } = await sb.auth.getSession();
  setTimeout(() => $('splash') && $('splash').classList.add('out'), 300);
  if (isReset && session) return newPasswordForm();
  if (session) { if (new URLSearchParams(location.search).has('code')) history.replaceState(null, '', location.pathname); await afterLogin(); }
  else welcome();
})();
