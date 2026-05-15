"""Представления (views) приложения users."""

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import (
    AdminUserSerializer,
    LoginSerializer,
    RegisterSerializer,
    UserSerializer,
)

User = get_user_model()


class RegisterView(APIView):
    """Регистрация нового пользователя."""

    permission_classes = (AllowAny,)

    def post(self, request: Request) -> Response:
        """Создание нового пользователя и возврат JWT-токенов."""
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        refresh = RefreshToken.for_user(user)

        return Response(
            {
                'user': UserSerializer(user).data,
                'tokens': {
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                },
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    """Аутентификация пользователя по email и паролю."""

    permission_classes = (AllowAny,)

    def post(self, request: Request) -> Response:
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email'].lower()
        password = serializer.validated_data['password']

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response(
                {'detail': 'Неверный email или пароль.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not user.check_password(password):
            return Response(
                {'detail': 'Неверный email или пароль.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not user.is_active:
            return Response(
                {'detail': 'Аккаунт деактивирован.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        if user.is_blocked:
            return Response(
                {'detail': 'Аккаунт заблокирован. Обратитесь к администратору.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        refresh = RefreshToken.for_user(user)

        return Response({
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            },
        })


class MeView(APIView):
    """
    Получение и обновление профиля текущего пользователя.
    Здесь же хранится анкета пользователя.
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request: Request) -> Response:
        """Получить текущего пользователя + анкету."""
        return Response(UserSerializer(request.user).data)

    def patch(self, request: Request) -> Response:
        """
        Обновление профиля пользователя (включая анкету).
        Поддерживает частичное обновление.
        """
        serializer = UserSerializer(
            request.user,
            data=request.data,
            partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response({
            "message": "Профиль успешно обновлён",
            "user": serializer.data
        })


class LogoutView(APIView):
    """
    Выход из системы — добавление refresh-токена в blacklist.
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request: Request) -> Response:
        try:
            token = RefreshToken(request.data.get('refresh'))
            token.blacklist()
            return Response(status=205)
        except Exception:
            return Response(
                {'error': 'Неверный токен'},
                status=status.HTTP_400_BAD_REQUEST
            )


class AdminUserListView(APIView):
    """Список всех пользователей (только для администратора)."""

    permission_classes = (IsAdminUser,)

    def get(self, request: Request) -> Response:
        users = User.objects.all().order_by('-created_at')
        serializer = AdminUserSerializer(users, many=True)
        return Response(serializer.data)


class AdminUserDetailView(APIView):
    """Управление пользователем (блокировка, права, удаление)."""

    permission_classes = (IsAdminUser,)

    def get(self, request: Request, user_id: int) -> Response:
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {'detail': 'Пользователь не найден.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(AdminUserSerializer(user).data)

    def patch(self, request: Request, user_id: int) -> Response:
        """Обновить пользователя (block/unblock, назначить админом)."""
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {'detail': 'Пользователь не найден.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if 'is_blocked' in request.data:
            user.is_blocked = request.data['is_blocked']
        if 'is_staff' in request.data:
            user.is_staff = request.data['is_staff']
        if 'is_superuser' in request.data:
            user.is_superuser = request.data['is_superuser']

        user.save()
        return Response(AdminUserSerializer(user).data)

    def delete(self, request: Request, user_id: int) -> Response:
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {'detail': 'Пользователь не найден.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if user.id == request.user.id:
            return Response(
                {'detail': 'Нельзя удалить самого себя.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)