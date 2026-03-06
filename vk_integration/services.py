"""Сервисный слой приложения vk_integration."""

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.exceptions import ValidationError

import requests as http_requests

from .models import VKPublication, VKToken

User = get_user_model()

VK_API_URL = 'https://api.vk.com/method'
VK_API_VERSION = '5.131'


def save_vk_token(user: User, access_token: str) -> VKToken:
    """Сохранение или обновление VK-токена пользователя."""
    token, _created = VKToken.objects.update_or_create(
        user=user,
        defaults={'access_token': access_token},
    )
    return token


def delete_vk_token(user: User) -> None:
    """Удаление VK-токена пользователя."""
    try:
        token = VKToken.objects.get(user=user)
        token.delete()
    except VKToken.DoesNotExist:
        raise ValidationError({'detail': 'VK-токен не найден.'})


def publish_to_vk(user: User, data: dict) -> VKPublication:
    """Публикация поста в VK через VK API wall.post."""
    # Получаем токен пользователя
    try:
        vk_token = VKToken.objects.get(user=user)
    except VKToken.DoesNotExist:
        raise ValidationError({'detail': 'VK-токен не найден. Сначала сохраните токен.'})

    # Создаём запись публикации
    publication = VKPublication.objects.create(
        project_id=data['project'],
        author=user,
        title=data['title'],
        content=data['content'],
        owner_id=data['owner_id'],
        status='draft',
    )

    # Отправляем запрос к VK API
    try:
        response = http_requests.post(
            f'{VK_API_URL}/wall.post',
            data={
                'owner_id': data['owner_id'],
                'message': f"{data['title']}\n\n{data['content']}",
                'v': VK_API_VERSION,
                'access_token': vk_token.access_token,
            },
            timeout=10,
        )
        result = response.json()
    except http_requests.RequestException as e:
        publication.status = 'failed'
        publication.error_message = f'Ошибка сети: {e}'
        publication.save()
        return publication

    # Обрабатываем ответ VK API
    if 'error' in result:
        publication.status = 'failed'
        publication.error_message = result['error'].get('error_msg', 'Неизвестная ошибка VK API')
        publication.save()
    else:
        publication.status = 'published'
        publication.vk_post_id = result.get('response', {}).get('post_id')
        publication.published_at = timezone.now()
        publication.save()

    return publication


def get_publications(user: User, project_id: int | None = None):
    """История публикаций пользователя с фильтрацией по проекту."""
    qs = VKPublication.objects.filter(author=user).select_related('project', 'author')
    if project_id:
        qs = qs.filter(project_id=project_id)
    return qs
