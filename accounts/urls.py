from django.urls import path

from . import views

app_name = 'accounts'

urlpatterns = [
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('register/', views.register_view, name='register'),
    path('confirm-email/<uuid:token>/', views.confirm_email_view, name='confirm_email'),
    path('manage/', views.manage_users, name='manage_users'),
]

