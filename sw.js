/* Corona Shift Log — service worker.

   The app files are never cached: an update has to show up the moment
   it is deployed, and a stale copy of db.js or config.js leaves the app
   unable to reach the database at all.

   Icons are cached, since they never change.

   Entries made with no signal are still safe — those are held by the
   app itself and sent when the connection returns. */

const CACHE = 'corona-icons-v1';
const ICONS = [
  './icon-192.png', './icon-512.png',
  './icon-maskable-512.png', './apple-touch-icon.png', './favicon-64.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ICONS))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    // clear everything an older version of this worker cached
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if(e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if(url.origin !== self.location.origin) return;      // leave Supabase alone

  // icons: from cache, quick
  if(/\.(png|ico)$/.test(url.pathname)){
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request)));
    return;
  }

  // everything else: always from the network, never stored
  e.respondWith(fetch(e.request));
});

// lets the page tell an old worker to step aside
self.addEventListener('message', e => {
  if(e.data === 'skip-waiting') self.skipWaiting();
});
