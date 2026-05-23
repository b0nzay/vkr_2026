from django.shortcuts import render
from django.views.decorators.csrf import ensure_csrf_cookie


@ensure_csrf_cookie
def index(request, path=''):
    """
    Отдаёт один и тот же шаблон для всех /dashboard/*,
    сам React SPA дальше занимается роутингом.
    """
    return render(request, 'dashboard/index.html')
