// Service worker: caches the app shell so Cooter opens offline (your checklist
// is always available). Species searches need a connection.
const CACHE = 'cooter-v3';
const SHELL = [
  './', 'index.html', 'css/styles.css', 'icon.svg', 'manifest.webmanifest',
  'js/app.js', 'js/groups.js', 'js/sources.js', 'js/rarity.js', 'js/checklist.js', 'js/management.js', 'js/management-view.js', 'js/usage.js', 'js/edible-view.js',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  const isShell = url.origin === location.origin || url.host === 'cdnjs.cloudflare.com';
  if (e.request.method !== 'GET' || !isShell) return; // API calls go straight to network
  // Network first so updates show up, falling back to cache when offline.
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request)),
  );
});
