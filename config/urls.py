"""Главная URL-конфигурация проекта."""

from django.conf import settings
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
)

from tasks.views import MyTasksView, ProjectTaskListCreateView

urlpatterns = [
    # Админка Django
    path('admin/', admin.site.urls),

    # API v1
    path('api/v1/users/', include('users.urls')),
    path('api/v1/users/me/tasks/', MyTasksView.as_view(), name='my-tasks'),
    path('api/v1/projects/', include('projects.urls')),
    path('api/v1/projects/<int:project_id>/tasks/', ProjectTaskListCreateView.as_view(), name='project-tasks'),
    path('api/v1/tasks/', include('tasks.urls')),
    path('api/v1/projects/<int:project_id>/literature/', include('literature.urls')),
    path('api/v1/reports/', include('reports.urls')),
    path('api/v1/publications/', include('publications.urls')),
    path('api/v1/notifications/', include('notifications.urls')),

    # OpenAPI-схема и Swagger UI
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
]

if settings.DEBUG:
    from django.conf.urls.static import static

    urlpatterns = [
        path('__debug__/', include('debug_toolbar.urls')),
    ] + urlpatterns + static(
        settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT,
    )