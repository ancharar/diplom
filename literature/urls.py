"""URL-маршруты приложения literature."""

from django.urls import path

from . import views

urlpatterns = [
    # Литературные источники
    path('sources/', views.SourceListCreateView.as_view(), name='source-list'),
    path('sources/<str:source_id>/', views.SourceDetailView.as_view(), name='source-detail'),
    # Файлы
    path('files/', views.FileListUploadView.as_view(), name='file-list'),
    path('files/<str:file_id>/download/', views.FileDownloadView.as_view(), name='file-download'),
    path('files/<str:file_id>/', views.FileDeleteView.as_view(), name='file-delete'),
]
