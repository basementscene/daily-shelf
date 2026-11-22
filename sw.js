const CACHE = 'daily-shelf-v4';
const ASSETS = [
  './', './index.html', './style.css', './app.js', './db.js', './manifest.json',
  './vendor/html5-qrcode.min.js',
  './fonts/dm-mono-300.woff2', './fonts/dm-mono-300-ext.woff2',
  './fonts/dm-mono-400.woff2', './fonts/dm-mono-400-ext.woff2',
  './fonts/dm-mono-500.woff2', './fonts/dm-mono-500-ext.woff2',
  './icons/icon-192.png', './icons/icon-512.png',
  './icons/icon-maskable-512.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).catch(() => {
        if (e.request.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      });
    })
  );
});
