/* ============================================================
   sw.js — caches the app shell so the studio keeps working
   offline once it's been opened once. Images the user loads are
   never touched by the service worker (they never leave the
   page's memory / IndexedDB in the first place).
   ============================================================ */
'use strict';

const CACHE = 'hws-shell-v1';
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './css/tokens.css',
  './css/base.css',
  './css/components.css',
  './css/editor.css',
  './css/responsive.css',
  './js/utils.js',
  './js/storage.js',
  './js/history.js',
  './js/exif-reader.js',
  './js/canvas-editor.js',
  './js/watermark-text.js',
  './js/watermark-logo.js',
  './js/watermark-signature.js',
  './js/watermark-qr.js',
  './js/watermark-exif.js',
  './js/watermark-repeat.js',
  './js/adjustments.js',
  './js/layers-panel.js',
  './js/export.js',
  './js/batch.js',
  './js/settings.js',
  './js/app.js',
  './assets/icons/icon-192.svg',
  './assets/icons/icon-512.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Cache-first for the app shell; network passthrough for CDN libraries so
// they can update, falling back to cache if the device is offline.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isShellRequest = url.origin === self.location.origin;

  if (isShellRequest) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
  } else {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, clone)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(event.request))
    );
  }
});
