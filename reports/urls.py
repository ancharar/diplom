"""URL-маршруты приложения reports."""

from django.urls import path

from .views import (
    ReportTemplateListCreateView,
    ReportTemplateDetailView,
    ReportTemplateDownloadView,
    ReportListView,
    MyReportsView,
    GenerateReportsView,
    ReportDetailView,
    ReportUploadView,
    ReportDownloadView,
    ReportReviewView,
    ReportSummaryView,
    ReportCollectTasksView,
)

app_name = 'reports'

urlpatterns = [
    # Шаблоны отчетов
    path(
        'projects/<int:project_id>/report-templates/',
        ReportTemplateListCreateView.as_view(),
        name='report-templates',
    ),
    path(
        'projects/<int:project_id>/report-templates/'
        '<int:template_id>/',
        ReportTemplateDetailView.as_view(),
        name='report-template-detail',
    ),
    path(
        'projects/<int:project_id>/report-templates/'
        '<int:template_id>/download/',
        ReportTemplateDownloadView.as_view(),
        name='report-template-download',
    ),

    # Отчеты
    path(
        'projects/<int:project_id>/reports/',
        ReportListView.as_view(),
        name='reports',
    ),
    path(
        'projects/<int:project_id>/reports/generate/',
        GenerateReportsView.as_view(),
        name='generate-reports',
    ),
    path(
        'projects/<int:project_id>/reports/summary/',
        ReportSummaryView.as_view(),
        name='reports-summary',
    ),
    path(
        'reports/my/',
        MyReportsView.as_view(),
        name='my-reports',
    ),
    path(
        'reports/<int:report_id>/',
        ReportDetailView.as_view(),
        name='report-detail',
    ),
    path(
        'reports/<int:report_id>/upload/',
        ReportUploadView.as_view(),
        name='report-upload',
    ),
    path(
        'reports/<int:report_id>/download/',
        ReportDownloadView.as_view(),
        name='report-download',
    ),
    path(
        'reports/<int:report_id>/review/',
        ReportReviewView.as_view(),
        name='report-review',
    ),
    path(
        'reports/<int:report_id>/collect-tasks/',
        ReportCollectTasksView.as_view(),
        name='report-collect-tasks',
    ),
]
