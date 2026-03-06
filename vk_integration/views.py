"""Представления (views) приложения vk_integration."""

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import VKPublication
from .serializers import (
    VKPublicationSerializer,
    VKPublishSerializer,
    VKTokenResponseSerializer,
    VKTokenSerializer,
)
from .services import delete_vk_token, get_publications, publish_to_vk, save_vk_token


class VKTokenView(APIView):
    """Сохранение / удаление VK-токена."""

    permission_classes = (IsAuthenticated,)

    def post(self, request: Request) -> Response:
        """Сохранить VK-токен."""
        serializer = VKTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = save_vk_token(request.user, serializer.validated_data['access_token'])
        return Response(VKTokenResponseSerializer(token).data, status=status.HTTP_201_CREATED)

    def delete(self, request: Request) -> Response:
        """Удалить VK-токен."""
        delete_vk_token(request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class VKPublishView(APIView):
    """Публикация поста в VK."""

    permission_classes = (IsAuthenticated,)

    def post(self, request: Request) -> Response:
        """Опубликовать пост в VK."""
        serializer = VKPublishSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        publication = publish_to_vk(request.user, serializer.validated_data)
        return Response(
            VKPublicationSerializer(publication).data,
            status=status.HTTP_201_CREATED,
        )


class VKPublicationListView(APIView):
    """История публикаций."""

    permission_classes = (IsAuthenticated,)

    def get(self, request: Request) -> Response:
        """Список публикаций пользователя с фильтрацией по проекту."""
        project_id = request.query_params.get('project')
        publications = get_publications(request.user, project_id)
        serializer = VKPublicationSerializer(publications, many=True)
        return Response(serializer.data)


class VKPublicationDetailView(APIView):
    """Детали публикации."""

    permission_classes = (IsAuthenticated,)

    def get(self, request: Request, pk: int) -> Response:
        """Детали конкретной публикации (только автор)."""
        try:
            publication = VKPublication.objects.select_related('author', 'project').get(pk=pk)
        except VKPublication.DoesNotExist:
            return Response({'detail': 'Публикация не найдена.'}, status=status.HTTP_404_NOT_FOUND)

        if publication.author != request.user:
            return Response(
                {'detail': 'Вы не являетесь автором этой публикации.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        return Response(VKPublicationSerializer(publication).data)
