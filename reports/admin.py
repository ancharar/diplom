from django.contrib import admin
from .models import ReportTemplate, Report, ReportTask


@admin.register(ReportTemplate)
class ReportTemplateAdmin(admin.ModelAdmin):
    list_display = ['title', 'project', 'frequency', 'is_active', 'created_at']
    list_filter = ['frequency', 'is_active', 'project']
    search_fields = ['title', 'project__title']


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ['__str__', 'status', 'deadline', 'submitted_at']
    list_filter = ['status', 'template__project']
    search_fields = ['user__full_name', 'template__title']


@admin.register(ReportTask)
class ReportTaskAdmin(admin.ModelAdmin):
    list_display = ['report', 'task', 'status_before', 'status_after', 'time_spent']