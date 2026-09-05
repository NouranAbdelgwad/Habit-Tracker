/* =========================================================================
   dashboard.js — dashboard screen logic
   ========================================================================= */

let currentPeriod = 'week'; // 'week' | 'month' | 'year'
let editingHabitId = null;

document.addEventListener('DOMContentLoaded', () => {
  const user = requireAuth();
  if (!user) return;

  renderUserBits(user);
  renderPeriodDropdown();
  renderDayGrid();
  renderHabits();
  initSidebar();
  initPeriodDropdown();
  initAccountModal();
  initHabitModal();
  initSettingsModal();
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
  document.querySelectorAll('.js-user-initial').forEach(el => el.textContent = (user.name[0] || '?').toUpperCase());
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
  renderHistoryList();

  document.getElementById('viewAccountBtn').addEventListener('click', openAccountModal);
}

function renderHistoryList() {
  const historyList = document.getElementById('historyList');
  const chats = getChats();
  historyList.innerHTML = '';
  chats.forEach(chat => {
    const item = document.createElement('button');
    item.className = 'history-item';
    item.type = 'button';
    item.textContent = chat.title;
    item.addEventListener('click', () => openChatbot(chat.id));
    historyList.appendChild(item);
  });
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
    btn.addEventListener('click', () => {
      currentPeriod = btn.getAttribute('data-period');
      renderPeriodDropdown();
      renderDayGrid();
      menu.classList.remove('open');
      trigger.classList.remove('open');
    });
  });

  document.addEventListener('click', () => {
    menu.classList.remove('open');
    trigger.classList.remove('open');
  });
}

/* ---------------------------------------------------------------------
   Day grid (week / month / year)
   ------------------------------------------------------------------- */
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function renderDayGrid() {
  const grid = document.getElementById('dayGrid');
  const dayLabelsRow = document.getElementById('dayLabelsRow');
  const habits = getHabits();
  grid.innerHTML = '';
  dayLabelsRow.innerHTML = '';
  grid.className = 'day-grid view-' + currentPeriod;

  if (currentPeriod === 'week') {
    dayLabelsRow.style.display = 'grid';
    const today = startOfDay(new Date());
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday

    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      const status = getDayStatus(d, habits);
      grid.appendChild(makeSquare(status));
    }

    DAY_LABELS.forEach((label, i) => {
      const el = document.createElement('span');
      el.className = 'day-label';
      if (i === today.getDay()) el.classList.add('active');
      el.textContent = label;
      dayLabelsRow.appendChild(el);
    });

  } else if (currentPeriod === 'month') {
    dayLabelsRow.style.display = 'grid';
    const now = new Date();
    const total = daysInMonth(now.getFullYear(), now.getMonth());
    for (let day = 1; day <= total; day++) {
      const d = new Date(now.getFullYear(), now.getMonth(), day);
      const status = getDayStatus(d, habits);
      grid.appendChild(makeSquare(status));
    }
    const todayIdx = now.getDay();
    DAY_LABELS.forEach((label, i) => {
      const el = document.createElement('span');
      el.className = 'day-label';
      if (i === todayIdx) el.classList.add('active');
      el.textContent = label;
      dayLabelsRow.appendChild(el);
    });

  } else if (currentPeriod === 'year') {
    dayLabelsRow.style.display = 'none';
    const now = new Date();
    for (let m = 0; m <= 11; m++) {
      const status = getMonthStatus(now.getFullYear(), m, habits);
      const wrap = document.createElement('div');
      wrap.className = 'month-square-wrap';
      const sq = makeSquare(status);
      const label = document.createElement('span');
      label.className = 'month-square-label';
      label.textContent = MONTH_LABELS[m];
      if (m === now.getMonth()) label.classList.add('active');
      wrap.appendChild(sq);
      wrap.appendChild(label);
      grid.appendChild(wrap);
    }
  }
}

/* Aggregate status for a whole month, used by the Year view. Only counts
   days that have already ended within that month; a month with no ended
   days yet (fully in the future) is neutral. */
function getMonthStatus(year, monthIndex, habits) {
  const total = daysInMonth(year, monthIndex);
  let veryWell = 0, good = 0, bad = 0, ended = 0;
  for (let day = 1; day <= total; day++) {
    const d = new Date(year, monthIndex, day);
    const status = getDayStatus(d, habits);
    if (status === 'neutral') continue;
    ended++;
    if (status === 'very-well') veryWell++;
    else if (status === 'good') good++;
    else if (status === 'bad') bad++;
  }
  if (ended === 0) return 'neutral';
  if (veryWell === ended) return 'very-well';
  if (bad === ended) return 'bad';
  return 'good';
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
  const habits = getHabits();
  row.innerHTML = '';

  habits.forEach(habit => row.appendChild(buildHabitCard(habit)));

  const addCard = document.createElement('button');
  addCard.className = 'habit-card add-habit-card';
  addCard.type = 'button';
  addCard.innerHTML = `<span class="add-icon">+</span><span>Make new Habit</span>`;
  addCard.addEventListener('click', () => openHabitModal(null));
  row.appendChild(addCard);
}

function buildHabitCard(habit) {
  const todayStr = formatDate(new Date());
  const checked = !!habit.checkins[todayStr];
  const streak = calcStreak(habit);

  const card = document.createElement('div');
  card.className = 'habit-card';
  card.innerHTML = `
    <button class="edit-btn" type="button" aria-label="Edit habit">✏️</button>
    <button class="checkin-toggle ${checked ? 'checked' : ''}" type="button" aria-label="Toggle check-in">
      ${checked ? '✓' : ''}
    </button>
    <div class="habit-name">${escapeHtml(habit.name)}</div>
    <div class="habit-streak">${streak} day streak</div>
  `;

  card.querySelector('.edit-btn').addEventListener('click', () => openHabitModal(habit.id));

  card.querySelector('.checkin-toggle').addEventListener('click', () => {
    // Toggle happens instantly in the mock data, then we re-render the
    // single card + the day grid right away — no waiting for "day end".
    toggleTodayCheckin(habit.id);
    renderHabits();
    renderDayGrid();
  });

  return card;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ---------------------------------------------------------------------
   Account modal
   ------------------------------------------------------------------- */
function initAccountModal() {
  document.getElementById('accountCloseBtn').addEventListener('click', closeAccountModal);
  document.getElementById('accountCancelBtn').addEventListener('click', closeAccountModal);
  document.getElementById('accountForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const user = getCurrentUser();
    user.name = document.getElementById('accountName').value.trim() || user.name;
    user.gender = document.getElementById('accountGender').value;
    setCurrentUser(user);

    // keep the users table in sync too
    const users = getUsers();
    const idx = users.findIndex(u => u.email === user.email);
    if (idx > -1) { users[idx] = user; saveUsers(users); }

    renderUserBits(user);
    closeAccountModal();
  });
}

function openAccountModal() {
  const user = getCurrentUser();
  document.getElementById('accountName').value = user.name;
  document.getElementById('accountEmail').placeholder = user.email;
  document.getElementById('accountGender').value = user.gender || '';
  document.getElementById('accountModal').classList.add('open');
}
function closeAccountModal() {
  document.getElementById('accountModal').classList.remove('open');
}

/* ---------------------------------------------------------------------
   Add / Edit habit modal
   ------------------------------------------------------------------- */
function initHabitModal() {
  document.getElementById('habitCancelBtn').addEventListener('click', closeHabitModal);
  document.getElementById('habitCloseBtn').addEventListener('click', closeHabitModal);

  document.getElementById('habitForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('habitNameInput').value.trim();
    if (!name) return;
    const habits = getHabits();

    if (editingHabitId) {
      const h = habits.find(h => h.id === editingHabitId);
      h.name = name;
    } else {
      habits.push({
        id: 'h' + Date.now(),
        name,
        createdAt: formatDate(new Date()),
        checkins: {}
      });
    }
    saveHabits(habits);
    renderHabits();
    renderDayGrid();
    closeHabitModal();
  });

  document.getElementById('habitDeleteBtn').addEventListener('click', () => {
    document.getElementById('deleteConfirm').classList.add('open');
  });
  document.getElementById('deleteCancelBtn').addEventListener('click', () => {
    document.getElementById('deleteConfirm').classList.remove('open');
  });
  document.getElementById('deleteConfirmBtn').addEventListener('click', () => {
    const habits = getHabits().filter(h => h.id !== editingHabitId);
    saveHabits(habits);
    document.getElementById('deleteConfirm').classList.remove('open');
    closeHabitModal();
    renderHabits();
    renderDayGrid();
  });
}

function openHabitModal(habitId) {
  editingHabitId = habitId;
  const isEdit = !!habitId;
  document.getElementById('habitModalTitle').textContent = isEdit ? 'Edit Habit' : 'Add Habit';
  document.getElementById('habitDeleteBtn').style.display = isEdit ? 'inline-flex' : 'none';
  document.getElementById('deleteConfirm').classList.remove('open');

  if (isEdit) {
    const habit = getHabits().find(h => h.id === habitId);
    document.getElementById('habitNameInput').value = habit.name;
  } else {
    document.getElementById('habitNameInput').value = '';
  }
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
  document.getElementById('settingsLogoutBtn').addEventListener('click', logout);

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