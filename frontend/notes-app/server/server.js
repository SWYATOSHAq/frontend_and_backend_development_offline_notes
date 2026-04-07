const express    = require('express');
const http       = require('http');
const socketIo   = require('socket.io');
const webpush    = require('web-push');
const bodyParser = require('body-parser');
const cors       = require('cors');
const path       = require('path');

// ── VAPID-ключи ───────────────────────────────────────────────
const vapidKeys = {
  publicKey:  'BJrHPMZ9LoKwM2olAS_YEeyHkBf0smsr1z9K7o987g03Ws5L_lApent8rc0rs5zI1vIdScnCyBuOqdiCO2vj9Ks',
  privateKey: '23R74fU9k5mYyOeghE7Gqv5H2GeSm9QTI26o1R_Gj7I'
};

webpush.setVapidDetails(
  'mailto:example@example.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// ── Express + Socket.IO ───────────────────────────────────────
const app = express();
app.use(cors());
app.use(bodyParser.json());

// Раздаём статику из папки notes-app (родительская для server/)
app.use(express.static(path.join(__dirname, '../')));

// ── Хранилище подписок (в памяти) ─────────────────────────────
let subscriptions = [];

const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// ── WebSocket ─────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('[WS] Клиент подключён:', socket.id);

  socket.on('newTask', (task) => {
    console.log('[WS] Новая задача:', task.text);

    // Рассылаем событие всем подключённым клиентам
    io.emit('taskAdded', task);

    // Push-уведомление всем подписчикам
    const payload = JSON.stringify({
      title: 'Новая задача',
      body: task.text
    });

    subscriptions.forEach((sub) => {
      webpush.sendNotification(sub, payload)
        .catch((err) => {
          console.error('[Push] Ошибка отправки:', err.statusCode);
          // Удаляем протухшие подписки
          if (err.statusCode === 410) {
            subscriptions = subscriptions.filter((s) => s.endpoint !== sub.endpoint);
          }
        });
    });
  });

  socket.on('disconnect', () => {
    console.log('[WS] Клиент отключён:', socket.id);
  });
});

// ── Эндпоинты для push-подписок ───────────────────────────────
app.post('/subscribe', (req, res) => {
  const sub = req.body;
  const exists = subscriptions.some((s) => s.endpoint === sub.endpoint);
  if (!exists) subscriptions.push(sub);
  res.status(201).json({ message: 'Подписка сохранена' });
});

app.post('/unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  subscriptions = subscriptions.filter((s) => s.endpoint !== endpoint);
  res.status(200).json({ message: 'Подписка удалена' });
});

// ── Запуск ────────────────────────────────────────────────────
const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Сервер запущен: http://localhost:${PORT}`);
});
