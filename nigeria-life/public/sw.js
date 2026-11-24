// Nigeria Life on the phone: the game's files kept for the next start (and a weak connection);
// the page itself always asked of the network first, so a new version is what opens.
// Models and other public assets are cache-first after the first fetch; bump CACHE when the
// worker changes so a new deploy replaces stale copies.
const CACHE = 'nigeria-life-v2';

function isModelOrStaticAsset(pathname) {
  // GLB/GLTF models and other public binaries that are content-addressed by path
  return (
    pathname.includes('/models/') ||
    /\.(glb|gltf|bin|webp|png|jpg|jpeg|svg|woff2?)$/i.test(pathname)
  );
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const url = new URL(req.url);
  // Built files have their content in their names: once fetched they never change
  if (url.pathname.includes('/assets/')) {
    event.respondWith(caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    }));
    return;
  }
  // Models / static media: cache-first so a repeat visit does not re-download megabytes.
  // A new sw.js (new CACHE name) drops the old cache on activate, so updates still land.
  if (isModelOrStaticAsset(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch {
        return (await cache.match(req)) || Response.error();
      }
    }));
    return;
  }
  // Everything else (the page, the version note): the network first, what was kept if offline
  if (url.pathname.endsWith('version.json')) return;
  event.respondWith(fetch(req).then((res) => {
    if (res.ok) caches.open(CACHE).then((cache) => cache.put(req, res.clone()));
    return res;
  }).catch(() => caches.match(req).then((hit) => hit || Response.error())));
});
