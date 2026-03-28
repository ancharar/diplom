"""Модели приложения vk_integration."""

from django.conf import settings
from django.db import models


class VKToken(models.Model):
    """Токен VK API пользователя."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='vk_token',
        verbose_name='Пользователь',
    )
    access_token = models.TextField('Токен VK API')
    vk_user_id = models.BigIntegerField('VK User ID', null=True, blank=True)
    created_at = models.DateTimeField('Дата создания', auto_now_add=True)
    updated_at = models.DateTimeField('Дата обновления', auto_now=True)

    class Meta:
        verbose_name = 'VK-токен'
        verbose_name_plural = 'VK-токены'

    def __str__(self) -> str:
        return f'VK-токен пользователя {self.user}'


class VKPublication(models.Model):
    """Публикация в ВКонтакте."""

    STATUS_CHOICES = [
        ('draft', 'Черновик'),
        ('published', 'Опубликовано'),
        ('failed', 'Ошибка'),
    ]

    project = models.ForeignKey(
        'projects.Project',
        on_delete=models.CASCADE,
        related_name='vk_publications',
        verbose_name='Проект',
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='vk_publications',
        verbose_name='Автор',
    )
    title = models.CharField('Заголовок', max_length=255)
    content = models.TextField('Текст статьи')
    vk_post_id = models.BigIntegerField('ID поста в VK', null=True, blank=True)
    owner_id = models.BigIntegerField('ID стены (пользователя или группы)')
    attachment_type = models.CharField(
        'Тип вложения', max_length=20,
        choices=[
            ('none', 'Без вложения'),
            ('photo', 'Фото'),
            ('doc', 'Документ'),
        ],
        default='none',
    )
    attachment_file = models.FileField(
        upload_to='vk_attachments/',
        null=True, blank=True,
    )
    vk_attachment_id = models.CharField(
        'ID вложения в VK', max_length=255, blank=True,
    )
    status = models.CharField(
        'Статус', max_length=20,
        choices=STATUS_CHOICES, default='draft',
    )
    published_at = models.DateTimeField(
        'Дата публикации', null=True, blank=True,
    )
    error_message = models.TextField('Текст ошибки', blank=True)
    created_at = models.DateTimeField('Дата создания', auto_now_add=True)

    class Meta:
        verbose_name = 'VK-публикация'
        verbose_name_plural = 'VK-публикации'
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f'{self.title} ({self.get_status_display()})'
