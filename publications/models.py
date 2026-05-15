"""Модели приложения publications."""

from django.conf import settings
from django.db import models


class Publication(models.Model):
    """Публикация пользователя."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='publications',
        verbose_name='Пользователь',
    )
    title = models.CharField('Название', max_length=1024, blank=True)
    authors = models.JSONField('Авторы', default=list, blank=True)
    year = models.IntegerField('Год', null=True, blank=True)
    journal = models.CharField(
        'Журнал / источник', max_length=512, blank=True,
    )
    volume = models.CharField('Том', max_length=50, blank=True)
    issue = models.CharField('Выпуск', max_length=50, blank=True)
    pages = models.CharField('Страницы', max_length=50, blank=True)
    url = models.URLField('URL', max_length=2048, blank=True)
    doi = models.CharField('DOI', max_length=255, blank=True)
    raw_url = models.URLField(
        'Исходный URL', max_length=2048, blank=True,
    )
    gost_string = models.TextField(
        'ГОСТ-строка', blank=True,
    )
    extraction_confidence = models.CharField(
        'Уверенность извлечения',
        max_length=10,
        choices=[
            ('high', 'Высокая'),
            ('medium', 'Средняя'),
            ('low', 'Низкая'),
        ],
        default='low',
        blank=True,
    )
    created_at = models.DateTimeField('Дата создания', auto_now_add=True)
    updated_at = models.DateTimeField('Дата обновления', auto_now=True)

    class Meta:
        verbose_name = 'Публикация'
        verbose_name_plural = 'Публикации'
        ordering = ['-created_at']

    def __str__(self):
        return self.title or self.raw_url or f'Publication #{self.pk}'
