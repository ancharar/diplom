"""Тесты приложения projects."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from .models import JoinRequest, Project, ProjectMembership

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

    def test_non_member_gets_catalog_view(self):
        """Не-участник получает краткую информацию о проекте."""
        self.client.force_authenticate(user=self.member)
        response = self.client.get(f'/api/v1/projects/{self.project_id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('members_count', response.data)
        self.assertNotIn('memberships', response.data)


class JoinRequestTest(TestCase):
    """Тесты заявок на вступление в проект."""

    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            email='owner@test.com', full_name='Owner',
            password='testpass123', role='admin',
        )
        self.member = User.objects.create_user(
            email='member@test.com', full_name='Member',
            password='testpass123',
        )
        self.outsider = User.objects.create_user(
            email='outsider@test.com', full_name='Outsider',
            password='testpass123',
        )
        # Создаём проект
        self.client.force_authenticate(user=self.owner)
        resp = self.client.post('/api/v1/projects/', {
            'title': 'Test Project', 'area': 'AI',
            'start_date': '2026-01-01', 'end_date': '2026-12-31',
        }, format='json')
        self.project_id = resp.data['id']
        # Добавляем member как участника
        self.client.post(
            f'/api/v1/projects/{self.project_id}/members/',
            {'user_id': self.member.id, 'project_role': 'developer'},
            format='json',
        )

    def test_submit_join_request(self):
        """Участник подаёт заявку — получает 201, статус pending."""
        self.client.force_authenticate(user=self.outsider)
        resp = self.client.post(
            f'/api/v1/projects/{self.project_id}/join-requests/',
            {'desired_role': 'tester', 'message': 'Хочу участвовать'},
            format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data['status'], 'pending')

    def test_duplicate_request(self):
        """Повторная заявка в тот же проект — 400."""
        self.client.force_authenticate(user=self.outsider)
        self.client.post(
            f'/api/v1/projects/{self.project_id}/join-requests/',
            {'desired_role': 'tester'}, format='json',
        )
        resp = self.client.post(
            f'/api/v1/projects/{self.project_id}/join-requests/',
            {'desired_role': 'developer'}, format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_member_cannot_submit(self):
        """Участник проекта подаёт заявку — 400."""
        self.client.force_authenticate(user=self.member)
        resp = self.client.post(
            f'/api/v1/projects/{self.project_id}/join-requests/',
            {'desired_role': 'tester'}, format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_approve_request(self):
        """Владелец одобряет заявку — пользователь становится участником."""
        self.client.force_authenticate(user=self.outsider)
        resp = self.client.post(
            f'/api/v1/projects/{self.project_id}/join-requests/',
            {'desired_role': 'tester'}, format='json',
        )
        req_id = resp.data['id']

        self.client.force_authenticate(user=self.owner)
        resp = self.client.patch(
            f'/api/v1/projects/{self.project_id}/join-requests/{req_id}/',
            {'action': 'approved'}, format='json',
        )
        self.assertEqual(resp.data['status'], 'approved')
        self.assertTrue(
            ProjectMembership.objects.filter(
                user=self.outsider, project_id=self.project_id,
            ).exists()
        )

    def test_approve_with_different_role(self):
        """Владелец одобряет с другой ролью."""
        self.client.force_authenticate(user=self.outsider)
        resp = self.client.post(
            f'/api/v1/projects/{self.project_id}/join-requests/',
            {'desired_role': 'tester'}, format='json',
        )
        req_id = resp.data['id']

        self.client.force_authenticate(user=self.owner)
        resp = self.client.patch(
            f'/api/v1/projects/{self.project_id}/join-requests/{req_id}/',
            {'action': 'approved', 'assigned_role': 'analyst'},
            format='json',
        )
        self.assertEqual(resp.data['assigned_role'], 'analyst')
        membership = ProjectMembership.objects.get(
            user=self.outsider, project_id=self.project_id,
        )
        self.assertEqual(membership.project_role, 'analyst')

    def test_reject_request(self):
        """Владелец отклоняет — заявка rejected, не участник."""
        self.client.force_authenticate(user=self.outsider)
        resp = self.client.post(
            f'/api/v1/projects/{self.project_id}/join-requests/',
            {'desired_role': 'tester'}, format='json',
        )
        req_id = resp.data['id']

        self.client.force_authenticate(user=self.owner)
        resp = self.client.patch(
            f'/api/v1/projects/{self.project_id}/join-requests/{req_id}/',
            {'action': 'rejected'}, format='json',
        )
        self.assertEqual(resp.data['status'], 'rejected')
        self.assertFalse(
            ProjectMembership.objects.filter(
                user=self.outsider, project_id=self.project_id,
            ).exists()
        )

    def test_resubmit_after_rejection(self):
        """После отклонения можно подать новую заявку."""
        self.client.force_authenticate(user=self.outsider)
        resp = self.client.post(
            f'/api/v1/projects/{self.project_id}/join-requests/',
            {'desired_role': 'tester'}, format='json',
        )
        req_id = resp.data['id']

        self.client.force_authenticate(user=self.owner)
        self.client.patch(
            f'/api/v1/projects/{self.project_id}/join-requests/{req_id}/',
            {'action': 'rejected'}, format='json',
        )

        self.client.force_authenticate(user=self.outsider)
        resp = self.client.post(
            f'/api/v1/projects/{self.project_id}/join-requests/',
            {'desired_role': 'developer'}, format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_cancel_pending_request(self):
        """Пользователь отзывает pending-заявку — 204."""
        self.client.force_authenticate(user=self.outsider)
        resp = self.client.post(
            f'/api/v1/projects/{self.project_id}/join-requests/',
            {'desired_role': 'tester'}, format='json',
        )
        req_id = resp.data['id']

        resp = self.client.delete(
            f'/api/v1/users/me/join-requests/{req_id}/',
        )
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)

    def test_cannot_cancel_approved(self):
        """Нельзя отозвать одобренную заявку."""
        self.client.force_authenticate(user=self.outsider)
        resp = self.client.post(
            f'/api/v1/projects/{self.project_id}/join-requests/',
            {'desired_role': 'tester'}, format='json',
        )
        req_id = resp.data['id']

        self.client.force_authenticate(user=self.owner)
        self.client.patch(
            f'/api/v1/projects/{self.project_id}/join-requests/{req_id}/',
            {'action': 'approved'}, format='json',
        )

        self.client.force_authenticate(user=self.outsider)
        resp = self.client.delete(
            f'/api/v1/users/me/join-requests/{req_id}/',
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_catalog_flags(self):
        """Каталог: is_member и has_pending_request корректны."""
        self.client.force_authenticate(user=self.outsider)
        resp = self.client.get('/api/v1/projects/catalog/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        proj = next(p for p in resp.data if p['id'] == self.project_id)
        self.assertFalse(proj['is_member'])
        self.assertFalse(proj['has_pending_request'])

        # Подаём заявку
        self.client.post(
            f'/api/v1/projects/{self.project_id}/join-requests/',
            {'desired_role': 'tester'}, format='json',
        )
        resp = self.client.get('/api/v1/projects/catalog/')
        proj = next(p for p in resp.data if p['id'] == self.project_id)
        self.assertTrue(proj['has_pending_request'])

    def test_non_owner_cannot_list_requests(self):
        """Не-владелец не может GET заявки проекта — 403."""
        self.client.force_authenticate(user=self.member)
        resp = self.client.get(
            f'/api/v1/projects/{self.project_id}/join-requests/',
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
