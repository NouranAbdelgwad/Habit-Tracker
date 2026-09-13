/* =========================================================================
   choose-habit.js — first-run onboarding: pick starting habits
   -------------------------------------------------------------------------
   Shown once, right after signup (before the dashboard). The person can
   tap any number of preset habits, add their own via "Another" (name +
   emoji), then hit Continue to create them all and land on the
   dashboard — or Skip to go straight there with nothing set up yet.
   ========================================================================= */

let chosenHabits = []; // { name, icon, isPreset }
let customIcon = '⭐';

document.addEventListener('DOMContentLoaded', () => {
  const user = requireAuth();
  if (!user) return;

  // Already done this before (e.g. came back via browser history) ->
  // no need to see it again.
  if (user.onboarded) {
    window.location.href = '/dashboard/';
    return;
  }

  renderPresetGrid();
  renderCustomIconPicker();
  renderChips();
  initCustomPanel();
  initActions();
});

/* ---------------------------------------------------------------------
   Preset grid (6 common habits + "Another")
   ------------------------------------------------------------------- */
function renderPresetGrid() {
  const grid = document.getElementById('presetGrid');
  grid.innerHTML = '';

  HABIT_PRESETS.forEach(preset => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'preset-card';
    card.innerHTML = `<span class="preset-icon">${preset.icon}</span><span class="preset-name">${preset.name}</span>`;
    card.addEventListener('click', () => togglePreset(preset, card));
    grid.appendChild(card);
  });

  const anotherCard = document.createElement('button');
  anotherCard.type = 'button';
  anotherCard.className = 'preset-card another';
  anotherCard.innerHTML = `<span class="preset-icon">➕</span><span class="preset-name">Another</span>`;
  anotherCard.addEventListener('click', openCustomPanel);
  grid.appendChild(anotherCard);
}

function togglePreset(preset, cardEl) {
  const idx = chosenHabits.findIndex(h => h.isPreset && h.name === preset.name);
  if (idx > -1) {
    chosenHabits.splice(idx, 1);
    cardEl.classList.remove('selected');
  } else {
    chosenHabits.push({ name: preset.name, icon: preset.icon, isPreset: true });
    cardEl.classList.add('selected');
  }
  renderChips();
}

/* ---------------------------------------------------------------------
   "Another" custom-habit panel
   ------------------------------------------------------------------- */
function renderCustomIconPicker() {
  const wrap = document.getElementById('customIconPicker');
  HABIT_ICON_CHOICES.forEach(icon => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'icon-choice';
    btn.textContent = icon;
    btn.addEventListener('click', () => {
      customIcon = icon;
      syncCustomIconPicker();
    });
    wrap.appendChild(btn);
  });
  syncCustomIconPicker();
}
function syncCustomIconPicker() {
  document.querySelectorAll('#customIconPicker .icon-choice').forEach(btn => {
    btn.classList.toggle('selected', btn.textContent === customIcon);
  });
}

function openCustomPanel() {
  document.getElementById('customPanel').classList.add('open');
  document.getElementById('customNameInput').value = '';
  customIcon = '⭐';
  syncCustomIconPicker();
  document.getElementById('customNameInput').focus();
}
function closeCustomPanel() {
  document.getElementById('customPanel').classList.remove('open');
}

function initCustomPanel() {
  document.getElementById('customCancelBtn').addEventListener('click', closeCustomPanel);
  document.getElementById('customAddBtn').addEventListener('click', () => {
    const name = document.getElementById('customNameInput').value.trim();
    if (!name) {
      document.getElementById('customNameInput').focus();
      return;
    }
    chosenHabits.push({ name, icon: customIcon, isPreset: false });
    renderChips();
    closeCustomPanel();
  });
}

/* ---------------------------------------------------------------------
   Chosen-habits chip list (shows everything queued up so far)
   ------------------------------------------------------------------- */
function renderChips() {
  const wrap = document.getElementById('chosenChips');
  wrap.innerHTML = '';
  chosenHabits.forEach((habit, i) => {
    const chip = document.createElement('span');
    chip.className = 'chosen-chip';
    chip.innerHTML = `<span>${habit.icon} ${escapeHtml(habit.name)}</span>`;
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'remove-chip';
    removeBtn.setAttribute('aria-label', 'Remove');
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', () => removeChosen(i));
    chip.appendChild(removeBtn);
    wrap.appendChild(chip);
  });
}

function removeChosen(index) {
  const removed = chosenHabits[index];
  chosenHabits.splice(index, 1);
  renderChips();
  // Keep the preset grid in sync if a preset chip was removed this way.
  if (removed && removed.isPreset) {
    document.querySelectorAll('.preset-card').forEach(card => {
      const nameEl = card.querySelector('.preset-name');
      if (nameEl && nameEl.textContent === removed.name) card.classList.remove('selected');
    });
  }
}

/* ---------------------------------------------------------------------
   Continue / Skip
   ------------------------------------------------------------------- */
function initActions() {
  document.getElementById('continueBtn').addEventListener('click', finishOnboarding);
  document.getElementById('skipBtn').addEventListener('click', finishOnboarding);
}

function finishOnboarding() {
  const user = getCurrentUser();
  chosenHabits.forEach(h => addHabit(h.name, h.icon));
  markOnboarded(user);
  window.location.href = '/dashboard/';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
