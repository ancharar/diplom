"""API-представления для литературных источников и файлов (MongoDB)."""

import base64

from bson.errors import InvalidId
from django.core.exceptions import ValidationError
from rest_framework import status
from rest_framework.parsers import JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from projects.models import Project
from projects.permissions import IsProjectMember

from . import services


class SourceListCreateView(APIView):
    """Список литературных источников проекта / создание нового."""

    permission_classes = (IsAuthenticated,)

    def _get_project(self, project_id: int, request: Request):
        try:
            project = Project.objects.get(pk=project_id)
        except Project.DoesNotExist:
            return None, Response({'detail': 'Проект не найден.'}, status=status.HTTP_404_NOT_FOUND)
        perm = IsProjectMember()
        if not perm.has_object_permission(request, self, project):
            return None, Response({'detail': perm.message}, status=status.HTTP_403_FORBIDDEN)
        return project, None

    def get(self, request: Request, project_id: int) -> Response:
        project, err = self._get_project(project_id, request)
        if err:
            return err
        sources = services.list_sources(project_id)
        return Response(sources)

    def post(self, request: Request, project_id: int) -> Response:
        project, err = self._get_project(project_id, request)
        if err:
            return err
        data = request.data.copy()
        data['project_id'] = project_id
        data['added_by'] = request.user.id
        source = services.create_source(data)
        return Response(source, status=status.HTTP_201_CREATED)


class SourceDetailView(APIView):
    """Получение / обновление / удаление литературного источника."""

    permission_classes = (IsAuthenticated,)

    def get(self, request: Request, project_id: int, source_id: str) -> Response:
        try:
            source = services.get_source(source_id)
        except InvalidId:
            return Response({'detail': 'Неверный ID.'}, status=status.HTTP_400_BAD_REQUEST)
        if not source:
            return Response({'detail': 'Источник не найден.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(source)

    def patch(self, request: Request, project_id: int, source_id: str) -> Response:
        try:
            source = services.update_source(source_id, request.data)
        except InvalidId:
            return Response({'detail': 'Неверный ID.'}, status=status.HTTP_400_BAD_REQUEST)
        if not source:
            return Response({'detail': 'Источник не найден.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(source)

    def delete(self, request: Request, project_id: int, source_id: str) -> Response:
        try:
            deleted = services.delete_source(source_id)
        except InvalidId:
            return Response({'detail': 'Неверный ID.'}, status=status.HTTP_400_BAD_REQUEST)
        if not deleted:
            return Response({'detail': 'Источник не найден.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)


class FileListUploadView(APIView):
    """Список файлов проекта / загрузка нового файла."""

    permission_classes = (IsAuthenticated,)
    parser_classes = (MultiPartParser, JSONParser)

    def _get_project(self, project_id: int, request: Request):
        try:
            project = Project.objects.get(pk=project_id)
        except Project.DoesNotExist:
            return None, Response({'detail': 'Проект не найден.'}, status=status.HTTP_404_NOT_FOUND)
        perm = IsProjectMember()
        if not perm.has_object_permission(request, self, project):
            return None, Response({'detail': perm.message}, status=status.HTTP_403_FORBIDDEN)
        return project, None

    def get(self, request: Request, project_id: int) -> Response:
        project, err = self._get_project(project_id, request)
        if err:
            return err
        files = services.list_files(project_id)
        return Response(files)

    def post(self, request: Request, project_id: int) -> Response:
        project, err = self._get_project(project_id, request)
        if err:
            return err
        uploaded = request.FILES.get('file')
        if not uploaded:
            return Response({'detail': 'Файл не передан.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            services.validate_file(uploaded)
        except ValidationError as e:
            return Response({'error': e.message}, status=status.HTTP_400_BAD_REQUEST)

        data = {
            'project_id': project_id,
            'filename': uploaded.name,
            'content_type': uploaded.content_type,
            'size': uploaded.size,
            'description': request.data.get('description', ''),
            'content': uploaded.read(),
            'uploaded_by': request.user.id,
        }
        file_doc = services.upload_file(data)
        return Response(file_doc, status=status.HTTP_201_CREATED)


class FileDownloadView(APIView):
    """Скачивание файла."""

    permission_classes = (IsAuthenticated,)

    def get(self, request: Request, project_id: int, file_id: str) -> Response:
        try:
            file_doc = services.get_file_content(file_id)
        except InvalidId:
            return Response({'detail': 'Неверный ID.'}, status=status.HTTP_400_BAD_REQUEST)
        if not file_doc:
            return Response({'detail': 'Файл не найден.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(file_doc)


class FileDeleteView(APIView):
    """Удаление файла."""

    permission_classes = (IsAuthenticated,)

    def delete(self, request: Request, project_id: int, file_id: str) -> Response:
        try:
            deleted = services.delete_file(file_id)
        except InvalidId:
            return Response({'detail': 'Неверный ID.'}, status=status.HTTP_400_BAD_REQUEST)
        if not deleted:
            return Response({'detail': 'Файл не найден.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)


class SearchLibraryView(APIView):
    """Полнотекстовый поиск по литературным источникам проекта."""

    permission_classes = (IsAuthenticated,)

    def get(self, request: Request, project_id: int) -> Response:
        # Проверка участия в проекте
        try:
            project = Project.objects.get(pk=project_id)
        except Project.DoesNotExist:
            return Response(
                {'detail': 'Проект не найден.'}, status=status.HTTP_404_NOT_FOUND,
            )
        perm = IsProjectMember()
        if not perm.has_object_permission(request, self, project):
            return Response(
                {'detail': perm.message}, status=status.HTTP_403_FORBIDDEN,
            )

        query = request.query_params.get('q', '').strip()
        if not query:
            return Response(
                {'error': 'Запрос не может быть пустым'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(query) > 200:
            return Response(
                {'error': 'Запрос слишком длинный'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        results = services.search_sources(project_id, query)
        return Response(results)
