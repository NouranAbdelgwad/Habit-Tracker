from django.shortcuts import render

# Create your views here.
def dashboard(request):
    return render(request, 'habits/dashboard.html')

def index(request):
    return render(request, 'habits/index.html')

def login_view(request):
    return render(request, 'habits/login.html')

def signup_view(request):
    return render(request, 'habits/signup.html')

def choose_habit_view(request):
    return render(request, 'habits/choose-habit.html')