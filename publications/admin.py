"""Настройка админ-панели для приложения publications."""

from django.contrib import admin

from .models import Publication


@admin.register(Publication)
class PublicationAdmin(admin.ModelAdmin):
    list_display = [
        'title', 'user', 'year', 'doi',
        'extraction_confidence', 'created_at',
    ]
    list_filter = ['extraction_confidence', 'year']
    search_fields = ['title', 'user__full_name', 'doi']
