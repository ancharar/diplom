"""Сериализаторы приложения projects."""

from rest_framework import serializers

from users.serializers import UserSerializer

from .models import JoinRequest, Project, ProjectHistory, ProjectMembership


class ProjectMembershipSerializer(serializers.ModelSerializer):
    """Сериализатор участия в проекте."""

    user = UserSerializer(read_only=True)

    class Meta:
        model = ProjectMembership
        fields = ('id', 'user', 'project_role', 'joined_at')
        read_only_fields = ('id', 'joined_at')


class ProjectSerializer(serializers.ModelSerializer):
    """Сериализатор проекта для чтения."""

    owner = UserSerializer(read_only=True)
    memberships = ProjectMembershipSerializer(many=True, read_only=True)

    class Meta:
        model = Project
        fields = (
            'id', 'title', 'description', 'area', 'status', 'goal',
            'owner', 'memberships', 'start_date', 'end_date',
            'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'owner', 'created_at', 'updated_at')


class ProjectCatalogSerializer(serializers.ModelSerializer):
    """Облегчённый сериализатор для каталога проектов."""

    members_count = serializers.SerializerMethodField()
    is_member = serializers.SerializerMethodField()
    has_pending_request = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = (
            'id', 'title', 'description', 'goal', 'area', 'status',
            'start_date', 'end_date',
            'members_count', 'is_member', 'has_pending_request',
        )

    def get_members_count(self, obj: Project) -> int:
        return obj.memberships.count()

    def get_is_member(self, obj: Project) -> bool:
        user = self.context['request'].user
        return (
            obj.owner_id == user.id
            or obj.memberships.filter(user=user).exists()
        )

    def get_has_pending_request(self, obj: Project) -> bool:
        user = self.context['request'].user
        return obj.join_requests.filter(
            user=user, status='pending',
        ).exists()


class ProjectCreateSerializer(serializers.ModelSerializer):
    """Сериализатор для создания проекта."""

    class Meta:
        model = Project
        fields = ('title', 'description', 'area', 'goal', 'start_date', 'end_date')

    def validate(self, attrs: dict) -> dict:
        """Проверка: end_date >= start_date."""
        if attrs.get('end_date') and attrs.get('start_date'):
            if attrs['end_date'] < attrs['start_date']:
                raise serializers.ValidationError(
                    {'end_date': 'Дата окончания не может быть раньше даты начала.'}
                )
        return attrs


class ProjectUpdateSerializer(serializers.ModelSerializer):
    """Сериализатор для обновления проекта."""

    class Meta:
        model = Project
        fields = ('title', 'description', 'area', 'status', 'goal', 'start_date', 'end_date')

    def validate(self, attrs: dict) -> dict:
        """Проверка: end_date >= start_date."""
        start = attrs.get('start_date', self.instance.start_date if self.instance else None)
        end = attrs.get('end_date', self.instance.end_date if self.instance else None)
        if start and end and end < start:
            raise serializers.ValidationError(
                {'end_date': 'Дата окончания не может быть раньше даты начала.'}
            )
        return attrs


class AddMemberSerializer(serializers.Serializer):
    """Сериализатор для добавления участника в проект."""

    user_id = serializers.IntegerField()
    project_role = serializers.ChoiceField(choices=ProjectMembership.PROJECT_ROLE_CHOICES)


class ProjectHistorySerializer(serializers.ModelSerializer):
    """Сериализатор истории изменений проекта."""

    changed_by = UserSerializer(read_only=True)

    class Meta:
        model = ProjectHistory
        fields = ('id', 'field_name', 'old_value', 'new_value', 'changed_by', 'changed_at')
        read_only_fields = fields


class JoinRequestCreateSerializer(serializers.Serializer):
    """Сериализатор для создания заявки на вступление."""

    desired_role = serializers.ChoiceField(
        choices=ProjectMembership.PROJECT_ROLE_CHOICES,
    )
    message = serializers.CharField(
        required=False, allow_blank=True, default='',
    )


class JoinRequestSerializer(serializers.ModelSerializer):
    """Сериализатор заявки на вступление."""

    user = UserSerializer(read_only=True)
    reviewed_by = UserSerializer(read_only=True)

    class Meta:
        model = JoinRequest
        fields = (
            'id', 'user', 'project', 'desired_role',
            'assigned_role', 'message', 'status',
            'reviewed_by', 'reviewed_at', 'created_at',
        )
        read_only_fields = fields


class JoinRequestReviewSerializer(serializers.Serializer):
    """Сериализатор для рассмотрения заявки."""

    action = serializers.ChoiceField(
        choices=[('approved', 'Одобрить'), ('rejected', 'Отклонить')],
    )
    assigned_role = serializers.ChoiceField(
        choices=ProjectMembership.PROJECT_ROLE_CHOICES,
        required=False,
    )
