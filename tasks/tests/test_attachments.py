"""Тесты прикрепления файлов и ссылок к задачам."""

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile


def make_file(name='test.pdf', size=1024):
    return SimpleUploadedFile(name, b'x' * size)


def test_attach_file_success(auth_client, task_in_project):
    """Загрузка файла допустимого формата <= 50 МБ -> 201."""
    resp = auth_client.post(
        f'/api/v1/tasks/{task_in_project.id}/attachments/',
        {
            'attachment_type': 'file',
            'file': make_file('doc.pdf'),
        },
        format='multipart',
    )
    assert resp.status_code == 201
    assert resp.data['file_name'] == 'doc.pdf'
    assert resp.data['attachment_type'] == 'file'


def test_attach_oversized(auth_client, task_in_project):
    """Файл > 50 МБ -> 400."""
    big = SimpleUploadedFile('big.pdf', b'x' * 52_428_801)
    resp = auth_client.post(
        f'/api/v1/tasks/{task_in_project.id}/attachments/',
        {'attachment_type': 'file', 'file': big},
        format='multipart',
    )
    assert resp.status_code == 400


def test_attach_invalid_format(auth_client, task_in_project):
    """Недопустимый формат (.exe) -> 400."""
    resp = auth_client.post(
        f'/api/v1/tasks/{task_in_project.id}/attachments/',
        {
            'attachment_type': 'file',
            'file': make_file('script.exe'),
        },
        format='multipart',
    )
    assert resp.status_code == 400


def test_attach_link_success(auth_client, task_in_project):
    """Прикрепление ссылки -> 201."""
    resp = auth_client.post(
        f'/api/v1/tasks/{task_in_project.id}/attachments/',
        {
            'attachment_type': 'link',
            'url': 'https://example.com/paper.pdf',
            'description': 'Полезная статья',
        },
        format='json',
    )
    assert resp.status_code == 201
    assert resp.data['attachment_type'] == 'link'
    assert resp.data['url'] == 'https://example.com/paper.pdf'


def test_attach_not_member(outsider_client, task_in_project):
    """Не участник проекта -> 403."""
    resp = outsider_client.post(
        f'/api/v1/tasks/{task_in_project.id}/attachments/',
        {'attachment_type': 'file', 'file': make_file()},
        format='multipart',
    )
    assert resp.status_code == 403


def test_attach_task_not_found(auth_client):
    """Несуществующая задача -> 404."""
    resp = auth_client.post(
        '/api/v1/tasks/99999/attachments/',
        {'attachment_type': 'file', 'file': make_file()},
        format='multipart',
    )
    assert resp.status_code == 404


def test_delete_own_attachment(auth_client, task_in_project):
    """Автор может удалить своё вложение -> 204."""
    resp = auth_client.post(
        f'/api/v1/tasks/{task_in_project.id}/attachments/',
        {
            'attachment_type': 'file',
            'file': make_file('del.pdf'),
        },
        format='multipart',
    )
    att_id = resp.data['id']
    del_resp = auth_client.delete(
        f'/api/v1/tasks/{task_in_project.id}'
        f'/attachments/{att_id}/',
    )
    assert del_resp.status_code == 204


def test_delete_others_attachment_forbidden(
    auth_client, outsider_client,
    task_in_project, user, outsider,
):
    """Не автор и не owner -> 403."""
    # Создаём вложение от user (owner)
    resp = auth_client.post(
        f'/api/v1/tasks/{task_in_project.id}/attachments/',
        {
            'attachment_type': 'file',
            'file': make_file('own.pdf'),
        },
        format='multipart',
    )
    att_id = resp.data['id']

    # outsider не может удалить
    del_resp = outsider_client.delete(
        f'/api/v1/tasks/{task_in_project.id}'
        f'/attachments/{att_id}/',
    )
    assert del_resp.status_code == 403


def test_list_attachments(auth_client, task_in_project):
    """GET список вложений задачи."""
    auth_client.post(
        f'/api/v1/tasks/{task_in_project.id}/attachments/',
        {
            'attachment_type': 'file',
            'file': make_file('a.pdf'),
        },
        format='multipart',
    )
    resp = auth_client.get(
        f'/api/v1/tasks/{task_in_project.id}/attachments/',
    )
    assert resp.status_code == 200
    assert len(resp.data) == 1
