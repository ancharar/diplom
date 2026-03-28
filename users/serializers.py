"""Сериализаторы приложения users."""

from django.contrib.auth import get_user_model
from rest_framework import serializers

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    """Сериализатор регистрации нового пользователя."""

    password = serializers.CharField(
        min_length=8,
        write_only=True,
        error_messages={
            'min_length': 'Пароль должен содержать минимум 8 символов.',
        },
    )

    class Meta:
        model = User
        fields = ('id', 'email', 'full_name', 'password')
        # ROLE_DISABLED: убрано 'role' из fields
        extra_kwargs = {
            'full_name': {'required': True},
            # ROLE_DISABLED: 'role': {'required': False},
        }

    def validate_email(self, value: str) -> str:
        """Приведение email к нижнему регистру и проверка уникальности."""
        value = value.lower()
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError('Пользователь с таким email уже существует.')
        return value

    def create(self, validated_data: dict) -> User:
        """Создание пользователя с хешированием пароля."""
        return User.objects.create_user(**validated_data)


class UserSerializer(serializers.ModelSerializer):
    """Сериализатор для чтения и обновления профиля пользователя."""

    class Meta:
        model = User
        fields = ('id', 'email', 'full_name', 'is_active', 'created_at', 'updated_at')
        # ROLE_DISABLED: убрано 'role' из fields
        read_only_fields = ('id', 'email', 'is_active', 'created_at', 'updated_at')


class LoginSerializer(serializers.Serializer):
    """Сериализатор для входа (email + пароль)."""

    email = serializers.EmailField()
    password = serializers.CharField()
