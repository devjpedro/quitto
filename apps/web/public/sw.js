/*
 * Quitto service worker, written by hand (no plugin).
 *
 * - Pre-caches only /offline.html (it uses no other file).
 * - Caches at run time, cache-first, ONLY the build's hashed files (/assets/*).
 * - Never caches navigation or HTML, /api/*, non-GET requests or other origins.
 * - Navigation always goes to the network; if it fails, /offline.html.
 *
 * To turn the PWA off for everyone: publish this file as the kill switch below
 * (it unregisters itself and clears the caches) and keep it for a few weeks:
 *
 *   self.addEventListener("install", () => self.skipWaiting());
 *   self.addEventListener("activate", (event) => event.waitUntil(
 *     caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
 *       .then(() => self.registration.unregister())));
 *
 * Bump CACHE_VERSION when the pre-cached file changes: `activate` deletes the old caches.
 */
const CACHE_VERSION = "v1";
const CACHE = `quitto-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
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
          keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
        )
      )
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
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then((res) => res ?? Response.error())
      )
    );
    return;
  }

  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) {
          return hit;
        }
        const res = await fetch(request);
        if (res.ok && res.type === "basic") {
          cache.put(request, res.clone());
        }
        return res;
      })
    );
  }
});
