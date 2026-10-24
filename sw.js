/*
 * sw.js — offline support for MetroMitra.
 * Caches the app shell so planning works underground with no signal.
 * Bump VERSION whenever any cached file changes.
 */
'use strict';
const VERSION = 'metromitra-v14';
const FILES = [
  './', 'index.html', 'css/style.css', 'js/data.js', 'js/i18n.js', 'js/population.js', 'js/planner.js', 'js/savings.js', 'js/reports.js', 'js/gapmap.js', 'js/vendor/qrcode.js', 'js/share.js', 'js/app.js', 'js/savings-card.js', 'js/guide.js', 'js/gap-ui.js',
  'story.html', 'css/story.css', 'js/story-data.js', 'js/story-worker.js', 'js/story.js',
  'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Network first so updates show up straight away; fall back to the cache offline.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
  );
});
