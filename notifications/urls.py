from django.urls import path
from .views import NotificationListView, NotificationReadView, NotificationReadAllView

app_name = 'notifications'

urlpatterns = [
    path('', NotificationListView.as_view(), name='list'),
    path('read-all/', NotificationReadAllView.as_view(), name='read-all'),
    path('<int:pk>/read/', NotificationReadView.as_view(), name='read'),
]
