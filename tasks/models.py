"""Модели приложения tasks."""

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


TASK_STATUS_CHOICES = [
    ('todo', 'К выполнению'),
    ('in_progress', 'В процессе'),
    ('done', 'Завершена'),
]


class Task(models.Model):
    """Задача проекта с жизненным циклом из 3 состояний."""

    title = models.CharField('Название', max_length=255)
    description = models.TextField('Описание', blank=True)
    technical_spec = models.TextField(
        verbose_name='Техническое задание',
        blank=True, default='',
    )
    project = models.ForeignKey(
        'projects.Project',
        on_delete=models.CASCADE,
        related_name='tasks',
        verbose_name='Проект',
    )
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_tasks',
        verbose_name='Исполнитель',
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='created_tasks',
        verbose_name='Автор',
    )
    status = models.CharField(
        'Статус', max_length=20, choices=TASK_STATUS_CHOICES, default='todo',
    )
    deadline = models.DateField('Дедлайн', null=True, blank=True)
    created_at = models.DateTimeField('Дата создания', auto_now_add=True)
    updated_at = models.DateTimeField('Дата обновления', auto_now=True)

    class Meta:
        verbose_name = 'Задача'
        verbose_name_plural = 'Задачи'
        ordering = ['-created_at']

    def clean(self):
        if self.deadline and self.deadline < timezone.now().date():
            raise ValidationError(
                {'deadline': 'Срок выполнения не может быть раньше текущей даты'}
            )

    def __str__(self) -> str:
        return self.title


class TaskAttachment(models.Model):
    """Вложение задачи (файл или ссылка)."""

    ATTACHMENT_TYPE_CHOICES = [
        ('file', 'Файл'),
        ('link', 'Ссылка'),
    ]

    task = models.ForeignKey(
        'Task', on_delete=models.CASCADE, related_name='attachments',
    )
    attachment_type = models.CharField(
        'Тип', max_length=10,
        choices=ATTACHMENT_TYPE_CHOICES, default='file',
    )
    file = models.FileField(
        upload_to='task_attachments/%Y/%m/',
        null=True, blank=True,
    )
    file_name = models.CharField(max_length=255, blank=True)
    file_size = models.PositiveIntegerField(null=True, blank=True)
    url = models.URLField('Ссылка', blank=True)
    description = models.CharField(max_length=500, blank=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Вложение задачи'
        verbose_name_plural = 'Вложения задач'
        ordering = ['-created_at']

    def __str__(self):
        if self.attachment_type == 'link':
            return self.url
        return self.file_name


class TaskHistory(models.Model):
    """История изменений задачи."""

    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name='history',
        verbose_name='Задача',
    )
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='task_changes',
        verbose_name='Кто изменил',
    )
    field_name = models.CharField('Поле', max_length=255)
    old_value = models.TextField('Старое значение', blank=True)
    new_value = models.TextField('Новое значение', blank=True)
    changed_at = models.DateTimeField('Дата изменения', auto_now_add=True)

    class Meta:
        verbose_name = 'Запись истории задачи'
        verbose_name_plural = 'История изменений задач'
        ordering = ['-changed_at']

    def __str__(self) -> str:
        return f'{self.task}: {self.field_name} изменено {self.changed_by}'
