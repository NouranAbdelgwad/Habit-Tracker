from django.shortcuts import render

# Create your views here.
def dashboard(request):
    return render(request, 'habits/dashboard.html')

def index(request):
    return render(request, 'habits/index.html')

from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from .forms import SignupForm


def signup_view(request):
    if request.method == 'POST':
        form = SignupForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            return redirect('dashboard')  # change to wherever post-signup should land
        return render(request, 'habits/signup.html', {'form': form})
    form = SignupForm()
    return render(request, 'habits/signup.html', {'form': form})


def login_view(request):
    error = None
    if request.method == 'POST':
        identifier = request.POST.get('email', '').strip()
        password = request.POST.get('password', '')

        # allow login by email OR username
        username = identifier
        if '@' in identifier:
            try:
                username = User.objects.get(email=identifier).username
            except User.DoesNotExist:
                username = None

        user = authenticate(request, username=username, password=password) if username else None
        if user is not None:
            login(request, user)
            return redirect('dashboard')
        error = "Email or Password are wrong"

    return render(request, 'habits/login.html', {'error': error})


def logout_view(request):
    logout(request)
    return redirect('login')