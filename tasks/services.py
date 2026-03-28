"""Сервисный слой приложения tasks — конечный автомат состояний."""

from django.contrib.auth import get_user_model
from rest_framework.exceptions import ValidationError

from .models import Task, TaskHistory

User = get_user_model()

# Допустимые переходы между состояниями задачи
ALLOWED_TRANSITIONS: dict[str, list[str]] = {
    'todo':        ['in_progress'],
    'in_progress': ['done', 'todo'],
    'done':        [],
}

# Русские названия для текста ошибок
STATUS_LABELS: dict[str, str] = {
    'todo':        'К выполнению',
    'in_progress': 'В процессе',
    'done':        'Завершена',
}


def create_task(project, user: User, data: dict) -> Task:
    """Создание задачи со статусом 'todo' и запись в историю."""
    task = Task.objects.create(project=project, created_by=user, **data)
    TaskHistory.objects.create(
        task=task,
        changed_by=user,
        field_name='status',
        old_value='',
        new_value='todo',
    )
    return task


def update_task(task: Task, user: User, data: dict) -> Task:
    """Обновление полей задачи с записью каждого изменения в историю."""
    for field, new_value in data.items():
        old_value = str(getattr(task, field, '') or '')
        new_value_str = str(new_value) if new_value is not None else ''
        if old_value != new_value_str:
            TaskHistory.objects.create(
                task=task,
                changed_by=user,
                field_name=field,
                old_value=old_value,
                new_value=new_value_str,
            )
        setattr(task, field, new_value)
    task.save()
    return task


def transition_task(task: Task, user: User, new_status: str) -> Task:
    """Переход задачи в новое состояние с валидацией конечного автомата."""
    current = task.status
    allowed = ALLOWED_TRANSITIONS.get(current, [])

    if new_status not in allowed:
        current_label = STATUS_LABELS.get(current, current)
        new_label = STATUS_LABELS.get(new_status, new_status)
        raise ValidationError({
            'error': (
                f'Переход из статуса «{current_label}» '
                f'в статус «{new_label}» недопустим'
            )
        })

    old_status = current
    task.status = new_status
    task.save()

    TaskHistory.objects.create(
        task=task,
        changed_by=user,
        field_name='status',
        old_value=old_status,
        new_value=new_status,
    )
    return task


def get_user_tasks(user: User):
    """Все задачи пользователя (где он assignee) по всем проектам."""
    return Task.objects.filter(assignee=user).select_related(
        'project', 'assignee', 'created_by'
    )
