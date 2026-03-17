"""Подключение к MongoDB."""

from django.conf import settings
from pymongo import MongoClient

_client = None


def get_db():
    """Возвращает объект базы данных MongoDB (ленивое подключение)."""
    global _client
    if _client is None:
        _client = MongoClient(settings.MONGO_HOST, settings.MONGO_PORT)
    return _client[settings.MONGO_DB_NAME]


def get_sources_collection():
    """Коллекция литературных источников."""
    return get_db()['sources']


def get_files_collection():
    """Коллекция файлов / документов."""
    return get_db()['files']
