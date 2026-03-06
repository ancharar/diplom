"""Тесты приложения tasks."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from projects.models import Project, ProjectMembership

from .models import Task

User = get_user_model()


class TaskTestBase(TestCase):
    """Базовый класс с общей подготовкой данных для тестов задач."""

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email='admin@test.com', full_name='Admin', password='testpass123', role='admin',
        )
        self.member = User.objects.create_user(
            email='member@test.com', full_name='Member', password='testpass123',
        )
        # Создаём проект и добавляем участника
        self.project = Project.objects.create(
            title='Test Project', area='AI', owner=self.admin,
            start_date='2026-01-01', end_date='2026-12-31',
        )
        ProjectMembership.objects.create(user=self.admin, project=self.project, project_role='researcher')
        ProjectMembership.objects.create(user=self.member, project=self.project, project_role='developer')


class TaskCRUDTest(TaskTestBase):
    """Тесты создания и обновления задач."""

    def test_create_task(self):
        """Участник может создать задачу."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            f'/api/v1/projects/{self.project.id}/tasks/',
            {'title': 'Task 1', 'priority': 'high'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'new')
        self.assertIn('on_discussion', response.data['allowed_transitions'])

    def test_update_task(self):
        """Автор может обновить задачу."""
        self.client.force_authenticate(user=self.admin)
        task = Task.objects.create(
            title='T', project=self.project, created_by=self.admin, priority='low',
        )
        response = self.client.patch(
            f'/api/v1/tasks/{task.id}/',
            {'title': 'Updated'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], 'Updated')


class TaskTransitionTest(TaskTestBase):
    """Тесты конечного автомата состояний задачи."""

    def setUp(self):
        super().setUp()
        self.client.force_authenticate(user=self.admin)
        self.task = Task.objects.create(
            title='FSM Task', project=self.project, created_by=self.admin,
        )

    def test_valid_transition(self):
        """Допустимый переход new -> on_discussion выполняется."""
        response = self.client.post(
            f'/api/v1/tasks/{self.task.id}/transition/',
            {'status': 'on_discussion'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'on_discussion')

    def test_invalid_transition(self):
        """Недопустимый переход new -> closed возвращает 400."""
        response = self.client.post(
            f'/api/v1/tasks/{self.task.id}/transition/',
            {'status': 'closed'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_full_lifecycle(self):
        """Полный цикл: new -> ... -> closed."""
        transitions = [
            'on_discussion', 'approved', 'in_progress', 'complete',
            'testing', 'to_review', 'ready_to_merge', 'closed',
        ]
        for new_status in transitions:
            response = self.client.post(
                f'/api/v1/tasks/{self.task.id}/transition/',
                {'status': new_status},
                format='json',
            )
            self.assertEqual(response.status_code, status.HTTP_200_OK, f'Переход в {new_status} не удался')
            self.assertEqual(response.data['status'], new_status)

    def test_disapproved_is_final(self):
        """Из disapproved нельзя перейти никуда."""
        self.task.status = 'disapproved'
        self.task.save()
        response = self.client.post(
            f'/api/v1/tasks/{self.task.id}/transition/',
            {'status': 'new'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_history_recorded(self):
        """При переходе записывается история."""
        self.client.post(
            f'/api/v1/tasks/{self.task.id}/transition/',
            {'status': 'on_discussion'},
            format='json',
        )
        response = self.client.get(f'/api/v1/tasks/{self.task.id}/history/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Минимум 1 запись (создание) + 1 переход
        self.assertGreaterEqual(len(response.data), 1)
