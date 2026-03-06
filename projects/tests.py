"""Тесты приложения projects."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from .models import Project, ProjectMembership

User = get_user_model()


class ProjectCRUDTest(TestCase):
    """Тесты CRUD проектов."""

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email='admin@test.com', full_name='Admin', password='testpass123', role='admin',
        )
        self.member = User.objects.create_user(
            email='member@test.com', full_name='Member', password='testpass123', role='member',
        )
        self.client.force_authenticate(user=self.admin)

    def test_create_project(self):
        """Администратор может создать проект."""
        response = self.client.post('/api/v1/projects/', {
            'title': 'Project', 'area': 'AI', 'start_date': '2026-01-01', 'end_date': '2026-12-31',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['title'], 'Project')
        # Владелец автоматически становится участником
        self.assertTrue(
            ProjectMembership.objects.filter(user=self.admin, project_id=response.data['id']).exists()
        )

    def test_member_cannot_create_project(self):
        """Участник не может создать проект."""
        self.client.force_authenticate(user=self.member)
        response = self.client.post('/api/v1/projects/', {
            'title': 'X', 'area': 'X', 'start_date': '2026-01-01', 'end_date': '2026-12-31',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_end_date_validation(self):
        """end_date не может быть раньше start_date."""
        response = self.client.post('/api/v1/projects/', {
            'title': 'X', 'area': 'X', 'start_date': '2026-12-31', 'end_date': '2026-01-01',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class ProjectMemberTest(TestCase):
    """Тесты управления участниками проектов."""

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email='admin@test.com', full_name='Admin', password='testpass123', role='admin',
        )
        self.member = User.objects.create_user(
            email='member@test.com', full_name='Member', password='testpass123',
        )
        self.client.force_authenticate(user=self.admin)
        # Создаём проект
        response = self.client.post('/api/v1/projects/', {
            'title': 'P', 'area': 'A', 'start_date': '2026-01-01', 'end_date': '2026-12-31',
        }, format='json')
        self.project_id = response.data['id']

    def test_add_member(self):
        """Владелец может добавить участника."""
        response = self.client.post(
            f'/api/v1/projects/{self.project_id}/members/',
            {'user_id': self.member.id, 'project_role': 'developer'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_add_duplicate_member(self):
        """Нельзя добавить пользователя в проект дважды."""
        self.client.post(
            f'/api/v1/projects/{self.project_id}/members/',
            {'user_id': self.member.id, 'project_role': 'developer'},
            format='json',
        )
        response = self.client.post(
            f'/api/v1/projects/{self.project_id}/members/',
            {'user_id': self.member.id, 'project_role': 'tester'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_remove_owner(self):
        """Нельзя удалить владельца проекта."""
        response = self.client.delete(
            f'/api/v1/projects/{self.project_id}/members/{self.admin.id}/',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_member_access(self):
        """Участник проекта видит детали проекта."""
        self.client.post(
            f'/api/v1/projects/{self.project_id}/members/',
            {'user_id': self.member.id, 'project_role': 'developer'},
            format='json',
        )
        self.client.force_authenticate(user=self.member)
        response = self.client.get(f'/api/v1/projects/{self.project_id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_non_member_no_access(self):
        """Не-участник не видит детали проекта."""
        self.client.force_authenticate(user=self.member)
        response = self.client.get(f'/api/v1/projects/{self.project_id}/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
