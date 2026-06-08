"""URL-маршруты приложения projects."""

from django.urls import path

from .views import (
    InvitationAcceptView,
    InvitationDeclineView,
    ProjectCatalogView,
    ProjectDetailView,
    ProjectHistoryView,
    ProjectInviteView,
    ProjectJoinRequestListCreateView,
    ProjectJoinRequestReviewView,
    ProjectListCreateView,
    ProjectMemberDeleteView,
    ProjectMemberView,
    ProjectMyTasksView,
    ProjectStatsView,
)

app_name = 'projects'

urlpatterns = [
    path('', ProjectListCreateView.as_view(), name='list-create'),
    path('catalog/', ProjectCatalogView.as_view(), name='catalog'),
    path('<int:pk>/', ProjectDetailView.as_view(), name='detail'),
    path('<int:pk>/members/', ProjectMemberView.as_view(), name='members'),
    path('<int:pk>/members/<int:user_id>/', ProjectMemberDeleteView.as_view(), name='member-delete'),
    path('<int:pk>/history/', ProjectHistoryView.as_view(), name='history'),
    path('<int:pk>/stats/', ProjectStatsView.as_view(), name='stats'),
    path('<int:pk>/invite/', ProjectInviteView.as_view(), name='invite'),
    path('<int:project_id>/my-tasks/', ProjectMyTasksView.as_view(), name='my-tasks'),
    path('invitations/<int:invitation_id>/accept/', InvitationAcceptView.as_view(), name='invitation-accept'),
    path('invitations/<int:invitation_id>/decline/', InvitationDeclineView.as_view(), name='invitation-decline'),
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