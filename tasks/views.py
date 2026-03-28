"""Представления (views) приложения tasks."""

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from projects.models import Project, ProjectMembership

from .filters import TaskFilter
from .permissions import IsTaskAuthorOrProjectOwner, IsTaskProjectMember
from .models import Task, TaskAttachment, TaskHistory
from .serializers import (
    TaskAttachmentCreateSerializer,
    TaskAttachmentSerializer,
    TaskCreateSerializer,
    TaskHistorySerializer,
    TaskSerializer,
    TaskTransitionSerializer,
    TaskUpdateSerializer,
)
from .services import create_task, get_user_tasks, transition_task, update_task

ALLOWED_ATTACHMENT_EXTENSIONS = {'pdf', 'doc', 'docx', 'txt', 'xlsx', 'pptx'}
MAX_ATTACHMENT_SIZE = 52_428_800  # 50 МБ


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

    def delete(self, request: Request, pk: int) -> Response:
        """Удаление задачи (автор или владелец проекта)."""
        try:
            task = self.get_task(pk)
        except Task.DoesNotExist:
            return Response({'detail': 'Задача не найдена.'}, status=status.HTTP_404_NOT_FOUND)

        perm = IsTaskAuthorOrProjectOwner()
        if not perm.has_object_permission(request, self, task):
            return Response({'detail': perm.message}, status=status.HTTP_403_FORBIDDEN)

        task.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class TaskTransitionView(APIView):
    """Изменение статуса задачи через конечный автомат."""

    permission_classes = (IsAuthenticated,)

    def patch(self, request: Request, pk: int) -> Response:
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


class TaskAttachmentListCreateView(APIView):
    """Список вложений задачи / прикрепление файла или ссылки."""

    permission_classes = (IsAuthenticated,)

    def _get_task_for_member(self, request, task_id):
        """Получить задачу, проверив участие в проекте."""
        try:
            task = Task.objects.select_related('project').get(pk=task_id)
        except Task.DoesNotExist:
            return None, Response(
                {'error': 'Задача не найдена'},
                status=status.HTTP_404_NOT_FOUND,
            )
        if not ProjectMembership.objects.filter(
            user=request.user, project=task.project,
        ).exists():
            return None, Response(
                {'error': 'Вы не являетесь участником проекта'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return task, None

    def get(self, request: Request, task_id: int) -> Response:
        """Список вложений задачи."""
        task, err = self._get_task_for_member(request, task_id)
        if err:
            return err
        attachments = task.attachments.select_related('uploaded_by').all()
        return Response(
            TaskAttachmentSerializer(attachments, many=True).data,
        )

    def post(self, request: Request, task_id: int) -> Response:
        """Прикрепить файл или ссылку к задаче."""
        task, err = self._get_task_for_member(request, task_id)
        if err:
            return err

        serializer = TaskAttachmentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        atype = data.get('attachment_type', 'file')

        if atype == 'file':
            file = data['file']
            if file.size > MAX_ATTACHMENT_SIZE:
                return Response(
                    {'error': 'Размер файла превышает 50 МБ'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            ext = file.name.rsplit('.', 1)[-1].lower() if '.' in file.name else ''
            if ext not in ALLOWED_ATTACHMENT_EXTENSIONS:
                allowed = ', '.join(sorted(ALLOWED_ATTACHMENT_EXTENSIONS))
                return Response(
                    {'error': f'Недопустимый формат. Разрешены: {allowed}'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            attachment = TaskAttachment.objects.create(
                task=task,
                attachment_type='file',
                file=file,
                file_name=file.name,
                file_size=file.size,
                description=data.get('description', ''),
                uploaded_by=request.user,
            )
            history_value = file.name
        else:
            attachment = TaskAttachment.objects.create(
                task=task,
                attachment_type='link',
                url=data['url'],
                description=data.get('description', ''),
                uploaded_by=request.user,
            )
            history_value = data['url']

        TaskHistory.objects.create(
            task=task,
            changed_by=request.user,
            field_name='attachment_added',
            old_value='',
            new_value=history_value,
        )

        return Response(
            TaskAttachmentSerializer(attachment).data,
            status=status.HTTP_201_CREATED,
        )


class TaskAttachmentDeleteView(APIView):
    """Удаление вложения (автор вложения или owner проекта)."""

    permission_classes = (IsAuthenticated,)

    def delete(self, request: Request, task_id: int, att_id: int) -> Response:
        try:
            attachment = TaskAttachment.objects.select_related(
                'task__project', 'uploaded_by',
            ).get(pk=att_id, task_id=task_id)
        except TaskAttachment.DoesNotExist:
            return Response(
                {'error': 'Вложение не найдено'},
                status=status.HTTP_404_NOT_FOUND,
            )

        project = attachment.task.project
        is_author = attachment.uploaded_by == request.user
        is_owner = project.owner == request.user
        if not is_author and not is_owner:
            return Response(
                {'error': 'Удалить может только автор или владелец проекта'},
                status=status.HTTP_403_FORBIDDEN,
            )

        name = attachment.file_name or attachment.url
        attachment.delete()

        TaskHistory.objects.create(
            task_id=task_id,
            changed_by=request.user,
            field_name='attachment_removed',
            old_value=name,
            new_value='',
        )

        return Response(status=status.HTTP_204_NO_CONTENT)


class TaskAttachmentDownloadView(APIView):
    """Скачивание файла вложения."""

    permission_classes = (IsAuthenticated,)

    def get(self, request: Request, task_id: int, att_id: int) -> Response:
        try:
            attachment = TaskAttachment.objects.select_related(
                'task__project',
            ).get(pk=att_id, task_id=task_id)
        except TaskAttachment.DoesNotExist:
            return Response(
                {'error': 'Вложение не найдено'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not ProjectMembership.objects.filter(
            user=request.user, project=attachment.task.project,
        ).exists():
            return Response(
                {'error': 'Вы не являетесь участником проекта'},
                status=status.HTTP_403_FORBIDDEN,
            )

        if attachment.attachment_type == 'link' or not attachment.file:
            return Response(
                {'error': 'У этого вложения нет файла для скачивания'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from django.http import FileResponse
        return FileResponse(
            attachment.file.open('rb'),
            as_attachment=True,
            filename=attachment.file_name,
        )


class TaskAssigneeView(APIView):
    """Назначение исполнителя задачи."""

    permission_classes = (IsAuthenticated,)

    def patch(self, request: Request, pk: int) -> Response:
        try:
            task = Task.objects.select_related('project', 'assignee', 'created_by').get(pk=pk)
        except Task.DoesNotExist:
            return Response({'detail': 'Задача не найдена.'}, status=status.HTTP_404_NOT_FOUND)

        if not ProjectMembership.objects.filter(
            user=request.user, project=task.project,
        ).exists():
            return Response(
                {'detail': 'Вы не являетесь участником проекта.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        from django.contrib.auth import get_user_model
        User = get_user_model()
        assignee_id = request.data.get('assignee_id')
        if assignee_id is None:
            return Response({'error': 'assignee_id обязателен'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            assignee = User.objects.get(pk=assignee_id)
        except User.DoesNotExist:
            return Response({'error': 'Пользователь не найден'}, status=status.HTTP_404_NOT_FOUND)

        old_assignee = str(task.assignee_id or '')
        task.assignee = assignee
        task.save()

        TaskHistory.objects.create(
            task=task,
            changed_by=request.user,
            field_name='assignee',
            old_value=old_assignee,
            new_value=str(assignee.id),
        )

        return Response(TaskSerializer(task).data)
