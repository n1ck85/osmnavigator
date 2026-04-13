const CACHE_NAME = "osmnav-cache-v1";

const ASSETS = [
  "./osmnavigator/index.html",
  "./osmnavigator/src/app.js",
  "./osmnavigator/src/style.css",
  "./osmnavigator/src/classes/MapManager.js",
  "./osmnavigator/src/classes/GPXManager.js",
  "./osmnavigator/src/classes/NavigationManager.js",
  "./osmnavigator/src/classes/DeviceManager.js",
  "./osmnavigator/src/classes/SpeechManager.js"
];

// --- Install ---
self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

// --- Activate ---
self.addEventListener("activate", event => {
  self.clients.claim();
});

// --- Fetch ---
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).catch(() => {
        if (event.request.mode === "navigate") {
          return caches.match("./index.html");
        }
      });
    })
  );
});