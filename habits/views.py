import json
from datetime import timedelta, date as date_cls

from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.http import JsonResponse, HttpResponseBadRequest
from django.shortcuts import redirect, render, get_object_or_404
from django.utils import timezone
from django.views.decorators.http import require_POST, require_GET

from .forms import SignupForm
from .models import ChatMessage, ChatSession, Habit, HabitLog, UserProfile


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_or_create_profile(user):
    profile, _ = UserProfile.objects.get_or_create(user=user)
    return profile


def _day_status(user, day):
    """'very-well' | 'good' | 'bad' | 'neutral' for one calendar day, based on
    the % of the user's habits that were checked in that day."""
    total = Habit.objects.filter(user=user).count()
    if total == 0:
        return 'neutral'

    checked = HabitLog.objects.filter(habit__user=user, date=day, checked_in=True).count()
    ratio = checked / total

    if ratio >= 0.8:
        return 'very-well'
    elif ratio >= 0.4:
        return 'good'
    elif checked > 0:
        return 'bad'
    return 'neutral'


def _week_grid(user, anchor=None):
    anchor = anchor or timezone.localdate()
    # Sunday-first week, to match the frontend's day-label row (Sun..Sat).
    sunday = anchor - timedelta(days=(anchor.weekday() + 1) % 7)
    days = [sunday + timedelta(days=i) for i in range(7)]
    return {
        'period': 'week',
        'label': 'This Week',
        'cells': [
            {'date': d.isoformat(), 'day_label': d.strftime('%a')[0], 'status': _day_status(user, d)}
            for d in days
        ],
    }


def _month_grid(user, anchor=None):
    anchor = anchor or timezone.localdate()
    first = anchor.replace(day=1)
    next_first = first.replace(year=first.year + 1, month=1) if first.month == 12 \
        else first.replace(month=first.month + 1)
    days = [first + timedelta(days=i) for i in range((next_first - first).days)]
    return {
        'period': 'month',
        'label': 'This Month',
        'cells': [
            {'date': d.isoformat(), 'day_label': str(d.day), 'status': _day_status(user, d)}
            for d in days
        ],
    }


def _year_grid(user, anchor=None):
    """One cell per month; status is aggregated over that month's days."""
    anchor = anchor or timezone.localdate()
    cells = []
    habits_total = Habit.objects.filter(user=user).count()

    for m in range(1, 13):
        month_start = date_cls(anchor.year, m, 1)
        month_end = date_cls(anchor.year + 1, 1, 1) if m == 12 else date_cls(anchor.year, m + 1, 1)

        logs_in_month = HabitLog.objects.filter(
            habit__user=user, date__gte=month_start, date__lt=month_end, checked_in=True
        ).count()
        days_in_month = (month_end - month_start).days
        possible = habits_total * days_in_month
        ratio = (logs_in_month / possible) if possible else 0

        if ratio >= 0.8:
            status = 'very-well'
        elif ratio >= 0.4:
            status = 'good'
        elif logs_in_month > 0:
            status = 'bad'
        else:
            status = 'neutral'

        cells.append({'date': month_start.isoformat(), 'day_label': month_start.strftime('%b'), 'status': status})

    return {'period': 'year', 'label': 'This Year', 'cells': cells}


_GRID_BUILDERS = {'week': _week_grid, 'month': _month_grid, 'year': _year_grid}


def _serialize_habit(habit, day=None):
    day = day or timezone.localdate()
    return {
        'id': habit.id,
        'name': habit.name,
        'icon': habit.icon,
        'frequency': habit.frequency,
        'reminder_time': habit.reminder_time.strftime('%H:%M') if habit.reminder_time else None,
        'tags': [t.strip() for t in habit.tags.split(',') if t.strip()],
        'current_streak': habit.current_streak,
        'longest_streak': habit.longest_streak,
        'checked_in_today': habit.is_checked_in_on(day),
    }


def _serialize_history(user, limit=12):
    """Distinct months that have at least one habit log, newest first —
    feeds the collapsible 'History' list in the sidebar."""
    months = HabitLog.objects.filter(habit__user=user).dates('date', 'month', order='DESC')[:limit]
    return [{'label': d.strftime('%B %Y'), 'value': d.strftime('%Y-%m')} for d in months]


# ---------------------------------------------------------------------------
# Public pages
# ---------------------------------------------------------------------------

def index(request):
    if request.user.is_authenticated:
        return redirect('dashboard')
    return render(request, 'habits/index.html')


def signup_view(request):
    if request.user.is_authenticated:
        return redirect('dashboard')

    if request.method == 'POST':
        form = SignupForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            return redirect('choose-habit')
        return render(request, 'habits/signup.html', {'form': form})

    form = SignupForm()
    return render(request, 'habits/signup.html', {'form': form})


def login_view(request):
    if request.user.is_authenticated:
        return redirect('dashboard')

    error = None
    if request.method == 'POST':
        identifier = (request.POST.get('email') or '').strip()
        password = request.POST.get('password', '')

        # Allow signing in with either the username or the email address.
        username = identifier
        if '@' in identifier:
            try:
                username = User.objects.get(email__iexact=identifier).username
            except User.DoesNotExist:
                username = None

        user = authenticate(request, username=username, password=password) if username else None
        if user is not None:
            login(request, user)
            profile = _get_or_create_profile(user)
            return redirect('dashboard' if profile.onboarded else 'choose-habit')
        error = "Email or Password are wrong"

    return render(request, 'habits/login.html', {'error': error})


def logout_view(request):
    logout(request)
    return redirect('index')


@login_required
def choose_habit_view(request):
    profile = _get_or_create_profile(request.user)
    if profile.onboarded:
        return redirect('dashboard')
    return render(request, 'habits/choose-habit.html')


@login_required
@require_POST
def onboarding_complete(request):
    """POST /api/onboarding/complete/ — called once the user finishes
    (or skips) the Choose Habit screen."""
    profile = _get_or_create_profile(request.user)
    profile.onboarded = True
    profile.save(update_fields=['onboarded'])
    return JsonResponse({'onboarded': True})


# ---------------------------------------------------------------------------
# Dashboard page
# ---------------------------------------------------------------------------

@login_required
def dashboard(request):
    user = request.user
    profile = _get_or_create_profile(user)
    habits = Habit.objects.filter(user=user)

    dashboard_data = {
        'user': {
            'name': user.get_full_name() or user.username,
            'email': user.email,
            'initial': (user.get_full_name() or user.username)[:1].upper(),
            'gender': profile.gender,
        },
        'habits': [_serialize_habit(h) for h in habits],
        'grid': _week_grid(user),
        'history': _serialize_history(user),
    }
    return render(request, 'habits/dashboard.html', {'dashboard_data': dashboard_data})


# ---------------------------------------------------------------------------
# AJAX endpoints (all return JSON; all require login)
# ---------------------------------------------------------------------------

@login_required
@require_GET
def get_period_data(request):
    """GET /api/period-data/?period=week|month|year"""
    period = request.GET.get('period', 'week')
    builder = _GRID_BUILDERS.get(period)
    if not builder:
        return HttpResponseBadRequest('Unknown period')
    return JsonResponse(builder(request.user))


@login_required
@require_POST
def toggle_habit_checkin(request, habit_id):
    """POST /api/habits/toggle/<id>/ — flips today's check-in for one habit."""
    habit = get_object_or_404(Habit, id=habit_id, user=request.user)
    today = timezone.localdate()
    log, _ = HabitLog.objects.get_or_create(habit=habit, date=today)
    log.checked_in = not log.checked_in
    log.save()
    habit.recompute_streaks()

    return JsonResponse({
        'habit_id': habit.id,
        'checked_in_today': log.checked_in,
        'current_streak': habit.current_streak,
        'longest_streak': habit.longest_streak,
        'day_status': _day_status(request.user, today),
    })


@login_required
@require_POST
def habit_create_or_update(request):
    """POST /api/habits/save/ — body: {id?, name, icon, frequency, tags}"""
    try:
        payload = json.loads(request.body)
    except json.JSONDecodeError:
        return HttpResponseBadRequest('Invalid JSON')

    name = (payload.get('name') or '').strip()
    if not name:
        return JsonResponse({'error': 'Name is required'}, status=400)

    habit_id = payload.get('id')
    if habit_id:
        habit = get_object_or_404(Habit, id=habit_id, user=request.user)
    else:
        habit = Habit(user=request.user)

    habit.name = name
    habit.icon = payload.get('icon', habit.icon)
    habit.frequency = payload.get('frequency', habit.frequency or 'daily')
    habit.tags = payload.get('tags', habit.tags)
    habit.save()

    return JsonResponse({'habit': _serialize_habit(habit)})


@login_required
@require_POST
def habit_delete(request, habit_id):
    """POST /api/habits/delete/<id>/"""
    habit = get_object_or_404(Habit, id=habit_id, user=request.user)
    habit.delete()
    return JsonResponse({'deleted': habit_id})


@login_required
@require_POST
def update_account(request):
    """POST /api/account/update/ — body: {name, gender}"""
    try:
        payload = json.loads(request.body)
    except json.JSONDecodeError:
        return HttpResponseBadRequest('Invalid JSON')

    user = request.user
    profile = _get_or_create_profile(user)

    full_name = (payload.get('name') or '').strip()
    if full_name:
        parts = full_name.split(' ', 1)
        user.first_name = parts[0]
        user.last_name = parts[1] if len(parts) > 1 else ''
        user.save(update_fields=['first_name', 'last_name'])

    gender = payload.get('gender')
    if gender in ('male', 'female', ''):
        profile.gender = gender
        profile.save(update_fields=['gender'])

    return JsonResponse({'name': user.get_full_name() or user.username, 'gender': profile.gender})


@login_required
@require_GET
def list_chats(request):
    """GET /api/chats/ — chat sessions for the sidebar History list."""
    sessions = ChatSession.objects.filter(user=request.user)
    return JsonResponse({
        'chats': [{'id': s.id, 'title': s.title or f'Chat #{s.id}'} for s in sessions]
    })


@login_required
@require_GET
def chat_detail(request, chat_id):
    """GET /api/chats/<id>/ — full message history for one session."""
    session = get_object_or_404(ChatSession, id=chat_id, user=request.user)
    return JsonResponse({
        'id': session.id,
        'title': session.title,
        'messages': [{'sender': m.sender, 'text': m.text} for m in session.messages.all()],
    })


@login_required
@require_POST
def chatbot_message(request):
    """POST /api/chat/ — body: {message, chat_id?}
    Creates (or reuses) a ChatSession, stores the user's message, generates
    a reply, stores that too, and returns both plus the session id/title.
    Replace the placeholder reply below with a real AI call when ready."""
    try:
        payload = json.loads(request.body)
    except json.JSONDecodeError:
        return HttpResponseBadRequest('Invalid JSON')

    message = (payload.get('message') or '').strip()
    if not message:
        return HttpResponseBadRequest('Empty message')

    chat_id = payload.get('chat_id')
    if chat_id:
        session = get_object_or_404(ChatSession, id=chat_id, user=request.user)
    else:
        session = ChatSession.objects.create(user=request.user, title=message[:40])

    ChatMessage.objects.create(session=session, sender='user', text=message)

    reply = "Got it! (This is a placeholder response — AI backend not connected yet.)"
    ChatMessage.objects.create(session=session, sender='bot', text=reply)

    return JsonResponse({'chat_id': session.id, 'title': session.title, 'reply': reply})