"""URL-маршруты приложения reports."""

from django.urls import path

from .views import (
    ReportTemplateListCreateView,
    ReportTemplateDetailView,
    ReportListView,
    MyReportsView,
    GenerateReportsView,
    ReportDetailView,
    ReportSubmitView,
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
        name='report-templates'
    ),
    path(
        'projects/<int:project_id>/report-templates/<int:template_id>/',
        ReportTemplateDetailView.as_view(),
        name='report-template-detail'
    ),
    
    # Отчеты
    path(
        'projects/<int:project_id>/reports/',
        ReportListView.as_view(),
        name='reports'
    ),
    path(
        'projects/<int:project_id>/reports/generate/',
        GenerateReportsView.as_view(),
        name='generate-reports'
    ),
    path(
        'projects/<int:project_id>/reports/summary/',
        ReportSummaryView.as_view(),
        name='reports-summary'
    ),
    path(
        'reports/my/',
        MyReportsView.as_view(),
        name='my-reports'
    ),
    path(
        'reports/<int:report_id>/',
        ReportDetailView.as_view(),
        name='report-detail'
    ),
    path(
        'reports/<int:report_id>/submit/',
        ReportSubmitView.as_view(),
        name='report-submit'
    ),
    path(
        'reports/<int:report_id>/review/',
        ReportReviewView.as_view(),
        name='report-review'
    ),
    path(
        'reports/<int:report_id>/collect-tasks/',
        ReportCollectTasksView.as_view(),
        name='report-collect-tasks'
    ),
]