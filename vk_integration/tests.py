"""Тесты приложения vk_integration."""

from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from projects.models import Project, ProjectMembership

from .models import VKToken

User = get_user_model()


class VKTokenTest(TestCase):
    """Тесты сохранения и удаления VK-токена."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='vk@test.com', full_name='VK User', password='testpass123',
        )
        self.client.force_authenticate(user=self.user)

    def test_save_token(self):
        """Сохранение VK-токена возвращает 201."""
        response = self.client.post(
            '/api/v1/vk/token/',
            {'access_token': 'test_token'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(VKToken.objects.filter(user=self.user).exists())

    def test_delete_token(self):
        """Удаление VK-токена возвращает 204."""
        VKToken.objects.create(user=self.user, access_token='test')
        response = self.client.delete('/api/v1/vk/token/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(VKToken.objects.filter(user=self.user).exists())

    def test_delete_nonexistent_token(self):
        """Удаление несуществующего токена возвращает 400."""
        response = self.client.delete('/api/v1/vk/token/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class VKPublishTest(TestCase):
    """Тесты публикации в VK (с mock)."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='pub@test.com', full_name='Publisher', password='testpass123', role='admin',
        )
        self.project = Project.objects.create(
            title='P', area='A', owner=self.user,
            start_date='2026-01-01', end_date='2026-12-31',
        )
        ProjectMembership.objects.create(user=self.user, project=self.project, project_role='researcher')
        VKToken.objects.create(user=self.user, access_token='mock_token')
        self.client.force_authenticate(user=self.user)

    @patch('vk_integration.services.http_requests.post')
    def test_publish_success(self, mock_post: MagicMock):
        """Успешная публикация в VK."""
        mock_post.return_value.json.return_value = {
            'response': {'post_id': 12345}
        }
        response = self.client.post('/api/v1/vk/publish/', {
            'project': self.project.id,
            'title': 'Article',
            'content': 'Content',
            'owner_id': 100,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'published')
        self.assertEqual(response.data['vk_post_id'], 12345)

    @patch('vk_integration.services.http_requests.post')
    def test_publish_vk_error(self, mock_post: MagicMock):
        """Ошибка VK API сохраняется с status=failed."""
        mock_post.return_value.json.return_value = {
            'error': {'error_msg': 'Access denied'}
        }
        response = self.client.post('/api/v1/vk/publish/', {
            'project': self.project.id,
            'title': 'Article',
            'content': 'Content',
            'owner_id': 100,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'failed')
        self.assertIn('Access denied', response.data['error_message'])

    def test_publish_without_token(self):
        """Публикация без VK-токена возвращает 400."""
        VKToken.objects.filter(user=self.user).delete()
        response = self.client.post('/api/v1/vk/publish/', {
            'project': self.project.id,
            'title': 'X',
            'content': 'Y',
            'owner_id': 100,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('vk_integration.services.http_requests.post')
    def test_publications_list(self, mock_post: MagicMock):
        """Список публикаций после создания."""
        mock_post.return_value.json.return_value = {'response': {'post_id': 1}}
        self.client.post('/api/v1/vk/publish/', {
            'project': self.project.id,
            'title': 'A',
            'content': 'B',
            'owner_id': 100,
        }, format='json')
        response = self.client.get('/api/v1/vk/publications/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
