"""Сервисный слой для работы с литературными источниками и файлами в MongoDB."""

import base64
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

import requests as http_requests
from bson import ObjectId
from django.core.exceptions import ValidationError

from .mongo import (
    get_files_collection,
    get_gost_templates_collection,
    get_sources_collection,
)

# ── Валидация файлов ─────────────────────────────────────────────────────────

ALLOWED_FORMATS = {'pdf', 'doc', 'docx', 'txt', 'xlsx', 'pptx'}
MAX_FILE_SIZE = 52_428_800  # 50 МБ


def validate_file(file) -> None:
    """Проверить файл перед сохранением."""
    if not file.name or len(file.name) > 255:
        raise ValidationError('Недопустимое имя файла')

    ext = file.name.rsplit('.', 1)[-1].lower() if '.' in file.name else ''
    if ext not in ALLOWED_FORMATS:
        raise ValidationError(
            f'Недопустимый формат. Разрешены: {", ".join(sorted(ALLOWED_FORMATS))}'
        )

    if file.size > MAX_FILE_SIZE:
        raise ValidationError('Размер файла превышает 50 МБ')


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
        'source_type': data.get('source_type', ''),
        'title': data['title'],
        'authors': data.get('authors', ''),
        'year': data.get('year'),
        'journal': data.get('journal', ''),
        'volume': data.get('volume', ''),
        'issue': data.get('issue', ''),
        'pages': data.get('pages', ''),
        'doi': data.get('doi', ''),
        'publisher': data.get('publisher', ''),
        'city': data.get('city', ''),
        'total_pages': data.get('total_pages', ''),
        'access_date': data.get('access_date', ''),
        'url': data.get('url', ''),
        'description': data.get('description', ''),
        'tags': data.get('tags', []),
        'added_by': data['added_by'],
        'created_at': datetime.now(timezone.utc),
        'updated_at': datetime.now(timezone.utc),
    }
    result = get_sources_collection().insert_one(doc)
    source_id = str(result.inserted_id)
    apply_gost_to_source(data['project_id'], source_id)
    return get_source(source_id)


def update_source(source_id: str, data: dict) -> dict | None:
    """Обновить литературный источник."""
    update_fields = {k: v for k, v in data.items() if k not in ('id', '_id', 'project_id', 'added_by', 'created_at')}
    update_fields['updated_at'] = datetime.now(timezone.utc)
    col = get_sources_collection()
    col.update_one({'_id': ObjectId(source_id)}, {'$set': update_fields})
    source = get_source(source_id)
    if source and 'gost_string' not in data:
        # Не перезаписываем gost_string если пользователь редактировал его вручную
        apply_gost_to_source(source['project_id'], source_id)
        return get_source(source_id)
    return source


def delete_source(source_id: str) -> bool:
    """Удалить литературный источник."""
    result = get_sources_collection().delete_one({'_id': ObjectId(source_id)})
    return result.deleted_count > 0


def search_sources(project_id: int, query: str) -> list[dict]:
    """Полнотекстовый поиск по источникам проекта через MongoDB text-индекс."""
    col = get_sources_collection()
    docs = list(
        col.find(
            {'$text': {'$search': query}, 'project_id': project_id},
            {'score': {'$meta': 'textScore'}},
        ).sort([('score', {'$meta': 'textScore'})])
    )
    return [_serialize_source(d) for d in docs]


# ── Поиск на arXiv ───────────────────────────────────────────────────────────

ARXIV_API_URL = 'http://export.arxiv.org/api/query'
ATOM_NS = '{http://www.w3.org/2005/Atom}'
ARXIV_NS = '{http://arxiv.org/schemas/atom}'


def search_arxiv(query: str, start: int = 0, max_results: int = 10) -> list[dict]:
    """Поиск статей на arXiv по ключевым словам."""
    params = {
        'search_query': f'all:{query}',
        'start': start,
        'max_results': max_results,
        'sortBy': 'relevance',
        'sortOrder': 'descending',
    }
    resp = http_requests.get(ARXIV_API_URL, params=params, timeout=15)
    resp.raise_for_status()

    root = ET.fromstring(resp.text)
    results = []

    for entry in root.findall(f'{ATOM_NS}entry'):
        arxiv_id_url = entry.findtext(f'{ATOM_NS}id', '')
        arxiv_id = arxiv_id_url.split('/abs/')[-1] if '/abs/' in arxiv_id_url else arxiv_id_url

        authors = [
            a.findtext(f'{ATOM_NS}name', '')
            for a in entry.findall(f'{ATOM_NS}author')
        ]

        published = entry.findtext(f'{ATOM_NS}published', '')
        year = int(published[:4]) if len(published) >= 4 else None

        pdf_url = ''
        for link in entry.findall(f'{ATOM_NS}link'):
            if link.get('title') == 'pdf':
                pdf_url = link.get('href', '')
                break

        categories = [
            cat.get('term', '')
            for cat in entry.findall(f'{ARXIV_NS}primary_category')
        ]
        if not categories:
            categories = [
                cat.get('term', '')
                for cat in entry.findall(f'{ATOM_NS}category')
            ][:3]

        title_text = entry.findtext(f'{ATOM_NS}title', '').strip().replace('\n', ' ')
        summary_text = entry.findtext(f'{ATOM_NS}summary', '').strip().replace('\n', ' ')

        results.append({
            'arxiv_id': arxiv_id,
            'title': title_text,
            'authors': ', '.join(authors),
            'year': year,
            'summary': summary_text,
            'url': arxiv_id_url,
            'pdf_url': pdf_url,
            'categories': categories,
        })

    return results


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


# ── ГОСТ-шаблоны ─────────────────────────────────────────────────────────────

SEPARATOR_MAP = {
    'slash': ' / ',
    'double_slash': ' // ',
    'dash': ' \u2013 ',
    'dot_dash': '. \u2013 ',
    'comma': ', ',
    'dot': '. ',
    'colon': ' : ',
    'number_sign': '\u2116 ',
    'volume_sign': '\u0422. ',
    'pages_sign_ru': '\u0421. ',
    'pages_sign_en': 'P. ',
    'et_al': '[\u0438 \u0434\u0440.]',
    'url_prefix': '\u2013 URL: ',
    'electronic_suffix': ' \u2013 \u0422\u0435\u043a\u0441\u0442 : \u044d\u043b\u0435\u043a\u0442\u0440\u043e\u043d\u043d\u044b\u0439.',
    'direct_suffix': ' \u2013 \u0422\u0435\u043a\u0441\u0442 : \u043d\u0435\u043f\u043e\u0441\u0440\u0435\u0434\u0441\u0442\u0432\u0435\u043d\u043d\u044b\u0439.',
}

SOURCE_TYPES = [
    'journal_article',
    'book',
    'collection_article',
    'electronic_resource',
    'newspaper_article',
    'dissertation',
    'gost_standard',
    'conference_theses',
]


def _serialize_gost_template(doc: dict) -> dict:
    """Преобразует MongoDB-документ шаблона в JSON-совместимый словарь."""
    doc['id'] = str(doc.pop('_id'))
    return doc


def list_gost_templates(project_id: int) -> list[dict]:
    """Список ГОСТ-шаблонов проекта."""
    col = get_gost_templates_collection()
    docs = col.find({'project_id': project_id}).sort('created_at', -1)
    return [_serialize_gost_template(d) for d in docs]


def get_gost_template(template_id: str) -> dict | None:
    """Получить ГОСТ-шаблон по ID."""
    doc = get_gost_templates_collection().find_one(
        {'_id': ObjectId(template_id)},
    )
    return _serialize_gost_template(doc) if doc else None


def create_gost_template(data: dict) -> dict:
    """Создать ГОСТ-шаблон."""
    doc = {
        'project_id': data['project_id'],
        'source_type': data['source_type'],
        'blocks': data.get('blocks', []),
        'created_by': data['created_by'],
        'created_at': datetime.now(timezone.utc),
        'updated_at': datetime.now(timezone.utc),
    }
    result = get_gost_templates_collection().insert_one(doc)
    doc['_id'] = result.inserted_id
    template = _serialize_gost_template(doc)
    _apply_template_to_all_sources(data['project_id'], template)
    return template


def update_gost_template(template_id: str, data: dict) -> dict | None:
    """Обновить ГОСТ-шаблон."""
    update_fields = {
        k: v for k, v in data.items()
        if k not in ('id', '_id', 'project_id', 'created_by', 'created_at')
    }
    update_fields['updated_at'] = datetime.now(timezone.utc)
    col = get_gost_templates_collection()
    col.update_one(
        {'_id': ObjectId(template_id)},
        {'$set': update_fields},
    )
    template = get_gost_template(template_id)
    if template:
        _apply_template_to_all_sources(template['project_id'], template)
    return template


def delete_gost_template(template_id: str) -> bool:
    """Удалить ГОСТ-шаблон."""
    result = get_gost_templates_collection().delete_one(
        {'_id': ObjectId(template_id)},
    )
    return result.deleted_count > 0


def format_reference(source_data: dict, template: dict) -> str:
    """Форматировать ссылку по ГОСТ-шаблону.

    Итерирует по блокам шаблона. Для полей (field) подставляет
    значение из source_data, пропуская пустые. Для разделителей
    (separator) вставляет литеральную строку, но только если
    следующее/предыдущее поле не было пропущено.
    """
    blocks = template.get('blocks', [])
    parts: list[str] = []

    # Предварительно собираем пары (тип, значение/литерал)
    resolved: list[tuple[str, str | None]] = []
    for block in blocks:
        btype = block.get('type')
        key = block.get('key', '')

        if btype == 'field':
            val = source_data.get(key, '')
            if isinstance(val, list):
                val = ', '.join(str(v) for v in val if v)
            resolved.append(('field', str(val).strip() if val else None))
        elif btype == 'separator':
            if key == 'access_date_wrap':
                ad = source_data.get('access_date', '')
                if ad:
                    resolved.append(
                        ('separator',
                         f'(\u0434\u0430\u0442\u0430 \u043e\u0431\u0440\u0430\u0449\u0435\u043d\u0438\u044f: {ad})'),
                    )
                else:
                    resolved.append(('separator', None))
            else:
                literal = SEPARATOR_MAP.get(key, '')
                resolved.append(('separator', literal))

    # Сборка: пропускаем разделители рядом с пустыми полями
    i = 0
    while i < len(resolved):
        rtype, rval = resolved[i]

        if rtype == 'field':
            if rval:
                parts.append(rval)
            else:
                # Пропускаем пустое поле и смежные разделители
                # Пропускаем предыдущий разделитель, если он был добавлен
                if parts and i > 0 and resolved[i - 1][0] == 'separator':
                    parts.pop()
                # Пропускаем следующий разделитель
                if (i + 1 < len(resolved)
                        and resolved[i + 1][0] == 'separator'):
                    i += 1
        elif rtype == 'separator':
            if rval:
                parts.append(rval)

        i += 1

    return ''.join(parts).strip()


def _apply_template_to_all_sources(project_id: int, template: dict) -> None:
    """Применить шаблон ко всем источникам проекта с подходящим source_type."""
    source_type = template.get('source_type', '')
    if not source_type:
        return
    col = get_sources_collection()
    for source_doc in col.find({'project_id': project_id, 'source_type': source_type}):
        gost_string = format_reference(source_doc, template)
        col.update_one(
            {'_id': source_doc['_id']},
            {'$set': {'gost_string': gost_string}},
        )


def apply_gost_to_source(project_id: int, source_id: str) -> str | None:
    """Найти подходящий ГОСТ-шаблон и применить к источнику."""
    source = get_source(source_id)
    if not source:
        return None

    source_type = source.get('source_type', '')
    if not source_type:
        return None

    col = get_gost_templates_collection()
    template = col.find_one({
        'project_id': project_id,
        'source_type': source_type,
    })
    if not template:
        return None

    template['id'] = str(template.pop('_id'))
    gost_string = format_reference(source, template)

    # Сохраняем gost_string в источник
    get_sources_collection().update_one(
        {'_id': ObjectId(source_id)},
        {'$set': {'gost_string': gost_string}},
    )

    return gost_string
