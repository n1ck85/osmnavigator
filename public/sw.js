const VERSION = "v3";
const STATIC_CACHE = `osmnav-static-${VERSION}`;
const RUNTIME_CACHE = `osmnav-runtime-${VERSION}`;

const IS_DEV = self.location.hostname === "localhost";

// Detect base path dynamically (works on localhost + GitHub Pages)
const BASE = self.location.pathname.replace(/sw\.js$/, "");

// --- Static assets to pre-cache ---
const DEV_ASSETS = [
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

async function getProdAssets() {
  const res = await fetch(BASE + "manifest.webmanifest");
  const manifest = await res.json();
  return [
    BASE,
    BASE + "index.html",
    ...Object.values(manifest).map(entry => BASE + entry.file),
    ...Object.values(manifest)
      .flatMap(entry => entry.css ? entry.css.map(c => BASE + c) : []),
  ];
}

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open("static-v1");

    const assets = IS_DEV
      ? DEV_ASSETS
      : await getProdAssets();

    for (const url of assets) {
      try {
        await cache.add(url);
      } catch (err) {
        console.warn("SW failed to cache:", url, err);
      }
    }
  })());
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

self.addEventListener("fetch", event => {
  const req = event.request;
  const url = new URL(req.url);

  // 1. Navigation
  if (req.mode === "navigate") {
    event.respondWith(handleNavigation(req));
    return;
  }

  // 2. Static assets
  if (isStaticAsset(url)) {
    event.respondWith(handleStatic(req));
    return;
  }

  // 3. Tiles
  if (isTile(url)) {
    event.respondWith(handleTile(req));
    return;
  }

  // 4. Everything else
  event.respondWith(fetch(req));
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
  if (event.data?.type !== "CACHE_TILES") return;

  const { tiles } = event.data;
  const cache = await caches.open(RUNTIME_CACHE);

  let i = 0;

  for (const url of tiles) {
    i++;

    try {
      const req = new Request(url); // CORS, not no-cors

      // Skip if already cached
      const existing = await cache.match(req);
      if (existing) continue;

      const res = await fetch(req);

      // Only cache valid raster tiles
      if (res.ok && res.headers.get("content-type")?.includes("image")) {
        await cache.put(req, res.clone());
      }

      // progress
      const percent = Math.round((i / tiles.length) * 100);
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
      console.log(`Cached tile ${i}/${tiles.length}: ${url}`);
    } catch (err) {
      console.warn("Tile fetch failed:", url, err);
    }
  }
});


// -----------------------------
// 1. Navigation handler
// -----------------------------
function handleNavigation(req) {
  return caches.match(`${BASE}index.html`).then(cached => {
    return cached || fetch(req);
  });
}

// -----------------------------
// 2. Static asset detection
// -----------------------------
function isStaticAsset(url) {
  return (
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".html") ||
    url.pathname.endsWith(".webmanifest")
  );
}

// -----------------------------
// 3. Static asset handler
// -----------------------------
function handleStatic(req) {
  return caches.match(req).then(cached => {
    if (cached) return cached;

    return fetch(req).then(res => {
      const clone = res.clone(); // clone FIRST
      caches.open(STATIC_CACHE).then(cache => cache.put(req, clone));
      return res;
    });
  });
}

// -----------------------------
// 4. Tile detection (strict whitelist)
// -----------------------------
function isTile(url) {
  return (
    url.hostname.includes("maptiler") &&
    /\/\d+\/\d+\/\d+\.(png|jpg)/.test(url.pathname)
  );
}

// -----------------------------
// 5. Tile handler (safe + trimmed)
// -----------------------------
function handleTile(req) {
  return caches.open(RUNTIME_CACHE).then(async cache => {
    const cached = await cache.match(req);
    if (cached) return cached;

    try {
      const res = await fetch(req);

      if (res.ok) {
        cache.put(req, res.clone());
        trimCache(RUNTIME_CACHE, 1000);
      }

      return res;
    } catch {
      return cached || Response.error();
    }
  });
}

