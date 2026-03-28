"""URL-маршруты приложения users."""

from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from projects.views import MyJoinRequestCancelView, MyJoinRequestsView

from .views import LoginView, LogoutView, MeView, RegisterView

app_name = 'users'

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('me/', MeView.as_view(), name='me'),
    path(
        'me/join-requests/',
        MyJoinRequestsView.as_view(),
        name='my-join-requests',
    ),
    path(
        'me/join-requests/<int:req_id>/',
        MyJoinRequestCancelView.as_view(),
        name='my-join-request-cancel',
    ),
]
