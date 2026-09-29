# Habit Tracker — setup

## 1. Create and activate a virtual environment

```powershell
py -3 -m venv venv
.\venv\Scripts\Activate.ps1
```

Confirm it's the real python.org interpreter, not a MinGW/MSYS2 build — this
matters because prebuilt wheels (Pillow, etc.) only exist for the standard
build. If you ever see a `mingw_x86_64` tag in a pip build log, recreate the
venv with the official Python install from python.org.

## 2. Install dependencies

```powershell
pip install -r requirements.txt
```

## 3. Apply migrations

```powershell
python manage.py migrate
```

This also applies migration `0004`, which fixes a real pre-existing bug:
`HabitLog.date` existed on the model but was never migrated into the
database, so any check-in would have crashed with
`OperationalError: no such column: habits_habitlog.date`.

## 4. (Optional) Create an admin account

```powershell
python manage.py createsuperuser
```

Lets you browse Users / Habits / HabitLogs / ChatSessions at `/admin/`.

## 5. Run the server

```powershell
python manage.py runserver
```

Visit `http://127.0.0.1:8000/`.

## What changed / what was actually broken

- **Signup never saved anything.** `auth.js` was a mock layer that stored
  fake accounts in `localStorage` and never touched the server. Login/signup
  forms now POST directly to Django (`views.py`: `signup_view`,
  `login_view`), with `{% csrf_token %}` and real server-side validation.
- **`login_view`, `signup_view`, `logout_view`, `choose_habit_view` didn't
  exist**, and their URLs were commented out in `urls.py`. Both are now
  wired up.
- **`UserProfile` was never auto-created on signup** because
  `habits/apps.py` had no `ready()` method to connect the `post_save`
  signal, and `INSTALLED_APPS` pointed at `'habits'` instead of
  `'habits.apps.HabitsConfig'`. Fixed both.
- **The dashboard, choose-habit screen, and chat panel were 100% mock**,
  reading/writing `localStorage` only. They're now wired to the real
  `/api/...` endpoints in `views.py` via `fetch()` (see `main.js`'s
  `apiFetch()` helper, which attaches the CSRF token automatically).
- **Chat history is now persisted** in two new models, `ChatSession` and
  `ChatMessage`, instead of living only in the browser.
- Added a `UserProfile.onboarded` flag so the "Choose your habits" screen
  only shows once, right after signup.
- Fixed hardcoded `/static/...` paths to use `{% static %}`, fixed a
  malformed `<head>` (missing closing tag) in two templates, and fixed an
  invalid `MAILERS` setting (the real Django setting is `EMAIL_BACKEND`).

Everything above was tested end-to-end with Django's test client: signup,
duplicate-email/weak-password rejection, login by username **or** email,
wrong-password error display, onboarding, habit create/edit/delete,
check-in toggling, week/month/year grid data, account updates, chat
send/list/detail, and logout — all passing.

## Known simplifications (not bugs, just left simple on purpose)

- The chatbot's reply is a hardcoded placeholder string
  (`views.chatbot_message`) — swap in a real API call whenever you're ready.
- Password rules use Django's default validators (min length, not too
  common/numeric, not too similar to your username/email) — these are
  stricter than the original "Email or Password are wrong" placeholder
  text implied, but they're real protection instead of doing nothing.
