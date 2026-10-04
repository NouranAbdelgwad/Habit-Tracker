"""Run:  python check_env.py   -- tells you exactly which setting is wrong."""
import os, sys, smtplib
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
from django.conf import settings  # noqa: E402  (loads .env)

print('.env path :', settings.BASE_DIR / '.env', '| exists:', (settings.BASE_DIR / '.env').exists())

key = os.environ.get('GOOGLE_API_KEY') or os.environ.get('GEMINI_API_KEY') or ''
print('Gemini key:', (key[:6] + '...' + key[-4:]) if key else 'MISSING', '| model:', os.environ.get('GEMINI_MODEL', '(default)'))
if key and not key.startswith('AIza'):
    print('  ! Real Google keys start with "AIza" -- this one looks wrong.')

print('Email user:', settings.EMAIL_HOST_USER or 'MISSING (emails go to terminal)')
if settings.EMAIL_HOST_USER and settings.EMAIL_HOST_PASSWORD:
    try:
        c = smtplib.SMTP(settings.EMAIL_HOST, settings.EMAIL_PORT, timeout=15)
        c.starttls(); c.login(settings.EMAIL_HOST_USER, settings.EMAIL_HOST_PASSWORD); c.quit()
        print('  SMTP login: OK')
    except Exception as e:
        print('  SMTP login FAILED:', e)
