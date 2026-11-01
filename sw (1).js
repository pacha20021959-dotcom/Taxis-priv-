/* Taxi Gestion Pro : fonctionnement hors connexion.
   Les pages sont lues sur internet quand il y en a (donc toujours à jour), sinon depuis la copie enregistrée. */
var VERSION = 'tgp-v2-1';
var TILES = 'tgp-tuiles';
var SHELL = ['./appli.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) {
    return Promise.all(SHELL.map(function (u) { return c.add(u).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION && k !== TILES; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function trim(name, max) {
  return caches.open(name).then(function (c) {
    return c.keys().then(function (ks) { if (ks.length > max) return c.delete(ks[0]).then(function () { return trim(name, max); }); });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (/tile\.openstreetmap\.org$/.test(url.hostname)) {
    e.respondWith(caches.open(TILES).then(function (c) {
      return c.match(req).then(function (hit) {
        return hit || fetch(req).then(function (res) { if (res && res.status === 200) { c.put(req, res.clone()); trim(TILES, 400); } return res; });
      });
    }).catch(function () { return Response.error(); }));
    return;
  }
  if (url.origin !== self.location.origin) return; /* recherche d'adresses et itinéraires : toujours en ligne */
  e.respondWith(fetch(req).then(function (res) {
    if (res && res.status === 200) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); }
    return res;
  }).catch(function () {
    return caches.match(req, { ignoreSearch: true }).then(function (hit) {
      return hit || (req.mode === 'navigate' ? caches.match('./appli.html') : Response.error());
    });
  }));
});
