"""Сериализаторы приложения publications."""

from rest_framework import serializers

from .models import Publication


class PublicationSerializer(serializers.ModelSerializer):
    """Сериализатор публикации."""

    class Meta:
        model = Publication
        fields = [
            'id', 'title', 'authors', 'year', 'journal',
            'volume', 'issue', 'pages', 'url', 'doi',
            'raw_url', 'gost_string', 'extraction_confidence',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'gost_string', 'created_at', 'updated_at',
        ]


class ExtractMetadataSerializer(serializers.Serializer):
    """Сериализатор для запроса извлечения метаданных."""

    url = serializers.URLField()
