"""URL-маршруты приложения publications."""

from django.urls import path

from .views import (
    ExtractMetadataView,
    PublicationDetailView,
    PublicationListCreateView,
)

app_name = 'publications'

urlpatterns = [
    path(
        'extract/',
        ExtractMetadataView.as_view(),
        name='extract-metadata',
    ),
    path(
        '',
        PublicationListCreateView.as_view(),
        name='publication-list',
    ),
    path(
        '<int:pk>/',
        PublicationDetailView.as_view(),
        name='publication-detail',
    ),
]
