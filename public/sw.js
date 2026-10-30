/* QITL service worker: network first for pages, falling back to a cached copy, then to /offline.
   Never caches API responses, account or admin pages. */
const CACHE = "qitl-pages-v1";
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.add("/offline")).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || req.mode !== "navigate" || url.origin !== self.location.origin) return;
  if (/^\/(ar\/)?(api|admin|account|sign-in|auth)(\/|$)/.test(url.pathname)) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("/offline"))),
  );
});
