// ── Практика 15: App Shell + Network First ──
const CACHE_NAME         = 'notes-cache-v3';
const DYNAMIC_CACHE_NAME = 'dynamic-content-v1';

const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/content/home.html', // 🔥 ВАЖНО
  '/content/about.html', // 🔥 ВАЖНО
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// ── INSTALL ─────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ───────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== DYNAMIC_CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH ──────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.origin !== location.origin) return;

  // 🔥 Network First для контента
  if (url.pathname.startsWith('/content/')) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(DYNAMIC_CACHE_NAME).then(cache => {
            cache.put(event.request, clone);
          });
          return res;
        })
        .catch(() =>
          caches.match(event.request)
            .then(res => res || caches.match('/content/home.html'))
        )
    );
    return;
  }

  // 🔥 Cache First
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request);
    })
  );
});

// ── PUSH ───────────────────────────────────
self.addEventListener('push', (event) => {
  let data = { title: 'Новое уведомление', body: '', reminderId: null };

  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch {
    data.body = event.data.text();
  }

  const options = {
    body: data.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    data: { reminderId: data.reminderId }
  };

  if (data.reminderId) {
  options.actions = [
    { action: 'snooze5', title: '⏰ +5 мин' },
    { action: 'snooze1', title: '⚡ +1 мин' }
  ];
}

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ── CLICK ──────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  const action = event.action;
  const notification = event.notification;

  notification.close();

  if (action === 'snooze1' || action === 'snooze5') {
  const reminderId = notification.data.reminderId;

  const minutes = action === 'snooze1' ? 1 : 5;

  event.waitUntil(
    fetch(`http://localhost:3001/snooze?reminderId=${reminderId}&minutes=${minutes}`, {
      method: 'POST'
    }).catch(err => console.error(err))
  );
} else {
    // 🔥 открывает приложение
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});