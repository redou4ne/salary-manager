const CACHE = "salary-manager-1.0.3";
const ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./icons/apple-touch-icon.png", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-maskable-512.png", "./fonts/bricolage-500.woff2", "./fonts/bricolage-700.woff2", "./fonts/public-400.woff2", "./fonts/public-500.woff2", "./fonts/public-600.woff2", "./fonts/public-700.woff2"];
// install: download every file fresh (never from the browser's HTTP cache)
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(ASSETS.map(u =>
    fetch(u, {cache: "no-cache"}).then(r => { if (!r.ok) throw new Error("download failed: " + u); return c.put(u, r); })
  ))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("salary-manager-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// offline: the last page seen online is always kept as ./index.html
const fromCache = req => caches.match("./index.html").then(hit => hit || caches.match(req, {ignoreSearch: true}));
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  const isPage = req.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith("/index.html");
  if (isPage) {
    // the page: newest copy when there is signal (3 s limit), saved copy when there is not
    e.respondWith(new Promise(resolve => {
      let done = false;
      const timer = setTimeout(() => { if (!done) { done = true; resolve(fromCache(req)); } }, 3000);
      fetch(req.url, {cache: "no-cache", credentials: "same-origin"}).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put("./index.html", copy)); }
        if (!done) { done = true; clearTimeout(timer); resolve(res.ok ? res : fromCache(req)); }
      }).catch(() => { if (!done) { done = true; clearTimeout(timer); resolve(fromCache(req)); } });
    }));
    return;
  }
  // fonts, icons, manifest: saved copy first
  e.respondWith(caches.match(req, {ignoreSearch: true}).then(hit => hit || fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => Response.error())));
});
