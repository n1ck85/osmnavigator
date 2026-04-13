const CACHE_NAME = "osmnav-cache-v1";

const ASSETS = [
  "./index.html",
  "./src/app.js",
  "./src/style.css",
  "./src/classes/MapManager.js",
  "./src/classes/GPXManager.js",
  "./src/classes/NavigationManager.js",
  "./src/classes/DeviceManager.js",
  "./src/classes/SpeechManager.js"
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