"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.1/topics/http/urls/
"""
from django.contrib import admin
from django.urls import path

from habits import views

urlpatterns = [
    path('admin/', admin.site.urls),

    # Pages
    path('', views.index, name='index'),
    path('login/', views.login_view, name='login'),
    path('signup/', views.signup_view, name='signup'),
    path('logout/', views.logout_view, name='logout'),
    path('choose-habit/', views.choose_habit_view, name='choose-habit'),
    path('dashboard/', views.dashboard, name='dashboard'),

    # AJAX / JSON endpoints
    path('api/period-data/', views.get_period_data, name='period_data'),
    path('api/habits/toggle/<int:habit_id>/', views.toggle_habit_checkin, name='toggle_habit'),
    path('api/habits/save/', views.habit_create_or_update, name='habit_save'),
    path('api/habits/delete/<int:habit_id>/', views.habit_delete, name='habit_delete'),
    path('api/account/update/', views.update_account, name='account_update'),
    path('api/onboarding/complete/', views.onboarding_complete, name='onboarding_complete'),
    path('api/chats/', views.list_chats, name='chat_list'),
    path('api/chats/<int:chat_id>/', views.chat_detail, name='chat_detail'),
    path('api/chat/', views.chatbot_message, name='chat_message'),
]
