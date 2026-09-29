/* =========================================================================
   main.js — shared utilities used across every page
   -------------------------------------------------------------------------
   All real data (users, habits, check-ins, chats) now lives in the Django
   backend and is loaded via server-rendered JSON (json_script) or fetched
   from the /api/ endpoints in views.py. This file only holds small
   cross-page helpers: theme handling, a couple of formatting utilities,
   and a fetch() wrapper that automatically attaches the CSRF token.
   ========================================================================= */

/* ---------------------------------------------------------------------
   Safe localStorage wrapper (theme + small UI preferences only — never
   used for auth/user data anymore). Falls back to an in-memory object if
   localStorage is blocked so the page never crashes because of it.
   ------------------------------------------------------------------- */
const memoryStore = {};
function storageGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (e) {
    return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : null;
  }
}
function storageSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch (e) {
    memoryStore[key] = value;
  }
}

/* ---------------------------------------------------------------------
   Theme (dark / light) — persisted client-side, applied on every page
   ------------------------------------------------------------------- */
const THEME_KEY = 'ht_theme';
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}
function getTheme() {
  return storageGet(THEME_KEY) || 'dark';
}
function setTheme(theme) {
  storageSet(THEME_KEY, theme);
  applyTheme(theme);
  document.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
}
function toggleTheme() {
  setTheme(getTheme() === 'dark' ? 'light' : 'dark');
}
applyTheme(getTheme());

/* ---------------------------------------------------------------------
   Preset habit choices (used by the Choose Habit onboarding screen and
   the dashboard's Add/Edit Habit modal).
   ------------------------------------------------------------------- */
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
   Small formatting helpers
   ------------------------------------------------------------------- */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ---------------------------------------------------------------------
   fetch() wrapper that attaches the CSRF token Django expects on every
   unsafe request (POST/PUT/PATCH/DELETE). Reads the token from the
   <meta name="csrf-token"> tag each page's <head> includes.
   ------------------------------------------------------------------- */
function getCsrfToken() {
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta ? meta.content : '';
}

async function apiFetch(url, options = {}) {
  const opts = Object.assign({}, options);
  // FormData bodies (used for the profile-photo upload) must NOT get a
  // manual Content-Type — the browser sets one itself with the correct
  // multipart boundary. Only plain JSON bodies get the JSON header.
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  opts.headers = Object.assign(
    { 'X-CSRFToken': getCsrfToken() },
    (options.body && !isFormData) ? { 'Content-Type': 'application/json' } : {},
    options.headers || {}
  );
  const res = await fetch(url, opts);
  if (!res.ok) {
    let detail = '';
    try { detail = await res.text(); } catch (e) { /* ignore */ }
    throw new Error(`Request to ${url} failed (${res.status}): ${detail}`);
  }
  const contentType = res.headers.get('content-type') || '';
  return contentType.includes('application/json') ? res.json() : null;
}
