"""Права доступа приложения tasks."""

from rest_framework.permissions import BasePermission
from rest_framework.request import Request

from projects.models import ProjectMembership


class IsTaskProjectMember(BasePermission):
    """Доступ участникам проекта, к которому относится задача."""

    message = 'Вы не являетесь участником проекта.'

    def has_object_permission(self, request: Request, view, obj) -> bool:
        return ProjectMembership.objects.filter(
            user=request.user, project=obj.project
        ).exists()


class IsTaskAuthorOrProjectOwner(BasePermission):
    """Доступ автору задачи или владельцу проекта."""

    message = 'Только автор задачи или владелец проекта может выполнить это действие.'

    def has_object_permission(self, request: Request, view, obj) -> bool:
        return (
            obj.created_by == request.user
            or obj.project.owner == request.user
        )
