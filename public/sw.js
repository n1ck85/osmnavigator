const VERSION = "v7";
const STATIC_CACHE = `osmnav-static-${VERSION}`;
const RUNTIME_CACHE = `osmnav-runtime-${VERSION}`;

const IS_DEV = self.location.hostname === "localhost";
const BASE = self.location.pathname.replace(/sw\.js$/, "");

// In development, we can hardcode the list of assets since they won't be hashed.
const DEV_ASSETS = [
  `${BASE}`, `${BASE}index.html`, `${BASE}src/main.js`,
  `${BASE}src/classes/MapManager.js`, `${BASE}src/classes/GPXManager.js`,
  `${BASE}src/classes/NavigationManager.js`, `${BASE}src/classes/DeviceManager.js`,
  `${BASE}src/classes/SpeechManager.js`, `${BASE}src/classes/utils/TileUtil.js`,
];

async function getProdAssets() {
  const res = await fetch(BASE + "manifest.webmanifest");
  const manifest = await res.json();
  return [
    BASE, BASE + "index.html",
    ...Object.values(manifest).map(entry => BASE + entry.file),
    ...Object.values(manifest).flatMap(entry => entry.css ? entry.css.map(c => BASE + c) : []),
  ];
}

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    const assets = IS_DEV ? DEV_ASSETS : await getProdAssets();
    for (const url of assets) {
      try { await cache.add(url); } catch (err) { console.warn("Pre-cache fail:", url); }
    }
  })());
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== STATIC_CACHE && k !== RUNTIME_CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// --- FETCH ---
self.addEventListener("fetch", event => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.mode === "navigate") {
    event.respondWith(handleNavigation(req));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(handleStatic(req));
    return;
  }

  if (isTile(url)) {
    event.respondWith(handleTile(req));
    return;
  }

  event.respondWith(fetch(req));
});

// --- TRIMMING (Non-recursive, faster) ---
async function trimCache(name, maxItems) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    // Delete oldest 50 items at once to reduce overhead
    const toDelete = keys.slice(0, 50); 
    for (const key of toDelete) await cache.delete(key);
  }
}

// --- MESSAGE (App-Triggered Download) ---
self.addEventListener("message", async event => {
  if (event.data?.type !== "CACHE_TILES") return;
  const { tiles } = event.data;
  const cache = await caches.open(RUNTIME_CACHE);

  for (let i = 0; i < tiles.length; i++) {
    let url = tiles[i];
    if (url.startsWith("/")) url = "https://api.maptiler.com" + url;
    const cleanUrl = url.split('?')[0];

    try {
      if (await cache.match(cleanUrl)) continue;

      // Use CORS mode. This allows the browser to see the real file size.
      // If MapTiler throws a CORS error, change mode to 'no-cors'.
      const res = await fetch(url, { mode: 'cors' });

      if (res.ok && res.headers.get("content-type")?.includes("image")) {
        await cache.put(cleanUrl, res.clone());
      }

      // Progress
      const clients = await self.clients.matchAll();
      clients.forEach(c => c.postMessage({
        type: "TILE_CACHE_PROGRESS",
        index: i + 1, total: tiles.length,
        percent: Math.round(((i + 1) / tiles.length) * 100)
      }));
    } catch (err) {
      console.warn("Tile fetch failed:", url);
    }
  }
});

// --- HANDLERS ---
function handleNavigation(req) {
  return caches.match(`${BASE}index.html`).then(c => c || fetch(req));
}

function isStaticAsset(url) {
  return [".js", ".css", ".html", ".webmanifest"].some(ext => url.pathname.endsWith(ext));
}

function handleStatic(req) {
  return caches.match(req).then(cached => {
    if (cached) return cached;
    return fetch(req).then(res => {
      if (res.ok) {
        const clone = res.clone();
        caches.open(STATIC_CACHE).then(cache => cache.put(req, clone));
      }
      return res;
    });
  });
}

function isTile(url) {
  return url.hostname.includes("maptiler") && /\/\d+\/\d+\/\d+\.(png|jpg|webp)/.test(url.pathname);
}

function handleTile(req) {
  return caches.open(RUNTIME_CACHE).then(async cache => {
    const cleanUrl = req.url.split('?')[0];
    const cached = await cache.match(cleanUrl);
    if (cached) return cached;

    try {
      const res = await fetch(req);
      // Only cache if it's a valid image. 
      // Avoids caching error pages or JSON metadata as "tiles"
      if (res.ok && res.headers.get("content-type")?.includes("image")) {
        cache.put(cleanUrl, res.clone());
        trimCache(RUNTIME_CACHE, 10000); // Keep runtime cache lean
      }
      return res;
    } catch {
      return cached || Response.error();
    }
  });
}