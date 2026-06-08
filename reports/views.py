"""Представления (views) приложения reports."""

import mimetypes

from django.http import FileResponse
from rest_framework import status
from rest_framework.parsers import JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from datetime import timedelta

from django.utils import timezone

from projects.models import Project, ProjectMembership
from notifications.models import Notification
from notifications.services import create_notification
from .models import ReportTemplate, Report
from .serializers import (
    ReportTemplateSerializer, ReportSerializer,
    ReportReviewSerializer,
)
from .services import (
    create_periodic_reports, get_project_reports_summary,
    review_report, get_user_reports, collect_tasks_data,
)


ALLOWED_DOCX_MIME = (
    'application/vnd.openxmlformats-officedocument'
    '.wordprocessingml.document'
)


def _validate_docx(file) -> str | None:
    """Проверить, что файл — .docx. Возвращает ошибку или None."""
    if not file.name.lower().endswith('.docx'):
        return 'Допускаются только файлы формата .docx'
    mime = mimetypes.guess_type(file.name)[0]
    if mime and mime != ALLOWED_DOCX_MIME:
        return 'Допускаются только файлы формата .docx'
    return None


class ReportTemplateListCreateView(APIView):
    """Список / создание шаблонов отчетов."""

    permission_classes = (IsAuthenticated,)
    parser_classes = (MultiPartParser, JSONParser)

    def get(self, request: Request, project_id: int) -> Response:
        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return Response(
                {'detail': 'Проект не найден.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not ProjectMembership.objects.filter(
            user=request.user, project=project,
        ).exists():
            return Response(
                {'detail': 'Вы не являетесь участником проекта.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        templates = ReportTemplate.objects.filter(project=project)
        serializer = ReportTemplateSerializer(templates, many=True)
        return Response(serializer.data)

    def post(self, request: Request, project_id: int) -> Response:
        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return Response(
                {'detail': 'Проект не найден.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if project.owner_id != request.user.id:
            return Response(
                {'detail': 'Только владелец проекта может '
                           'создавать шаблоны отчетов.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = ReportTemplateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(project=project)

        return Response(
            serializer.data, status=status.HTTP_201_CREATED,
        )


class ReportTemplateDetailView(APIView):
    """Детали / обновление / удаление шаблона отчета."""

    permission_classes = (IsAuthenticated,)
    parser_classes = (MultiPartParser, JSONParser)

    def get(self, request: Request, project_id: int,
            template_id: int) -> Response:
        try:
            template = ReportTemplate.objects.get(
                id=template_id, project_id=project_id,
            )
        except ReportTemplate.DoesNotExist:
            return Response(
                {'detail': 'Шаблон не найден.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = ReportTemplateSerializer(template)
        return Response(serializer.data)

    def patch(self, request: Request, project_id: int,
              template_id: int) -> Response:
        try:
            project = Project.objects.get(id=project_id)
            template = ReportTemplate.objects.get(
                id=template_id, project_id=project_id,
            )
        except (Project.DoesNotExist, ReportTemplate.DoesNotExist):
            return Response(
                {'detail': 'Шаблон не найден.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if project.owner_id != request.user.id:
            return Response(
                {'detail': 'Только владелец проекта может '
                           'изменять шаблоны отчетов.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = ReportTemplateSerializer(
            template, data=request.data, partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(serializer.data)

    def delete(self, request: Request, project_id: int,
               template_id: int) -> Response:
        try:
            project = Project.objects.get(id=project_id)
            template = ReportTemplate.objects.get(
                id=template_id, project_id=project_id,
            )
        except (Project.DoesNotExist, ReportTemplate.DoesNotExist):
            return Response(
                {'detail': 'Шаблон не найден.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if project.owner_id != request.user.id:
            return Response(
                {'detail': 'Только владелец проекта может '
                           'удалять шаблоны отчетов.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        template.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ReportTemplateDownloadView(APIView):
    """Скачивание файла шаблона отчета (.docx)."""

    permission_classes = (IsAuthenticated,)

    def get(self, request: Request, project_id: int,
            template_id: int) -> Response:
        try:
            template = ReportTemplate.objects.get(
                id=template_id, project_id=project_id,
            )
        except ReportTemplate.DoesNotExist:
            return Response(
                {'detail': 'Шаблон не найден.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not template.template_file:
            return Response(
                {'detail': 'Файл шаблона не загружен.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        return FileResponse(
            template.template_file.open('rb'),
            as_attachment=True,
            filename=template.template_file.name.split('/')[-1],
        )


class ReportListView(APIView):
    """Список отчетов проекта."""

    permission_classes = (IsAuthenticated,)

    def get(self, request: Request, project_id: int) -> Response:
        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return Response(
                {'detail': 'Проект не найден.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not ProjectMembership.objects.filter(
            user=request.user, project=project,
        ).exists():
            return Response(
                {'detail': 'Вы не являетесь участником проекта.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        reports = Report.objects.filter(
            template__project=project,
        ).select_related('user', 'template')

        user_id = request.query_params.get('user_id')
        if user_id:
            reports = reports.filter(user_id=user_id)

        status_filter = request.query_params.get('status')
        if status_filter:
            reports = reports.filter(status=status_filter)

        serializer = ReportSerializer(reports, many=True)
        return Response(serializer.data)


class MyReportsView(APIView):
    """Мои отчеты."""

    permission_classes = (IsAuthenticated,)

    def get(self, request: Request) -> Response:
        project_id = request.query_params.get('project_id')
        reports = get_user_reports(request.user.id, project_id)
        self._send_deadline_reminders(request.user, reports)
        serializer = ReportSerializer(reports, many=True)
        return Response(serializer.data)

    def _send_deadline_reminders(self, user, reports):
        """Отправить напоминание если до дедлайна ≤ 2 дня."""
        now = timezone.now()
        threshold = now + timedelta(days=2)
        pending_statuses = ('pending', 'draft')

        for report in reports:
            if report.status not in pending_statuses:
                continue
            if not report.deadline or report.deadline < now:
                continue
            if report.deadline > threshold:
                continue

            project = report.template.project
            already_sent = Notification.objects.filter(
                recipient=user,
                notification_type='report_reminder',
                project=project,
                created_at__date=now.date(),
            ).exists()
            if already_sent:
                continue

            days_left = (report.deadline.date() - now.date()).days
            label = 'завтра' if days_left <= 1 else 'через 2 дня'
            create_notification(
                recipient=user,
                notification_type='report_reminder',
                title=f'Напоминание: дедлайн отчёта {label}',
                message=(
                    f'Срок сдачи отчёта «{report.template.title}» '
                    f'истекает {report.deadline.strftime("%d.%m.%Y")}. '
                    f'Не забудьте заполнить и сдать отчёт.'
                ),
                project=project,
            )


class GenerateReportsView(APIView):
    """Создание периодических отчетов (только владелец)."""

    permission_classes = (IsAuthenticated,)

    def post(self, request: Request, project_id: int) -> Response:
        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return Response(
                {'detail': 'Проект не найден.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if project.owner_id != request.user.id:
            return Response(
                {'detail': 'Только владелец проекта может '
                           'создавать отчеты.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        template_id = request.data.get('template_id')
        created_count = create_periodic_reports(
            project_id, template_id,
        )

        return Response({
            'message': f'Создано {created_count} отчетов',
            'created_count': created_count,
        })


class ReportDetailView(APIView):
    """Детали отчета."""

    permission_classes = (IsAuthenticated,)

    def get(self, request: Request, report_id: int) -> Response:
        try:
            report = Report.objects.select_related(
                'user', 'template',
            ).get(id=report_id)
        except Report.DoesNotExist:
            return Response(
                {'detail': 'Отчет не найден.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        project = report.template.project
        is_member = ProjectMembership.objects.filter(
            user=request.user, project=project,
        ).exists()
        is_owner = project.owner_id == request.user.id
        is_author = report.user_id == request.user.id

        if not (is_member and (is_author or is_owner)):
            return Response(
                {'detail': 'У вас нет доступа к этому отчету.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = ReportSerializer(report)
        return Response(serializer.data)


class ReportUploadView(APIView):
    """Загрузка заполненного отчета (.docx) участником."""

    permission_classes = (IsAuthenticated,)
    parser_classes = (MultiPartParser,)

    def post(self, request: Request, report_id: int) -> Response:
        try:
            report = Report.objects.get(id=report_id)
        except Report.DoesNotExist:
            return Response(
                {'detail': 'Отчет не найден.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if report.user_id != request.user.id:
            return Response(
                {'detail': 'Вы не можете загрузить файл '
                           'для чужого отчета.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        if report.status in ['reviewed']:
            return Response(
                {'detail': 'Отчет уже проверен.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        uploaded = request.FILES.get('file')
        if not uploaded:
            return Response(
                {'detail': 'Файл не передан.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        err = _validate_docx(uploaded)
        if err:
            return Response(
                {'detail': err},
                status=status.HTTP_400_BAD_REQUEST,
            )

        report.submitted_file = uploaded
        report.status = 'submitted'
        from django.utils import timezone
        report.submitted_at = timezone.now()
        report.save()

        return Response(ReportSerializer(report).data)


class ReportDownloadView(APIView):
    """Скачивание загруженного отчета (.docx)."""

    permission_classes = (IsAuthenticated,)

    def get(self, request: Request, report_id: int) -> Response:
        try:
            report = Report.objects.select_related(
                'template__project',
            ).get(id=report_id)
        except Report.DoesNotExist:
            return Response(
                {'detail': 'Отчет не найден.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not report.submitted_file:
            return Response(
                {'detail': 'Файл отчета не загружен.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        project = report.template.project
        is_owner = project.owner_id == request.user.id
        is_author = report.user_id == request.user.id

        if not (is_author or is_owner):
            return Response(
                {'detail': 'У вас нет доступа к этому файлу.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        return FileResponse(
            report.submitted_file.open('rb'),
            as_attachment=True,
            filename=report.submitted_file.name.split('/')[-1],
        )


# LEGACY: JSON-based questions (disabled)
# class ReportSubmitView(APIView):
#     """Сдача отчета (JSON-ответы)."""
#     permission_classes = (IsAuthenticated,)
#     def post(self, request, report_id):
#         ...
# LEGACY: JSON-based questions (disabled)


class ReportReviewView(APIView):
    """Проверка отчета (только владелец)."""

    permission_classes = (IsAuthenticated,)

    def post(self, request: Request, report_id: int) -> Response:
        serializer = ReportReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            report = review_report(
                report_id,
                request.user.id,
                serializer.validated_data['status'],
                serializer.validated_data.get(
                    'review_comment', '',
                ),
            )
            return Response(ReportSerializer(report).data)
        except PermissionError as e:
            return Response(
                {'detail': str(e)},
                status=status.HTTP_403_FORBIDDEN,
            )
        except Report.DoesNotExist:
            return Response(
                {'detail': 'Отчет не найден.'},
                status=status.HTTP_404_NOT_FOUND,
            )


class ReportSummaryView(APIView):
    """Сводка по отчетам проекта."""

    permission_classes = (IsAuthenticated,)

    def get(self, request: Request, project_id: int) -> Response:
        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return Response(
                {'detail': 'Проект не найден.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not ProjectMembership.objects.filter(
            user=request.user, project=project,
        ).exists():
            return Response(
                {'detail': 'Вы не являетесь участником проекта.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        summary = get_project_reports_summary(
            project_id, request.user.id,
        )

        if summary is None:
            return Response(
                {'detail': 'Только владелец проекта может '
                           'видеть сводку.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        return Response(summary)


class ReportCollectTasksView(APIView):
    """Сбор данных о задачах для отчета."""

    permission_classes = (IsAuthenticated,)

    def get(self, request: Request, report_id: int) -> Response:
        try:
            report = Report.objects.get(id=report_id)
        except Report.DoesNotExist:
            return Response(
                {'detail': 'Отчет не найден.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if report.user_id != request.user.id:
            return Response(
                {'detail': 'Вы не можете получить данные '
                           'для чужого отчета.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        tasks_data = collect_tasks_data(report)
        return Response(tasks_data)
