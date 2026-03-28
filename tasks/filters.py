"""Фильтры приложения tasks."""

import django_filters

from .models import Task


class TaskFilter(django_filters.FilterSet):
    """Фильтрация задач по статусу, приоритету, исполнителю, дедлайну."""

    deadline_before = django_filters.DateFilter(
        field_name='deadline', lookup_expr='lte', label='Дедлайн до',
    )

    class Meta:
        model = Task
        fields = ['status', 'assignee', 'deadline_before']
