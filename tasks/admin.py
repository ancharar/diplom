"""Настройка админ-панели для приложения tasks."""

from django.contrib import admin

from .models import Task, TaskHistory


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    """Админ-панель для модели Task."""

    list_display = ('title', 'project', 'assignee', 'status', 'priority', 'deadline')
    list_filter = ('status', 'priority', 'project')
    search_fields = ('title', 'description')


@admin.register(TaskHistory)
class TaskHistoryAdmin(admin.ModelAdmin):
    """Админ-панель для истории изменений задач."""

    list_display = ('task', 'changed_by', 'field_name', 'changed_at')
    list_filter = ('field_name',)
    readonly_fields = ('task', 'changed_by', 'field_name', 'old_value', 'new_value', 'changed_at')
