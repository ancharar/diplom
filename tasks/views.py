"""Представления (views) приложения tasks."""

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from projects.models import Project, ProjectMembership

from .filters import TaskFilter
from .models import Task
from .permissions import IsTaskAuthorOrProjectOwner, IsTaskProjectMember
from .serializers import (
    TaskCreateSerializer,
    TaskHistorySerializer,
    TaskSerializer,
    TaskTransitionSerializer,
    TaskUpdateSerializer,
)
from .services import create_task, get_user_tasks, transition_task, update_task


class ProjectTaskListCreateView(APIView):
    """Список задач проекта / создание новой задачи."""

    permission_classes = (IsAuthenticated,)

    def get(self, request: Request, project_id: int) -> Response:
        """Список задач проекта с фильтрацией (только для участников)."""
        try:
            project = Project.objects.get(pk=project_id)
        except Project.DoesNotExist:
            return Response({'detail': 'Проект не найден.'}, status=status.HTTP_404_NOT_FOUND)

        if not ProjectMembership.objects.filter(user=request.user, project=project).exists():
            return Response(
                {'detail': 'Вы не являетесь участником проекта.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        tasks = Task.objects.filter(project=project).select_related('assignee', 'created_by')

        # Применяем фильтрацию
        filterset = TaskFilter(request.query_params, queryset=tasks)
        if filterset.is_valid():
            tasks = filterset.qs

        serializer = TaskSerializer(tasks, many=True)
        return Response(serializer.data)

    def post(self, request: Request, project_id: int) -> Response:
        """Создание задачи в проекте (только для участников)."""
        try:
            project = Project.objects.get(pk=project_id)
        except Project.DoesNotExist:
            return Response({'detail': 'Проект не найден.'}, status=status.HTTP_404_NOT_FOUND)

        if not ProjectMembership.objects.filter(user=request.user, project=project).exists():
            return Response(
                {'detail': 'Вы не являетесь участником проекта.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = TaskCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        task = create_task(project, request.user, serializer.validated_data)
        return Response(TaskSerializer(task).data, status=status.HTTP_201_CREATED)


class TaskDetailView(APIView):
    """Детали / обновление задачи."""

    permission_classes = (IsAuthenticated,)

    def get_task(self, pk: int) -> Task:
        """Получение задачи по id."""
        return Task.objects.select_related('project', 'assignee', 'created_by').get(pk=pk)

    def get(self, request: Request, pk: int) -> Response:
        """Детали задачи (только для участников проекта)."""
        try:
            task = self.get_task(pk)
        except Task.DoesNotExist:
            return Response({'detail': 'Задача не найдена.'}, status=status.HTTP_404_NOT_FOUND)

        perm = IsTaskProjectMember()
        if not perm.has_object_permission(request, self, task):
            return Response({'detail': perm.message}, status=status.HTTP_403_FORBIDDEN)

        return Response(TaskSerializer(task).data)

    def patch(self, request: Request, pk: int) -> Response:
        """Обновление задачи (автор или владелец проекта)."""
        try:
            task = self.get_task(pk)
        except Task.DoesNotExist:
            return Response({'detail': 'Задача не найдена.'}, status=status.HTTP_404_NOT_FOUND)

        perm = IsTaskAuthorOrProjectOwner()
        if not perm.has_object_permission(request, self, task):
            return Response({'detail': perm.message}, status=status.HTTP_403_FORBIDDEN)

        serializer = TaskUpdateSerializer(task, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        task = update_task(task, request.user, serializer.validated_data)
        return Response(TaskSerializer(task).data)


class TaskTransitionView(APIView):
    """Изменение статуса задачи через конечный автомат."""

    permission_classes = (IsAuthenticated,)

    def post(self, request: Request, pk: int) -> Response:
        """Переход задачи в новое состояние (только для участников проекта)."""
        try:
            task = Task.objects.select_related('project', 'assignee', 'created_by').get(pk=pk)
        except Task.DoesNotExist:
            return Response({'detail': 'Задача не найдена.'}, status=status.HTTP_404_NOT_FOUND)

        if not ProjectMembership.objects.filter(user=request.user, project=task.project).exists():
            return Response(
                {'detail': 'Вы не являетесь участником проекта.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = TaskTransitionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        task = transition_task(task, request.user, serializer.validated_data['status'])
        return Response(TaskSerializer(task).data)


class TaskHistoryView(APIView):
    """История изменений задачи."""

    permission_classes = (IsAuthenticated,)

    def get(self, request: Request, pk: int) -> Response:
        """Получение истории изменений задачи (только для участников проекта)."""
        try:
            task = Task.objects.select_related('project').get(pk=pk)
        except Task.DoesNotExist:
            return Response({'detail': 'Задача не найдена.'}, status=status.HTTP_404_NOT_FOUND)

        if not ProjectMembership.objects.filter(user=request.user, project=task.project).exists():
            return Response(
                {'detail': 'Вы не являетесь участником проекта.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        history = task.history.select_related('changed_by').all()
        serializer = TaskHistorySerializer(history, many=True)
        return Response(serializer.data)


class MyTasksView(APIView):
    """Мои задачи (все проекты)."""

    permission_classes = (IsAuthenticated,)

    def get(self, request: Request) -> Response:
        """Все задачи пользователя, где он исполнитель."""
        tasks = get_user_tasks(request.user)
        serializer = TaskSerializer(tasks, many=True)
        return Response(serializer.data)
