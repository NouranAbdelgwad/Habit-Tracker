from django.db import models
from django.contrib.auth.models import User

class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    gender = models.CharField(max_length=10, blank=True, choices=[('male', 'Male'), ('female', 'Female')])
    age = models.IntegerField(null=True, blank=True)
    country = models.CharField(max_length=50, blank=True)
    profile_picture = models.ImageField(upload_to='profile_pictures/', null=True, blank=True)
    bio = models.TextField(blank=True)

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
    tags = models.CharField(max_length=100, blank=True)  # Comma-separated tags
    current_streak = models.IntegerField(default=0)
    longest_streak = models.IntegerField(default=0)
    frequency = models.CharField(max_length=10, choices=FREQUENCY_CHOICES, default='daily')
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.name


class HabitLog(models.Model):
    habit = models.ForeignKey(Habit, on_delete=models.CASCADE, related_name='logs')
    checked_in = models.BooleanField(default=False)
    note = models.CharField(max_length=200, blank=True)

    class Meta:
        unique_together = ('habit', 'date')  # one log per habit per day

    def __str__(self):
        return f"{self.habit.name} - {self.date}"