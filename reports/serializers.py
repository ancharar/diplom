"""Сериализаторы приложения reports."""

from rest_framework import serializers

from users.serializers import UserSerializer
from tasks.serializers import TaskSerializer
from .models import ReportTemplate, Report, ReportTask


class ReportTemplateSerializer(serializers.ModelSerializer):
    """Сериализатор шаблона отчета."""

    has_template_file = serializers.SerializerMethodField()
    # Явный default — иначе MultiPartParser трактует отсутствие поля как False
    is_active = serializers.BooleanField(default=True)

    class Meta:
        model = ReportTemplate
        fields = [
            'id', 'project', 'title', 'description', 'frequency',
            'deadline_days', 'template_file', 'has_template_file',
            'is_active', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'project', 'created_at', 'updated_at',
        ]

    def get_has_template_file(self, obj) -> bool:
        return bool(obj.template_file)


class ReportTaskSerializer(serializers.ModelSerializer):
    """Сериализатор задач в отчете."""

    task = TaskSerializer(read_only=True)
    task_id = serializers.IntegerField(
        write_only=True, required=False,
    )

    class Meta:
        model = ReportTask
        fields = [
            'id', 'report', 'task', 'task_id',
            'status_before', 'status_after',
            'time_spent', 'comment',
        ]
        read_only_fields = ['id', 'report']


class ReportSerializer(serializers.ModelSerializer):
    """Сериализатор отчета."""

    user = UserSerializer(read_only=True)
    template_title = serializers.CharField(
        source='template.title', read_only=True,
    )
    template_frequency = serializers.CharField(
        source='template.frequency', read_only=True,
    )
    status_display = serializers.CharField(
        source='get_status_display', read_only=True,
    )
    is_overdue = serializers.BooleanField(read_only=True)
    report_tasks = ReportTaskSerializer(many=True, read_only=True)
    has_submitted_file = serializers.SerializerMethodField()

    class Meta:
        model = Report
        fields = [
            'id', 'template', 'template_title',
            'template_frequency',
            'user', 'period_start', 'period_end', 'deadline',
            'submitted_file', 'has_submitted_file',
            'status', 'status_display', 'is_overdue',
            'submitted_at', 'reviewed_by', 'reviewed_at',
            'review_comment',
            'tasks_data', 'report_tasks',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'user', 'submitted_at', 'reviewed_by',
            'reviewed_at', 'created_at', 'updated_at',
            'is_overdue',
        ]

    def get_has_submitted_file(self, obj) -> bool:
        return bool(obj.submitted_file)


# LEGACY: JSON-based questions (disabled)
# class ReportSubmitSerializer(serializers.Serializer):
#     """Сериализатор для сдачи отчета."""
#     answers = serializers.JSONField(required=False, default=dict)
#     tasks_data = serializers.JSONField(
#         required=False, default=dict,
#     )
#     report_tasks = serializers.ListField(
#         child=serializers.DictField(),
#         required=False,
#         default=list,
#     )
# LEGACY: JSON-based questions (disabled)


class ReportReviewSerializer(serializers.Serializer):
    """Сериализатор для проверки отчета."""

    status = serializers.ChoiceField(
        choices=['reviewed', 'rejected'],
    )
    review_comment = serializers.CharField(
        required=False, allow_blank=True,
    )


class ReportSummarySerializer(serializers.Serializer):
    """Сериализатор сводной статистики по отчетам."""

    total_reports = serializers.IntegerField()
    submitted_reports = serializers.IntegerField()
    pending_reports = serializers.IntegerField()
    overdue_reports = serializers.IntegerField()
    completion_rate = serializers.FloatField()

    user_stats = serializers.ListField(
        child=serializers.DictField(),
    )
