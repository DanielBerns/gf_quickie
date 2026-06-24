/**
 * sw.js — Service Worker for Campo Ciudadano
 *
 * Caches the app shell for offline use.
 * Handles background sync of pending reports.
 */

const CACHE_NAME = 'campo-ciudadano-v2';
const APP_SHELL  = [
  '/',
  '/css/style.css',
  '/js/pin-ui.js',
  '/js/auth.js',
  '/js/geolocation.js',
  '/js/categories.js',
  '/js/camera.js',
  '/js/db.js',
  '/js/api.js',
  '/js/app.js',
  '/manifest.json',
  'https://unpkg.com/dexie/dist/dexie.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
];

// ── Install: cache app shell ──────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// ── Activate: clear old caches ───────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: network-first for API, cache-first for assets ─────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // API calls: always try network; never cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request).catch(() =>
      new Response(JSON.stringify({ error: 'Sin conexión' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      })
    ));
    return;
  }

  // App shell: cache-first, fallback to network
  event.respondWith(
    caches.match(event.request).then(cached =>
      cached || fetch(event.request).then(response => {
        // Cache successful responses
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
    )
  );
});
