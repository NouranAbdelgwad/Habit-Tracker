/* =========================================================================
   main.js — shared mock data layer + utilities
   -------------------------------------------------------------------------
   Everything here is a stand-in for a future Django + SQLite backend.
   Data lives in localStorage under the "ht_*" keys so it survives reloads,
   but every read/write goes through small helper functions
   (getHabits/saveHabits, getUsers/saveUsers, etc.) so that later on we can
   swap the localStorage calls for fetch() calls to real API endpoints
   without touching the rendering code that calls these helpers.
   ========================================================================= */

const STORAGE_KEYS = {
  users: 'ht_users',
  currentUser: 'ht_currentUser',
  habits: 'ht_habits',
  chats: 'ht_chats',
  theme: 'ht_theme',
  seeded: 'ht_seeded_v3'
};

/* ---------------------------------------------------------------------
   Preset habits offered on the "Choose Habit" onboarding screen.
   Shared with dashboard.js so the same icon set is available when
   adding/editing a habit later from the dashboard. ------------------- */
const HABIT_PRESETS = [
  { name: 'Running', icon: '🏃' },
  { name: 'Reading', icon: '📖' },
  { name: 'Gaming', icon: '🎮' },
  { name: 'Meditation', icon: '🧘' },
  { name: 'Drink Water', icon: '💧' },
  { name: 'Workout', icon: '💪' }
];
const HABIT_ICON_CHOICES = [
  '⭐','🏃','📖','🎮','🧘','💧','💪','😴','🎨','🎵',
  '✍️','🧹','🥗','🚴','🧠','💰','🌱','☀️','🙏','📚'
];

/* ---------------------------------------------------------------------
   Safe storage wrapper
   -------------------------------------------------------------------
   Some browsers (or opening the HTML file directly with a double-click
   instead of through a local server) block localStorage entirely and
   throw a SecurityError the moment it's touched. Because almost every
   function in this app reads/writes storage, one thrown error used to
   take down the whole page — no squares, no working buttons, nothing.
   These helpers try localStorage first and silently fall back to an
   in-memory object if it's unavailable, so the app always keeps
   working (data just won't survive a reload in that fallback case). */
const memoryStore = {};
let storageBlocked = false;
function storageGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (e) {
    storageBlocked = true;
    return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : null;
  }
}
function storageSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch (e) {
    storageBlocked = true;
    memoryStore[key] = value;
  }
}
function storageRemove(key) {
  try {
    window.localStorage.removeItem(key);
  } catch (e) {
    storageBlocked = true;
    delete memoryStore[key];
  }
}

/* ---------------------------------------------------------------------
   Per-user namespacing
   -------------------------------------------------------------------
   Habits and chat history must never be shared between accounts. Every
   read/write of that data goes through a key that's suffixed with the
   signed-in user's email, so "demo" and "test" (or any two accounts in
   the same browser) each get their own isolated storage bucket instead
   of silently sharing — and overwriting — one global list. */
function currentUserId() {
  const raw = storageGet(STORAGE_KEYS.currentUser);
  if (!raw) return 'guest';
  try {
    const user = JSON.parse(raw);
    return (user && (user.email || user.username)) || 'guest';
  } catch (e) {
    return 'guest';
  }
}
function namespacedKey(baseKey, userId) {
  return baseKey + ':' + (userId || currentUserId());
}

/* ---------------------------------------------------------------------
   Date helpers
   ------------------------------------------------------------------- */
function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/* ---------------------------------------------------------------------
   Seed data — only runs once, first time the app is opened.
   IMPORTANT: this must never blow away real accounts/data that already
   exist in this browser — it only fills in what's missing (the demo
   account and its sample habits), then migrates/cleans up any leftover
   data from older, pre-namespacing versions of the app.
   ------------------------------------------------------------------- */
function seedIfNeeded() {
  if (storageGet(STORAGE_KEYS.seeded)) return;

  const demoUser = {
    username: 'demo',
    email: 'demo@habit.com',
    password: 'demo1234',
    name: 'Demo',
    gender: '',
    onboarded: true
  };

  // Add the demo account only if it isn't already there — never replace
  // the whole users table, or any real accounts created in this browser
  // (e.g. "test") would be wiped out.
  const users = getUsers();
  if (!users.some(u => u.email === demoUser.email)) {
    users.push(demoUser);
    saveUsers(users);
  }

  // Only seed demo's sample habits/chats if it doesn't already have its
  // own namespaced data (so re-running this never overwrites anything).
  const demoHabitsKey = namespacedKey(STORAGE_KEYS.habits, demoUser.email);
  if (!storageGet(demoHabitsKey)) {
    // Build check-in history so streaks match the reference design:
    // "Morning run" -> 5 day streak INCLUDING today (today is checked).
    // "Read 20 pages" -> 14 day streak NOT including today (today unchecked).
    const today = startOfDay(new Date());
    const runCheckins = {};
    for (let i = 0; i < 5; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      runCheckins[formatDate(d)] = true;
    }
    const readCheckins = {};
    for (let i = 1; i <= 14; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      readCheckins[formatDate(d)] = true;
    }

    const createdLongAgo = formatDate(new Date(today.getFullYear(), today.getMonth() - 2, 1));

    const habits = [
      { id: 'h1', name: 'Read 20 pages', icon: '📖', createdAt: createdLongAgo, checkins: readCheckins },
      { id: 'h2', name: 'Morning run', icon: '🏃', createdAt: createdLongAgo, checkins: runCheckins }
    ];
    storageSet(demoHabitsKey, JSON.stringify(habits));
  }

  const demoChatsKey = namespacedKey(STORAGE_KEYS.chats, demoUser.email);
  if (!storageGet(demoChatsKey)) {
    const chats = [
      {
        id: 'c1',
        title: 'Habit ideas for mornings',
        messages: [
          { sender: 'user', text: 'Give me 3 quick morning habits' },
          { sender: 'bot', text: "Got it! (This is a placeholder response — AI backend not connected yet.)" }
        ]
      },
      {
        id: 'c2',
        title: 'How to stay consistent',
        messages: [
          { sender: 'user', text: 'How do I stop breaking my streak?' },
          { sender: 'bot', text: "Got it! (This is a placeholder response — AI backend not connected yet.)" }
        ]
      },
      {
        id: 'c3',
        title: 'Weekly reflection',
        messages: [
          { sender: 'user', text: 'Summarize my week for me' },
          { sender: 'bot', text: "Got it! (This is a placeholder response — AI backend not connected yet.)" }
        ]
      }
    ];
    storageSet(demoChatsKey, JSON.stringify(chats));
  }

  migrateLegacySharedData();
  storageSet(STORAGE_KEYS.seeded, '1');
}

/* Earlier versions of this app kept EVERY account's habits/chats under one
   shared, un-namespaced key ('ht_habits' / 'ht_chats'), so any two accounts
   in the same browser silently saw and overwrote each other's data. If
   that legacy shared data is still sitting here, hand it to whichever
   account happens to be signed in right now (so nothing just disappears),
   then delete the shared copy so it can never leak into another account
   again. Accounts that aren't currently signed in unfortunately can't be
   recovered automatically here — there's no way to know which of the
   merged habits were "theirs" — but they simply start fresh. */
function migrateLegacySharedData() {
  const legacyHabits = storageGet(STORAGE_KEYS.habits);
  const legacyChats = storageGet(STORAGE_KEYS.chats);
  if (legacyHabits === null && legacyChats === null) return;

  const uid = currentUserId();
  if (uid !== 'guest') {
    const habitsKey = namespacedKey(STORAGE_KEYS.habits, uid);
    const chatsKey = namespacedKey(STORAGE_KEYS.chats, uid);
    if (legacyHabits !== null && storageGet(habitsKey) === null) {
      storageSet(habitsKey, legacyHabits);
    }
    if (legacyChats !== null && storageGet(chatsKey) === null) {
      storageSet(chatsKey, legacyChats);
    }
  }
  storageRemove(STORAGE_KEYS.habits);
  storageRemove(STORAGE_KEYS.chats);
}
seedIfNeeded();

/* ---------------------------------------------------------------------
   Users / auth
   ------------------------------------------------------------------- */
function getUsers() {
  return JSON.parse(storageGet(STORAGE_KEYS.users) || '[]');
}
function saveUsers(users) {
  storageSet(STORAGE_KEYS.users, JSON.stringify(users));
}
function getCurrentUser() {
  const raw = storageGet(STORAGE_KEYS.currentUser);
  return raw ? JSON.parse(raw) : null;
}
function setCurrentUser(user) {
  storageSet(STORAGE_KEYS.currentUser, JSON.stringify(user));
}
/* Marks the current user as having finished the first-run "Choose Habit"
   screen, so it never shows again for that account (login/reload go
   straight to the dashboard). Keeps the users table in sync too. */
function markOnboarded(user) {
  user.onboarded = true;
  setCurrentUser(user);
  const users = getUsers();
  const idx = users.findIndex(u => u.email === user.email);
  if (idx > -1) { users[idx] = user; saveUsers(users); }
}
function logout() {
  storageRemove(STORAGE_KEYS.currentUser);
  window.location.href = '/';
}
/* Any page that requires auth calls this at load time. */
function requireAuth() {
  const user = getCurrentUser();
  if (!user) {
    window.location.href = '/login/';
    return null;
  }
  return user;
}

/* ---------------------------------------------------------------------
   Habits
   ------------------------------------------------------------------- */
function getHabits() {
  return JSON.parse(storageGet(namespacedKey(STORAGE_KEYS.habits)) || '[]');
}
function saveHabits(habits) {
  storageSet(namespacedKey(STORAGE_KEYS.habits), JSON.stringify(habits));
}

/* Creates and persists a brand-new habit (used by the onboarding
   "Choose Habit" screen and the dashboard's Add Habit modal). */
function addHabit(name, icon) {
  const habits = getHabits();
  const habit = {
    id: 'h' + Date.now() + Math.floor(Math.random() * 1000),
    name,
    icon: icon || '⭐',
    createdAt: formatDate(new Date()),
    checkins: {}
  };
  habits.push(habit);
  saveHabits(habits);
  return habit;
}

/* Streak is ALWAYS derived, never stored/typed by the user. */
function calcStreak(habit) {
  let streak = 0;
  const today = startOfDay(new Date());
  const cursor = new Date(today);
  if (!habit.checkins[formatDate(cursor)]) {
    // today not checked yet -> look backwards starting yesterday
    cursor.setDate(cursor.getDate() - 1);
  }
  while (habit.checkins[formatDate(cursor)]) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/* Toggles TODAY's check-in for a habit. This updates the mock data and
   is reflected in the UI immediately by the caller re-rendering the
   habit card — there is no delay/waiting for "day end" here. The
   day-end rule only applies to the week/month/year overview squares,
   which represent days that have already finished (see getDayStatus). */
function toggleTodayCheckin(habitId) {
  const habits = getHabits();
  const habit = habits.find(h => h.id === habitId);
  if (!habit) return null;
  const todayStr = formatDate(new Date());
  if (habit.checkins[todayStr]) {
    delete habit.checkins[todayStr];
  } else {
    habit.checkins[todayStr] = true;
  }
  saveHabits(habits);
  return habit;
}

/* ---------------------------------------------------------------------
   Day-square status logic (Very Well / Good / Bad / neutral)
   ------------------------------------------------------------------- */
function getDayStatus(dateObj, habits) {
  const today = startOfDay(new Date());
  const day = startOfDay(dateObj);
  const isToday = day.getTime() === today.getTime();

  // (a) hasn't happened yet -> always neutral
  if (day > today) return 'neutral';

  const dateStr = formatDate(day);
  const habitsThatDay = habits.filter(h => new Date(h.createdAt + 'T00:00:00') <= day);

  // (b) zero habits that day
  if (habitsThatDay.length === 0) return 'neutral';

  const checkedCount = habitsThatDay.filter(h => h.checkins[dateStr]).length;

  // Today updates live as check-ins happen: none checked yet -> stays
  // neutral (the day hasn't ended, so it must NOT turn Bad yet). Some
  // or all checked -> reflects Good / Very Well immediately.
  if (checkedCount === 0) return isToday ? 'neutral' : 'bad';
  if (checkedCount === habitsThatDay.length) return 'very-well';
  return 'good';
}

/* ---------------------------------------------------------------------
   Theme (dark / light) — persisted + applied on every page
   ------------------------------------------------------------------- */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}
function getTheme() {
  return storageGet(STORAGE_KEYS.theme) || 'dark';
}
function setTheme(theme) {
  storageSet(STORAGE_KEYS.theme, theme);
  applyTheme(theme);
  document.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
}
function toggleTheme() {
  setTheme(getTheme() === 'dark' ? 'light' : 'dark');
}
/* Apply saved theme as early as possible on every page load. */
applyTheme(getTheme());

/* ---------------------------------------------------------------------
   Chat history (mock)
   ------------------------------------------------------------------- */
function getChats() {
  return JSON.parse(storageGet(namespacedKey(STORAGE_KEYS.chats)) || '[]');
}
function saveChats(chats) {
  storageSet(namespacedKey(STORAGE_KEYS.chats), JSON.stringify(chats));
}