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

const NAVIGATION_TIMEOUT_MS = 3500;

async function networkFirst(request) {
  const cache = await caches.open(SHELL);
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), NAVIGATION_TIMEOUT_MS)),
    ]);
    if (response.ok) cache.put("/", response.clone());
    return response;
  } catch {
    const cached = await cache.match("/");
    return cached || Response.error();
  }
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
    event.respondWith(networkFirst(request));
    return;
  }
  event.respondWith(cacheFirst(request, SHELL));
});
