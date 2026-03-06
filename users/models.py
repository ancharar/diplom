"""Модели приложения users."""

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models


class UserManager(BaseUserManager):
    """Менеджер кастомной модели пользователя."""

    def create_user(
        self, email: str, full_name: str, password: str | None = None, **extra_fields
    ) -> 'User':
        """Создание обычного пользователя."""
        if not email:
            raise ValueError('Email обязателен')
        email = self.normalize_email(email)
        user = self.model(email=email, full_name=full_name, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(
        self, email: str, full_name: str, password: str | None = None, **extra_fields
    ) -> 'User':
        """Создание суперпользователя."""
        extra_fields.setdefault('role', 'admin')
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, full_name, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """Кастомная модель пользователя. Email используется для аутентификации."""

    ROLE_CHOICES = [
        ('admin', 'Администратор'),
        ('member', 'Участник'),
    ]

    email = models.EmailField('Email', unique=True)
    full_name = models.CharField('ФИО', max_length=255)
    role = models.CharField('Роль', max_length=10, choices=ROLE_CHOICES, default='member')
    is_active = models.BooleanField('Активен', default=True)
    is_staff = models.BooleanField('Доступ к админке', default=False)
    created_at = models.DateTimeField('Дата создания', auto_now_add=True)
    updated_at = models.DateTimeField('Дата обновления', auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['full_name']

    class Meta:
        verbose_name = 'Пользователь'
        verbose_name_plural = 'Пользователи'

    def __str__(self) -> str:
        return self.email
