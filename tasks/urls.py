"""URL-маршруты приложения tasks."""

from django.urls import path

from .views import (
    MyTasksView,
    TaskAssigneeView,
    TaskAttachmentDeleteView,
    TaskAttachmentDownloadView,
    TaskAttachmentListCreateView,
    TaskDetailView,
    TaskHistoryView,
    TaskTransitionView,
)

app_name = 'tasks'

urlpatterns = [
    path('<int:pk>/', TaskDetailView.as_view(), name='detail'),
    path('<int:pk>/status/', TaskTransitionView.as_view(), name='status'),
    path('<int:pk>/history/', TaskHistoryView.as_view(), name='history'),
    path('<int:pk>/assignee/', TaskAssigneeView.as_view(), name='assignee'),
    path(
        '<int:task_id>/attachments/',
        TaskAttachmentListCreateView.as_view(),
        name='attachments',
    ),
    path(
        '<int:task_id>/attachments/<int:att_id>/',
        TaskAttachmentDeleteView.as_view(),
        name='attachment-delete',
    ),
    path(
        '<int:task_id>/attachments/<int:att_id>/download/',
        TaskAttachmentDownloadView.as_view(),
        name='attachment-download',
    ),
]
