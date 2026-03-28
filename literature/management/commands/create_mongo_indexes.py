"""Management-команда для создания индексов MongoDB."""

from django.core.management.base import BaseCommand
from pymongo import DESCENDING, TEXT

from literature.mongo import get_files_collection, get_sources_collection


class Command(BaseCommand):
    help = 'Создать индексы MongoDB для библиотеки'

    def handle(self, *args, **kwargs):
        sources = get_sources_collection()
        files = get_files_collection()

        # Полнотекстовый поиск по источникам
        sources.create_index(
            [('title', TEXT), ('authors', TEXT), ('tags', TEXT)],
            name='library_text_index',
            default_language='russian',
        )
        self.stdout.write('  Индекс library_text_index создан')

        # Фильтрация источников по проекту + сортировка
        sources.create_index(
            [('project_id', 1), ('created_at', DESCENDING)],
            name='sources_project_id',
        )
        self.stdout.write('  Индекс sources_project_id создан')

        # Фильтрация файлов по проекту + сортировка
        files.create_index(
            [('project_id', 1), ('uploaded_at', DESCENDING)],
            name='files_project_id',
        )
        self.stdout.write('  Индекс files_project_id создан')

        self.stdout.write(self.style.SUCCESS(
            'Все индексы MongoDB созданы',
        ))
