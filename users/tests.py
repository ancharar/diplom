"""Тесты приложения users."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

User = get_user_model()


class UserRegistrationTest(TestCase):
    """Тесты регистрации пользователя."""

    def setUp(self):
        self.client = APIClient()
        self.url = '/api/v1/users/register/'

    def test_register_success(self):
        """Успешная регистрация возвращает 201 и токены."""
        data = {
            'email': 'new@test.com',
            'full_name': 'Test User',
            'password': 'testpass123',
        }
        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('tokens', response.data)
        self.assertIn('access', response.data['tokens'])
        self.assertEqual(response.data['user']['role'], 'member')

    def test_register_duplicate_email(self):
        """Повторная регистрация с тем же email возвращает 400."""
        data = {
            'email': 'dup@test.com',
            'full_name': 'User',
            'password': 'testpass123',
        }
        self.client.post(self.url, data, format='json')
        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_short_password(self):
        """Короткий пароль (< 8 символов) возвращает 400."""
        data = {
            'email': 'short@test.com',
            'full_name': 'User',
            'password': '123',
        }
        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class UserLoginTest(TestCase):
    """Тесты входа пользователя."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='login@test.com', full_name='Login User', password='testpass123',
        )

    def test_login_success(self):
        """Успешный вход возвращает 200 и токены."""
        response = self.client.post(
            '/api/v1/users/login/',
            {'email': 'login@test.com', 'password': 'testpass123'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('tokens', response.data)

    def test_login_wrong_password(self):
        """Неверный пароль возвращает 401."""
        response = self.client.post(
            '/api/v1/users/login/',
            {'email': 'login@test.com', 'password': 'wrongpass'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class UserProfileTest(TestCase):
    """Тесты профиля пользователя."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='me@test.com', full_name='Me User', password='testpass123',
        )
        self.client.force_authenticate(user=self.user)

    def test_get_profile(self):
        """GET /me/ возвращает данные текущего пользователя."""
        response = self.client.get('/api/v1/users/me/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['email'], 'me@test.com')

    def test_update_profile(self):
        """PATCH /me/ обновляет ФИО."""
        response = self.client.patch(
            '/api/v1/users/me/', {'full_name': 'Updated Name'}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['full_name'], 'Updated Name')

    def test_unauthenticated_access(self):
        """Без токена GET /me/ возвращает 401."""
        client = APIClient()
        response = client.get('/api/v1/users/me/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
