# Offline Notes — PWA-приложение для заметок

Простое прогрессивное веб-приложение (PWA) для управления заметками, которое работает **полностью офлайн**.

## Возможности

- Добавление и удаление заметок
- Хранение данных в `localStorage` — заметки сохраняются между сессиями
- Полная работа без интернета благодаря Service Worker (App Shell + Network First)
- Установка на устройство как нативное приложение (PWA)
- Поддержка Android, iOS и десктопа
- Индикатор статуса соединения (онлайн / офлайн) в реальном времени
- Синхронизация между вкладками через WebSocket (Socket.IO)
- Push-уведомления при добавлении новых задач

## Технологии

| Технология | Назначение |
|---|---|
| Vanilla JS | Логика приложения |
| Service Worker | Офлайн-кэширование (App Shell + Network First) |
| Web App Manifest | Установка как PWA |
| localStorage | Персистентное хранение заметок |
| CSS Custom Properties | Стилизация |
| Socket.IO | WebSocket — синхронизация в реальном времени |
| Web Push API | Push-уведомления |
| Node.js / Express | Backend-сервер |

## Структура проекта

```
frontend/
└── notes-app/
    ├── content/
    │   ├── home.html       # Динамический контент: форма + список заметок
    │   └── about.html      # Страница «О приложении»
    ├── icons/              # Иконки всех размеров (16–512px)
    ├── server/
    │   ├── server.js       # Node.js сервер (Express + Socket.IO + Web Push)
    │   └── package.json
    ├── index.html          # App Shell: шапка + навигация + пустой контейнер
    ├── app.js              # Навигация, заметки, Socket.IO, Push
    ├── style.css           # Стили
    ├── sw.js               # Service Worker (Cache First + Network First + Push)
    └── manifest.json       # Web App Manifest
```

## Запуск

### Только фронтенд (без WebSocket/Push)

```bash
cd frontend/notes-app && python3 -m http.server 8080
```

Открыть: `http://localhost:8080`

### Полный запуск (с WebSocket и Push)

```bash
cd frontend/notes-app/server
node server.js
```

Открыть: `http://localhost:3001`

### HTTPS (для полноценного PWA с mkcert)

```bash
# Установка mkcert (macOS)
brew install mkcert

# Генерация сертификата в папке notes-app
cd frontend/notes-app
mkcert -install
mkcert localhost 127.0.0.1 ::1

# Запуск HTTPS-сервера
http-server --ssl --cert localhost.pem --key localhost-key.pem -p 3000
```

Открыть: `https://localhost:3000`

---

## История изменений по практикам

### Практика 13 — Service Worker и офлайн-кэширование
- Создано базовое PWA-приложение для заметок
- Реализован Service Worker с кэшированием (Cache First)
- Заметки хранятся в `localStorage`

### Практика 14 — Web App Manifest и установка PWA
- Добавлен `manifest.json` с описанием приложения и иконками
- Поддержка установки на Android, iOS, десктоп
- Индикатор онлайн/офлайн статуса

### Практика 15 — HTTPS + App Shell
- Реализована архитектура **App Shell**: `index.html` стал каркасом, динамический контент вынесен в `content/home.html` и `content/about.html`
- Добавлена навигация между страницами «Главная» и «О приложении» без перезагрузки
- Обновлён Service Worker: статика кэшируется по **Cache First**, страницы `/content/*` — по **Network First** (с фолбеком в офлайне)
- Добавлена страница «О приложении» с описанием возможностей и технологий

### Практика 16 — WebSocket + Push
- Создан Node.js сервер (`server/server.js`) с Express, Socket.IO и Web Push
- Интегрирован **Socket.IO** на клиенте: при добавлении заметки отправляется событие `newTask`, остальные вкладки получают тост-уведомление через `taskAdded`
- Реализованы **Push-уведомления**: подписка через PushManager с VAPID-ключами, кнопки включения/отключения уведомлений в футере
- Обновлён Service Worker: добавлен обработчик события `push` для показа системных уведомлений
