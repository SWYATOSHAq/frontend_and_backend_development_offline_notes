// ── Практика 15: App Shell + Network First для динамического контента ──
const CACHE_NAME         = 'notes-cache-v3';
const DYNAMIC_CACHE_NAME = 'dynamic-content-v1';

// Статические ресурсы App Shell — кэшируются при установке
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

// ── Установка: кэшируем App Shell ─────────────────────────────
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
          .filter((key) => key !== CACHE_NAME && key !== DYNAMIC_CACHE_NAME)
          .map((key) => {
            console.log('[SW] Удаляем старый кэш:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Пропускаем запросы к другим источникам (CDN, Socket.IO и т.д.)
  if (url.origin !== location.origin) return;

  // Динамические страницы (/content/*) — Network First
  if (url.pathname.startsWith('/content/')) {
    event.respondWith(
      fetch(event.request)
        .then((networkRes) => {
          const resClone = networkRes.clone();
          caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
            cache.put(event.request, resClone);
          });
          return networkRes;
        })
        .catch(() =>
          caches.match(event.request)
            .then((cached) => cached || caches.match('/content/home.html'))
        )
    );
    return;
  }

  // Статика (App Shell) — Cache First
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
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
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// ── Push-уведомления (Практика 16) ────────────────────────────
self.addEventListener('push', (event) => {
  let data = { title: 'Новое уведомление', body: '' };
  if (event.data) {
    data = event.data.json();
  }
  const options = {
    body: data.body,
    icon: '/icons/icon-128x128.png',
    badge: '/icons/icon-48x48.png',
  };
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});
