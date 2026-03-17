"""Права доступа приложения projects."""

from rest_framework.permissions import BasePermission
from rest_framework.request import Request

from .models import ProjectMembership


class IsProjectOwner(BasePermission):
    """Доступ только владельцу (owner) проекта."""

    message = 'Вы не являетесь владельцем проекта.'

    def has_object_permission(self, request: Request, view, obj) -> bool:
        return obj.owner == request.user


class IsProjectMember(BasePermission):
    """Доступ участникам проекта (включая владельца)."""

    message = 'Вы не являетесь участником проекта.'

    def has_object_permission(self, request: Request, view, obj) -> bool:
        return ProjectMembership.objects.filter(
            user=request.user, project=obj
        ).exists()


class IsProjectAdmin(BasePermission):
    """Владелец проекта (администратор проекта)."""

    message = 'Только владелец проекта может выполнить это действие.'

    def has_object_permission(self, request: Request, view, obj) -> bool:
        from .models import Project
        project = obj if isinstance(obj, Project) else obj.project
        return project.owner == request.user
