"""Сериализаторы приложения vk_integration."""

from rest_framework import serializers

from users.serializers import UserSerializer

from .models import VKPublication, VKToken


class VKTokenSerializer(serializers.Serializer):
    """Сериализатор для сохранения VK-токена."""

    access_token = serializers.CharField()


class VKTokenResponseSerializer(serializers.ModelSerializer):
    """Сериализатор для отображения VK-токена."""

    class Meta:
        model = VKToken
        fields = ('id', 'vk_user_id', 'created_at', 'updated_at')
        read_only_fields = fields


class VKPublishSerializer(serializers.Serializer):
    """Сериализатор для публикации поста в VK."""

    project_id = serializers.IntegerField()
    text = serializers.CharField(max_length=4096)
    owner_id = serializers.IntegerField()
    attachment_type = serializers.ChoiceField(
        choices=['none', 'photo', 'doc'], default='none',
    )
    file = serializers.FileField(required=False)

    def validate(self, attrs):
        atype = attrs.get('attachment_type', 'none')
        if atype != 'none' and not attrs.get('file'):
            raise serializers.ValidationError(
                {'file': 'Файл обязателен при выбранном типе вложения.'},
            )
        return attrs


class VKPublicationSerializer(serializers.ModelSerializer):
    """Сериализатор публикации VK."""

    author = UserSerializer(read_only=True)

    class Meta:
        model = VKPublication
        fields = (
            'id', 'project', 'author', 'title', 'content',
            'vk_post_id', 'owner_id', 'attachment_type',
            'vk_attachment_id', 'status', 'published_at',
            'error_message', 'created_at',
        )
        read_only_fields = fields
