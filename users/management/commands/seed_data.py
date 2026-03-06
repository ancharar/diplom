"""Management-команда для заполнения БД тестовыми данными."""

import random

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from projects.models import Project, ProjectMembership
from tasks.models import Task

User = get_user_model()

TASK_STATUSES = [
    'new', 'on_discussion', 'approved', 'in_progress', 'complete',
    'testing', 'to_review', 'ready_to_merge', 'closed', 'disapproved',
]

PRIORITIES = ['low', 'medium', 'high']

PROJECT_ROLES = ['analyst', 'developer', 'tester', 'designer', 'researcher']


class Command(BaseCommand):
    """Заполнение базы данных тестовыми данными."""

    help = 'Заполняет базу данных тестовыми данными (пользователи, проекты, задачи)'

    def handle(self, *args, **options):
        self.stdout.write('Создание тестовых данных...')

        # --- Пользователи ---
        admins = []
        members = []

        for i in range(1, 3):
            user, created = User.objects.get_or_create(
                email=f'admin{i}@example.com',
                defaults={
                    'full_name': f'Администратор {i}',
                    'role': 'admin',
                    'is_staff': True,
                },
            )
            if created:
                user.set_password('admin123456')
                user.save()
            admins.append(user)

        for i in range(1, 6):
            user, created = User.objects.get_or_create(
                email=f'member{i}@example.com',
                defaults={
                    'full_name': f'Участник {i}',
                    'role': 'member',
                },
            )
            if created:
                user.set_password('member123456')
                user.save()
            members.append(user)

        self.stdout.write(f'  Создано {len(admins)} администраторов и {len(members)} участников')

        # --- Проекты ---
        projects_data = [
            {
                'title': 'Исследование нейросетей',
                'area': 'Искусственный интеллект',
                'description': 'Исследование архитектур глубокого обучения',
                'goal': 'Разработать модель классификации изображений',
                'start_date': '2026-01-15',
                'end_date': '2026-06-30',
            },
            {
                'title': 'Анализ климатических данных',
                'area': 'Экология',
                'description': 'Статистический анализ климатических изменений',
                'goal': 'Построить прогнозную модель температур',
                'start_date': '2026-02-01',
                'end_date': '2026-08-31',
            },
            {
                'title': 'Разработка IoT-платформы',
                'area': 'Интернет вещей',
                'description': 'Платформа для сбора данных с датчиков',
                'goal': 'Создать прототип системы мониторинга',
                'start_date': '2026-03-01',
                'end_date': '2026-12-31',
            },
        ]

        projects = []
        for i, pdata in enumerate(projects_data):
            owner = admins[i % len(admins)]
            project, created = Project.objects.get_or_create(
                title=pdata['title'],
                defaults={**pdata, 'owner': owner},
            )
            if created:
                # Добавляем владельца как участника
                ProjectMembership.objects.get_or_create(
                    user=owner, project=project,
                    defaults={'project_role': 'researcher'},
                )
                # Добавляем 2-3 случайных участников
                sample_members = random.sample(members, min(3, len(members)))
                for member in sample_members:
                    ProjectMembership.objects.get_or_create(
                        user=member, project=project,
                        defaults={'project_role': random.choice(PROJECT_ROLES)},
                    )
            projects.append(project)

        self.stdout.write(f'  Создано {len(projects)} проектов')

        # --- Задачи ---
        task_titles = [
            'Настроить окружение разработки',
            'Написать обзор литературы',
            'Собрать датасет',
            'Реализовать прототип',
            'Провести эксперименты',
            'Написать тесты',
            'Подготовить документацию',
            'Code review',
            'Оптимизировать производительность',
            'Подготовить презентацию',
        ]

        task_count = 0
        for project in projects:
            project_members = list(
                ProjectMembership.objects.filter(project=project).values_list('user', flat=True)
            )
            num_tasks = random.randint(5, 10)
            for j in range(num_tasks):
                title = task_titles[j % len(task_titles)]
                task_status = random.choice(TASK_STATUSES)
                _, created = Task.objects.get_or_create(
                    title=f'{title} #{j + 1}',
                    project=project,
                    defaults={
                        'description': f'Описание задачи: {title}',
                        'created_by_id': project.owner_id,
                        'assignee_id': random.choice(project_members) if project_members else None,
                        'status': task_status,
                        'priority': random.choice(PRIORITIES),
                        'deadline': '2026-06-01',
                    },
                )
                if created:
                    task_count += 1

        self.stdout.write(f'  Создано {task_count} задач')
        self.stdout.write(self.style.SUCCESS('Тестовые данные успешно созданы!'))
