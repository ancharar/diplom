"""Настройка админ-панели для приложения users."""

from django.contrib import admin
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

User = get_user_model()


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Админ-панель для кастомной модели пользователя."""

    list_display = ('email', 'full_name', 'is_active', 'is_staff', 'created_at')
    # ROLE_DISABLED: убрано 'role' из list_display и list_filter
    list_filter = ('is_active', 'is_staff')
    search_fields = ('email', 'full_name')
    ordering = ('-created_at',)

    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Личные данные', {'fields': ('full_name',)}),
        # ROLE_DISABLED: убрано 'role' из fieldsets
        ('Права доступа', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Даты', {'fields': ('created_at', 'updated_at')}),
    )
    readonly_fields = ('created_at', 'updated_at')

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            # ROLE_DISABLED: убрано 'role' из add_fieldsets
            'fields': ('email', 'full_name', 'password1', 'password2'),
        }),
    )
