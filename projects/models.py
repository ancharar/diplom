"""Модели приложения projects."""

from django.conf import settings
from django.db import models


class Project(models.Model):
    """Проект научной группы."""

    STATUS_CHOICES = [
        ('in_progress', 'В процессе'),
        ('completed', 'Завершён'),
    ]

    title = models.CharField('Название', max_length=255)
    description = models.TextField('Описание', blank=True)
    area = models.CharField('Область проекта', max_length=255)
    status = models.CharField('Статус', max_length=20, choices=STATUS_CHOICES, default='in_progress')
    goal = models.TextField('Цель проекта', blank=True)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='owned_projects',
        verbose_name='Владелец',
    )
    members = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        through='ProjectMembership',
        related_name='projects',
        verbose_name='Участники',
    )
    start_date = models.DateField('Дата начала')
    end_date = models.DateField('Дата окончания')
    created_at = models.DateTimeField('Дата создания', auto_now_add=True)
    updated_at = models.DateTimeField('Дата обновления', auto_now=True)

    class Meta:
        verbose_name = 'Проект'
        verbose_name_plural = 'Проекты'
        ordering = ['-created_at']

    def __str__(self) -> str:
        return self.title


class ProjectMembership(models.Model):
    """Участие пользователя в проекте с ролью."""

    PROJECT_ROLE_CHOICES = [
        ('analyst', 'Аналитик'),
        ('developer', 'Разработчик'),
        ('tester', 'Тестировщик'),
        ('designer', 'Дизайнер'),
        ('researcher', 'Исследователь'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='project_memberships',
        verbose_name='Пользователь',
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='memberships',
        verbose_name='Проект',
    )
    project_role = models.CharField('Роль в проекте', max_length=20, choices=PROJECT_ROLE_CHOICES)
    joined_at = models.DateTimeField('Дата вступления', auto_now_add=True)

    class Meta:
        verbose_name = 'Участие в проекте'
        verbose_name_plural = 'Участия в проектах'
        unique_together = [('user', 'project')]

    def __str__(self) -> str:
        return f'{self.user} — {self.project} ({self.get_project_role_display()})'


class ProjectHistory(models.Model):
    """История изменений проекта."""

    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='history',
        verbose_name='Проект',
    )
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='project_changes',
        verbose_name='Кто изменил',
    )
    field_name = models.CharField('Поле', max_length=255)
    old_value = models.TextField('Старое значение', blank=True)
    new_value = models.TextField('Новое значение', blank=True)
    changed_at = models.DateTimeField('Дата изменения', auto_now_add=True)

    class Meta:
        verbose_name = 'Запись истории проекта'
        verbose_name_plural = 'История изменений проектов'
        ordering = ['-changed_at']

    def __str__(self) -> str:
        return f'{self.project}: {self.field_name} изменено {self.changed_by}'
