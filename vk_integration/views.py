"""Представления (views) приложения vk_integration."""

import urllib.parse

import requests as http_requests
from django.conf import settings
from django.shortcuts import redirect
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import VKPublication, VKToken
from .serializers import (
    VKPublicationSerializer,
    VKPublishSerializer,
    VKTokenResponseSerializer,
    VKTokenSerializer,
)
from .services import delete_vk_token, get_publications, publish_to_vk, save_vk_token


class VKTokenView(APIView):
    """Сохранение / удаление VK-токена.

    Ручной ввод токена — fallback для разработки.
    В продакшене использовать OAuth через /api/v1/vk/auth/ и /callback/
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request: Request) -> Response:
        """Сохранить VK-токен."""
        serializer = VKTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = save_vk_token(request.user, serializer.validated_data['access_token'])
        return Response(VKTokenResponseSerializer(token).data, status=status.HTTP_201_CREATED)

    def delete(self, request: Request) -> Response:
        """Удалить VK-токен."""
        delete_vk_token(request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class VKAuthView(APIView):
    """Генерация URL для авторизации через VK OAuth."""

    permission_classes = (IsAuthenticated,)

    def get(self, request: Request) -> Response:
        """Сформировать URL для OAuth-авторизации в VK."""
        params = {
            'client_id': settings.VK_APP_ID,
            'redirect_uri': settings.VK_REDIRECT_URI,
            'scope': 'wall,docs,photos',
            'response_type': 'code',
            'state': str(request.user.id),
            'v': settings.VK_API_VERSION,
        }
        base = 'https://oauth.vk.com/authorize'
        url = f'{base}?{urllib.parse.urlencode(params)}'
        return Response({'auth_url': url})


class VKCallbackView(APIView):
    """Обработка callback от VK OAuth — обмен code на token."""

    # Публичный — VK редиректит сюда
    permission_classes = (AllowAny,)

    def get(self, request: Request) -> Response:
        code = request.GET.get('code')
        error = request.GET.get('error')
        state = request.GET.get('state')
        frontend = getattr(
            settings, 'FRONTEND_URL', 'http://localhost:5173',
        )

        if error:
            return redirect(
                f'{frontend}/vk?status=error'
                f'&message={error}',
            )

        if not code:
            return redirect(
                f'{frontend}/vk?status=error'
                '&message=no_code',
            )

        # Обмен code на access_token
        try:
            resp = http_requests.get(
                'https://oauth.vk.com/access_token',
                params={
                    'client_id': settings.VK_APP_ID,
                    'client_secret': settings.VK_APP_SECRET,
                    'redirect_uri': settings.VK_REDIRECT_URI,
                    'code': code,
                },
                timeout=10,
            )
            data = resp.json()
        except http_requests.RequestException:
            return redirect(
                f'{frontend}/vk?status=error'
                '&message=network_error',
            )

        if 'error' in data:
            msg = data.get('error_description', 'denied')
            return redirect(
                f'{frontend}/vk?status=error'
                f'&message={msg}',
            )

        # Привязка к пользователю через state
        from django.contrib.auth import get_user_model
        User = get_user_model()
        try:
            user = User.objects.get(pk=int(state))
        except (User.DoesNotExist, TypeError, ValueError):
            return redirect(
                f'{frontend}/vk?status=error'
                '&message=invalid_state',
            )

        VKToken.objects.update_or_create(
            user=user,
            defaults={
                'access_token': data['access_token'],
                'vk_user_id': data.get('user_id'),
            },
        )
        return redirect(f'{frontend}/vk?status=success')


class VKPublishView(APIView):
    """Публикация поста в VK."""

    permission_classes = (IsAuthenticated,)

    def post(self, request: Request) -> Response:
        """Опубликовать пост в VK."""
        # Проверяем наличие VK-токена
        try:
            vk_token = VKToken.objects.get(user=request.user)
        except VKToken.DoesNotExist:
            return Response(
                {'error': 'Необходима авторизация через ВКонтакте'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Валидация текста публикации
        text = request.data.get('text', '')
        if not text:
            return Response(
                {'error': 'Текст публикации не может быть пустым'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(text) > 4096:
            return Response(
                {'error': 'Текст публикации превышает 4096 символов'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = VKPublishSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        publication = publish_to_vk(request.user, serializer.validated_data)
        return Response(VKPublicationSerializer(publication).data)


class VKPublicationListView(APIView):
    """История публикаций."""

    permission_classes = (IsAuthenticated,)

    def get(self, request: Request) -> Response:
        """Список публикаций пользователя с фильтрацией по проекту."""
        project_id = request.query_params.get('project_id') or request.query_params.get('project')
        publications = get_publications(request.user, project_id)
        serializer = VKPublicationSerializer(publications, many=True)
        return Response(serializer.data)


class VKPublicationDetailView(APIView):
    """Детали публикации."""

    permission_classes = (IsAuthenticated,)

    def get(self, request: Request, pk: int) -> Response:
        """Детали конкретной публикации (только автор)."""
        try:
            publication = VKPublication.objects.select_related('author', 'project').get(pk=pk)
        except VKPublication.DoesNotExist:
            return Response({'detail': 'Публикация не найдена.'}, status=status.HTTP_404_NOT_FOUND)

        if publication.author != request.user:
            return Response(
                {'detail': 'Вы не являетесь автором этой публикации.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        return Response(VKPublicationSerializer(publication).data)
