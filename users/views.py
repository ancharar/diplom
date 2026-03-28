"""Представления (views) приложения users."""

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import LoginSerializer, RegisterSerializer, UserSerializer

User = get_user_model()


class RegisterView(APIView):
    """Регистрация нового пользователя."""

    permission_classes = (AllowAny,)

    def post(self, request: Request) -> Response:
        """Создание нового пользователя и возврат JWT-токенов."""
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Генерируем JWT-токены для автоматического входа после регистрации
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
        """Проверка учётных данных и выдача JWT-токенов."""
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

        refresh = RefreshToken.for_user(user)
        return Response({
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            },
        })


class MeView(APIView):
    """Получение и обновление профиля текущего пользователя."""

    permission_classes = (IsAuthenticated,)

    def get(self, request: Request) -> Response:
        """Возврат данных текущего пользователя."""
        return Response(UserSerializer(request.user).data)

    def patch(self, request: Request) -> Response:
        """Обновление профиля текущего пользователя."""
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class LogoutView(APIView):
    """Выход из системы — добавление refresh-токена в чёрный список."""

    permission_classes = (IsAuthenticated,)

    def post(self, request: Request) -> Response:
        try:
            token = RefreshToken(request.data.get('refresh'))
            token.blacklist()
            return Response(status=205)
        except Exception:
            return Response({'error': 'Неверный токен'}, status=status.HTTP_400_BAD_REQUEST)
