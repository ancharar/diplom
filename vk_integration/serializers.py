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

    project = serializers.IntegerField()
    title = serializers.CharField(max_length=255)
    content = serializers.CharField()
    owner_id = serializers.IntegerField()


class VKPublicationSerializer(serializers.ModelSerializer):
    """Сериализатор публикации VK."""

    author = UserSerializer(read_only=True)

    class Meta:
        model = VKPublication
        fields = (
            'id', 'project', 'author', 'title', 'content',
            'vk_post_id', 'owner_id', 'status', 'published_at',
            'error_message', 'created_at',
        )
        read_only_fields = fields
