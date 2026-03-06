"""Модели приложения tasks."""

from django.conf import settings
from django.db import models


TASK_STATUS_CHOICES = [
    ('new', 'New'),
    ('on_discussion', 'On discussion'),
    ('approved', 'Approved'),
    ('in_progress', 'In progress'),
    ('complete', 'Complete'),
    ('testing', 'Testing'),
    ('to_review', 'To review'),
    ('ready_to_merge', 'Ready to merge'),
    ('closed', 'Close'),
    ('disapproved', 'Disapprove'),
]

PRIORITY_CHOICES = [
    ('low', 'Низкий'),
    ('medium', 'Средний'),
    ('high', 'Высокий'),
]


class Task(models.Model):
    """Задача проекта с жизненным циклом из 10 состояний."""

    title = models.CharField('Название', max_length=255)
    description = models.TextField('Техническое задание', blank=True)
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
        'Статус', max_length=20, choices=TASK_STATUS_CHOICES, default='new',
    )
    priority = models.CharField(
        'Приоритет', max_length=10, choices=PRIORITY_CHOICES, default='medium',
    )
    deadline = models.DateField('Дедлайн', null=True, blank=True)
    created_at = models.DateTimeField('Дата создания', auto_now_add=True)
    updated_at = models.DateTimeField('Дата обновления', auto_now=True)

    class Meta:
        verbose_name = 'Задача'
        verbose_name_plural = 'Задачи'
        ordering = ['-created_at']

    def __str__(self) -> str:
        return self.title


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
