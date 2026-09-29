import json
import logging
from datetime import timedelta, date as date_cls

from django.conf import settings
from django.templatetags.static import static as static_url
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.http import JsonResponse, HttpResponseBadRequest
from django.shortcuts import redirect, render, get_object_or_404
from django.urls import reverse
from django.utils import timezone
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.views.decorators.http import require_POST, require_GET

from .forms import SignupForm
from .models import ChatMessage, ChatSession, Habit, HabitLog, UserProfile


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_or_create_profile(user):
    profile, _ = UserProfile.objects.get_or_create(user=user)
    return profile


def _send_email(user, subject, body):
    """Sends an email to the user. Failures (bad SMTP settings, no network)
    are logged to the terminal instead of crashing the page."""
    try:
        send_mail(subject, body, None, [user.email], fail_silently=False)
        return True
    except Exception:
        logging.getLogger(__name__).exception('Could not send email to %s', user.email)
        return False


def _send_verification_email(request, user):
    uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    link = request.build_absolute_uri(
        reverse('verify_email', kwargs={'uidb64': uidb64, 'token': token})
    )
    return _send_email(
        user,
        'Confirm your Habit Tracker email',
        f"Hi {user.get_full_name() or user.username},\n\n"
        "Welcome to Habit Tracker! Confirm your email address to activate "
        f"your account:\n\n{link}\n\n"
        "If you didn't create this account, you can ignore this email.",
    )


def _serialize_account(user, profile):
    """Full set of fields shown in Settings → Account (name, gender, age,
    country, bio, profile photo). photo_url prefers an uploaded photo;
    if there isn't one but the user picked a preset avatar icon, that
    icon's static URL is used instead; otherwise it's null and the UI
    falls back to showing the user's initial."""
    if profile.profile_picture:
        photo_url = profile.profile_picture.url
    elif profile.avatar_icon:
        photo_url = static_url(f'habits/img/avatars/{profile.avatar_icon}.png')
    else:
        photo_url = None

    return {
        'name': user.get_full_name() or user.username,
        'email': user.email,
        'initial': (user.get_full_name() or user.username)[:1].upper(),
        'gender': profile.gender,
        'age': profile.age,
        'country': profile.country,
        'bio': profile.bio,
        'avatar_icon': profile.avatar_icon,
        'photo_url': photo_url,
    }


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
            user = form.save(commit=False)
            user.email = form.cleaned_data['email']
            user.save()
            profile = _get_or_create_profile(user)
            profile.email_verified = False
            profile.save(update_fields=['email_verified'])
            _send_verification_email(request, user)
            return render(request, 'habits/verify-email.html', {'state': 'sent', 'email': user.email})
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
        # Both lookups ignore letter case (Osama == osama); signup already
        # forbids two usernames that differ only by case.
        if '@' in identifier:
            match = User.objects.filter(email__iexact=identifier).first()
        else:
            match = (User.objects.filter(username=identifier).first()
                     or User.objects.filter(username__iexact=identifier).first())
        username = match.username if match else None

        user = authenticate(request, username=username, password=password) if username else None
        if user is not None:
            profile = _get_or_create_profile(user)
            if not profile.email_verified:
                return render(request, 'habits/login.html', {
                    'error': 'Please confirm your email first. Check your inbox',
                    'unverified_email': user.email,
                })
            login(request, user)
            return redirect('dashboard' if profile.onboarded else 'choose-habit')
        error = "Email or Password are wrong"

    return render(request, 'habits/login.html', {
        'error': error,
        'notice': 'Email confirmed! You can log in now.' if request.GET.get('verified') else None,
    })


def logout_view(request):
    logout(request)
    return redirect('index')


def verify_email_view(request, uidb64, token):
    """Link from the confirmation email: marks the email as verified."""
    try:
        user = User.objects.get(pk=force_str(urlsafe_base64_decode(uidb64)))
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        user = None

    if user is not None and default_token_generator.check_token(user, token):
        profile = _get_or_create_profile(user)
        profile.email_verified = True
        profile.save(update_fields=['email_verified'])
        return redirect(reverse('login') + '?verified=1')
    return render(request, 'habits/verify-email.html', {'state': 'invalid'})


def resend_verification_view(request):
    """POST: re-sends the confirmation email (same reply whether or not the
    address exists, so it can't be used to discover registered emails)."""
    email = (request.POST.get('email') or '').strip()
    if request.method == 'POST' and email:
        user = User.objects.filter(email__iexact=email).first()
        if user is not None and not _get_or_create_profile(user).email_verified:
            _send_verification_email(request, user)
    return render(request, 'habits/verify-email.html', {'state': 'sent', 'email': email})


def forgot_password_view(request):
    """GET: shows the 'enter your email' form.
    POST: if that email belongs to an account, emails a one-time reset
    link (valid once, expires after Django's default password-reset
    timeout). Always shows the same confirmation either way, so the page
    never reveals whether a given email is registered."""
    if request.user.is_authenticated:
        return redirect('dashboard')

    sent = False
    if request.method == 'POST':
        email = (request.POST.get('email') or '').strip()
        user = User.objects.filter(email__iexact=email).first() if email else None
        if user is not None:
            uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            reset_link = request.build_absolute_uri(
                reverse('reset_password', kwargs={'uidb64': uidb64, 'token': token})
            )
            _send_email(
                user,
                'Reset your Habit Tracker password',
                f"Hi {user.get_full_name() or user.username},\n\n"
                "Click the link below to choose a new password. It works once "
                "and expires soon:\n\n"
                f"{reset_link}\n\n"
                "If you didn't request this, you can safely ignore this email.",
            )
        sent = True

    return render(request, 'habits/forgot-password.html', {'sent': sent})


def reset_password_view(request, uidb64, token):
    """The link from the reset email lands here. Validates the uid/token
    pair (same mechanism Django's own password-reset uses), then lets the
    user set a new password."""
    if request.user.is_authenticated:
        return redirect('dashboard')

    try:
        uid = force_str(urlsafe_base64_decode(uidb64))
        user = User.objects.get(pk=uid)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        user = None

    valid_link = user is not None and default_token_generator.check_token(user, token)
    if not valid_link:
        # Shows in the runserver terminal so a bad link can be diagnosed.
        logging.getLogger(__name__).warning(
            'Password reset link rejected: uidb64=%r token=%r (token length %d, user found: %s)',
            uidb64, token, len(token), user is not None,
        )

    error = None
    done = False
    if valid_link and request.method == 'POST':
        password1 = request.POST.get('password1', '')
        password2 = request.POST.get('password2', '')
        if not password1 or password1 != password2:
            error = "Passwords don't match"
        else:
            try:
                validate_password(password1, user=user)
            except ValidationError as exc:
                error = ' '.join(exc.messages)
        if not error:
            user.set_password(password1)
            user.save(update_fields=['password'])
            # Receiving the reset email proves the user owns this address.
            profile = _get_or_create_profile(user)
            if not profile.email_verified:
                profile.email_verified = True
                profile.save(update_fields=['email_verified'])
            done = True

    return render(request, 'habits/reset-password.html', {
        'valid_link': valid_link,
        'error': error,
        'done': done,
    })


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
        'user': _serialize_account(user, profile),
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
    """POST /api/account/update/ — multipart/form-data with any of:
    name, gender, age, country, bio, photo (image file), remove_photo ('1').
    Sent as FormData (not JSON) so it can carry the optional photo file.
    Every field is optional; only the ones present in the request are
    changed, so the Settings form can save just what the user touched."""
    user = request.user
    profile = _get_or_create_profile(user)

    if 'name' in request.POST:
        full_name = (request.POST.get('name') or '').strip()
        if full_name:
            parts = full_name.split(' ', 1)
            user.first_name = parts[0]
            user.last_name = parts[1] if len(parts) > 1 else ''
            user.save(update_fields=['first_name', 'last_name'])

    if 'gender' in request.POST:
        gender = request.POST.get('gender')
        if gender in ('male', 'female', ''):
            profile.gender = gender

    if 'age' in request.POST:
        age_raw = (request.POST.get('age') or '').strip()
        if age_raw == '':
            profile.age = None
        elif age_raw.isdigit() and 0 < int(age_raw) < 130:
            profile.age = int(age_raw)
        else:
            return JsonResponse({'error': 'Age must be a number between 1 and 129'}, status=400)

    if 'country' in request.POST:
        profile.country = (request.POST.get('country') or '').strip()

    if 'bio' in request.POST:
        profile.bio = (request.POST.get('bio') or '').strip()

    if request.POST.get('remove_photo') == '1':
        if profile.profile_picture:
            profile.profile_picture.delete(save=False)
            profile.profile_picture = None
        profile.avatar_icon = ''

    if 'avatar_icon' in request.POST:
        avatar_icon = request.POST.get('avatar_icon')
        valid_icons = {key for key, _ in UserProfile.AVATAR_ICON_CHOICES}
        if avatar_icon == '':
            profile.avatar_icon = ''
        elif avatar_icon in valid_icons:
            profile.avatar_icon = avatar_icon
            # Picking a preset icon replaces any uploaded photo — only one
            # of the two is shown at a time.
            if profile.profile_picture:
                profile.profile_picture.delete(save=False)
                profile.profile_picture = None
        else:
            return JsonResponse({'error': 'Invalid avatar icon'}, status=400)

    photo = request.FILES.get('photo')
    if photo:
        if not (photo.content_type or '').startswith('image/'):
            return JsonResponse({'error': 'Please upload an image file'}, status=400)
        if photo.size > settings.PROFILE_PICTURE_MAX_BYTES:
            return JsonResponse({'error': 'Image is too large (max 5 MB)'}, status=400)
        if profile.profile_picture:
            profile.profile_picture.delete(save=False)
        profile.profile_picture = photo
        # An uploaded photo replaces any preset icon selection.
        profile.avatar_icon = ''

    profile.save()

    return JsonResponse(_serialize_account(user, profile))


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