"""Представления (views) приложения publications."""

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Publication
from .serializers import (
    ExtractMetadataSerializer,
    PublicationSerializer,
)
from .services import extract_metadata


class ExtractMetadataView(APIView):
    """Извлечение метаданных публикации по URL."""

    permission_classes = (IsAuthenticated,)

    def post(self, request: Request) -> Response:
        serializer = ExtractMetadataSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        url = serializer.validated_data['url']
        try:
            metadata = extract_metadata(url)
        except Exception:
            metadata = {
                'title': '',
                'authors': [],
                'year': None,
                'journal': '',
                'volume': '',
                'issue': '',
                'pages': '',
                'doi': '',
                'url': url,
                'raw_url': url,
                'extraction_confidence': 'low',
            }

        return Response(metadata)


class PublicationListCreateView(APIView):
    """Список публикаций пользователя / создание новой."""

    permission_classes = (IsAuthenticated,)

    def get(self, request: Request) -> Response:
        publications = Publication.objects.filter(user=request.user)
        serializer = PublicationSerializer(publications, many=True)
        return Response(serializer.data)

    def post(self, request: Request) -> Response:
        serializer = PublicationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user)
        return Response(
            serializer.data, status=status.HTTP_201_CREATED,
        )


class PublicationDetailView(APIView):
    """Обновление / удаление публикации."""

    permission_classes = (IsAuthenticated,)

    def put(self, request: Request, pk: int) -> Response:
        try:
            pub = Publication.objects.get(
                pk=pk, user=request.user,
            )
        except Publication.DoesNotExist:
            return Response(
                {'detail': 'Публикация не найдена.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = PublicationSerializer(
            pub, data=request.data, partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request: Request, pk: int) -> Response:
        try:
            pub = Publication.objects.get(
                pk=pk, user=request.user,
            )
        except Publication.DoesNotExist:
            return Response(
                {'detail': 'Публикация не найдена.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        pub.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
