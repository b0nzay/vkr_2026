from django.http import HttpResponseForbidden


class DashboardAccessMiddleware:
    """
    Разрешает доступ к /dashboard/* только MANAGER/ADMIN.
    CLIENT и анонимные пользователи получают 403.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path
        if path.startswith('/dashboard'):
            user = request.user
            if not user.is_authenticated or getattr(user, 'is_client', lambda: False)():
                return HttpResponseForbidden('Доступ запрещён')
            if path.startswith('/dashboard/admin') and not getattr(user, 'is_admin', lambda: False)():
                return HttpResponseForbidden('Доступ запрещён')
        return self.get_response(request)

