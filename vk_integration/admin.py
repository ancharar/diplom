"""Настройка админ-панели для приложения vk_integration."""

from django.contrib import admin

from .models import VKPublication, VKToken


@admin.register(VKToken)
class VKTokenAdmin(admin.ModelAdmin):
    """Админ-панель для VK-токенов."""

    list_display = ('user', 'vk_user_id', 'created_at', 'updated_at')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(VKPublication)
class VKPublicationAdmin(admin.ModelAdmin):
    """Админ-панель для VK-публикаций."""

    list_display = ('title', 'author', 'project', 'status', 'published_at', 'created_at')
    list_filter = ('status', 'project')
    search_fields = ('title', 'content')
    readonly_fields = ('vk_post_id', 'published_at', 'error_message', 'created_at')
