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


def _upload_photo_to_vk(token, owner_id, file):
    """Загрузить фото на стену VK. Возвращает строку вложения."""
    # 1. Получить URL для загрузки
    resp = http_requests.get(
        f'{VK_API_URL}/photos.getWallUploadServer',
        params={
            'access_token': token, 'v': VK_API_VERSION,
        },
        timeout=15,
    )
    resp_data = resp.json().get('response', {})
    upload_url = resp_data.get('upload_url')
    if not upload_url:
        return '', ''

    # 2. Загрузить файл
    upload_resp = http_requests.post(
        upload_url,
        files={'photo': (file.name, file, 'image/jpeg')},
        timeout=30,
    )
    upload_data = upload_resp.json()

    # 3. Сохранить фото
    save_resp = http_requests.post(
        f'{VK_API_URL}/photos.saveWallPhoto',
        data={
            'server': upload_data.get('server'),
            'photo': upload_data.get('photo'),
            'hash': upload_data.get('hash'),
            'access_token': token,
            'v': VK_API_VERSION,
        },
        timeout=15,
    )
    photos = save_resp.json().get('response', [])
    if photos:
        p = photos[0]
        att_str = f"photo{p['owner_id']}_{p['id']}"
        return att_str, att_str
    return '', ''


def _upload_doc_to_vk(token, owner_id, file):
    """Загрузить документ на стену VK. Возвращает строку вложения."""
    resp = http_requests.get(
        f'{VK_API_URL}/docs.getWallUploadServer',
        params={
            'access_token': token, 'v': VK_API_VERSION,
        },
        timeout=15,
    )
    resp_data = resp.json().get('response', {})
    upload_url = resp_data.get('upload_url')
    if not upload_url:
        return '', ''

    upload_resp = http_requests.post(
        upload_url,
        files={'file': (file.name, file)},
        timeout=30,
    )
    upload_data = upload_resp.json()

    save_resp = http_requests.post(
        f'{VK_API_URL}/docs.save',
        data={
            'file': upload_data.get('file'),
            'access_token': token,
            'v': VK_API_VERSION,
        },
        timeout=15,
    )
    save_result = save_resp.json()
    doc_data = save_result.get('response', {})
    doc = doc_data.get('doc', doc_data)
    if doc.get('id'):
        att_str = f"doc{doc['owner_id']}_{doc['id']}"
        return att_str, att_str
    return '', ''


def publish_to_vk(user: User, data: dict) -> VKPublication:
    """Публикация поста в VK с опциональным вложением."""
    try:
        vk_token = VKToken.objects.get(user=user)
    except VKToken.DoesNotExist:
        raise ValidationError(
            {'error': 'Необходима авторизация через ВКонтакте'},
        )

    text = data['text']
    attachment_type = data.get('attachment_type', 'none')
    file = data.get('file')

    publication = VKPublication.objects.create(
        project_id=data['project_id'],
        author=user,
        title=text[:255],
        content=text,
        owner_id=data['owner_id'],
        attachment_type=attachment_type,
        status='draft',
    )

    if file:
        publication.attachment_file = file
        publication.save()

    # Загрузка вложения в VK
    attachments = ''
    vk_att_id = ''
    token = vk_token.access_token
    owner_id = data['owner_id']

    try:
        if attachment_type == 'photo' and file:
            attachments, vk_att_id = _upload_photo_to_vk(
                token, owner_id, file,
            )
        elif attachment_type == 'doc' and file:
            attachments, vk_att_id = _upload_doc_to_vk(
                token, owner_id, file,
            )
    except http_requests.RequestException as e:
        publication.status = 'failed'
        publication.error_message = f'Ошибка загрузки вложения: {e}'
        publication.save()
        return publication

    if vk_att_id:
        publication.vk_attachment_id = vk_att_id
        publication.save()

    # Публикация поста
    try:
        response = http_requests.post(
            f'{VK_API_URL}/wall.post',
            data={
                'owner_id': owner_id,
                'message': text,
                'attachments': attachments,
                'v': VK_API_VERSION,
                'access_token': token,
            },
            timeout=15,
        )
        result = response.json()
    except http_requests.RequestException as e:
        publication.status = 'failed'
        publication.error_message = f'Ошибка сети: {e}'
        publication.save()
        return publication

    if 'error' in result:
        publication.status = 'failed'
        publication.error_message = result['error'].get(
            'error_msg', 'Неизвестная ошибка VK API',
        )
        publication.save()
    else:
        publication.status = 'published'
        publication.vk_post_id = result.get(
            'response', {},
        ).get('post_id')
        publication.published_at = timezone.now()
        publication.save()

    return publication


def get_publications(user: User, project_id: int | None = None):
    """История публикаций пользователя с фильтрацией по проекту."""
    qs = VKPublication.objects.filter(author=user).select_related('project', 'author')
    if project_id:
        qs = qs.filter(project_id=project_id)
    return qs
