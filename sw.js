/* ============================================================
   CAP FIN — service worker
   - Coquille de l'appli (HTML, CSS, JS, icônes) en cache : l'appli
     s'ouvre même sans réseau.
   - Les appels à Supabase ne sont jamais mis en cache : les données
     hors ligne sont gérées par l'appli (cache local + file d'attente).
   ============================================================ */

const VERSION = 'cap75-v3.4.0';
const SHELL = [
  './',
  './index.html',
  './offline.html',
  './manifest.json',
  './css/cap75.css',
  './js/vendor/supabase.js',
  './js/config.js',
  './js/finance.js',
  './js/data.js',
  './js/app.js',
  // Les grandes icônes (512 px) ne servent qu'à l'installation : pas de préchargement
  './icons/logo-mark.png',
  './icons/icon-192.png',
  './icons/favicon.ico'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(new Request(url, { cache: 'reload' })))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Uniquement nos propres fichiers : Supabase et les autres domaines passent directement
  if (url.origin !== self.location.origin) return;

  // Pages : réseau d'abord (version à jour), puis cache, puis page hors ligne
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() =>
          caches
            .match('./index.html')
            .then((cached) => cached || caches.match('./offline.html'))
            .then((page) => page || new Response('Hors ligne', { status: 503 }))
        )
    );
    return;
  }

  // Fichiers de l'appli : cache d'abord, mise à jour en arrière-plan
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached || new Response('', { status: 504 }));
      return cached || network;
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
