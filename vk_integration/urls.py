"""URL-маршруты приложения vk_integration."""

from django.urls import path

from .views import (
    VKAuthView,
    VKCallbackView,
    VKPublicationDetailView,
    VKPublicationListView,
    VKPublishView,
    VKTokenView,
)

app_name = 'vk_integration'

urlpatterns = [
    path('auth/', VKAuthView.as_view(), name='auth'),
    path('callback/', VKCallbackView.as_view(), name='callback'),
    path('token/', VKTokenView.as_view(), name='token'),
    path('publish/', VKPublishView.as_view(), name='publish'),
    path('history/', VKPublicationListView.as_view(), name='history'),
    path('publications/', VKPublicationListView.as_view(), name='publications'),
    path('publications/<int:pk>/', VKPublicationDetailView.as_view(), name='publication-detail'),
]
