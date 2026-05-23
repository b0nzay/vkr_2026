from django.shortcuts import redirect, render
from django.views.decorators.csrf import ensure_csrf_cookie


def _shop_legacy_url(request, subpath):
    subpath = (subpath or '').strip('/')
    head = subpath.split('/')[0].lower() if subpath else ''
    qs = request.GET.urlencode()
    suffix = f'?{qs}' if qs else ''

    def target(path_prefix):
        return f'{path_prefix}/{suffix}' if suffix else f'{path_prefix}/'

    if head in ('', 'catalog'):
        return target('/catalog')
    if head == 'cart':
        return target('/cart')
    if head == 'checkout':
        return target('/checkout')
    if head in ('favorites', 'favorite'):
        return target('/favorites')
    return target('/catalog')


def shop_legacy_redirect_root(request):
    return redirect(_shop_legacy_url(request, ''), permanent=True)


def shop_legacy_redirect_nested(request, subpath):
    return redirect(_shop_legacy_url(request, subpath), permanent=True)


@ensure_csrf_cookie
def client_index(request):
    return render(request, 'catalog/client_index.html')
