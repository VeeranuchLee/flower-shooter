/* Petal Kingdom — offline cache.
   Bump CACHE_NAME whenever app files change so installed copies refresh.

   OPTIONAL_FILES are the generated-art slots. They are cached opportunistically:
   a missing file must never break installation, so they are added one by one
   and failures are swallowed. When art is added later, bump CACHE_NAME. */

const CACHE_NAME = "petal-kingdom-public-v2";

const APP_FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest"
];

const OPTIONAL_FILES = [
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/apple-touch-icon.png",
  "./assets/art/garden-background-secret.png",
  "./assets/art/garden-background-dawn.png",
  "./assets/art/garden-background-greenhouse.png",
  "./assets/art/garden-background.png",
  "./assets/art/castle-band.png",
  "./assets/art/helper-idle.png",
  "./assets/art/helper-cheer.png",
  "./assets/art/helper-worry.png",
  "./assets/art/win-banner.png",
  "./assets/art/title-card.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(APP_FILES);
      await Promise.all(
        OPTIONAL_FILES.map((url) => cache.add(url).catch(() => undefined))
      );
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  // Navigations: network first, fall back to the cached shell when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Everything else: cache first, then network, and store what we fetch.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.status === 200 && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
