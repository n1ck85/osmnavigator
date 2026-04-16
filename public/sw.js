const VERSION = "v3";
const STATIC_CACHE = `osmnav-static-${VERSION}`;
const RUNTIME_CACHE = `osmnav-runtime-${VERSION}`;

// Detect base path dynamically (works on localhost + GitHub Pages)
const BASE = self.location.pathname.replace(/sw\.js$/, "");

// --- Static assets to pre-cache ---
const STATIC_ASSETS = [
  `${BASE}`,
  `${BASE}index.html`,
  `${BASE}src/main.js`,
  `${BASE}src/classes/MapManager.js`,
  `${BASE}src/classes/GPXManager.js`,
  `${BASE}src/classes/NavigationManager.js`,
  `${BASE}src/classes/DeviceManager.js`,
  `${BASE}src/classes/SpeechManager.js`,
  `${BASE}src/classes/utils/TileUtil.js`,
];

// --- Install ---
self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS))
  );
});

// --- Activate ---
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// --- Fetch handler ---
self.addEventListener("fetch", event => {
  const req = event.request;
  const url = new URL(req.url);

  // 1. Navigation requests → return cached index.html
  if (req.mode === "navigate") {
    event.respondWith(
      caches.match(`${BASE}index.html`).then(res => res || fetch(req))
    );
    return;
  }

  // 2. Static assets → cache-first
  if (req.url.startsWith(self.location.origin + BASE)) {
    event.respondWith(
      caches.match(req).then(cached => {
        return (
          cached ||
          fetch(req).then(res => {
            const copy = res.clone();
            caches.open(STATIC_CACHE).then(cache => cache.put(req, copy));
            return res;
          })
        );
      })
    );
    return;
  }

  // 3. Map tiles → runtime cache with limit
  if (url.hostname.includes("tile") || url.pathname.includes("/tiles/")) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async cache => {
        const cached = await cache.match(req);
        if (cached) return cached;

        try {
          const res = await fetch(req);
          cache.put(req, res.clone());
          trimCache(RUNTIME_CACHE, 100); // keep last 100 tiles
          return res;
        } catch {
          return cached || Response.error();
        }
      })
    );
    return;
  }

  // 4. Everything else → network fallback
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});

// --- Cache trimming helper ---
async function trimCache(name, maxItems) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    await cache.delete(keys[0]);
    trimCache(name, maxItems);
  }
}

self.addEventListener("message", async event => {
  if (event.data?.type === "CACHE_TILES") {
    const { tiles } = event.data;
    const cache = await caches.open(RUNTIME_CACHE);

    let i = 0;

    for (const url of tiles) {
      i++;

      try {
        const req = new Request(url, { mode: "no-cors" });

        // 1. Check if tile already exists in cache
        const existing = await cache.match(req);
        if (existing) {
          console.log(`skipped (already cached) ${i} of ${tiles.length}`);
          continue;
        }

        // 2. Fetch tile
        const res = await fetch(req);

        // 3. Cache opaque or OK responses
        if (res.type === "opaque" || res.ok) {
          await cache.put(req, res.clone());
        }

        // Calculate progress
        const percent = Math.round((i / tiles.length) * 100);

        // Send progress back to the main thread
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: "TILE_CACHE_PROGRESS",
              index: i,
              total: tiles.length,
              percent
            });
          });
        });

        console.log(`cached ${i} of ${tiles.length} tiles`);
      } catch (err) {
        console.warn("Tile fetch failed:", url, err);
      }
    }
  }
});
