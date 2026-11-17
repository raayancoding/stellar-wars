/* ============================================================
   SERVICE WORKER — offline support / runtime asset cache
   ============================================================ */

const VERSION = "stellarwars-v9";
const CORE = [
  "./",
  "./index.html",
  "./styles/main.css",
  "./src/main.js",
  "./src/config.js",
  "./src/core/assets.js",
  "./src/core/ships.js",
  "./src/core/save.js",
  "./src/core/audio.js",
  "./src/core/upgrades.js",
  "./src/core/fx.js",
  "./src/core/graphics.js",
  "./src/core/cheats.js",
  "./src/game/level.js",
  "./src/game/entities.js",
  "./src/game/boss.js",
  "./src/game/hud.js",
  "./src/scenes/hangar.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(CORE).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: network first, fall back to the cached shell when offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put("./index.html", copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match("./index.html").then((res) => res || caches.match("./")))
    );
    return;
  }

  // Media assets are big and immutable: cache first.
  const immutable = /\.(glb|gltf|png|jpg|jpeg|webp|woff2?|mp3|ogg|wav)$/i.test(url.pathname);
  if (immutable) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }))
    );
    return;
  }

  // Scripts, styles and data: network first so updates land immediately,
  // with the cached copy as the offline fallback.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || Response.error()))
  );
});
