"""Представления (views) приложения projects."""

from django.contrib.auth import get_user_model
from django.db.models import Count, Exists, OuterRef, Q
from django.utils import timezone

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import JoinRequest, Project, ProjectInvitation, ProjectMembership
from .permissions import IsProjectMember, IsProjectOwner
# ROLE_DISABLED: IsProjectAdmin больше не импортируется, используем IsProjectOwner
from .serializers import (
    AddMemberSerializer,
    JoinRequestCreateSerializer,
    JoinRequestReviewSerializer,
    JoinRequestSerializer,
    ProjectCatalogSerializer,
    ProjectCreateSerializer,
    ProjectHistorySerializer,
    ProjectSerializer,
    ProjectUpdateSerializer,
)
from .services import (
    add_member,
    cancel_join_request,
    create_join_request,
    create_project,
    remove_member,
    review_join_request,
    update_project,
)


class ProjectListCreateView(APIView):
    """Список проектов пользователя / создание нового проекта."""

    permission_classes = (IsAuthenticated,)

    def get(self, request: Request) -> Response:
        """Список проектов, в которых пользователь является участником."""
        projects = Project.objects.filter(
            memberships__user=request.user
        ).select_related('owner').prefetch_related('memberships__user')
        serializer = ProjectSerializer(projects, many=True)
        return Response(serializer.data)

    def post(self, request: Request) -> Response:
        """Создание нового проекта (любой авторизованный пользователь)."""
        # ROLE_DISABLED: Раньше создание проекта было доступно только admin
        # if request.user.role != 'admin':
        #     return Response(
        #         {'detail': 'Только администраторы могут создавать проекты.'},
        #         status=status.HTTP_403_FORBIDDEN,
        #     )
        serializer = ProjectCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        project = create_project(request.user, serializer.validated_data)
        return Response(ProjectSerializer(project).data, status=status.HTTP_201_CREATED)


class ProjectCatalogView(APIView):
    """Каталог всех проектов (краткая информация)."""

    permission_classes = (IsAuthenticated,)

    def get(self, request: Request) -> Response:
        user = request.user
        projects = (
            Project.objects.all()
            .select_related('owner')
            .annotate(
                _members_count=Count('memberships'),
                _is_member=Exists(
                    ProjectMembership.objects.filter(
                        project=OuterRef('pk'), user=user,
                    )
                ),
                _has_pending_request=Exists(
                    JoinRequest.objects.filter(
                        project=OuterRef('pk'),
                        user=user,
                        status='pending',
                    )
                ),
            )
        )
        serializer = ProjectCatalogSerializer(
            projects, many=True, context={'request': request},
        )
        return Response(serializer.data)


class ProjectDetailView(APIView):
    """Детали / обновление / удаление проекта."""

    permission_classes = (IsAuthenticated,)

    def get_project(self, pk: int) -> Project:
        """Получение проекта по id."""
        return Project.objects.select_related('owner').prefetch_related(
            'memberships__user'
        ).get(pk=pk)

    def get(self, request: Request, pk: int) -> Response:
        """Детали проекта: полные для участников, краткие для остальных."""
        try:
            project = self.get_project(pk)
        except Project.DoesNotExist:
            return Response(
                {'detail': 'Проект не найден.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        is_member = (
            project.owner_id == request.user.id
            or project.memberships.filter(user=request.user).exists()
        )
        if is_member:
            serializer = ProjectSerializer(project)
        else:
            serializer = ProjectCatalogSerializer(
                project, context={'request': request},
            )
        return Response(serializer.data)

    def patch(self, request: Request, pk: int) -> Response:
        """Обновление проекта (только владелец)."""
        try:
            project = self.get_project(pk)
        except Project.DoesNotExist:
            return Response({'detail': 'Проект не найден.'}, status=status.HTTP_404_NOT_FOUND)

        perm = IsProjectOwner()
        if not perm.has_object_permission(request, self, project):
            return Response({'detail': perm.message}, status=status.HTTP_403_FORBIDDEN)

        serializer = ProjectUpdateSerializer(project, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        project = update_project(project, request.user, serializer.validated_data)
        return Response(ProjectSerializer(project).data)

    def delete(self, request: Request, pk: int) -> Response:
        """Удаление проекта (только владелец)."""
        try:
            project = self.get_project(pk)
        except Project.DoesNotExist:
            return Response({'detail': 'Проект не найден.'}, status=status.HTTP_404_NOT_FOUND)

        perm = IsProjectOwner()
        if not perm.has_object_permission(request, self, project):
            return Response({'detail': perm.message}, status=status.HTTP_403_FORBIDDEN)

        project.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProjectMemberView(APIView):
    """Просмотр / добавление участников проекта."""

    permission_classes = (IsAuthenticated,)

    def get_project(self, pk: int) -> Project:
        """Получение проекта по id."""
        return Project.objects.select_related('owner').get(pk=pk)

    def get(self, request: Request, pk: int) -> Response:
        """Получить список участников проекта (только для участников)."""
        try:
            project = self.get_project(pk)
        except Project.DoesNotExist:
            return Response({'detail': 'Проект не найден.'}, status=status.HTTP_404_NOT_FOUND)

        # Проверяем, что пользователь является участником проекта
        if not ProjectMembership.objects.filter(user=request.user, project=project).exists():
            return Response(
                {'detail': 'Вы не являетесь участником проекта.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Получаем всех участников проекта
        memberships = ProjectMembership.objects.filter(project=project).select_related('user')
        
        members_data = [
            {
                'id': membership.user.id,
                'full_name': membership.user.full_name,
                'email': membership.user.email,
            }
            for membership in memberships
        ]
        
        return Response(members_data)

    def post(self, request: Request, pk: int) -> Response:
        """Добавление участника в проект (только владелец)."""
        try:
            project = self.get_project(pk)
        except Project.DoesNotExist:
            return Response({'detail': 'Проект не найден.'}, status=status.HTTP_404_NOT_FOUND)

        perm = IsProjectOwner()
        if not perm.has_object_permission(request, self, project):
            return Response({'detail': perm.message}, status=status.HTTP_403_FORBIDDEN)

        serializer = AddMemberSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        membership = add_member(
            project,
            serializer.validated_data['user_id'],
            serializer.validated_data['project_role'],
        )
        from .serializers import ProjectMembershipSerializer
        return Response(
            ProjectMembershipSerializer(membership).data,
            status=status.HTTP_201_CREATED,
        )


class ProjectMemberDeleteView(APIView):
    """Удаление конкретного участника из проекта."""

    permission_classes = (IsAuthenticated,)

    def delete(self, request: Request, pk: int, user_id: int) -> Response:
        """Удаление участника из проекта (только владелец)."""
        try:
            project = Project.objects.get(pk=pk)
        except Project.DoesNotExist:
            return Response({'detail': 'Проект не найден.'}, status=status.HTTP_404_NOT_FOUND)

        perm = IsProjectOwner()
        if not perm.has_object_permission(request, self, project):
            return Response({'detail': perm.message}, status=status.HTTP_403_FORBIDDEN)

        remove_member(project, user_id)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProjectHistoryView(APIView):
    """История изменений проекта."""

    permission_classes = (IsAuthenticated,)

    def get(self, request: Request, pk: int) -> Response:
        """Получение истории изменений проекта (только для участников)."""
        try:
            project = Project.objects.get(pk=pk)
        except Project.DoesNotExist:
            return Response({'detail': 'Проект не найден.'}, status=status.HTTP_404_NOT_FOUND)

        perm = IsProjectMember()
        if not perm.has_object_permission(request, self, project):
            return Response({'detail': perm.message}, status=status.HTTP_403_FORBIDDEN)

        history = project.history.select_related('changed_by').all()
        serializer = ProjectHistorySerializer(history, many=True)
        return Response(serializer.data)


class ProjectJoinRequestListCreateView(APIView):
    """Список заявок проекта / подача новой заявки."""

    permission_classes = (IsAuthenticated,)

    def get(self, request: Request, pk: int) -> Response:
        """Список заявок (только для владельца проекта)."""
        try:
            project = Project.objects.get(pk=pk)
        except Project.DoesNotExist:
            return Response(
                {'detail': 'Проект не найден.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # ROLE_DISABLED: заменено IsProjectAdmin на IsProjectOwner
        perm = IsProjectOwner()
        if not perm.has_object_permission(request, self, project):
            return Response(
                {'detail': perm.message},
                status=status.HTTP_403_FORBIDDEN,
            )

        qs = project.join_requests.select_related('user', 'reviewed_by')
        filter_status = request.query_params.get('status')
        if filter_status:
            qs = qs.filter(status=filter_status)
        serializer = JoinRequestSerializer(qs, many=True)
        return Response(serializer.data)

    def post(self, request: Request, pk: int) -> Response:
        """Подать заявку на вступление."""
        try:
            project = Project.objects.get(pk=pk)
        except Project.DoesNotExist:
            return Response(
                {'detail': 'Проект не найден.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = JoinRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        join_req = create_join_request(
            user=request.user,
            project=project,
            desired_role=serializer.validated_data['desired_role'],
            message=serializer.validated_data.get('message', ''),
        )
        return Response(
            JoinRequestSerializer(join_req).data,
            status=status.HTTP_201_CREATED,
        )


class ProjectJoinRequestReviewView(APIView):
    """Одобрение / отклонение заявки владельцем."""

    permission_classes = (IsAuthenticated,)

    def patch(self, request: Request, pk: int, req_id: int) -> Response:
        try:
            project = Project.objects.get(pk=pk)
        except Project.DoesNotExist:
            return Response(
                {'detail': 'Проект не найден.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # ROLE_DISABLED: заменено IsProjectAdmin на IsProjectOwner
        perm = IsProjectOwner()
        if not perm.has_object_permission(request, self, project):
            return Response(
                {'detail': perm.message},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            join_req = JoinRequest.objects.get(
                pk=req_id, project=project,
            )
        except JoinRequest.DoesNotExist:
            return Response(
                {'detail': 'Заявка не найдена.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = JoinRequestReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        join_req = review_join_request(
            join_request=join_req,
            reviewer=request.user,
            action=serializer.validated_data['action'],
            assigned_role=serializer.validated_data.get('assigned_role'),
        )
        return Response(JoinRequestSerializer(join_req).data)


class MyJoinRequestsView(APIView):
    """Мои заявки на вступление."""

    permission_classes = (IsAuthenticated,)

    def get(self, request: Request) -> Response:
        qs = JoinRequest.objects.filter(
            user=request.user,
        ).select_related('user', 'reviewed_by')
        serializer = JoinRequestSerializer(qs, many=True)
        return Response(serializer.data)


class MyJoinRequestCancelView(APIView):
    """Отзыв своей заявки."""

    permission_classes = (IsAuthenticated,)

    def delete(self, request: Request, req_id: int) -> Response:
        try:
            join_req = JoinRequest.objects.get(pk=req_id)
        except JoinRequest.DoesNotExist:
            return Response(
                {'detail': 'Заявка не найдена.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        cancel_join_request(join_req, request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


# 👇 ДОБАВЬТЕ ЭТОТ КЛАСС В КОНЕЦ ФАЙЛА
class ProjectMyTasksView(APIView):
    """Мои задачи в проекте (где я исполнитель)."""

    permission_classes = (IsAuthenticated,)

    def get(self, request: Request, project_id: int) -> Response:
        from tasks.models import Task
        from tasks.serializers import TaskSerializer

        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return Response({'detail': 'Проект не найден.'}, status=status.HTTP_404_NOT_FOUND)

        # Проверяем, что пользователь участник проекта
        if not ProjectMembership.objects.filter(user=request.user, project=project).exists():
            return Response(
                {'detail': 'Вы не являетесь участником проекта.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Получаем задачи, где пользователь исполнитель
        tasks = Task.objects.filter(project=project, assignee=request.user)

        # Применяем фильтры
        status_filter = request.query_params.get('status')
        priority_filter = request.query_params.get('priority')

        if status_filter:
            tasks = tasks.filter(status=status_filter)
        if priority_filter:
            tasks = tasks.filter(priority=priority_filter)

        serializer = TaskSerializer(tasks, many=True)
        return Response(serializer.data)


class ProjectStatsView(APIView):
    """Статистика выполнения задач проекта."""

    permission_classes = (IsAuthenticated,)

    def get(self, request: Request, pk: int) -> Response:
        try:
            project = Project.objects.get(pk=pk)
        except Project.DoesNotExist:
            return Response(
                {'detail': 'Проект не найден.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        perm = IsProjectMember()
        if not perm.has_object_permission(request, self, project):
            return Response({'detail': perm.message}, status=status.HTTP_403_FORBIDDEN)

        from tasks.models import Task as TaskModel
        today = timezone.now().date()
        qs = TaskModel.objects.filter(project=project)

        total = qs.count()
        todo = qs.filter(status='todo').count()
        in_progress = qs.filter(status='in_progress').count()
        done = qs.filter(status='done').count()
        overdue = qs.filter(
            deadline__lt=today,
        ).exclude(status='done').count()
        completion_percent = round(done / total * 100) if total else 0

        return Response({
            'total': total,
            'todo': todo,
            'in_progress': in_progress,
            'done': done,
            'overdue': overdue,
            'completion_percent': completion_percent,
        })


class ProjectInviteView(APIView):
    """Отправка приглашения в проект по email (только владелец)."""

    permission_classes = (IsAuthenticated,)

    def post(self, request: Request, pk: int) -> Response:
        try:
            project = Project.objects.get(pk=pk)
        except Project.DoesNotExist:
            return Response(
                {'detail': 'Проект не найден.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        perm = IsProjectOwner()
        if not perm.has_object_permission(request, self, project):
            return Response({'detail': perm.message}, status=status.HTTP_403_FORBIDDEN)

        email = request.data.get('email', '').strip()
        project_role = request.data.get('project_role', 'developer')

        if not email:
            return Response(
                {'detail': 'Email обязателен.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        User = get_user_model()
        try:
            receiver = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response(
                {'detail': f'Пользователь с email «{email}» не найден.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if receiver == request.user:
            return Response(
                {'detail': 'Нельзя пригласить себя.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if ProjectMembership.objects.filter(user=receiver, project=project).exists():
            return Response(
                {'detail': 'Пользователь уже является участником проекта.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        invitation, created = ProjectInvitation.objects.get_or_create(
            project=project,
            receiver=receiver,
            defaults={'sender': request.user, 'project_role': project_role},
        )
        if not created:
            if invitation.status == 'pending':
                return Response(
                    {'detail': 'Приглашение уже отправлено.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            # Переотправка после отклонения
            invitation.status = 'pending'
            invitation.sender = request.user
            invitation.project_role = project_role
            invitation.save()

        from notifications.services import create_notification
        create_notification(
            recipient=receiver,
            notification_type='project_invitation',
            title=f'Приглашение в проект «{project.title}»',
            message=(
                f'{request.user.full_name} приглашает вас принять участие '
                f'в проекте «{project.title}» в роли {project_role}.'
            ),
            project=project,
            invitation=invitation,
        )

        return Response(
            {'detail': 'Приглашение отправлено.'},
            status=status.HTTP_201_CREATED,
        )


class InvitationAcceptView(APIView):
    """Принятие приглашения получателем."""

    permission_classes = (IsAuthenticated,)

    def post(self, request: Request, invitation_id: int) -> Response:
        try:
            invitation = ProjectInvitation.objects.select_related(
                'project', 'receiver',
            ).get(pk=invitation_id)
        except ProjectInvitation.DoesNotExist:
            return Response(
                {'detail': 'Приглашение не найдено.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if invitation.receiver != request.user:
            return Response(
                {'detail': 'Вы не являетесь получателем этого приглашения.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        if invitation.status != 'pending':
            return Response(
                {'detail': 'Приглашение уже обработано.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ProjectMembership.objects.get_or_create(
            user=request.user,
            project=invitation.project,
            defaults={'project_role': invitation.project_role},
        )
        invitation.status = 'accepted'
        invitation.save()

        return Response({'detail': 'Вы вступили в проект.'})


class InvitationDeclineView(APIView):
    """Отклонение приглашения получателем."""

    permission_classes = (IsAuthenticated,)

    def post(self, request: Request, invitation_id: int) -> Response:
        try:
            invitation = ProjectInvitation.objects.get(pk=invitation_id)
        except ProjectInvitation.DoesNotExist:
            return Response(
                {'detail': 'Приглашение не найдено.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if invitation.receiver != request.user:
            return Response(
                {'detail': 'Вы не являетесь получателем этого приглашения.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        invitation.status = 'declined'
        invitation.save()

        return Response({'detail': 'Приглашение отклонено.'})