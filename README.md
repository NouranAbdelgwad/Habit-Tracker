# 🫀 Habit Tracker

**Build habits that stick.** Check in once a day, watch your streak grow, and see your week, month, or year at a glance — no clutter, no noise, just the habits you actually keep.

A full-stack Django project built for **IEEE Elevate — Software Engineering Track, Project 3**.

---

## ✨ Features

**Core**
- Secure sign-up and login (by username *or* email)
- Create, edit, and delete habits with custom emoji icons
- One-click daily check-ins with live streak counters (current + longest)
- Color-coded progress heatmap — Week / Month / Year views
- Guided onboarding flow (`Choose your habits`) right after signup

**Beyond the brief**
- 🤖 Built-in AI chatbot with persisted, per-user chat history
- 🌗 Light / dark theme toggle, remembered per device
- 👤 Live account settings (name, gender) — no page reload
- 🔁 "Never-miss-twice" streak logic instead of all-or-nothing resets

## 📸 Screenshots

| Sign in | Create account |
|---|---|
| ![Login](docs/screenshots/login.png) | ![Signup](docs/screenshots/signup.png) |

| Dashboard — daily check-ins & streaks | Weekly progress heatmap |
|---|---|
| ![Dashboard](docs/screenshots/dashboard.png) | ![Heatmap](docs/screenshots/heatmap.png) |

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python, Django 6.1 |
| Database | SQLite (via Django ORM) |
| Frontend | Django Templates, vanilla JavaScript (`fetch` API), hand-written CSS |
| Auth | Django session-based auth, CSRF-protected |

No frontend framework, no build step — just server-rendered HTML plus a handful of plain `.js` files.

## 🚀 Getting Started

### 1. Create and activate a virtual environment

```powershell
py -3 -m venv venv
.\venv\Scripts\Activate.ps1
```

> Make sure this is the official python.org interpreter, not a MinGW/MSYS2 build — prebuilt wheels only exist for the standard build. If a `pip install` ever tries to compile something from source with a `mingw_x86_64` tag in the log, recreate the venv with Python from [python.org](https://www.python.org/downloads/).

### 2. Install dependencies

```powershell
pip install -r requirements.txt
```

### 3. Apply migrations

```powershell
python manage.py migrate
```

### 4. (Optional) Create an admin account

```powershell
python manage.py createsuperuser
```

Lets you browse Users / Habits / HabitLogs / ChatSessions at `/admin/`.

### 5. Run the server

```powershell
python manage.py runserver
```

Visit **http://127.0.0.1:8000/**.

## 📁 Project Structure

```
Habit-Tracker/
├── config/                  # Django project settings, URL routing
│   ├── settings.py
│   └── urls.py
├── habits/                  # The one Django app
│   ├── models.py            # UserProfile, Habit, HabitLog, ChatSession, ChatMessage
│   ├── views.py             # Page views + JSON API views
│   ├── forms.py             # SignupForm
│   ├── signals.py           # Auto-creates UserProfile on signup
│   ├── migrations/
│   ├── static/habits/
│   │   ├── css/style.css
│   │   └── js/               # main.js, dashboard.js, choose-habit.js, chatbot.js
│   └── templates/habits/     # index, login, signup, choose-habit, dashboard
├── docs/screenshots/         # Images used in this README
├── manage.py
└── requirements.txt
```

## 🔌 API Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/login/` | Log in (username or email) |
| GET/POST | `/signup/` | Create an account |
| GET | `/logout/` | Log out |
| GET | `/choose-habit/` | Onboarding: pick starting habits |
| GET | `/dashboard/` | Main dashboard (`never_cache`) |
| GET | `/api/period-data/?period=` | Week / Month / Year grid as JSON |
| POST | `/api/habits/toggle/<id>/` | Toggle today's check-in |
| POST | `/api/habits/save/` | Create or update a habit |
| POST | `/api/habits/delete/<id>/` | Delete a habit |
| POST | `/api/account/update/` | Update name / gender |
| GET | `/api/chats/` | List the user's chat sessions |
| POST | `/api/chat/` | Send a chat message, get a reply |

Full request-flow walkthrough and the database schema (with ER diagram) are documented separately in **`Habit_Tracker_System_Architecture_and_Database_Design.docx`**.

## 🗺 Roadmap

- [ ] Email / push reminders at user-set times
- [ ] Swap the chatbot's placeholder reply for a real LLM
- [ ] Deeper analytics — category breakdowns, consistency insights
- [ ] Full password-reset flow
- [ ] Cloud deployment as an installable, mobile-friendly PWA

## 🧪 Design Notes

- **Timezone-correct by design** — `TIME_ZONE` is set to the user's local zone so "today" in streak and check-in logic always matches their real calendar day, not UTC.
- **No stale state** — the dashboard is served with `never_cache`, so a browser restoring the page from its back/forward cache (e.g. after the laptop sleeps overnight) can never show a frozen, days-old check-in state.
- **One check-in per day, enforced at the database level** — `HabitLog` has a `unique_together` constraint on `(habit, date)`, not just an application-level check.
- **Real calendar math** — the Month view is a true 7-column, Sun–Sat calendar grid (4–6 rows depending on the month), padded so the 1st always lands under its correct weekday.

## 📄 License

Built for educational purposes as part of IEEE Elevate.
