"""Сериализаторы приложения tasks."""

from rest_framework import serializers

from users.serializers import UserSerializer

from .models import Task, TaskAttachment, TaskHistory
from .services import ALLOWED_TRANSITIONS


class TaskSerializer(serializers.ModelSerializer):
    """Сериализатор задачи для чтения."""

    assignee = UserSerializer(read_only=True)
    created_by = UserSerializer(read_only=True)
    status_display = serializers.CharField(source='get_status_display', 
                                           read_only=True)
    allowed_transitions = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = (
            'id', 'title', 'description', 'technical_spec', 'project',
            'assignee', 'created_by',
            'status', 'status_display', 'deadline', 'allowed_transitions',
            'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'project', 'created_by', 'created_at', 
                            'updated_at')

    def get_allowed_transitions(self, obj: Task) -> list[str]:
        """Возвращает допустимые переходы из текущего состояния."""
        return ALLOWED_TRANSITIONS.get(obj.status, [])


class TaskCreateSerializer(serializers.ModelSerializer):
    """Сериализатор для создания задачи."""

    class Meta:
        model = Task
        fields = ('title', 'description', 'technical_spec', 'assignee', 
                  'deadline')
        extra_kwargs = {
            'title': {'required': True},
        }


class TaskUpdateSerializer(serializers.ModelSerializer):
    """Сериализатор для обновления задачи (без статуса — статус через transition)."""

    class Meta:
        model = Task
        fields = ('title', 'description', 'technical_spec', 'assignee', 'deadline')


class TaskTransitionSerializer(serializers.Serializer):
    """Сериализатор для перехода состояния задачи."""

    status = serializers.CharField()


class TaskHistorySerializer(serializers.ModelSerializer):
    """Сериализатор истории изменений задачи."""

    changed_by = UserSerializer(read_only=True)

    class Meta:
        model = TaskHistory
        fields = ('id', 'field_name', 'old_value', 'new_value', 'changed_by', 
                  'changed_at')
        read_only_fields = fields


class TaskAttachmentSerializer(serializers.ModelSerializer):
    """Сериализатор вложения задачи (чтение)."""

    file_url = serializers.SerializerMethodField()
    uploaded_by = UserSerializer(read_only=True)

    class Meta:
        model = TaskAttachment
        fields = (
            'id', 'attachment_type', 'file_name', 'file_size',
            'file_url', 'url', 'description',
            'uploaded_by', 'created_at',
        )
        read_only_fields = fields

    def get_file_url(self, obj: TaskAttachment) -> str:
        return obj.file.url if obj.file else ''


class TaskAttachmentCreateSerializer(serializers.Serializer):
    """Сериализатор для создания вложения."""

    attachment_type = serializers.ChoiceField(
        choices=['file', 'link'], default='file',
    )
    file = serializers.FileField(required=False)
    url = serializers.URLField(required=False)
    description = serializers.CharField(
        max_length=500, required=False, default='',
    )

    def validate(self, attrs):
        atype = attrs.get('attachment_type', 'file')
        if atype == 'file' and not attrs.get('file'):
            raise serializers.ValidationError(
                {'file': 'Файл обязателен для типа "file".'},
            )
        if atype == 'link' and not attrs.get('url'):
            raise serializers.ValidationError(
                {'url': 'Ссылка обязательна для типа "link".'},
            )
        return attrs
