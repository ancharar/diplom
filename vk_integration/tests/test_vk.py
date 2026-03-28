"""Тесты приложения vk_integration."""

import pytest
from unittest.mock import patch, MagicMock


def test_publish_success(auth_client_with_vk_token, project):
    mock_response = MagicMock()
    mock_response.json.return_value = {'response': {'post_id': 42}}
    with patch('vk_integration.services.http_requests.post', return_value=mock_response):
        resp = auth_client_with_vk_token.post('/api/v1/vk/publish/', {
            'project_id': project.id,
            'text': 'Тестовая публикация',
            'owner_id': -1,
        }, format='json')
    assert resp.status_code == 200


def test_publish_empty_text(auth_client_with_vk_token, project):
    resp = auth_client_with_vk_token.post('/api/v1/vk/publish/', {
        'project_id': project.id,
        'text': '',
        'owner_id': -1,
    }, format='json')
    assert resp.status_code == 400


def test_publish_too_long_text(auth_client_with_vk_token, project):
    resp = auth_client_with_vk_token.post('/api/v1/vk/publish/', {
        'project_id': project.id,
        'text': 'x' * 4097,
        'owner_id': -1,
    }, format='json')
    assert resp.status_code == 400


def test_publish_no_vk_token(auth_client, project):
    resp = auth_client.post('/api/v1/vk/publish/', {
        'project_id': project.id,
        'text': 'Тест',
        'owner_id': -1,
    }, format='json')
    assert resp.status_code == 401


def test_vk_history(auth_client_with_vk_token, project):
    resp = auth_client_with_vk_token.get(
        f'/api/v1/vk/history/?project_id={project.id}',
    )
    assert resp.status_code == 200
    assert isinstance(resp.data, list)
