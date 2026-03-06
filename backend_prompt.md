# Промпт для разработки серверной части приложения

> **Как использовать:** скопируй весь текст ниже (начиная с разделителя `---`) и вставь в чат ИИ-ассистента в VSCode (Copilot Chat, Cline, Cursor и т.д.). Работай поэтапно — после завершения каждого шага пиши "Готово, переходим к шагу N".

---

## СИСТЕМНЫЙ КОНТЕКСТ

Ты — опытный fullstack-разработчик (Python/Django + React/TypeScript). Ты помогаешь мне пошагово создать серверную часть (backend) веб-приложения для поддержки рабочих процессов командных проектов в молодежных научных группах, а также простой фронтенд для проверки работоспособности API.

### Описание проекта

Приложение — это таск-трекер для научных групп со следующими возможностями:
- Управление проектами и задачами (с 10 состояниями жизненного цикла задачи)
- Два типа пользователей: Администратор и Участник
- Интеграция с ВКонтакте для публикации научно-популярных статей
- REST API для взаимодействия с React-фронтендом

### Стек технологий

- **Язык:** Python 3.12+
- **Фреймворк:** Django 5.x + Django REST Framework (DRF)
- **БД:** PostgreSQL (основная, структурированные данные)
- **Аутентификация:** JWT (djangorestframework-simplejwt)
- **Документация API:** drf-spectacular (Swagger/OpenAPI)
- **Внешние интеграции:** VK API
- **Прочее:** django-filter, django-cors-headers

### Стек фронтенда (для проверки API)

- **Язык:** TypeScript
- **Фреймворк:** React 18+ (Create React App или Vite)
- **Стилизация:** SCSS
- **HTTP-клиент:** axios
- **Роутинг:** react-router-dom v6

### Архитектура

Проект разбит на Django-приложения (apps):
- `users` — аутентификация, пользователи, роли
- `projects` — проекты
- `tasks` — задачи, состояния, история изменений
- `vk_integration` — интеграция с ВКонтакте

### Принципы разработки

- Каждый шаг — один логический блок, который можно запустить и проверить
- Код пишется сразу с комментариями на русском языке
- После создания моделей — сразу миграции
- После создания API — сразу пример запроса для проверки
- Валидация входных данных — в сериализаторах
- Бизнес-логика (переходы состояний, проверка прав) — в сервисном слое (services.py), а НЕ во views

---

## ШАГ 1. Инициализация проекта

Создай структуру Django-проекта с нуля.

**Что нужно сделать:**

1. Инициализировать виртуальное окружение (venv)
2. Создать файл `requirements.txt` со следующими зависимостями:
   ```
   Django>=5.0,<6.0
   djangorestframework>=3.15
   djangorestframework-simplejwt>=5.3
   drf-spectacular>=0.27
   django-filter>=24.0
   django-cors-headers>=4.3
   psycopg2-binary>=2.9
   requests>=2.31
   python-dotenv>=1.0
   ```
3. Выполнить `django-admin startproject config .`
4. Создать приложения: `users`, `projects`, `tasks`, `vk_integration`
5. Настроить `config/settings.py`:
   - Подключить все приложения в INSTALLED_APPS
   - Настроить подключение к PostgreSQL через переменные окружения (.env)
   - Настроить DRF: пагинация (PageNumberPagination, page_size=20), парсеры JSON, рендереры JSON
   - Настроить JWT (access token — 30 минут, refresh — 1 день)
   - Настроить drf-spectacular (title: "Scientific Project Manager API")
   - Настроить CORS (разрешить localhost:3000 для разработки)
   - AUTH_USER_MODEL = 'users.User'
6. Создать файл `.env.example` с шаблоном переменных окружения
7. Настроить `config/urls.py` с подключением:
   - `api/v1/` — пространство имён для API
   - `api/schema/` — OpenAPI-схема
   - `api/docs/` — Swagger UI

**Результат:** проект запускается через `python manage.py runserver`, Swagger доступен по адресу `/api/docs/`.

---

## ШАГ 2. Модель пользователя и аутентификация

Создай кастомную модель пользователя и API для регистрации/авторизации.

**Модель `User` (users/models.py):**

```
Поля:
- email: EmailField, unique, используется как USERNAME_FIELD
- full_name: CharField(max_length=255) — ФИО
- password: хешированный пароль (наследуется от AbstractBaseUser)
- role: CharField с choices = [("admin", "Администратор"), ("member", "Участник")]
- is_active: BooleanField, default=True
- is_staff: BooleanField, default=False
- created_at: DateTimeField(auto_now_add)
- updated_at: DateTimeField(auto_now)
```

Создать кастомный UserManager с методами `create_user` и `create_superuser`.
Наследоваться от `AbstractBaseUser` и `PermissionsMixin`.

**API эндпоинты (users/urls.py → api/v1/users/):**

| Метод | URL                        | Описание                    | Доступ       |
|-------|----------------------------|-----------------------------|--------------|
| POST  | /api/v1/users/register/    | Регистрация пользователя    | Все          |
| POST  | /api/v1/users/login/       | Получение JWT-токенов       | Все          |
| POST  | /api/v1/users/token/refresh/| Обновление access-токена   | Все          |
| GET   | /api/v1/users/me/          | Текущий пользователь        | Авторизованные |
| PATCH | /api/v1/users/me/          | Обновление профиля          | Авторизованные |

**Сериализаторы (users/serializers.py):**
- `RegisterSerializer` — валидация email (уникальность), пароль (мин. 8 символов), full_name (обязательное), role
- `UserSerializer` — для чтения/обновления профиля (пароль readonly)
- `LoginSerializer` — email + password

**Важно:**
- Пароль хешируется через `make_password` / метод `set_password`
- При регистрации роль по умолчанию — "member"
- Email приводится к нижнему регистру при сохранении

**Результат:** можно зарегистрироваться, получить JWT-токен и запросить свой профиль.

---

## ШАГ 3. Модели проектов

Создай модель проекта и CRUD API.

**Модель `Project` (projects/models.py):**

```
Поля:
- title: CharField(max_length=255) — название
- description: TextField(blank=True) — описание
- area: CharField(max_length=255) — область проекта
- status: CharField, choices = [("in_progress", "В процессе"), ("completed", "Завершен")]
- goal: TextField(blank=True) — цель проекта
- owner: ForeignKey → User (создатель, администратор проекта)
- start_date: DateField
- end_date: DateField
- created_at: DateTimeField(auto_now_add)
- updated_at: DateTimeField(auto_now)

Связи:
- members: ManyToManyField → User, через промежуточную модель ProjectMembership
```

**Модель `ProjectMembership` (projects/models.py):**

```
Поля:
- user: ForeignKey → User
- project: ForeignKey → Project
- project_role: CharField, choices = [("analyst", "Аналитик"), ("developer", "Разработчик"), ("tester", "Тестировщик"), ...]
- joined_at: DateTimeField(auto_now_add)

Meta: unique_together = [("user", "project")]
```

**Модель `ProjectHistory` (projects/models.py):**

```
Поля:
- project: ForeignKey → Project
- changed_by: ForeignKey → User
- field_name: CharField — какое поле изменилось
- old_value: TextField
- new_value: TextField
- changed_at: DateTimeField(auto_now_add)
```

**API эндпоинты (projects/urls.py → api/v1/projects/):**

| Метод  | URL                                     | Описание                         | Доступ            |
|--------|-----------------------------------------|----------------------------------|-------------------|
| GET    | /api/v1/projects/                       | Список проектов пользователя     | Авторизованные    |
| POST   | /api/v1/projects/                       | Создание проекта                 | Администраторы    |
| GET    | /api/v1/projects/{id}/                  | Детали проекта                   | Участники проекта |
| PATCH  | /api/v1/projects/{id}/                  | Обновление проекта               | Владелец          |
| DELETE | /api/v1/projects/{id}/                  | Удаление проекта                 | Владелец          |
| POST   | /api/v1/projects/{id}/members/          | Добавление участника в проект    | Владелец          |
| DELETE | /api/v1/projects/{id}/members/{user_id}/| Удаление участника из проекта    | Владелец          |
| GET    | /api/v1/projects/{id}/history/          | История изменений проекта        | Участники проекта |

**Permissions (projects/permissions.py):**
- `IsProjectOwner` — только владелец (owner) проекта
- `IsProjectMember` — участник проекта (включая владельца)

**Сервисный слой (projects/services.py):**
- `create_project(user, data)` — создание + автоматическое добавление создателя как участника
- `update_project(project, user, data)` — обновление + запись в ProjectHistory
- `add_member(project, user_id, role)` — добавление участника с проверкой существования
- `remove_member(project, user_id)` — удаление участника (нельзя удалить владельца)

**Валидация:**
- end_date >= start_date
- Нельзя создать проект с пустым title
- Нельзя добавить пользователя в проект дважды

**Результат:** CRUD проектов, управление участниками, история изменений.

---

## ШАГ 4. Модели задач и конечный автомат состояний

Создай модель задачи с полным жизненным циклом (10 состояний).

**Модель `Task` (tasks/models.py):**

```
Поля:
- title: CharField(max_length=255) — название
- description: TextField(blank=True) — техническое задание
- project: ForeignKey → Project
- assignee: ForeignKey → User (исполнитель, null=True)
- created_by: ForeignKey → User (автор задачи)
- status: CharField, default="new"
- priority: CharField, choices = [("low", "Низкий"), ("medium", "Средний"), ("high", "Высокий")]
- deadline: DateField(null=True)
- created_at: DateTimeField(auto_now_add)
- updated_at: DateTimeField(auto_now)
```

**Состояния задачи (TASK_STATUS_CHOICES):**

```python
TASK_STATUS_CHOICES = [
    ("new", "New"),
    ("on_discussion", "On discussion"),
    ("approved", "Approved"),
    ("in_progress", "In progress"),
    ("complete", "Complete"),
    ("testing", "Testing"),
    ("to_review", "To review"),
    ("ready_to_merge", "Ready to merge"),
    ("closed", "Close"),
    ("disapproved", "Disapprove"),
]
```

**Допустимые переходы (tasks/services.py — КОНЕЧНЫЙ АВТОМАТ):**

```python
ALLOWED_TRANSITIONS = {
    "new":            ["on_discussion", "disapproved"],
    "on_discussion":  ["approved", "disapproved"],
    "approved":       ["in_progress"],
    "in_progress":    ["complete"],
    "complete":       ["testing", "to_review"],
    "testing":        ["to_review", "in_progress"],  # можно вернуть на доработку
    "to_review":      ["ready_to_merge", "in_progress"],  # можно вернуть на доработку
    "ready_to_merge": ["closed"],
    "closed":         [],  # финальное состояние
    "disapproved":    [],  # финальное состояние
}
```

**Модель `TaskHistory` (tasks/models.py):**

```
Поля:
- task: ForeignKey → Task
- changed_by: ForeignKey → User
- field_name: CharField — что изменилось ("status", "assignee", "deadline", ...)
- old_value: TextField
- new_value: TextField
- changed_at: DateTimeField(auto_now_add)
```

**API эндпоинты (tasks/urls.py → api/v1/tasks/):**

| Метод  | URL                                  | Описание                     | Доступ            |
|--------|--------------------------------------|------------------------------|-------------------|
| GET    | /api/v1/projects/{pid}/tasks/        | Список задач проекта         | Участники проекта |
| POST   | /api/v1/projects/{pid}/tasks/        | Создание задачи              | Участники проекта |
| GET    | /api/v1/tasks/{id}/                  | Детали задачи                | Участники проекта |
| PATCH  | /api/v1/tasks/{id}/                  | Обновление задачи            | Автор или владелец проекта |
| POST   | /api/v1/tasks/{id}/transition/       | Изменение статуса задачи     | Участники проекта |
| GET    | /api/v1/tasks/{id}/history/          | История изменений задачи     | Участники проекта |
| GET    | /api/v1/users/me/tasks/              | Мои задачи (все проекты)     | Авторизованные    |

**Сервисный слой (tasks/services.py):**

- `create_task(project, user, data)` → создать задачу, статус "new", записать в историю
- `update_task(task, user, data)` → обновить поля, записать каждое изменённое поле в TaskHistory
- `transition_task(task, user, new_status)`:
  1. Проверить, что `new_status` входит в `ALLOWED_TRANSITIONS[task.status]`
  2. Если переход недопустим — вернуть ошибку 400 с текстом: "Переход из '{current}' в '{new}' запрещён. Допустимые: {list}"
  3. Если допустим — обновить статус, записать в TaskHistory
- `get_user_tasks(user)` → все задачи пользователя (где он assignee) по всем проектам

**Фильтрация (tasks/filters.py):**
- По статусу: `?status=in_progress`
- По приоритету: `?priority=high`
- По исполнителю: `?assignee={user_id}`
- По дедлайну: `?deadline_before=2026-06-01`

**Результат:** полный CRUD задач, конечный автомат состояний с валидацией, история изменений, фильтрация.

---

## ШАГ 5. Интеграция с ВКонтакте

Создай подсистему для публикации постов через VK API.

**Модель `VKToken` (vk_integration/models.py):**

```
Поля:
- user: OneToOneField → User
- access_token: TextField — токен VK API
- vk_user_id: BigIntegerField(null=True)
- created_at: DateTimeField(auto_now_add)
- updated_at: DateTimeField(auto_now)
```

**Модель `VKPublication` (vk_integration/models.py):**

```
Поля:
- project: ForeignKey → Project
- author: ForeignKey → User
- title: CharField(max_length=255) — заголовок публикации
- content: TextField — текст статьи
- vk_post_id: BigIntegerField(null=True) — ID поста в VK
- owner_id: BigIntegerField — ID стены (пользователя или группы)
- status: CharField, choices = [("draft", "Черновик"), ("published", "Опубликовано"), ("failed", "Ошибка")]
- published_at: DateTimeField(null=True)
- error_message: TextField(blank=True) — текст ошибки от VK API
- created_at: DateTimeField(auto_now_add)
```

**API эндпоинты (vk_integration/urls.py → api/v1/vk/):**

| Метод | URL                                  | Описание                         | Доступ            |
|-------|--------------------------------------|----------------------------------|-------------------|
| POST  | /api/v1/vk/token/                    | Сохранить VK-токен               | Авторизованные    |
| DELETE| /api/v1/vk/token/                    | Удалить VK-токен                 | Авторизованные    |
| POST  | /api/v1/vk/publish/                  | Опубликовать пост в VK           | Авторизованные    |
| GET   | /api/v1/vk/publications/             | История публикаций               | Авторизованные    |
| GET   | /api/v1/vk/publications/{id}/        | Детали публикации                | Автор публикации  |

**Сервисный слой (vk_integration/services.py):**

- `save_vk_token(user, access_token)` → сохранить/обновить токен
- `publish_to_vk(user, data)`:
  1. Получить VKToken пользователя (если нет → ошибка 400)
  2. Сформировать запрос к VK API `wall.post` (https://api.vk.com/method/wall.post)
  3. Параметры: `owner_id`, `message` (content), `v=5.131`, `access_token`
  4. Если VK вернул ошибку → сохранить publication со status="failed" и error_message
  5. Если успех → сохранить publication со status="published", vk_post_id, published_at
- `get_publications(user, project_id=None)` → история публикаций с фильтрацией по проекту

**Важно:**
- VK access_token хранится в БД (в продакшене — шифровать)
- Токен передаётся пользователем вручную (получен через VK OAuth вне нашей системы)
- Все запросы к VK API — через `requests` библиотеку с timeout=10

**Результат:** можно сохранить VK-токен и опубликовать пост через API.

---

## ШАГ 6. Финализация и тестирование

**Что нужно сделать:**

1. **Проверить миграции:** `python manage.py makemigrations` и `python manage.py migrate` — все без ошибок
2. **Создать суперпользователя:** `python manage.py createsuperuser`
3. **Проверить Swagger:** открыть `/api/docs/` — все эндпоинты на месте
4. **Написать базовые тесты (tests.py в каждом приложении):**
   - `users`: регистрация, логин, получение профиля
   - `projects`: создание проекта, добавление участника, проверка прав
   - `tasks`: создание задачи, допустимые и недопустимые переходы состояний
   - `vk_integration`: сохранение токена, mock-тест публикации
5. **Добавить management-команду** `seed_data` для заполнения тестовыми данными:
   - 2 администратора, 5 участников
   - 3 проекта с участниками
   - По 5-10 задач в каждом проекте в разных статусах

**Команда для запуска тестов:** `python manage.py test`

---

## ШАГ 7. Простой фронтенд для проверки API

Создай минимальный React + TypeScript интерфейс для проверки работоспособности бэкенда. Это НЕ финальный фронтенд, а инструмент для тестирования API.

**Инициализация:**

1. В корне проекта создать папку `frontend/`
2. Инициализировать проект через Vite: `npm create vite@latest frontend -- --template react-ts`
3. Установить зависимости:
   ```
   npm install axios react-router-dom sass
   npm install -D @types/react-router-dom
   ```
4. Настроить axios instance (`frontend/src/api/client.ts`):
   - baseURL: `http://localhost:8000/api/v1`
   - Interceptor: автоматически добавлять `Authorization: Bearer <token>` из localStorage
   - Interceptor на 401: перенаправление на страницу логина

**Страницы (frontend/src/pages/):**

### 7.1 Страница логина (`LoginPage.tsx`)
- Форма: email + пароль
- Кнопки: "Войти" и ссылка "Регистрация"
- При успешном логине — сохранить access/refresh токены в localStorage, перейти на `/projects`
- При ошибке — показать сообщение под формой

### 7.2 Страница регистрации (`RegisterPage.tsx`)
- Форма: ФИО, email, пароль, подтверждение пароля
- Роль — выпадающий список (Администратор / Участник)
- После регистрации — автоматический логин и переход на `/projects`

### 7.3 Список проектов (`ProjectsPage.tsx`)
- Таблица/список карточек: название, область, статус, дата начала — дата окончания
- Кнопка "Создать проект" (видна только администраторам)
- Клик по проекту → переход на `/projects/:id`

### 7.4 Страница проекта (`ProjectDetailPage.tsx`)
- Информация о проекте: название, описание, цель, статус, сроки
- Блок "Участники" — список с ролями, кнопка "Добавить участника" (для владельца)
- Блок "Задачи" — таблица с колонками: название, исполнитель, статус, приоритет, дедлайн
- Фильтры задач: по статусу (выпадающий список), по приоритету
- Кнопка "Создать задачу"

### 7.5 Модальное окно / страница задачи (`TaskDetailPage.tsx` или модалка)
- Все поля задачи с возможностью редактирования
- Блок смены статуса: показывать ТОЛЬКО допустимые переходы как кнопки
  - Пример: если задача в статусе "Complete" → показать кнопки "Testing" и "To review"
- История изменений задачи — список снизу (дата, кто изменил, что изменилось, старое → новое значение)

### 7.6 Страница VK-интеграции (`VKPage.tsx`)
- Форма ввода VK access_token + кнопка "Сохранить"
- Форма публикации: заголовок, текст, выбор проекта, owner_id (ID стены)
- Кнопка "Опубликовать"
- Таблица истории публикаций: заголовок, дата, статус (Опубликовано / Ошибка)

**Общие компоненты (frontend/src/components/):**

- `Header.tsx` — навигация: Проекты, VK-публикации, имя пользователя, кнопка "Выйти"
- `PrivateRoute.tsx` — обёртка для защищённых маршрутов (проверка наличия токена)
- `StatusBadge.tsx` — цветной бейдж статуса задачи (зелёный для closed, красный для disapproved, синий для in_progress и т.д.)
- `Loader.tsx` — индикатор загрузки

**Стилизация (SCSS):**

- Простая, чистая, без UI-библиотек
- Файл `frontend/src/styles/global.scss` — базовые стили: шрифт, отступы, цвета
- Каждая страница — свой `.module.scss` файл
- Цветовая схема: нейтральная (белый фон, тёмный текст, акцентный цвет — #2E75B6)

**Роутинг (frontend/src/App.tsx):**

```
/login           → LoginPage
/register        → RegisterPage
/projects        → ProjectsPage          (PrivateRoute)
/projects/:id    → ProjectDetailPage     (PrivateRoute)
/tasks/:id       → TaskDetailPage        (PrivateRoute)
/vk              → VKPage                (PrivateRoute)
```

**Результат:** можно открыть `http://localhost:5173`, зарегистрироваться, залогиниться, создать проект, создавать задачи и двигать их по статусам, публиковать посты в VK.

---

## СТРУКТУРА ПРОЕКТА (итоговая)

```
project_root/
├── .env.example
├── requirements.txt
├── manage.py
├── config/
│   ├── __init__.py
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
├── users/
│   ├── models.py          # User, UserManager
│   ├── serializers.py     # RegisterSerializer, UserSerializer
│   ├── views.py           # RegisterView, MeView
│   ├── urls.py
│   ├── permissions.py
│   ├── admin.py
│   └── tests.py
├── projects/
│   ├── models.py          # Project, ProjectMembership, ProjectHistory
│   ├── serializers.py
│   ├── views.py
│   ├── urls.py
│   ├── services.py        # create_project, update_project, add_member
│   ├── permissions.py     # IsProjectOwner, IsProjectMember
│   ├── admin.py
│   └── tests.py
├── tasks/
│   ├── models.py          # Task, TaskHistory
│   ├── serializers.py
│   ├── views.py
│   ├── urls.py
│   ├── services.py        # create_task, transition_task, ALLOWED_TRANSITIONS
│   ├── filters.py         # TaskFilter
│   ├── permissions.py
│   ├── admin.py
│   └── tests.py
├── vk_integration/
│   ├── models.py          # VKToken, VKPublication
│   ├── serializers.py
│   ├── views.py
│   ├── urls.py
│   ├── services.py        # publish_to_vk, save_vk_token
│   ├── admin.py
│   └── tests.py
└── frontend/              # React + TypeScript (Vite)
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    └── src/
        ├── App.tsx
        ├── main.tsx
        ├── api/
        │   └── client.ts          # axios instance + interceptors
        ├── pages/
        │   ├── LoginPage.tsx
        │   ├── RegisterPage.tsx
        │   ├── ProjectsPage.tsx
        │   ├── ProjectDetailPage.tsx
        │   ├── TaskDetailPage.tsx
        │   └── VKPage.tsx
        ├── components/
        │   ├── Header.tsx
        │   ├── PrivateRoute.tsx
        │   ├── StatusBadge.tsx
        │   └── Loader.tsx
        └── styles/
            ├── global.scss
            └── *.module.scss
```

---

## ПРАВИЛА ДЛЯ ИИ-АССИСТЕНТА

**Общие:**
1. Работай строго пошагово. Не перепрыгивай шаги.
2. После каждого шага выдай мне команды для проверки (curl, httpie или Swagger).
3. Если я говорю "ошибка" — покажи исправление, а не переписывай всё.
4. Каждый файл — полностью, не пропускай импорты.

**Backend (шаги 1–6):**
5. Используй type hints в Python-коде.
6. Все строки в коде (docstrings, комментарии, сообщения об ошибках) — на русском.
7. Не используй `function-based views` — только `APIView` или `ViewSet`.

**Frontend (шаг 7):**
8. Используй функциональные компоненты с хуками (useState, useEffect, useNavigate).
9. Строгая типизация TypeScript — никаких `any`. Создай интерфейсы для всех сущностей (User, Project, Task и т.д.) в `frontend/src/types/`.
10. Стилизация — только SCSS-модули, без inline-стилей и без CSS-фреймворков.
11. Обработка ошибок API — показывать пользователю понятные сообщения, а не коды ошибок.
12. При запуске фронтенд работает на `localhost:5173` (Vite), бэкенд — на `localhost:8000`.
