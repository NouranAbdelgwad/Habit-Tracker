/* =========================================================================
   auth.js — mock login / signup logic (no backend yet)
   ========================================================================= */

function initLoginPage() {
  const form = document.getElementById('loginForm');
  const errorEl = document.getElementById('loginError');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    const users = getUsers();
    const match = users.find(u => u.email === email && u.password === password);

    if (match) {
      errorEl.classList.remove('visible');
      setCurrentUser(match);
      window.location.href = 'dashboard.html';
    } else {
      errorEl.classList.add('visible');
    }
  });
}

function initSignupPage() {
  const form = document.getElementById('signupForm');
  if (!form) return;

  const usernameInput = document.getElementById('signupUsername');
  const emailInput = document.getElementById('signupEmail');
  const passwordInput = document.getElementById('signupPassword');
  const confirmInput = document.getElementById('signupConfirm');

  const usernameError = document.getElementById('usernameError');
  const emailError = document.getElementById('emailError');
  const passwordError = document.getElementById('passwordError');
  const confirmError = document.getElementById('confirmError');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    [usernameError, emailError, passwordError, confirmError].forEach(el => el.classList.remove('visible'));

    const username = usernameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirm = confirmInput.value;

    const users = getUsers();
    let hasError = false;

    const usernameTaken = username.toLowerCase() === 'admin' || users.some(u => u.username.toLowerCase() === username.toLowerCase());
    const emailTaken = users.some(u => u.email.toLowerCase() === email.toLowerCase());

    if (!username || usernameTaken) {
      usernameError.classList.add('visible');
      hasError = true;
    }
    if (!email || emailTaken) {
      emailError.classList.add('visible');
      hasError = true;
    }
    if (!password) {
      passwordError.classList.add('visible');
      hasError = true;
    }
    if (!confirm || confirm !== password) {
      confirmError.classList.add('visible');
      hasError = true;
    }

    if (hasError) return;

    const newUser = { username, email, password, name: username, gender: '' };
    users.push(newUser);
    saveUsers(users);
    setCurrentUser(newUser);
    window.location.href = '/dashboard/';
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initLoginPage();
  initSignupPage();
});
