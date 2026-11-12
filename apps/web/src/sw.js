const VERSION = "__VERSION__";
const SHELL = `yara-shell-${VERSION}`;
const MEDIA = "yara-media-v1";
const PRECACHE = __PRECACHE__;
const MEDIA_PATH = /\/v1\/(images|audio)\//;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== SHELL && key !== MEDIA).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function shellFirst(request) {
  const cache = await caches.open(SHELL);
  const cached = await cache.match("/");
  if (cached) return cached;
  return fetch(request);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (MEDIA_PATH.test(url.pathname)) {
    event.respondWith(cacheFirst(request, MEDIA));
    return;
  }
  if (url.origin !== self.location.origin || url.pathname.startsWith("/v1/")) return;
  if (request.mode === "navigate") {
    event.respondWith(shellFirst(request));
    return;
  }
  event.respondWith(cacheFirst(request, SHELL));
});
