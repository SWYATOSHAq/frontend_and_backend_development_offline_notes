// ── DOM-элементы (App Shell) ───────────────────────────────────
const contentDiv  = document.getElementById('app-content');
const homeBtn     = document.getElementById('home-btn');
const aboutBtn    = document.getElementById('about-btn');
const statusBadge = document.getElementById('online-status');

// ── Состояние сети ────────────────────────────────────────────
function updateOnlineStatus() {
  if (navigator.onLine) {
    statusBadge.textContent = 'Онлайн';
    statusBadge.className = 'status-badge online';
  } else {
    statusBadge.textContent = 'Офлайн';
    statusBadge.className = 'status-badge offline';
  }
}

window.addEventListener('online',  updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

// ── Socket.IO (Практика 16) ────────────────────────────────────
let socket = null;
try {
  // io доступен только если Socket.IO скрипт загрузился
  if (typeof io !== 'undefined') {
    socket = io('http://localhost:3001');

    socket.on('taskAdded', (task) => {
      console.log('[Socket] Задача от другого клиента:', task);
      showToast(`Новая задача: ${task.text}`);
    });
  }
} catch (e) {
  console.warn('[Socket] Сервер недоступен:', e.message);
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ── Навигация ─────────────────────────────────────────────────
function setActiveButton(activeId) {
  [homeBtn, aboutBtn].forEach(btn => btn.classList.remove('active'));
  document.getElementById(activeId).classList.add('active');
}

async function loadContent(page) {
  try {
    const response = await fetch(`/content/${page}.html`);
    const html = await response.text();
    contentDiv.innerHTML = html;
    if (page === 'home') {
      initNotes();
    }
  } catch (err) {
    contentDiv.innerHTML = '<p class="empty-msg">Ошибка загрузки страницы.</p>';
    console.error(err);
  }
}

homeBtn.addEventListener('click', () => {
  setActiveButton('home-btn');
  loadContent('home');
});

aboutBtn.addEventListener('click', () => {
  setActiveButton('about-btn');
  loadContent('about');
});

// Загружаем главную страницу при старте
loadContent('home');

// ── Функционал заметок (инициализируется после загрузки home.html) ──
function initNotes() {
  const form     = document.getElementById('note-form');
  const input    = document.getElementById('note-input');
  const list     = document.getElementById('notes-list');
  const emptyMsg = document.getElementById('empty-msg');
  const countEl  = document.getElementById('notes-count');

  function getNotes() {
    return JSON.parse(localStorage.getItem('notes') || '[]');
  }

  function saveNotes(notes) {
    localStorage.setItem('notes', JSON.stringify(notes));
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderNotes() {
    const notes = getNotes();
    list.innerHTML = '';
    if (notes.length === 0) {
      emptyMsg.style.display = 'block';
      countEl.textContent = '';
      return;
    }
    emptyMsg.style.display = 'none';
    countEl.textContent = `Всего заметок: ${notes.length}`;
    notes.forEach((note, index) => {
      const li = document.createElement('li');
      li.className = 'note-item';
      li.innerHTML = `
        <span class="note-text">${escapeHtml(note)}</span>
        <button class="note-delete" data-index="${index}" title="Удалить">✕</button>
      `;
      list.appendChild(li);
    });
  }

  function addNote(text) {
    const notes = getNotes();
    notes.push(text);
    saveNotes(notes);
    renderNotes();
    // Отправляем событие через WebSocket (Практика 16)
    if (socket) {
      socket.emit('newTask', { text, timestamp: Date.now() });
    }
  }

  function deleteNote(index) {
    const notes = getNotes();
    notes.splice(index, 1);
    saveNotes(notes);
    renderNotes();
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (text) {
      addNote(text);
      input.value = '';
      input.focus();
    }
  });

  list.addEventListener('click', (e) => {
    const btn = e.target.closest('.note-delete');
    if (btn) {
      deleteNote(Number(btn.dataset.index));
    }
  });

  renderNotes();
}

// ── Push-уведомления (Практика 16) ────────────────────────────
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array('BJrHPMZ9LoKwM2olAS_YEeyHkBf0smsr1z9K7o987g03Ws5L_lApent8rc0rs5zI1vIdScnCyBuOqdiCO2vj9Ks')
    });
    await fetch('http://localhost:3001/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription)
    });
    console.log('[Push] Подписка оформлена');
  } catch (err) {
    console.error('[Push] Ошибка подписки:', err);
  }
}

async function unsubscribeFromPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    await fetch('http://localhost:3001/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint })
    });
    await subscription.unsubscribe();
    console.log('[Push] Отписка выполнена');
  }
}

// ── Регистрация Service Worker + кнопки push ──────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      console.log('[SW] Зарегистрирован, scope:', reg.scope);

      const enableBtn  = document.getElementById('enable-push');
      const disableBtn = document.getElementById('disable-push');

      if (enableBtn && disableBtn) {
        const subscription = await reg.pushManager.getSubscription();
        if (subscription) {
          enableBtn.style.display  = 'none';
          disableBtn.style.display = 'inline-block';
        }

        enableBtn.addEventListener('click', async () => {
          if (Notification.permission === 'denied') {
            alert('Уведомления запрещены. Разрешите их в настройках браузера.');
            return;
          }
          if (Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
              alert('Необходимо разрешить уведомления.');
              return;
            }
          }
          await subscribeToPush();
          enableBtn.style.display  = 'none';
          disableBtn.style.display = 'inline-block';
        });

        disableBtn.addEventListener('click', async () => {
          await unsubscribeFromPush();
          disableBtn.style.display = 'none';
          enableBtn.style.display  = 'inline-block';
        });
      }
    } catch (err) {
      console.error('[SW] Ошибка регистрации:', err);
    }
  });
}
