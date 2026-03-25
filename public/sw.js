const CACHE_NAME = "time-machine-v2";
const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        )
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only handle GET requests — let everything else pass through
  if (event.request.method !== "GET") return;

  // Never intercept API calls
  if (url.pathname.startsWith("/api/")) return;

  // Never intercept Next.js internals:
  //   /_next/webpack-hmr  → WebSocket for hot-module replacement
  //   /_next/static/chunks/*.hot-update.*  → HMR patch files
  //   /_next/ in general  → Next.js handles its own cache-busting via hashed filenames
  if (url.pathname.startsWith("/_next/")) return;

  // Cache-first for long-lived static assets (icons, manifest)
  const isStaticAsset =
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.json";

  if (isStaticAsset) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) =>
                cache.put(event.request, clone)
              );
            }
            return response;
          })
      )
    );
    return;
  }

  // Network-first for HTML navigation pages.
  // On network failure, serve cached version or root; never return undefined
  // (returning undefined from respondWith causes ERR_CACHE_MISS in Chrome).
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && response.type !== "opaque") {
          const clone = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        return cached || caches.match("/");
      })
  );
});
