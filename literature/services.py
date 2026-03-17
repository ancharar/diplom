"""Сервисный слой для работы с литературными источниками и файлами в MongoDB."""

import base64
from datetime import datetime, timezone

from bson import ObjectId

from .mongo import get_files_collection, get_sources_collection


# ── Литературные источники ───────────────────────────────────────────────────

def _serialize_source(doc: dict) -> dict:
    """Преобразует MongoDB-документ в JSON-совместимый словарь."""
    doc['id'] = str(doc.pop('_id'))
    return doc


def list_sources(project_id: int) -> list[dict]:
    """Список источников проекта."""
    col = get_sources_collection()
    docs = col.find({'project_id': project_id}).sort('created_at', -1)
    return [_serialize_source(d) for d in docs]


def get_source(source_id: str) -> dict | None:
    """Получить источник по ID."""
    doc = get_sources_collection().find_one({'_id': ObjectId(source_id)})
    return _serialize_source(doc) if doc else None


def create_source(data: dict) -> dict:
    """Создать литературный источник."""
    doc = {
        'project_id': data['project_id'],
        'title': data['title'],
        'authors': data.get('authors', ''),
        'year': data.get('year'),
        'url': data.get('url', ''),
        'description': data.get('description', ''),
        'tags': data.get('tags', []),
        'added_by': data['added_by'],
        'created_at': datetime.now(timezone.utc),
        'updated_at': datetime.now(timezone.utc),
    }
    result = get_sources_collection().insert_one(doc)
    doc['_id'] = result.inserted_id
    return _serialize_source(doc)


def update_source(source_id: str, data: dict) -> dict | None:
    """Обновить литературный источник."""
    update_fields = {k: v for k, v in data.items() if k not in ('id', '_id', 'project_id', 'added_by', 'created_at')}
    update_fields['updated_at'] = datetime.now(timezone.utc)
    col = get_sources_collection()
    col.update_one({'_id': ObjectId(source_id)}, {'$set': update_fields})
    return get_source(source_id)


def delete_source(source_id: str) -> bool:
    """Удалить литературный источник."""
    result = get_sources_collection().delete_one({'_id': ObjectId(source_id)})
    return result.deleted_count > 0


# ── Файлы ────────────────────────────────────────────────────────────────────

def _serialize_file(doc: dict) -> dict:
    """Преобразует MongoDB-документ файла (без бинарного содержимого)."""
    doc['id'] = str(doc.pop('_id'))
    doc.pop('content', None)  # не отдаём бинарное содержимое в списках
    return doc


def list_files(project_id: int) -> list[dict]:
    """Список файлов проекта (без содержимого)."""
    col = get_files_collection()
    docs = col.find({'project_id': project_id}, {'content': 0}).sort('uploaded_at', -1)
    return [_serialize_file(d) for d in docs]


def upload_file(data: dict) -> dict:
    """Сохранить файл в MongoDB."""
    doc = {
        'project_id': data['project_id'],
        'filename': data['filename'],
        'content_type': data.get('content_type', 'application/octet-stream'),
        'size': data.get('size', 0),
        'description': data.get('description', ''),
        'content': data['content'],  # bytes или base64-строка
        'uploaded_by': data['uploaded_by'],
        'uploaded_at': datetime.now(timezone.utc),
    }
    result = get_files_collection().insert_one(doc)
    doc['_id'] = result.inserted_id
    return _serialize_file(doc)


def get_file_content(file_id: str) -> dict | None:
    """Получить файл вместе с содержимым для скачивания."""
    doc = get_files_collection().find_one({'_id': ObjectId(file_id)})
    if not doc:
        return None
    doc['id'] = str(doc.pop('_id'))
    # Если content — bytes, кодируем в base64 для API
    if isinstance(doc.get('content'), bytes):
        doc['content'] = base64.b64encode(doc['content']).decode()
    return doc


def delete_file(file_id: str) -> bool:
    """Удалить файл."""
    result = get_files_collection().delete_one({'_id': ObjectId(file_id)})
    return result.deleted_count > 0
