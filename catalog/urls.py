from django.urls import path

from . import views

app_name = 'catalog'

urlpatterns = [
    path('shop/', views.shop_legacy_redirect_root),
    path('shop/<path:subpath>', views.shop_legacy_redirect_nested),
    path('catalog/', views.client_index, name='storefront_catalog'),
    path('cart/', views.client_index, name='storefront_cart'),
    path('checkout/', views.client_index, name='storefront_checkout'),
    path('favorites/', views.client_index, name='storefront_favorites'),
    path('profile/', views.client_index, name='storefront_profile'),
    path('', views.client_index, name='home'),
]
