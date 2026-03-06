"""URL-маршруты приложения tasks."""

from django.urls import path

from .views import (
    MyTasksView,
    TaskDetailView,
    TaskHistoryView,
    TaskTransitionView,
)

app_name = 'tasks'

urlpatterns = [
    path('<int:pk>/', TaskDetailView.as_view(), name='detail'),
    path('<int:pk>/transition/', TaskTransitionView.as_view(), name='transition'),
    path('<int:pk>/history/', TaskHistoryView.as_view(), name='history'),
]
