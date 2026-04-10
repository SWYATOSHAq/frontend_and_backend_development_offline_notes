const express    = require('express');
const http       = require('http');
const socketIo   = require('socket.io');
const webpush    = require('web-push');
const bodyParser = require('body-parser');
const cors       = require('cors');
const path       = require('path');

// 📌 Хранилище напоминаний
const reminders = new Map();

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

app.use(express.static(path.join(__dirname, '../')));

// ── Подписки ─────────────────────────────────────────────────
let subscriptions = [];

const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// ── WebSocket ─────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('[WS] Клиент подключён:', socket.id);

  // 📌 ОБЫЧНЫЕ ЗАДАЧИ
  socket.on('newTask', (task) => {
    console.log('[WS] Новая задача:', task.text);

    io.emit('taskAdded', task);

    const payload = JSON.stringify({
      title: 'Новая задача',
      body: task.text
    });

    subscriptions.forEach((sub) => {
      webpush.sendNotification(sub, payload)
        .catch((err) => {
          console.error('[Push] Ошибка:', err.statusCode);

          if (err.statusCode === 410) {
            subscriptions = subscriptions.filter(
              (s) => s.endpoint !== sub.endpoint
            );
          }
        });
    });
  });

  // 📌 НАПОМИНАНИЯ
  socket.on('newReminder', (reminder) => {
    const { id, text, reminderTime } = reminder;

    console.log('[WS] Новое напоминание:', text);

    const delay = Number(reminderTime) - Date.now();

    if (!delay || delay <= 0) {
      console.log('[WS] Ошибка времени напоминания');
      return;
    }

    console.log('[WS] Таймер установлен на', delay, 'мс');

    const timeoutId = setTimeout(() => {
      const payload = JSON.stringify({
        title: '!!! Напоминание',
        body: text,
        reminderId: id
      });

      subscriptions.forEach((sub) => {
        webpush.sendNotification(sub, payload)
          .catch((err) => {
            console.error('[Push] Ошибка:', err.statusCode);

            if (err.statusCode === 410) {
              subscriptions = subscriptions.filter(
                (s) => s.endpoint !== sub.endpoint
              );
            }
          });
      });

      reminders.delete(id);
    }, delay);

    reminders.set(id, { timeoutId, text, reminderTime });
  });

  socket.on('disconnect', () => {
    console.log('[WS] Клиент отключён:', socket.id);
  });
});

// ── Подписки ─────────────────────────────────────────────────
app.post('/subscribe', (req, res) => {
  const sub = req.body;

  const exists = subscriptions.some((s) => s.endpoint === sub.endpoint);
  if (!exists) subscriptions.push(sub);

  res.status(201).json({ message: 'Подписка сохранена' });
});

app.post('/unsubscribe', (req, res) => {
  const { endpoint } = req.body;

  subscriptions = subscriptions.filter(
    (s) => s.endpoint !== endpoint
  );

  res.status(200).json({ message: 'Подписка удалена' });
});

// ── SNOOZE ───────────────────────────────────────────────────
app.post('/snooze', (req, res) => {
  const reminderId = parseInt(req.query.reminderId, 10);
  const minutes = parseInt(req.query.minutes, 10) || 5;

  console.log(`[SNOOZE] id=${reminderId}, minutes=${minutes}`);

  if (!reminderId || !reminders.has(reminderId)) {
    return res.status(404).json({ error: 'Not found' });
  }

  const reminder = reminders.get(reminderId);

  clearTimeout(reminder.timeoutId);

  const newDelay = minutes * 60 * 1000;

  const timeoutId = setTimeout(() => {
    const payload = JSON.stringify({
      title: 'Отложенное напоминание',
      body: reminder.text,
      reminderId
    });

    subscriptions.forEach(sub => {
      webpush.sendNotification(sub, payload)
        .catch(err => {
          console.error('[Push]', err.statusCode);

          if (err.statusCode === 410) {
            subscriptions = subscriptions.filter(
              s => s.endpoint !== sub.endpoint
            );
          }
        });
    });

    reminders.delete(reminderId);
  }, newDelay);

  reminders.set(reminderId, {
    timeoutId,
    text: reminder.text,
    reminderTime: Date.now() + newDelay
  });

  res.json({ message: `Snoozed for ${minutes} minutes` });
});
// ── Запуск ────────────────────────────────────────────────────
const PORT = 3001;

server.listen(PORT, () => {
  console.log(`Сервер запущен: http://localhost:${PORT}`);
});