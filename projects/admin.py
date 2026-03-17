"""Настройка админ-панели для приложения projects."""

from django.contrib import admin

from .models import JoinRequest, Project, ProjectHistory, ProjectMembership


class ProjectMembershipInline(admin.TabularInline):
    """Инлайн для отображения участников проекта."""

    model = ProjectMembership
    extra = 0


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    """Админ-панель для модели Project."""

    list_display = ('title', 'area', 'status', 'owner', 'start_date', 'end_date')
    list_filter = ('status', 'area')
    search_fields = ('title', 'description')
    inlines = [ProjectMembershipInline]


@admin.register(ProjectHistory)
class ProjectHistoryAdmin(admin.ModelAdmin):
    """Админ-панель для истории изменений проектов."""

    list_display = ('project', 'changed_by', 'field_name', 'changed_at')
    list_filter = ('field_name',)
    readonly_fields = ('project', 'changed_by', 'field_name', 'old_value', 'new_value', 'changed_at')


@admin.register(JoinRequest)
class JoinRequestAdmin(admin.ModelAdmin):
    """Админ-панель для заявок на вступление."""

    list_display = ('user', 'project', 'desired_role', 'status', 'created_at')
    list_filter = ('status',)
