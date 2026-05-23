from django.contrib import messages
from django.contrib.auth import login, logout
from django.contrib.auth.decorators import permission_required
from django.contrib.auth.forms import AuthenticationForm
from django import forms
from django.http import HttpRequest, HttpResponse
from django.shortcuts import redirect, render
from django.urls import reverse
from django.utils.http import url_has_allowed_host_and_scheme

from .models import User


def _get_safe_next_url(request: HttpRequest, user: User) -> str | None:
    next_url = request.POST.get('next') or request.GET.get('next')
    if not next_url:
        return None

    # Защита от open redirect
    if not url_has_allowed_host_and_scheme(next_url, allowed_hosts={request.get_host()}):
        return None

    # Клиентам нельзя в /dashboard/*
    if user.is_client() and next_url.startswith('/dashboard'):
        return None

    # Менеджеру нельзя в /dashboard/admin*
    if user.is_manager() and next_url.startswith('/dashboard/admin'):
        return None

    return next_url


def _default_redirect_for_role(user: User) -> str:
    if user.is_client():
        return reverse('catalog:storefront_catalog')
    if user.is_admin():
        return '/dashboard/admin'
    if user.is_manager():
        return '/dashboard/manager'
    return reverse('catalog:storefront_catalog')


class ClientAuthenticationForm(AuthenticationForm):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for name, field in self.fields.items():
            if name == 'username' or name == 'password':
                field.widget.attrs.setdefault('class', 'auth-form__input')


def login_view(request: HttpRequest) -> HttpResponse:
    if request.user.is_authenticated:
        return redirect(_default_redirect_for_role(request.user))

    if request.method == 'POST':
        form = ClientAuthenticationForm(request, data=request.POST)
        if form.is_valid():
            user = form.get_user()
            login(request, user)
            next_url = _get_safe_next_url(request, user)
            return redirect(next_url or _default_redirect_for_role(user))
    else:
        form = ClientAuthenticationForm(request)

    return render(request, 'accounts/login.html', {'form': form})


class RegistrationForm(forms.ModelForm):
    first_name = forms.CharField(label='Имя', max_length=150, required=True)
    last_name = forms.CharField(label='Фамилия', max_length=150, required=True)
    email = forms.EmailField(label='Email', required=True)
    phone = forms.CharField(label='Телефон', max_length=32, required=True)
    password1 = forms.CharField(label='Пароль', widget=forms.PasswordInput(), required=True)
    password2 = forms.CharField(label='Подтверждение пароля', widget=forms.PasswordInput(), required=True)

    class Meta:
        model = User
        fields = ('username', 'first_name', 'last_name', 'email', 'phone')

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for _name, field in self.fields.items():
            if field.widget.__class__.__name__ == 'CheckboxInput':
                continue
            field.widget.attrs.setdefault('class', 'auth-form__input')

    def clean(self):
        cleaned_data = super().clean()
        password1 = cleaned_data.get('password1')
        password2 = cleaned_data.get('password2')
        if password1 and password2 and password1 != password2:
            self.add_error('password2', 'Пароли не совпадают.')
        return cleaned_data

    def save(self, commit=True):
        user = super().save(commit=False)
        user.set_password(self.cleaned_data['password1'])
        if commit:
            user.save()
        return user


def register_view(request: HttpRequest) -> HttpResponse:
    if request.user.is_authenticated:
        return redirect(_default_redirect_for_role(request.user))

    if request.method == 'POST':
        form = RegistrationForm(request.POST)
        if form.is_valid():
            user = form.save(commit=False)
            user.role = User.Roles.CLIENT
            user.email_verified = True
            user.email_verification_token = None
            user.save()
            login(request, user)
            return redirect(reverse('catalog:storefront_catalog'))
    else:
        form = RegistrationForm()

    return render(request, 'accounts/register.html', {'form': form})


def confirm_email_view(request: HttpRequest, token: str) -> HttpResponse:
    messages.info(request, 'Подтверждение email отключено в демо-режиме.')
    return redirect(reverse('accounts:login'))


def logout_view(request: HttpRequest) -> HttpResponse:
    logout(request)
    return redirect('catalog:storefront_catalog')


@permission_required('accounts.view_user', raise_exception=True)
def manage_users(request: HttpRequest) -> HttpResponse:
    """
    Пример server-rendered view с проверкой прав для управления пользователями.
    Пока только отображает список пользователей.
    """
    users = User.objects.all().order_by('id')
    return render(request, 'accounts/manage_users.html', {'users': users})
