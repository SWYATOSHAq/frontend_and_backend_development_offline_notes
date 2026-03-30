// ── Практика 13 + 14: Service Worker с кэшированием ──────────
const CACHE_NAME = 'notes-cache-v2';

const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/icons/icon-16x16.png',
  '/icons/icon-32x32.png',
  '/icons/icon-48x48.png',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-192x192.png',
  '/icons/icon-256x256.png',
  '/icons/icon-512x512.png',
];

// ── Установка: кэшируем все статические ресурсы ───────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Установка...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Активация: удаляем устаревшие кэши ───────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Активация...');
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log('[SW] Удаляем старый кэш:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: сначала кэш, потом сеть (Cache First) ─────────────
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(event.request).then((response) => {
        // Кэшируем только успешные GET-запросы
        if (
          response.ok &&
          event.request.method === 'GET' &&
          !event.request.url.startsWith('chrome-extension')
        ) {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) =>
            cache.put(event.request, cloned)
          );
        }
        return response;
      }).catch(() => {
        // Офлайн-фолбэк для навигационных запросов
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
