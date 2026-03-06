"""URL-маршруты приложения projects."""

from django.urls import path

from .views import (
    ProjectDetailView,
    ProjectHistoryView,
    ProjectListCreateView,
    ProjectMemberDeleteView,
    ProjectMemberView,
)

app_name = 'projects'

urlpatterns = [
    path('', ProjectListCreateView.as_view(), name='list-create'),
    path('<int:pk>/', ProjectDetailView.as_view(), name='detail'),
    path('<int:pk>/members/', ProjectMemberView.as_view(), name='members'),
    path('<int:pk>/members/<int:user_id>/', ProjectMemberDeleteView.as_view(), name='member-delete'),
    path('<int:pk>/history/', ProjectHistoryView.as_view(), name='history'),
]
