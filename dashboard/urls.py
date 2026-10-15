from django.urls import path, re_path

from . import views

app_name = 'dashboard'

urlpatterns = [
    path('', views.index, name='index'),
    re_path(r'^(?P<path>.*)$', views.index, name='index_catchall'),
]

