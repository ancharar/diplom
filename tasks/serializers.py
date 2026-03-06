"""Сериализаторы приложения tasks."""

from rest_framework import serializers

from users.serializers import UserSerializer

from .models import Task, TaskHistory
from .services import ALLOWED_TRANSITIONS


class TaskSerializer(serializers.ModelSerializer):
    """Сериализатор задачи для чтения."""

    assignee = UserSerializer(read_only=True)
    created_by = UserSerializer(read_only=True)
    allowed_transitions = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = (
            'id', 'title', 'description', 'project', 'assignee', 'created_by',
            'status', 'priority', 'deadline', 'allowed_transitions',
            'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'project', 'created_by', 'created_at', 'updated_at')

    def get_allowed_transitions(self, obj: Task) -> list[str]:
        """Возвращает допустимые переходы из текущего состояния."""
        return ALLOWED_TRANSITIONS.get(obj.status, [])


class TaskCreateSerializer(serializers.ModelSerializer):
    """Сериализатор для создания задачи."""

    class Meta:
        model = Task
        fields = ('title', 'description', 'assignee', 'priority', 'deadline')
        extra_kwargs = {
            'title': {'required': True},
        }


class TaskUpdateSerializer(serializers.ModelSerializer):
    """Сериализатор для обновления задачи (без статуса — статус через transition)."""

    class Meta:
        model = Task
        fields = ('title', 'description', 'assignee', 'priority', 'deadline')


class TaskTransitionSerializer(serializers.Serializer):
    """Сериализатор для перехода состояния задачи."""

    status = serializers.CharField()


class TaskHistorySerializer(serializers.ModelSerializer):
    """Сериализатор истории изменений задачи."""

    changed_by = UserSerializer(read_only=True)

    class Meta:
        model = TaskHistory
        fields = ('id', 'field_name', 'old_value', 'new_value', 'changed_by', 'changed_at')
        read_only_fields = fields
