const CACHE_NAME = 'cdlabelmaker-v2';
const PRECACHE_URLS = [
  '/',
  'index.html',
  'styles.css',
  'app.js',
  'manifest.json',
  'offline.html',
  'icons/icon-192.svg',
  'icons/icon-512.svg',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

const RUNTIME_CACHE = 'runtime-cache-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k !== CACHE_NAME && k !== RUNTIME_CACHE).map(k => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// helper to send a message to all clients
async function notifyClients(message) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  for (const client of clients) {
    client.postMessage(message);
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // navigation requests: network-first with offline fallback
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const networkResp = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, networkResp.clone());
        return networkResp;
      } catch (err) {
        const cached = await caches.match(req);
        if (cached) return cached;
        return caches.match('offline.html');
      }
    })());
    return;
  }

  // images: stale-while-revalidate
  if (req.destination === 'image' || url.pathname.startsWith('/icons/')) {
    event.respondWith((async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      const cached = await cache.match(req);
      const networkPromise = fetch(req).then(networkResp => {
        if (networkResp && networkResp.ok) cache.put(req, networkResp.clone());
        return networkResp;
      }).catch(() => null);
      return cached || (await networkPromise) || (await caches.match('icons/icon-192.png'));
    })());
    return;
  }

  // default: try cache first, then network
  event.respondWith(caches.match(req).then(cached => cached || fetch(req).then(networkResp => {
    // optionally cache GET responses
    if (req.method === 'GET' && networkResp && networkResp.ok) {
      caches.open(RUNTIME_CACHE).then(cache => cache.put(req, networkResp.clone()));
    }
    return networkResp;
  }).catch(() => {
    // if nothing found and it's a request for a CSS/JS we may return offline fallback
    if (req.destination === 'document') return caches.match('offline.html');
  })));
});

// Listen for SKIP_WAITING message from the client
self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Notify clients when a new service worker is installed and controlling
self.addEventListener('controllerchange', () => {
  notifyClients({ type: 'SW_UPDATED' });
});

self.addEventListener('push', (evt) => {
  // placeholder for future push handling
});
