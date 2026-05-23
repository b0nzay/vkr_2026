from django.urls import path

from catalog.views import client_index

app_name = 'orders'

urlpatterns = [
    path('my/', client_index, name='order_list'),
    path('<int:pk>/', client_index, name='order_detail'),
    path('', client_index),
]
