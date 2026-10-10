/*
 * Quitto service worker, written by hand (no plugin).
 *
 * - Two caches: SHELL pre-caches only /offline.html (it uses no other file);
 *   ASSETS holds, cache-first, ONLY the build's hashed files (/assets/*), trimmed
 *   to the MAX_ASSETS most recent so it can't grow forever across deploys.
 * - Never caches navigation or HTML, /api/*, non-GET requests or other origins.
 * - Navigation always goes to the network; if it fails, /offline.html.
 *
 * To turn the PWA off for everyone: publish this file as the kill switch below
 * (it unregisters itself and clears the caches) and keep it for a few weeks:
 *
 *   // cache.keys() is in insertion order, so the oldest files go first.
async function trimAssets(cache) {
  const keys = await cache.keys();
  await Promise.all(
    keys.slice(0, Math.max(0, keys.length - MAX_ASSETS)).map((k) => cache.delete(k))
  );
}

self.addEventListener("install", () => self.skipWaiting());
 *   self.addEventListener("activate", (event) => event.waitUntil(
 *     caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
 *       .then(() => self.registration.unregister())));
 *
 * Bump CACHE_VERSION when the pre-cached file changes: `activate` deletes the caches of other names.
 */
const CACHE_VERSION = "v2";
const SHELL = `quitto-shell-${CACHE_VERSION}`;
const ASSETS = `quitto-assets-${CACHE_VERSION}`;
const MAX_ASSETS = 200;
const OFFLINE_URL = "/offline.html";

// cache.keys() is in insertion order, so the oldest files go first.
async function trimAssets(cache) {
  const keys = await cache.keys();
  await Promise.all(
    keys
      .slice(0, Math.max(0, keys.length - MAX_ASSETS))
      .map((key) => cache.delete(key))
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" })))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL && key !== ASSETS)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.registration.navigationPreload?.enable())
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return (await event.preloadResponse) ?? (await fetch(request));
        } catch {
          return (await caches.match(OFFLINE_URL)) ?? Response.error();
        }
      })()
    );
    return;
  }

  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.open(ASSETS).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) {
          return hit;
        }
        const res = await fetch(request);
        if (res.ok && res.type === "basic") {
          event.waitUntil(
            cache.put(request, res.clone()).then(() => trimAssets(cache))
          );
        }
        return res;
      })
    );
  }
});
