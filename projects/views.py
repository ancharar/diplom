"""Представления (views) приложения projects."""

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import JoinRequest, Project
from .permissions import IsProjectAdmin, IsProjectMember, IsProjectOwner
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
        """Создание нового проекта (только администраторы)."""
        if request.user.role != 'admin':
            return Response(
                {'detail': 'Только администраторы могут создавать проекты.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = ProjectCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        project = create_project(request.user, serializer.validated_data)
        return Response(ProjectSerializer(project).data, status=status.HTTP_201_CREATED)


class ProjectCatalogView(APIView):
    """Каталог всех проектов (краткая информация)."""

    permission_classes = (IsAuthenticated,)

    def get(self, request: Request) -> Response:
        projects = Project.objects.all().select_related('owner')
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
    """Добавление / удаление участников проекта."""

    permission_classes = (IsAuthenticated,)

    def get_project(self, pk: int) -> Project:
        """Получение проекта по id."""
        return Project.objects.get(pk=pk)

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

        perm = IsProjectAdmin()
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

        perm = IsProjectAdmin()
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
