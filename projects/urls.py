"""URL-маршруты приложения projects."""

from django.urls import path

from .views import (
    ProjectCatalogView,
    ProjectDetailView,
    ProjectHistoryView,
    ProjectJoinRequestListCreateView,
    ProjectJoinRequestReviewView,
    ProjectListCreateView,
    ProjectMemberDeleteView,
    ProjectMemberView,
)

app_name = 'projects'

urlpatterns = [
    path('', ProjectListCreateView.as_view(), name='list-create'),
    path('catalog/', ProjectCatalogView.as_view(), name='catalog'),
    path('<int:pk>/', ProjectDetailView.as_view(), name='detail'),
    path('<int:pk>/members/', ProjectMemberView.as_view(), name='members'),
    path('<int:pk>/members/<int:user_id>/', ProjectMemberDeleteView.as_view(), name='member-delete'),
    path('<int:pk>/history/', ProjectHistoryView.as_view(), name='history'),
    path(
        '<int:pk>/join-requests/',
        ProjectJoinRequestListCreateView.as_view(),
        name='join-requests',
    ),
    path(
        '<int:pk>/join-requests/<int:req_id>/',
        ProjectJoinRequestReviewView.as_view(),
        name='join-request-review',
    ),
]
