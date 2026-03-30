// ── DOM-элементы ──────────────────────────────────────────────
const form       = document.getElementById('note-form');
const input      = document.getElementById('note-input');
const list       = document.getElementById('notes-list');
const emptyMsg   = document.getElementById('empty-msg');
const countEl    = document.getElementById('notes-count');
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

// ── localStorage ──────────────────────────────────────────────
function getNotes() {
  return JSON.parse(localStorage.getItem('notes') || '[]');
}

function saveNotes(notes) {
  localStorage.setItem('notes', JSON.stringify(notes));
}

// ── Рендер списка ─────────────────────────────────────────────
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

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Добавление заметки ────────────────────────────────────────
function addNote(text) {
  const notes = getNotes();
  notes.push(text);
  saveNotes(notes);
  renderNotes();
}

// ── Удаление заметки ──────────────────────────────────────────
function deleteNote(index) {
  const notes = getNotes();
  notes.splice(index, 1);
  saveNotes(notes);
  renderNotes();
}

// ── Обработчики событий ───────────────────────────────────────
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

// ── Инициализация ─────────────────────────────────────────────
renderNotes();

// ── Регистрация Service Worker (Практика 13) ──────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('[SW] Зарегистрирован, scope:', registration.scope);
    } catch (err) {
      console.error('[SW] Ошибка регистрации:', err);
    }
  });
}
