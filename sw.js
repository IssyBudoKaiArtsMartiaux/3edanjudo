/* Carnet Sandan : fonctionnement sans réseau.
   Les fichiers de l'appli sont gardés en cache à l'installation,
   puis servis depuis le cache et rafraîchis en arrière-plan quand le réseau est là. */
const VERSION = "sandan-2026-11-13-1";
const APP_CACHE = "app-" + VERSION;
const FONT_CACHE = "fonts-v1";
const CORE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./apple-touch-icon.png",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("app-") && k !== APP_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Polices Google : cache d'abord, réseau sinon.
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(
      caches.open(FONT_CACHE).then((c) =>
        c.match(req).then((hit) => hit || fetch(req).then((res) => {
          if (res.ok || res.type === "opaque") c.put(req, res.clone());
          return res;
        }).catch(() => new Response("", { status: 504 })))
      )
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Fichiers de l'appli : réponse immédiate depuis le cache, mise à jour en arrière-plan.
  const isPage = req.mode === "navigate";
  event.respondWith(
    caches.open(APP_CACHE).then(async (c) => {
      const hit = await c.match(isPage ? "./index.html" : req, { ignoreSearch: true });
      const update = fetch(req).then((res) => {
        if (res.ok) c.put(isPage ? "./index.html" : req, res.clone());
        return res;
      }).catch(() => null);
      if (hit) { event.waitUntil(update); return hit; }
      const res = await update;
      return res || new Response("Hors ligne : ouvrez l'appli une première fois avec du réseau.", {
        status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    })
  );
});
