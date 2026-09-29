/* =========================================================================
   dashboard.js — dashboard screen logic
   -------------------------------------------------------------------------
   Initial state comes from the server via the "dashboard-data" json_script
   block dashboard.html renders. Every mutation (check-in, add/edit/delete
   habit, account update, period switch, chat) goes through the /api/
   endpoints in habits/views.py using the apiFetch() helper from main.js.
   ========================================================================= */

let dashboardData = null;
let habitsState = [];
let currentGrid = null;
let currentPeriod = 'week';
let editingHabitId = null;
let selectedHabitIcon = '⭐';

document.addEventListener('DOMContentLoaded', () => {
  dashboardData = JSON.parse(document.getElementById('dashboard-data').textContent);
  habitsState = dashboardData.habits || [];
  currentGrid = dashboardData.grid || { period: 'week', label: 'This Week', cells: [] };
  currentPeriod = currentGrid.period || 'week';

  renderUserBits(dashboardData.user);
  renderPeriodDropdown();
  renderDayGrid();
  renderHabits();
  initSidebar();
  initPeriodDropdown();
  initHabitModal();
  initSettingsModal();
  initAccountSection();
  initThemeControls();

  document.addEventListener('themechange', () => {
    renderDayGrid(); // colors depend on CSS vars only, but re-render keeps legend in sync
  });
});

/* ---------------------------------------------------------------------
   User-facing text (name shown everywhere — never a hardcoded "Name")
   ------------------------------------------------------------------- */
function renderUserBits(user) {
  document.querySelectorAll('.js-user-name').forEach(el => el.textContent = user.name);
  document.querySelectorAll('.js-user-initial').forEach(el => el.textContent = (user.initial || '?').toUpperCase());
  // Every element carrying .js-user-avatar (sidebar) plus the Settings preview
  // is rendered with the same logic: uploaded photo > chosen icon > initial.
  document.querySelectorAll('.js-user-avatar').forEach(el => renderAvatar(el, user));
  const removeBtn = document.getElementById('accountPhotoRemoveBtn');
  if (removeBtn) removeBtn.style.display = user.photo_url ? 'inline-flex' : 'none';
}

/* Fills an avatar element with the user's photo/icon (photo_url), or falls
   back to their initial when there isn't one. Works for any avatar element. */
function renderAvatar(avatarEl, user) {
  if (!avatarEl) return;
  if (user.photo_url) {
    let img = avatarEl.querySelector('img');
    if (!img) {
      avatarEl.innerHTML = '';
      img = document.createElement('img');
      img.alt = 'Profile photo';
      avatarEl.appendChild(img);
    }
    img.src = user.photo_url;
  } else {
    avatarEl.innerHTML = '';
    const span = document.createElement('span');
    span.className = 'js-user-initial';
    span.textContent = (user.initial || '?').toUpperCase();
    avatarEl.appendChild(span);
  }
}

/* ---------------------------------------------------------------------
   Sidebar
   ------------------------------------------------------------------- */
function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('sidebarToggle');
  toggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
  });

  const historyToggle = document.getElementById('historyToggle');
  const historyList = document.getElementById('historyList');
  historyToggle.addEventListener('click', () => {
    historyList.classList.toggle('open');
    historyToggle.classList.toggle('open');
  });
  refreshHistoryList();

  // Account fields now live inside the Settings modal, so "View Account"
  // opens Settings and scrolls straight to the Account section.
  document.getElementById('viewAccountBtn').addEventListener('click', () => {
    document.getElementById('settingsModal').classList.add('open');
    syncThemeSwitches();
    document.querySelector('.account-section')?.scrollIntoView({ block: 'start' });
  });
}

async function refreshHistoryList() {
  const historyList = document.getElementById('historyList');
  try {
    const data = await apiFetch('/api/chats/');
    historyList.innerHTML = '';
    (data.chats || []).forEach(chat => {
      const item = document.createElement('button');
      item.className = 'history-item';
      item.type = 'button';
      item.textContent = chat.title;
      item.addEventListener('click', () => openChatbot(chat.id));
      historyList.appendChild(item);
    });
  } catch (err) {
    console.error('Failed to load chat history', err);
  }
}

/* ---------------------------------------------------------------------
   Period dropdown (This Week / This Month / This Year)
   ------------------------------------------------------------------- */
function renderPeriodDropdown() {
  const label = document.getElementById('periodLabel');
  const map = { week: 'This Week', month: 'This Month', year: 'This Year' };
  label.textContent = map[currentPeriod];
}

function initPeriodDropdown() {
  const trigger = document.getElementById('periodTrigger');
  const menu = document.getElementById('periodMenu');

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('open');
    trigger.classList.toggle('open');
  });

  menu.querySelectorAll('[data-period]').forEach(btn => {
    btn.addEventListener('click', async () => {
      currentPeriod = btn.getAttribute('data-period');
      renderPeriodDropdown();
      menu.classList.remove('open');
      trigger.classList.remove('open');
      await loadGrid(currentPeriod);
    });
  });

  document.addEventListener('click', () => {
    menu.classList.remove('open');
    trigger.classList.remove('open');
  });
}

async function loadGrid(period) {
  try {
    currentGrid = await apiFetch(`/api/period-data/?period=${encodeURIComponent(period)}`);
    renderDayGrid();
  } catch (err) {
    console.error('Failed to load period data', err);
  }
}

/* ---------------------------------------------------------------------
   Day grid (week / month / year) — rendered from server-provided cells
   ------------------------------------------------------------------- */
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function renderDayGrid() {
  const grid = document.getElementById('dayGrid');
  const dayLabelsRow = document.getElementById('dayLabelsRow');
  grid.innerHTML = '';
  dayLabelsRow.innerHTML = '';
  grid.className = 'day-grid view-' + currentGrid.period;

  const todayIso = new Date().toISOString().slice(0, 10);

  if (currentGrid.period === 'year') {
    dayLabelsRow.style.display = 'none';
    const thisMonth = todayIso.slice(0, 7);
    currentGrid.cells.forEach(cell => {
      const wrap = document.createElement('div');
      wrap.className = 'month-square-wrap';
      const sq = makeSquare(cell.status);
      const label = document.createElement('span');
      label.className = 'month-square-label';
      label.textContent = cell.day_label;
      if (cell.date.slice(0, 7) === thisMonth) label.classList.add('active');
      wrap.appendChild(sq);
      wrap.appendChild(label);
      grid.appendChild(wrap);
    });
  } else {
    dayLabelsRow.style.display = 'grid';
    currentGrid.cells.forEach(cell => {
      grid.appendChild(makeSquare(cell.status));
    });

    const todayWeekday = new Date().getDay();
    DAY_LABELS.forEach((label, i) => {
      const el = document.createElement('span');
      el.className = 'day-label';
      if (i === todayWeekday) el.classList.add('active');
      el.textContent = label;
      dayLabelsRow.appendChild(el);
    });
  }
}

function makeSquare(status) {
  const el = document.createElement('div');
  el.className = 'day-square status-' + status;
  return el;
}

/* ---------------------------------------------------------------------
   Habit cards
   ------------------------------------------------------------------- */
function renderHabits() {
  const row = document.getElementById('habitsRow');
  row.innerHTML = '';
  habitsState.forEach(habit => row.appendChild(buildHabitCard(habit)));

  const addCard = document.createElement('button');
  addCard.className = 'habit-card add-habit-card';
  addCard.type = 'button';
  addCard.innerHTML = `<span class="add-icon">+</span><span>Make new Habit</span>`;
  addCard.addEventListener('click', () => openHabitModal(null));
  row.appendChild(addCard);
}

function buildHabitCard(habit) {
  const checked = !!habit.checked_in_today;

  const card = document.createElement('div');
  card.className = 'habit-card';
  card.innerHTML = `
    <button class="edit-btn" type="button" aria-label="Edit habit">✏️</button>
    <button class="checkin-toggle ${checked ? 'checked' : ''}" type="button" aria-label="Toggle check-in">
      ${checked ? '✓' : ''}
    </button>
    <div class="habit-icon">${habit.icon || '⭐'}</div>
    <div class="habit-name">${escapeHtml(habit.name)}</div>
    <div class="habit-streak">${habit.current_streak} day streak</div>
  `;

  card.querySelector('.edit-btn').addEventListener('click', () => openHabitModal(habit.id));

  card.querySelector('.checkin-toggle').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      const result = await apiFetch(`/api/habits/toggle/${habit.id}/`, { method: 'POST', body: '{}' });
      habit.checked_in_today = result.checked_in_today;
      habit.current_streak = result.current_streak;
      habit.longest_streak = result.longest_streak;
      renderHabits();
      await loadGrid(currentPeriod); // today's status may have changed
    } catch (err) {
      console.error('Failed to toggle check-in', err);
      btn.disabled = false;
    }
  });

  return card;
}

/* ---------------------------------------------------------------------
   Account section (inside the Settings modal) — name, email, gender,
   age, country, bio, and the profile photo (upload / take a photo /
   remove). Every save goes through /api/account/update/ using FormData
   so the optional photo file can ride along with the text fields.
   ------------------------------------------------------------------- */
function initAccountSection() {
  populateAccountFields(dashboardData.user);

  const photoInput = document.getElementById('accountPhotoInput');
  document.getElementById('accountPhotoBtn').addEventListener('click', () => photoInput.click());

  // "Pick an icon" toggles the icon row open/closed, same interaction
  // level as the "Change photo" button next to it.
  document.getElementById('accountIconPickerBtn').addEventListener('click', () => {
    const picker = document.getElementById('avatarIconPicker');
    picker.style.display = picker.style.display === 'none' ? 'flex' : 'none';
  });

  // Selecting a file here (from either "Take Photo" or "Photo Library" on
  // mobile — the plain file input with no "capture" attribute lets the OS
  // offer both) uploads it right away, independent of the Save button.
  photoInput.addEventListener('change', async () => {
    const file = photoInput.files[0];
    if (!file) return;
    await saveAccountFields(new FormData(), file);
    photoInput.value = '';
  });

  document.getElementById('accountPhotoRemoveBtn').addEventListener('click', async () => {
    const fd = new FormData();
    fd.append('remove_photo', '1');
    await saveAccountFields(fd);
  });

  document.querySelectorAll('.avatar-icon-option').forEach(btn => {
    btn.addEventListener('click', async () => {
      const fd = new FormData();
      fd.append('avatar_icon', btn.dataset.icon);
      await saveAccountFields(fd);
    });
  });

  document.getElementById('accountForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append('name', document.getElementById('accountName').value.trim());
    fd.append('gender', document.getElementById('accountGender').value);
    fd.append('age', document.getElementById('accountAge').value.trim());
    fd.append('country', document.getElementById('accountCountry').value.trim());
    fd.append('bio', document.getElementById('accountBio').value.trim());
    const ok = await saveAccountFields(fd);
    if (ok) {
      document.getElementById('settingsModal').classList.remove('open');
    }
  });
}

function populateAccountFields(user) {
  document.getElementById('accountName').value = user.name || '';
  document.getElementById('accountEmail').placeholder = user.email || '';
  document.getElementById('accountGender').value = user.gender || '';
  document.getElementById('accountAge').value = user.age != null ? user.age : '';
  document.getElementById('accountCountry').value = user.country || '';
  document.getElementById('accountBio').value = user.bio || '';
  document.querySelectorAll('.avatar-icon-option').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.icon === user.avatar_icon);
  });
}

async function saveAccountFields(formData, photoFile) {
  if (photoFile) formData.append('photo', photoFile);
  const errorEl = document.getElementById('accountError');
  errorEl.style.display = 'none';
  try {
    const result = await apiFetch('/api/account/update/', { method: 'POST', body: formData });
    dashboardData.user = result;
    populateAccountFields(result);
    renderUserBits(result);
    return true;
  } catch (err) {
    console.error('Failed to update account', err);
    let message = 'Could not save your changes. Please try again.';
    try {
      const parsed = JSON.parse(err.message.slice(err.message.indexOf('{')));
      if (parsed && parsed.error) message = parsed.error;
    } catch (parseErr) { /* fall back to the generic message */ }
    errorEl.textContent = message;
    errorEl.style.display = 'block';
    return false;
  }
}

/* ---------------------------------------------------------------------
   Add / Edit habit modal
   ------------------------------------------------------------------- */
function initHabitModal() {
  document.getElementById('habitCancelBtn').addEventListener('click', closeHabitModal);
  document.getElementById('habitCloseBtn').addEventListener('click', closeHabitModal);
  renderHabitIconPicker();

  document.getElementById('habitForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('habitNameInput').value.trim();
    if (!name) return;

    const payload = { name, icon: selectedHabitIcon };
    if (editingHabitId) payload.id = editingHabitId;

    try {
      const result = await apiFetch('/api/habits/save/', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const saved = result.habit;
      const idx = habitsState.findIndex(h => h.id === saved.id);
      if (idx > -1) habitsState[idx] = saved; else habitsState.push(saved);
      renderHabits();
      await loadGrid(currentPeriod);
      closeHabitModal();
    } catch (err) {
      console.error('Failed to save habit', err);
      alert('Could not save this habit. Please try again.');
    }
  });

  document.getElementById('habitDeleteBtn').addEventListener('click', () => {
    document.getElementById('deleteConfirm').classList.add('open');
  });
  document.getElementById('deleteCancelBtn').addEventListener('click', () => {
    document.getElementById('deleteConfirm').classList.remove('open');
  });
  document.getElementById('deleteConfirmBtn').addEventListener('click', async () => {
    try {
      await apiFetch(`/api/habits/delete/${editingHabitId}/`, { method: 'POST', body: '{}' });
      habitsState = habitsState.filter(h => h.id !== editingHabitId);
      document.getElementById('deleteConfirm').classList.remove('open');
      closeHabitModal();
      renderHabits();
      await loadGrid(currentPeriod);
    } catch (err) {
      console.error('Failed to delete habit', err);
      alert('Could not delete this habit. Please try again.');
    }
  });
}

/* Renders the small emoji grid inside the Add/Edit Habit modal. Built
   once; openHabitModal() just updates which button looks selected. */
function renderHabitIconPicker() {
  const wrap = document.getElementById('habitIconPicker');
  if (!wrap || wrap.childElementCount) return;
  HABIT_ICON_CHOICES.forEach(icon => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'icon-choice';
    btn.textContent = icon;
    btn.addEventListener('click', () => {
      selectedHabitIcon = icon;
      syncHabitIconPicker();
    });
    wrap.appendChild(btn);
  });
  syncHabitIconPicker();
}
function syncHabitIconPicker() {
  const wrap = document.getElementById('habitIconPicker');
  if (!wrap) return;
  wrap.querySelectorAll('.icon-choice').forEach(btn => {
    btn.classList.toggle('selected', btn.textContent === selectedHabitIcon);
  });
}

function openHabitModal(habitId) {
  editingHabitId = habitId;
  const isEdit = !!habitId;
  document.getElementById('habitModalTitle').textContent = isEdit ? 'Edit Habit' : 'Add Habit';
  document.getElementById('habitDeleteBtn').style.display = isEdit ? 'inline-flex' : 'none';
  document.getElementById('deleteConfirm').classList.remove('open');

  if (isEdit) {
    const habit = habitsState.find(h => h.id === habitId);
    document.getElementById('habitNameInput').value = habit.name;
    selectedHabitIcon = habit.icon || '⭐';
  } else {
    document.getElementById('habitNameInput').value = '';
    selectedHabitIcon = '⭐';
  }
  syncHabitIconPicker();
  document.getElementById('habitModal').classList.add('open');
}
function closeHabitModal() {
  document.getElementById('habitModal').classList.remove('open');
  editingHabitId = null;
}

/* ---------------------------------------------------------------------
   Settings modal
   ------------------------------------------------------------------- */
function initSettingsModal() {
  document.getElementById('settingsBtn').addEventListener('click', () => {
    document.getElementById('settingsModal').classList.add('open');
    syncThemeSwitches();
  });
  document.getElementById('settingsCloseBtn').addEventListener('click', () => {
    document.getElementById('settingsModal').classList.remove('open');
  });
  document.getElementById('settingsLogoutBtn').addEventListener('click', () => {
    window.location.href = '/logout/';
  });

  const notifToggle = document.getElementById('notifToggle');
  notifToggle.addEventListener('change', () => {
    storageSet('ht_notifications', notifToggle.checked ? '1' : '0');
  });
  notifToggle.checked = storageGet('ht_notifications') !== '0';
}

/* ---------------------------------------------------------------------
   Theme controls (sidebar switch + settings switch, kept in sync)
   ------------------------------------------------------------------- */
function initThemeControls() {
  syncThemeSwitches();
  document.getElementById('sidebarThemeSwitch').addEventListener('change', () => {
    toggleTheme();
    syncThemeSwitches();
  });
  document.getElementById('settingsThemeSwitch').addEventListener('change', () => {
    toggleTheme();
    syncThemeSwitches();
  });
}
function syncThemeSwitches() {
  const isLight = getTheme() === 'light';
  document.getElementById('sidebarThemeSwitch').checked = isLight;
  document.getElementById('settingsThemeSwitch').checked = isLight;
  document.querySelectorAll('.js-theme-label').forEach(el => {
    el.textContent = isLight ? 'Light mode' : 'Night mode';
  });
  document.querySelectorAll('.js-theme-icon').forEach(el => {
    el.textContent = isLight ? '☀️' : '🌙';
  });
}
