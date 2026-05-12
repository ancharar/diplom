"""Представления (views) приложения reports."""

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from projects.models import Project, ProjectMembership
from .models import ReportTemplate, Report
from .serializers import (
    ReportTemplateSerializer, ReportSerializer, 
    ReportSubmitSerializer, ReportReviewSerializer,
    ReportSummarySerializer
)
from .services import (
    create_periodic_reports, get_project_reports_summary,
    submit_report, review_report, get_user_reports, collect_tasks_data
)


class ReportTemplateListCreateView(APIView):
    """Список / создание шаблонов отчетов."""
    
    permission_classes = (IsAuthenticated,)
    
    def get(self, request: Request, project_id: int) -> Response:
        """Получить список шаблонов отчетов проекта."""
        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return Response({'detail': 'Проект не найден.'}, status=status.HTTP_404_NOT_FOUND)
        
        # Только участники проекта могут видеть шаблоны
        if not ProjectMembership.objects.filter(user=request.user, project=project).exists():
            return Response(
                {'detail': 'Вы не являетесь участником проекта.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        templates = ReportTemplate.objects.filter(project=project)
        serializer = ReportTemplateSerializer(templates, many=True)
        return Response(serializer.data)
    
    def post(self, request: Request, project_id: int) -> Response:
        """Создать шаблон отчета (только владелец)."""
        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return Response({'detail': 'Проект не найден.'}, status=status.HTTP_404_NOT_FOUND)
        
        if project.owner_id != request.user.id:
            return Response(
                {'detail': 'Только владелец проекта может создавать шаблоны отчетов.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = ReportTemplateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(project=project)
        
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ReportTemplateDetailView(APIView):
    """Детали / обновление / удаление шаблона отчета."""
    
    permission_classes = (IsAuthenticated,)
    
    def get(self, request: Request, project_id: int, template_id: int) -> Response:
        """Получить детали шаблона."""
        try:
            template = ReportTemplate.objects.get(id=template_id, project_id=project_id)
        except ReportTemplate.DoesNotExist:
            return Response({'detail': 'Шаблон не найден.'}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = ReportTemplateSerializer(template)
        return Response(serializer.data)
    
    def patch(self, request: Request, project_id: int, template_id: int) -> Response:
        """Обновить шаблон (только владелец)."""
        try:
            project = Project.objects.get(id=project_id)
            template = ReportTemplate.objects.get(id=template_id, project_id=project_id)
        except (Project.DoesNotExist, ReportTemplate.DoesNotExist):
            return Response({'detail': 'Шаблон не найден.'}, status=status.HTTP_404_NOT_FOUND)
        
        if project.owner_id != request.user.id:
            return Response(
                {'detail': 'Только владелец проекта может изменять шаблоны отчетов.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = ReportTemplateSerializer(template, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        return Response(serializer.data)
    
    def delete(self, request: Request, project_id: int, template_id: int) -> Response:
        """Удалить шаблон (только владелец)."""
        try:
            project = Project.objects.get(id=project_id)
            template = ReportTemplate.objects.get(id=template_id, project_id=project_id)
        except (Project.DoesNotExist, ReportTemplate.DoesNotExist):
            return Response({'detail': 'Шаблон не найден.'}, status=status.HTTP_404_NOT_FOUND)
        
        if project.owner_id != request.user.id:
            return Response(
                {'detail': 'Только владелец проекта может удалять шаблоны отчетов.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        template.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ReportListView(APIView):
    """Список отчетов проекта."""
    
    permission_classes = (IsAuthenticated,)
    
    def get(self, request: Request, project_id: int) -> Response:
        """Получить список отчетов."""
        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return Response({'detail': 'Проект не найден.'}, status=status.HTTP_404_NOT_FOUND)
        
        if not ProjectMembership.objects.filter(user=request.user, project=project).exists():
            return Response(
                {'detail': 'Вы не являетесь участником проекта.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        reports = Report.objects.filter(template__project=project).select_related('user', 'template')
        
        # Фильтр по пользователю
        user_id = request.query_params.get('user_id')
        if user_id:
            reports = reports.filter(user_id=user_id)
        
        # Фильтр по статусу
        status_filter = request.query_params.get('status')
        if status_filter:
            reports = reports.filter(status=status_filter)
        
        serializer = ReportSerializer(reports, many=True)
        return Response(serializer.data)


class MyReportsView(APIView):
    """Мои отчеты."""
    
    permission_classes = (IsAuthenticated,)
    
    def get(self, request: Request) -> Response:
        """Получить отчеты текущего пользователя."""
        project_id = request.query_params.get('project_id')
        reports = get_user_reports(request.user.id, project_id)
        serializer = ReportSerializer(reports, many=True)
        return Response(serializer.data)


class GenerateReportsView(APIView):
    """Создание периодических отчетов (только владелец)."""
    
    permission_classes = (IsAuthenticated,)
    
    def post(self, request: Request, project_id: int) -> Response:
        """Создать отчеты на период."""
        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return Response({'detail': 'Проект не найден.'}, status=status.HTTP_404_NOT_FOUND)
        
        if project.owner_id != request.user.id:
            return Response(
                {'detail': 'Только владелец проекта может создавать отчеты.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        template_id = request.data.get('template_id')
        created_count = create_periodic_reports(project_id, template_id)
        
        return Response({
            'message': f'Создано {created_count} отчетов',
            'created_count': created_count
        })


class ReportDetailView(APIView):
    """Детали отчета."""
    
    permission_classes = (IsAuthenticated,)
    
    def get(self, request: Request, report_id: int) -> Response:
        """Получить детали отчета."""
        try:
            report = Report.objects.select_related('user', 'template').get(id=report_id)
        except Report.DoesNotExist:
            return Response({'detail': 'Отчет не найден.'}, status=status.HTTP_404_NOT_FOUND)
        
        # Проверяем доступ
        project = report.template.project
        is_member = ProjectMembership.objects.filter(user=request.user, project=project).exists()
        is_owner = project.owner_id == request.user.id
        is_author = report.user_id == request.user.id
        
        if not (is_member and (is_author or is_owner)):
            return Response(
                {'detail': 'У вас нет доступа к этому отчету.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = ReportSerializer(report)
        return Response(serializer.data)


class ReportSubmitView(APIView):
    """Сдача отчета."""
    
    permission_classes = (IsAuthenticated,)
    
    def post(self, request: Request, report_id: int) -> Response:
        """Сдать отчет."""
        try:
            report = Report.objects.get(id=report_id)
        except Report.DoesNotExist:
            return Response({'detail': 'Отчет не найден.'}, status=status.HTTP_404_NOT_FOUND)
        
        if report.user_id != request.user.id:
            return Response(
                {'detail': 'Вы не можете сдать чужой отчет.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if report.status in ['submitted', 'reviewed']:
            return Response(
                {'detail': 'Отчет уже сдан.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = ReportSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            report = submit_report(report_id, request.user.id, serializer.validated_data)
            return Response(ReportSerializer(report).data)
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ReportReviewView(APIView):
    """Проверка отчета (только владелец)."""
    
    permission_classes = (IsAuthenticated,)
    
    def post(self, request: Request, report_id: int) -> Response:
        """Проверить отчет."""
        serializer = ReportReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            report = review_report(
                report_id,
                request.user.id,
                serializer.validated_data['status'],
                serializer.validated_data.get('review_comment', '')
            )
            return Response(ReportSerializer(report).data)
        except PermissionError as e:
            return Response({'detail': str(e)}, status=status.HTTP_403_FORBIDDEN)
        except Report.DoesNotExist:
            return Response({'detail': 'Отчет не найден.'}, status=status.HTTP_404_NOT_FOUND)


class ReportSummaryView(APIView):
    """Сводка по отчетам проекта."""
    
    permission_classes = (IsAuthenticated,)
    
    def get(self, request: Request, project_id: int) -> Response:
        """Получить сводную статистику."""
        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return Response({'detail': 'Проект не найден.'}, status=status.HTTP_404_NOT_FOUND)
        
        if not ProjectMembership.objects.filter(user=request.user, project=project).exists():
            return Response(
                {'detail': 'Вы не являетесь участником проекта.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        summary = get_project_reports_summary(project_id, request.user.id)
        
        if summary is None:
            return Response(
                {'detail': 'Только владелец проекта может видеть сводку.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        return Response(summary)


class ReportCollectTasksView(APIView):
    """Сбор данных о задачах для отчета."""
    
    permission_classes = (IsAuthenticated,)
    
    def get(self, request: Request, report_id: int) -> Response:
        """Получить актуальные данные о задачах для отчета."""
        try:
            report = Report.objects.get(id=report_id)
        except Report.DoesNotExist:
            return Response({'detail': 'Отчет не найден.'}, status=status.HTTP_404_NOT_FOUND)
        
        if report.user_id != request.user.id:
            return Response(
                {'detail': 'Вы не можете получить данные для чужого отчета.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        tasks_data = collect_tasks_data(report)
        return Response(tasks_data)