from rest_framework import serializers
from .models import Notification


class NotificationProjectSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    title = serializers.CharField()


class NotificationTaskSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    title = serializers.CharField()


class NotificationInvitationSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    status = serializers.CharField()


class NotificationSerializer(serializers.ModelSerializer):
    project = serializers.SerializerMethodField()
    task = serializers.SerializerMethodField()
    invitation = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = (
            'id', 'notification_type', 'title', 'message',
            'is_read', 'project', 'task', 'invitation', 'created_at',
        )

    def get_project(self, obj):
        if obj.project_id:
            return {'id': obj.project.id, 'title': obj.project.title}
        return None

    def get_task(self, obj):
        if obj.task_id:
            return {'id': obj.task.id, 'title': obj.task.title}
        return None

    def get_invitation(self, obj):
        if obj.invitation_id:
            return {'id': obj.invitation.id}
        return None
