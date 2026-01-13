// Minimal service worker for caching app shell for offline install
const CACHE_NAME = 'cdlabelmaker-v1';
const ASSETS_TO_CACHE = [
  '/',
  'index.html',
  'styles.css',
  'app.js',
  'manifest.json',
  'icons/icon-192.svg',
  'icons/icon-512.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(names => Promise.all(
      names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // simple cache-first strategy
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(networkRes => {
        // optionally add to cache for future
        return caches.open(CACHE_NAME).then(cache => {
          // Don't cache opaque cross-origin requests
          if (event.request.method === 'GET' && networkRes && networkRes.type !== 'opaque') {
            cache.put(event.request, networkRes.clone());
          }
          return networkRes;
        });
      }).catch(() => {
        // fallback could be the index (for navigation requests)
        if (event.request.mode === 'navigate') {
          return caches.match('index.html');
        }
      });
    })
  );
});
