const CACHE_NAME = "osmnav-cache-v1";

const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./src/app.js",
  "./src/style.css",
  // classes
  "./src/classes/MapManager.js",
  "./src/classes/GPXManager.js",
  "./src/classes/NavigationManager.js",
  "./src/classes/DeviceManager.js",
  "./src/classes/SpeechManager.js"
];

// --- Force immediate activation of new SW ---
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", () => self.clients.claim());

// Install
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

// Fetch
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request);
    })
  );
});