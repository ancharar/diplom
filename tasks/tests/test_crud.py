"""Тесты CRUD и переходов статусов задач (unittest)."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from projects.models import Project, ProjectMembership
from tasks.models import Task

User = get_user_model()


class TaskTestBase(TestCase):
    """Базовый класс с общей подготовкой данных."""

    def setUp(self):
        self.client = APIClient()
        # ROLE_DISABLED: убрано role='admin'
        self.user = User.objects.create_user(
            email='user@test.com',
            full_name='User',
            password='testpass123',
        )
        self.member = User.objects.create_user(
            email='member@test.com',
            full_name='Member',
            password='testpass123',
        )
        self.project = Project.objects.create(
            title='Test Project',
            area='AI',
            owner=self.user,
            start_date='2026-01-01',
            end_date='2026-12-31',
        )
        ProjectMembership.objects.create(
            user=self.user,
            project=self.project,
            project_role='researcher',
        )
        ProjectMembership.objects.create(
            user=self.member,
            project=self.project,
            project_role='developer',
        )


class TaskCRUDTest(TaskTestBase):
    """Тесты создания и обновления задач."""

    def test_create_task(self):
        """Участник может создать задачу."""
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            f'/api/v1/projects/{self.project.id}/tasks/',
            {'title': 'Task 1'},
            format='json',
        )
        self.assertEqual(
            response.status_code, status.HTTP_201_CREATED,
        )
        self.assertEqual(response.data['status'], 'todo')
        self.assertEqual(
            response.data['status_display'], 'К выполнению',
        )

    def test_update_task(self):
        """Автор может обновить задачу."""
        self.client.force_authenticate(user=self.user)
        task = Task.objects.create(
            title='T',
            project=self.project,
            created_by=self.user,
        )
        response = self.client.patch(
            f'/api/v1/tasks/{task.id}/',
            {'title': 'Updated'},
            format='json',
        )
        self.assertEqual(
            response.status_code, status.HTTP_200_OK,
        )
        self.assertEqual(response.data['title'], 'Updated')


class TaskTransitionTest(TaskTestBase):
    """Тесты конечного автомата состояний задачи."""

    def setUp(self):
        super().setUp()
        self.client.force_authenticate(user=self.user)
        self.task = Task.objects.create(
            title='FSM Task',
            project=self.project,
            created_by=self.user,
        )

    def test_valid_transition(self):
        """Допустимый переход todo -> in_progress."""
        response = self.client.patch(
            f'/api/v1/tasks/{self.task.id}/status/',
            {'status': 'in_progress'},
            format='json',
        )
        self.assertEqual(
            response.status_code, status.HTTP_200_OK,
        )
        self.assertEqual(
            response.data['status'], 'in_progress',
        )

    def test_invalid_transition(self):
        """Недопустимый переход todo -> done → 400."""
        response = self.client.patch(
            f'/api/v1/tasks/{self.task.id}/status/',
            {'status': 'done'},
            format='json',
        )
        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_full_lifecycle(self):
        """Полный цикл: todo -> in_progress -> done."""
        for new_status in ['in_progress', 'done']:
            response = self.client.patch(
                f'/api/v1/tasks/{self.task.id}/status/',
                {'status': new_status},
                format='json',
            )
            self.assertEqual(
                response.status_code,
                status.HTTP_200_OK,
                f'Переход в {new_status} не удался',
            )
            self.assertEqual(
                response.data['status'], new_status,
            )

    def test_done_is_final(self):
        """Из done нельзя перейти никуда."""
        self.task.status = 'done'
        self.task.save()
        response = self.client.patch(
            f'/api/v1/tasks/{self.task.id}/status/',
            {'status': 'todo'},
            format='json',
        )
        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_history_recorded(self):
        """При переходе записывается история."""
        self.client.patch(
            f'/api/v1/tasks/{self.task.id}/status/',
            {'status': 'in_progress'},
            format='json',
        )
        response = self.client.get(
            f'/api/v1/tasks/{self.task.id}/history/',
        )
        self.assertEqual(
            response.status_code, status.HTTP_200_OK,
        )
        self.assertGreaterEqual(len(response.data), 1)
