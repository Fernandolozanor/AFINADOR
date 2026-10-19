const CACHE_NAME = 'afinador-backstage-v10';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js?v=10.0',
  './audio-processor.js?v=10.0',
  './manifest.json',
  './afinador-backstage-logo.jpg',
  './logo-afinador.svg',
  './icon-afinador.svg',
  './backstage-logo.png',
  './backstage-icon.png',
  './icon-192.svg',
  './icon-512.svg'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
