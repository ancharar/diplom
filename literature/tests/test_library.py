"""Тесты приложения literature."""

import pytest
from unittest.mock import patch, MagicMock
from django.core.files.uploadedfile import SimpleUploadedFile


def test_upload_success(auth_client, project_with_member):
    f = SimpleUploadedFile('article.pdf', b'%PDF content')
    with patch('literature.services.get_files_collection') as mock_col:
        mock_collection = MagicMock()
        mock_collection.insert_one.return_value.inserted_id = 'abc123'
        mock_col.return_value = mock_collection
        resp = auth_client.post(
            f'/api/v1/projects/{project_with_member.id}/literature/files/',
            {'file': f, 'description': 'Статья'},
            format='multipart',
        )
    assert resp.status_code == 201


def test_upload_oversized(auth_client, project_with_member):
    f = SimpleUploadedFile('big.pdf', b'x' * 52_428_801)
    resp = auth_client.post(
        f'/api/v1/projects/{project_with_member.id}/literature/files/',
        {'file': f},
        format='multipart',
    )
    assert resp.status_code == 400


def test_upload_invalid_format(auth_client, project_with_member):
    f = SimpleUploadedFile('image.jpg', b'image data')
    resp = auth_client.post(
        f'/api/v1/projects/{project_with_member.id}/literature/files/',
        {'file': f},
        format='multipart',
    )
    assert resp.status_code == 400


def test_upload_not_member(outsider_client, project):
    f = SimpleUploadedFile('doc.pdf', b'content')
    resp = outsider_client.post(
        f'/api/v1/projects/{project.id}/literature/files/',
        {'file': f},
        format='multipart',
    )
    assert resp.status_code == 403


def test_search_empty_query(auth_client, project_with_member):
    resp = auth_client.get(
        f'/api/v1/projects/{project_with_member.id}/literature/search/?q=',
    )
    assert resp.status_code == 400


def test_search_too_long_query(auth_client, project_with_member):
    resp = auth_client.get(
        f'/api/v1/projects/{project_with_member.id}/literature/search/?q={"x" * 201}',
    )
    assert resp.status_code == 400
