/* Escale : fonctionnement hors connexion. Seuls les fichiers de l'appli sont mis en cache ;
 * les données personnelles et les photos ne passent jamais par ce cache. */
const VERSION = 'escale-v1.2.0';
const SHELL = ['./', 'index.html', 'css/app.css', 'css/fonts.css', 'js/config.js', 'js/world.js', 'js/ref.js', 'js/store.js', 'js/ui.js', 'js/comptes.js', 'js/v12.js', 'js/social.js', 'js/auth.js',
  'vendor/supabase.js', 'vendor/gsap.min.js', 'vendor/d3.min.js', 'vendor/topojson-client.min.js', 'vendor/jszip.min.js', 'manifest.webmanifest', 'icons/icon-192.png',
  'fonts/inter-latin-400-normal.woff2', 'fonts/inter-latin-500-normal.woff2', 'fonts/inter-latin-600-normal.woff2', 'fonts/inter-latin-700-normal.woff2', 'fonts/playfair-display-latin-500-normal.woff2'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== VERSION).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // API Supabase, photos : jamais en cache
  if (e.request.mode === 'navigate') { e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(VERSION).then(x => x.put('index.html', c)); return r; }).catch(() => caches.match('index.html'))); return; }
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => { if (r.ok && !u.pathname.startsWith('/legal/')) { const c = r.clone(); caches.open(VERSION).then(x => x.put(e.request, c)); } return r; })));
});
