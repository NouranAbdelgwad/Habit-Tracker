from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


class UserProfile(models.Model):
    # Preset avatar icons bundled with the app (Settings → Account). Keep
    # this list in sync with the files in
    # habits/static/habits/img/avatars/<key>.png
    AVATAR_ICON_CHOICES = [
        ('avatar-1', 'Avatar 1'),
        ('avatar-2', 'Avatar 2'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE)
    gender = models.CharField(max_length=10, blank=True, choices=[('male', 'Male'), ('female', 'Female')])
    age = models.IntegerField(null=True, blank=True)
    country = models.CharField(max_length=50, blank=True)
    profile_picture = models.ImageField(upload_to='profile_pictures/', null=True, blank=True)
    avatar_icon = models.CharField(max_length=30, blank=True, choices=AVATAR_ICON_CHOICES)
    bio = models.TextField(blank=True)
    onboarded = models.BooleanField(default=False)
    # True once the user proved they own the email (clicked the link we sent).
    email_verified = models.BooleanField(default=False)

    def __str__(self):
        return self.user.username


class Habit(models.Model):
    FREQUENCY_CHOICES = [
        ('daily', 'Daily'),
        ('weekly', 'Weekly'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='habits')
    name = models.CharField(max_length=100)
    icon = models.CharField(max_length=50, blank=True)
    reminder_time = models.TimeField(null=True, blank=True)
    tracking_days = models.IntegerField(default=0)
    tags = models.CharField(max_length=100, blank=True)  # comma-separated tags
    current_streak = models.IntegerField(default=0)
    longest_streak = models.IntegerField(default=0)
    frequency = models.CharField(max_length=10, choices=FREQUENCY_CHOICES, default='daily')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return self.name

    def is_checked_in_on(self, day):
        return self.logs.filter(date=day, checked_in=True).exists()

    def is_checked_in_today(self):
        return self.is_checked_in_on(timezone.localdate())

    def recompute_streaks(self):
        """Recalculate current_streak / longest_streak from HabitLog history.
        Call this after any HabitLog is created/updated/deleted for this habit."""
        checked_dates = list(
            self.logs.filter(checked_in=True).order_by('-date').values_list('date', flat=True)
        )

        # --- current streak (must include today or yesterday to still be "alive") ---
        if not checked_dates:
            current = 0
        else:
            today = timezone.localdate()
            if (today - checked_dates[0]).days > 1:
                current = 0
            else:
                current = 1
                for i in range(1, len(checked_dates)):
                    if (checked_dates[i - 1] - checked_dates[i]).days == 1:
                        current += 1
                    else:
                        break

        # --- longest streak ever (scan ascending) ---
        ascending = sorted(checked_dates)
        longest = running = 0
        prev = None
        for d in ascending:
            running = running + 1 if prev and (d - prev).days == 1 else 1
            longest = max(longest, running)
            prev = d

        self.current_streak = current
        self.longest_streak = max(self.longest_streak, longest)
        self.save(update_fields=['current_streak', 'longest_streak'])


class HabitLog(models.Model):
    habit = models.ForeignKey(Habit, on_delete=models.CASCADE, related_name='logs')
    date = models.DateField(default=timezone.localdate)
    checked_in = models.BooleanField(default=False)
    note = models.CharField(max_length=200, blank=True)

    class Meta:
        unique_together = ('habit', 'date')  # one log per habit per day
        ordering = ['-date']

    def __str__(self):
        return f"{self.habit.name} - {self.date}"

class ChatSession(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='chat_sessions')
    title = models.CharField(max_length=60, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title or f"Chat #{self.pk}"


class ChatMessage(models.Model):
    SENDER_CHOICES = [('user', 'User'), ('bot', 'Bot')]

    session = models.ForeignKey(ChatSession, on_delete=models.CASCADE, related_name='messages')
    sender = models.CharField(max_length=4, choices=SENDER_CHOICES)
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.sender}: {self.text[:30]}"
