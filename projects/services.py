"""Сервисный слой приложения projects."""

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from .models import JoinRequest, Project, ProjectHistory, ProjectMembership

User = get_user_model()


def create_project(user: User, data: dict) -> Project:
    """Создание проекта и автоматическое добавление создателя как участника."""
    project = Project.objects.create(owner=user, **data)
    # Владелец автоматически становится участником с ролью «Исследователь»
    ProjectMembership.objects.create(
        user=user,
        project=project,
        project_role='researcher',
    )
    return project


def update_project(project: Project, user: User, data: dict) -> Project:
    """Обновление проекта с записью изменений в историю."""
    for field, new_value in data.items():
        old_value = str(getattr(project, field, ''))
        new_value_str = str(new_value)
        if old_value != new_value_str:
            ProjectHistory.objects.create(
                project=project,
                changed_by=user,
                field_name=field,
                old_value=old_value,
                new_value=new_value_str,
            )
        setattr(project, field, new_value)
    project.save()
    return project


def add_member(project: Project, user_id: int, role: str) -> ProjectMembership:
    """Добавление участника в проект с проверкой существования пользователя."""
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        raise ValidationError({'detail': f'Пользователь с id={user_id} не найден.'})

    if ProjectMembership.objects.filter(user=user, project=project).exists():
        raise ValidationError({'detail': 'Пользователь уже является участником проекта.'})

    return ProjectMembership.objects.create(
        user=user,
        project=project,
        project_role=role,
    )


def remove_member(project: Project, user_id: int) -> None:
    """Удаление участника из проекта (нельзя удалить владельца)."""
    if project.owner_id == user_id:
        raise ValidationError({'detail': 'Нельзя удалить владельца проекта.'})

    try:
        membership = ProjectMembership.objects.get(user_id=user_id, project=project)
    except ProjectMembership.DoesNotExist:
        raise ValidationError({'detail': 'Пользователь не является участником проекта.'})

    membership.delete()


def create_join_request(user, project, desired_role, message=''):
    """Создать заявку на вступление в проект."""
    if (ProjectMembership.objects.filter(user=user, project=project).exists()
            or project.owner == user):
        raise ValidationError(
            'Вы уже являетесь участником этого проекта',
        )
    if JoinRequest.objects.filter(
        user=user, project=project, status='pending',
    ).exists():
        raise ValidationError(
            'У вас уже есть активная заявка в этот проект',
        )
    return JoinRequest.objects.create(
        user=user,
        project=project,
        desired_role=desired_role,
        message=message,
        status='pending',
    )


def review_join_request(join_request, reviewer, action, assigned_role=None):
    """Одобрить или отклонить заявку."""
    if join_request.status != 'pending':
        raise ValidationError('Эта заявка уже рассмотрена')

    if action == 'approved':
        final_role = assigned_role or join_request.desired_role
        ProjectMembership.objects.create(
            user=join_request.user,
            project=join_request.project,
            project_role=final_role,
        )
        join_request.status = 'approved'
        join_request.assigned_role = final_role
    elif action == 'rejected':
        join_request.status = 'rejected'
    else:
        raise ValidationError(
            "Недопустимое действие. Используйте 'approved' или 'rejected'",
        )

    join_request.reviewed_by = reviewer
    join_request.reviewed_at = timezone.now()
    join_request.save()
    return join_request


def cancel_join_request(join_request, user):
    """Отозвать свою заявку (только pending)."""
    if join_request.user != user:
        raise PermissionDenied(
            'Вы можете отзывать только свои заявки',
        )
    if join_request.status != 'pending':
        raise ValidationError(
            "Можно отозвать только заявку со статусом 'На рассмотрении'",
        )
    join_request.delete()
