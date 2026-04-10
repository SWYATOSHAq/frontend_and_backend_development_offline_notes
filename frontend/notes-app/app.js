// ── DOM ─────────────────────────────────────
const contentDiv  = document.getElementById('app-content');
const homeBtn     = document.getElementById('home-btn');
const aboutBtn    = document.getElementById('about-btn');
const statusBadge = document.getElementById('online-status');

// ── ONLINE ──────────────────────────────────
function updateOnlineStatus() {
  statusBadge.textContent = navigator.onLine ? 'Онлайн' : 'Офлайн';
  statusBadge.className = navigator.onLine
    ? 'status-badge online'
    : 'status-badge offline';
}

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

// ── SOCKET ─────────────────────────────────
let socket = null;

if (typeof io !== 'undefined') {
  socket = io('http://localhost:3001');

  socket.on('taskAdded', (task) => {
    showToast(`Новая задача: ${task.text}`);
  });
}

function showToast(message) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ── NAVIGATION ─────────────────────────────
function setActiveButton(id) {
  [homeBtn, aboutBtn].forEach(btn => btn.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

async function loadContent(page) {
  const res = await fetch(`/content/${page}.html`);
  contentDiv.innerHTML = await res.text();

  if (page === 'home') initNotes();
}

homeBtn.onclick  = () => { setActiveButton('home-btn'); loadContent('home'); };
aboutBtn.onclick = () => { setActiveButton('about-btn'); loadContent('about'); };

loadContent('home');

// ── NOTES ──────────────────────────────────
function initNotes() {
  const form  = document.getElementById('note-form');
  const input = document.getElementById('note-input');
  const list  = document.getElementById('notes-list');

  const rForm = document.getElementById('reminder-form');
  const rText = document.getElementById('reminder-text');
  const rTime = document.getElementById('reminder-time');

  if (!form || !input || !list) return; // 🔥 защита от null

  function getNotes() {
    const raw = JSON.parse(localStorage.getItem('notes') || '[]');
    return raw.map(n => typeof n === 'string' ? { text: n } : n);
  }

  function saveNotes(notes) {
    localStorage.setItem('notes', JSON.stringify(notes));
  }

  function loadNotes() {
    const notes = getNotes();

    list.innerHTML = notes.map((n, i) => {
      let rem = '';

      if (n.reminder) {
        rem = `<br><small>⏰ ${new Date(n.reminder).toLocaleString()}</small>`;
      }

      return `
        <li>
          ${n.text}
          ${rem}
          <button data-i="${i}">✕</button>
        </li>
      `;
    }).join('');
  }

  function addNote(text, reminder = null) {
    const notes = getNotes();

    const note = {
      id: Date.now(),
      text,
      reminder
    };

    notes.push(note);
    saveNotes(notes);
    loadNotes();

    if (socket) {
      if (reminder) {
        socket.emit('newReminder', {
          id: note.id,
          text,
          reminderTime: reminder
        });
      } else {
        socket.emit('newTask', { text });
      }
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const text = input.value.trim();

    if (text) {
      addNote(text);
      input.value = '';
    }
  });

  if (rForm) {
    rForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const text = rText.value.trim();
      const time = new Date(rTime.value).getTime();

      if (text && time > Date.now()) {
        addNote(text, time);
        rText.value = '';
        rTime.value = '';
      }
    });
  }

  list.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') {
      const i = e.target.dataset.i;
      const notes = getNotes();
      notes.splice(i, 1);
      saveNotes(notes);
      loadNotes();
    }
  });

  loadNotes();
}

// ── PUSH ───────────────────────────────────
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

async function subscribeToPush() {
  try {
    const reg = await navigator.serviceWorker.ready;

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array('BJrHPMZ9LoKwM2olAS_YEeyHkBf0smsr1z9K7o987g03Ws5L_lApent8rc0rs5zI1vIdScnCyBuOqdiCO2vj9Ks')
    });

    await fetch('http://localhost:3001/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub)
    });

    console.log('[Push] OK');
  } catch (err) {
    console.error('[Push ERROR]', err);
  }
}

// кнопка
const btn = document.getElementById('enable-push');

if (btn) {
  btn.addEventListener('click', async () => {
    console.log('[Push] CLICK');

    const perm = await Notification.requestPermission();
    console.log('[Push] permission:', perm);

    if (perm === 'granted') {
      await subscribeToPush();
      console.log('[Push] subscribed');
      alert('Уведомления включены');
    }
  });
}
// SW
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      console.log('[SW] зарегистрирован:', reg.scope);
    } catch (e) {
      console.error('[SW] ошибка:', e);
    }
  });
}