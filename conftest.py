"""Глобальные фикстуры для pytest."""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from projects.models import Project, ProjectMembership
from tasks.models import Task
from vk_integration.models import VKToken

User = get_user_model()


@pytest.fixture
def user(db):
    """Основной тестовый пользователь."""
    return User.objects.create_user(
        email='user@test.com', full_name='Тестовый Пользователь', password='testpass123',
    )


@pytest.fixture
def outsider(db):
    """Пользователь, НЕ являющийся участником проекта."""
    return User.objects.create_user(
        email='outsider@test.com', full_name='Посторонний', password='testpass123',
    )


@pytest.fixture
def project(user):
    """Проект с владельцем user."""
    p = Project.objects.create(
        title='Тестовый проект', area='AI', goal='Тестовая цель',
        owner=user, start_date='2026-01-01', end_date='2026-12-31',
    )
    ProjectMembership.objects.create(user=user, project=p, project_role='researcher')
    return p


@pytest.fixture
def project_with_member(user, project):
    """Алиас для project — пользователь уже участник."""
    return project


@pytest.fixture
def task_in_project(user, project):
    """Задача в проекте со статусом todo."""
    return Task.objects.create(
        title='Тестовая задача', project=project, created_by=user,
    )


@pytest.fixture
def auth_client(user):
    """APIClient, аутентифицированный как user."""
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def outsider_client(outsider):
    """APIClient, аутентифицированный как outsider (не участник проекта)."""
    client = APIClient()
    client.force_authenticate(user=outsider)
    return client


@pytest.fixture
def auth_client_with_vk_token(user, auth_client):
    """APIClient с VK-токеном."""
    VKToken.objects.create(
        user=user, access_token='test_vk_token_123', vk_user_id=12345,
    )
    return auth_client
