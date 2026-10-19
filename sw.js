const CACHE_NAME = 'afinador-backstage-v8';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js?v=8.0',
  './audio-processor.js?v=8.0',
  './manifest.json',
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
