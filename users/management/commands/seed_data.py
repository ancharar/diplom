"""Management-команда для заполнения БД тестовыми данными."""

import random
from datetime import datetime, timedelta, timezone

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from projects.models import JoinRequest, Project, ProjectHistory, ProjectMembership
from tasks.models import Task, TaskHistory

User = get_user_model()

# ── Данные для генерации ─────────────────────────────────────────────────────

FIRST_NAMES_M = [
    'Александр', 'Дмитрий', 'Максим', 'Иван', 'Артём',
    'Сергей', 'Андрей', 'Никита', 'Михаил', 'Егор',
    'Алексей', 'Илья', 'Кирилл', 'Владимир', 'Роман',
    'Денис', 'Павел', 'Николай', 'Олег', 'Тимур',
    'Виктор', 'Юрий', 'Евгений', 'Константин', 'Григорий',
]

FIRST_NAMES_F = [
    'Анна', 'Мария', 'Елена', 'Ольга', 'Наталья',
    'Екатерина', 'Татьяна', 'Ирина', 'Светлана', 'Юлия',
    'Дарья', 'Полина', 'Алина', 'Виктория', 'Ксения',
    'Марина', 'Валерия', 'Анастасия', 'Кристина', 'Людмила',
    'Вера', 'Галина', 'Лариса', 'Надежда', 'Софья',
]

LAST_NAMES_M = [
    'Иванов', 'Петров', 'Сидоров', 'Козлов', 'Новиков',
    'Морозов', 'Волков', 'Соколов', 'Лебедев', 'Попов',
    'Кузнецов', 'Орлов', 'Макаров', 'Захаров', 'Фёдоров',
    'Семёнов', 'Белов', 'Жуков', 'Медведев', 'Тихонов',
    'Крылов', 'Никитин', 'Комаров', 'Шмидт', 'Борисов',
]

LAST_NAMES_F = [
    'Иванова', 'Петрова', 'Сидорова', 'Козлова', 'Новикова',
    'Морозова', 'Волкова', 'Соколова', 'Лебедева', 'Попова',
    'Кузнецова', 'Орлова', 'Макарова', 'Захарова', 'Фёдорова',
    'Семёнова', 'Белова', 'Жукова', 'Медведева', 'Тихонова',
    'Крылова', 'Никитина', 'Комарова', 'Шмидт', 'Борисова',
]

PATRONYMICS_M = [
    'Александрович', 'Дмитриевич', 'Сергеевич', 'Иванович', 'Андреевич',
    'Михайлович', 'Николаевич', 'Владимирович', 'Петрович', 'Олегович',
]

PATRONYMICS_F = [
    'Александровна', 'Дмитриевна', 'Сергеевна', 'Ивановна', 'Андреевна',
    'Михайловна', 'Николаевна', 'Владимировна', 'Петровна', 'Олеговна',
]

PROJECT_ROLES = ['analyst', 'developer', 'tester', 'designer', 'researcher']
TASK_STATUSES = ['todo', 'in_progress', 'done']

# Научные области и проекты
SCIENTIFIC_AREAS = [
    'Искусственный интеллект',
    'Машинное обучение',
    'Компьютерное зрение',
    'Обработка естественного языка',
    'Биоинформатика',
    'Квантовые вычисления',
    'Робототехника',
    'Кибербезопасность',
    'Интернет вещей',
    'Блокчейн-технологии',
    'Экология и климат',
    'Материаловедение',
    'Нейронауки',
    'Генетика',
    'Астрофизика',
    'Энергетика',
    'Медицинская информатика',
    'Геоинформатика',
    'Вычислительная химия',
    'Цифровые гуманитарные науки',
]

PROJECTS_DATA = [
    {'title': 'Исследование архитектур трансформеров для классификации текстов', 'area': 'Обработка естественного языка'},
    {'title': 'Анализ климатических данных Арктики за последние 50 лет', 'area': 'Экология и климат'},
    {'title': 'Разработка IoT-платформы для мониторинга теплиц', 'area': 'Интернет вещей'},
    {'title': 'Сегментация медицинских изображений на основе U-Net', 'area': 'Компьютерное зрение'},
    {'title': 'Прогнозирование белковых структур методами ML', 'area': 'Биоинформатика'},
    {'title': 'Квантовые алгоритмы оптимизации для задач логистики', 'area': 'Квантовые вычисления'},
    {'title': 'Автономная навигация дронов в городской среде', 'area': 'Робототехника'},
    {'title': 'Обнаружение аномалий в сетевом трафике с помощью GAN', 'area': 'Кибербезопасность'},
    {'title': 'Децентрализованная система голосования на блокчейне', 'area': 'Блокчейн-технологии'},
    {'title': 'Нейросетевая генерация музыкальных композиций', 'area': 'Искусственный интеллект'},
    {'title': 'Оптимизация солнечных элементов нового поколения', 'area': 'Энергетика'},
    {'title': 'Генетический анализ устойчивости растений к засухе', 'area': 'Генетика'},
    {'title': 'Предсказание побочных эффектов лекарств через граф знаний', 'area': 'Медицинская информатика'},
    {'title': 'Моделирование распространения загрязнений в атмосфере', 'area': 'Экология и климат'},
    {'title': 'Синтез наночастиц для адресной доставки препаратов', 'area': 'Материаловедение'},
    {'title': 'Распознавание эмоций в речи с помощью глубокого обучения', 'area': 'Машинное обучение'},
    {'title': 'Поиск экзопланет по данным телескопа Kepler', 'area': 'Астрофизика'},
    {'title': 'Картографирование оползневых зон по спутниковым данным', 'area': 'Геоинформатика'},
    {'title': 'Моделирование каталитических реакций методом DFT', 'area': 'Вычислительная химия'},
    {'title': 'Цифровой архив рукописей XVIII века', 'area': 'Цифровые гуманитарные науки'},
    {'title': 'Федеративное обучение для мобильных устройств', 'area': 'Машинное обучение'},
    {'title': 'Электронные нейроморфные чипы для edge-вычислений', 'area': 'Нейронауки'},
    {'title': 'Рекомендательная система для научных публикаций', 'area': 'Искусственный интеллект'},
    {'title': 'Цифровой двойник промышленного предприятия', 'area': 'Интернет вещей'},
    {'title': 'Анализ тональности отзывов на русском языке', 'area': 'Обработка естественного языка'},
    {'title': 'Разработка протокола квантового распределения ключей', 'area': 'Квантовые вычисления'},
    {'title': 'Система визуального SLAM для складских роботов', 'area': 'Робототехника'},
    {'title': 'Анализ уязвимостей смарт-контрактов Solidity', 'area': 'Кибербезопасность'},
    {'title': 'NFT-платформа для цифрового искусства', 'area': 'Блокчейн-технологии'},
    {'title': 'Компьютерная томография с низкой дозой облучения', 'area': 'Медицинская информатика'},
    {'title': 'Мониторинг биоразнообразия по акустическим данным', 'area': 'Экология и климат'},
    {'title': 'Графеновые сенсоры для обнаружения газов', 'area': 'Материаловедение'},
    {'title': 'CRISPR-редактирование генома пшеницы', 'area': 'Генетика'},
    {'title': 'Моделирование магнитосферы Юпитера', 'area': 'Астрофизика'},
    {'title': 'ГИС-анализ доступности медицинских учреждений', 'area': 'Геоинформатика'},
    {'title': 'Молекулярная динамика белок-лигандных взаимодействий', 'area': 'Вычислительная химия'},
    {'title': 'Оцифровка и атрибуция памятников древнерусской живописи', 'area': 'Цифровые гуманитарные науки'},
    {'title': 'Обнаружение deepfake-видео в реальном времени', 'area': 'Компьютерное зрение'},
    {'title': 'Оптимизация ветрогенераторов с помощью CFD', 'area': 'Энергетика'},
    {'title': 'Классификация ЭЭГ-сигналов для интерфейса мозг-компьютер', 'area': 'Нейронауки'},
    {'title': 'Чат-бот для психологической поддержки студентов', 'area': 'Обработка естественного языка'},
    {'title': 'Прогнозирование землетрясений по сейсмическим данным', 'area': 'Геоинформатика'},
    {'title': 'Разработка биоразлагаемых полимеров', 'area': 'Материаловедение'},
    {'title': 'Система контроля качества воздуха в умном городе', 'area': 'Интернет вещей'},
    {'title': 'Автоматизированное реферирование научных статей', 'area': 'Искусственный интеллект'},
    {'title': 'Водородные топливные элементы для транспорта', 'area': 'Энергетика'},
    {'title': 'Филогенетический анализ вирусов гриппа', 'area': 'Биоинформатика'},
    {'title': 'Распределённые вычисления на GPU-кластерах', 'area': 'Квантовые вычисления'},
    {'title': 'Предиктивная аналитика отказов оборудования', 'area': 'Машинное обучение'},
    {'title': 'Виртуальная лаборатория по органической химии', 'area': 'Вычислительная химия'},
]

TASK_TEMPLATES = [
    'Обзор литературы по теме',
    'Формулировка гипотезы исследования',
    'Разработка методологии эксперимента',
    'Сбор исходных данных',
    'Предобработка и очистка данных',
    'Разработка прототипа',
    'Реализация основного алгоритма',
    'Настройка окружения разработки',
    'Написание unit-тестов',
    'Проведение серии экспериментов',
    'Анализ результатов эксперимента',
    'Визуализация данных и графиков',
    'Оптимизация производительности',
    'Подготовка датасета для обучения',
    'Обучение модели',
    'Валидация модели на тестовых данных',
    'Интеграционное тестирование',
    'Code review и рефакторинг',
    'Подготовка технической документации',
    'Написание раздела статьи',
    'Подготовка презентации для семинара',
    'Проведение A/B-тестирования',
    'Настройка CI/CD пайплайна',
    'Деплой на тестовый сервер',
    'Подготовка отчёта о проделанной работе',
]

TASK_DESCRIPTIONS = {
    'Обзор литературы по теме': 'Собрать и проанализировать релевантные публикации за последние 5 лет. Составить аннотированную библиографию.',
    'Формулировка гипотезы исследования': 'На основе обзора литературы сформулировать проверяемую гипотезу и определить метрики успеха.',
    'Разработка методологии эксперимента': 'Спланировать серию экспериментов, определить независимые и зависимые переменные, описать протокол.',
    'Сбор исходных данных': 'Собрать данные из указанных источников, проверить полноту и корректность.',
    'Предобработка и очистка данных': 'Устранить пропуски, выбросы и дубликаты. Нормализовать и привести к единому формату.',
    'Разработка прототипа': 'Создать минимально рабочий прототип для проверки основной гипотезы.',
    'Реализация основного алгоритма': 'Реализовать алгоритм согласно техническому заданию и покрыть основные edge-кейсы.',
    'Настройка окружения разработки': 'Подготовить среду: установить зависимости, настроить Docker, подключить базу данных.',
    'Написание unit-тестов': 'Покрыть критические модули тестами. Целевое покрытие — не менее 80%.',
    'Проведение серии экспериментов': 'Выполнить запланированные эксперименты, зафиксировать промежуточные результаты.',
    'Анализ результатов эксперимента': 'Обработать данные экспериментов, рассчитать статистическую значимость.',
    'Визуализация данных и графиков': 'Построить графики и диаграммы для презентации и статьи.',
    'Оптимизация производительности': 'Профилирование кода. Улучшить время работы и потребление памяти.',
    'Подготовка датасета для обучения': 'Разделить данные на train/val/test, провести аугментацию при необходимости.',
    'Обучение модели': 'Обучить модель, подобрать гиперпараметры, залогировать метрики.',
    'Валидация модели на тестовых данных': 'Оценить качество модели на тестовой выборке, сравнить с baseline.',
    'Интеграционное тестирование': 'Проверить взаимодействие модулей системы, устранить конфликты.',
    'Code review и рефакторинг': 'Провести ревью кода команды, предложить и выполнить рефакторинг.',
    'Подготовка технической документации': 'Документировать API, архитектуру и процедуру развёртывания.',
    'Написание раздела статьи': 'Написать черновик раздела для научной публикации.',
    'Подготовка презентации для семинара': 'Подготовить слайды и текст доклада для научного семинара.',
    'Проведение A/B-тестирования': 'Настроить и провести A/B-тест, собрать метрики, подготовить выводы.',
    'Настройка CI/CD пайплайна': 'Настроить автоматическую сборку, тестирование и деплой.',
    'Деплой на тестовый сервер': 'Развернуть текущую версию на staging-сервере для тестирования.',
    'Подготовка отчёта о проделанной работе': 'Составить отчёт с описанием проделанной работы и достигнутых результатов.',
}

# Литературные источники для MongoDB
SOURCE_TEMPLATES = [
    {'title': 'Deep Learning', 'authors': 'Ian Goodfellow, Yoshua Bengio, Aaron Courville', 'year': 2016, 'tags': ['deep learning', 'neural networks', 'ML']},
    {'title': 'Attention Is All You Need', 'authors': 'Ashish Vaswani et al.', 'year': 2017, 'tags': ['transformer', 'attention', 'NLP']},
    {'title': 'BERT: Pre-training of Deep Bidirectional Transformers', 'authors': 'Jacob Devlin et al.', 'year': 2019, 'tags': ['BERT', 'NLP', 'transfer learning']},
    {'title': 'ImageNet Classification with Deep CNNs', 'authors': 'Alex Krizhevsky, Ilya Sutskever, Geoffrey Hinton', 'year': 2012, 'tags': ['CNN', 'image classification']},
    {'title': 'Generative Adversarial Networks', 'authors': 'Ian Goodfellow et al.', 'year': 2014, 'tags': ['GAN', 'generative models']},
    {'title': 'U-Net: CNNs for Biomedical Image Segmentation', 'authors': 'Olaf Ronneberger et al.', 'year': 2015, 'tags': ['segmentation', 'medical imaging']},
    {'title': 'Mastering the Game of Go with DNNs and Tree Search', 'authors': 'David Silver et al.', 'year': 2016, 'tags': ['reinforcement learning', 'AlphaGo']},
    {'title': 'GPT-3: Language Models are Few-Shot Learners', 'authors': 'Tom Brown et al.', 'year': 2020, 'tags': ['GPT', 'language model', 'few-shot']},
    {'title': 'ResNet: Deep Residual Learning for Image Recognition', 'authors': 'Kaiming He et al.', 'year': 2016, 'tags': ['ResNet', 'deep learning', 'image recognition']},
    {'title': 'YOLO: Real-Time Object Detection', 'authors': 'Joseph Redmon et al.', 'year': 2016, 'tags': ['YOLO', 'object detection', 'real-time']},
    {'title': 'Dropout: A Simple Way to Prevent Overfitting', 'authors': 'Nitish Srivastava et al.', 'year': 2014, 'tags': ['regularization', 'dropout']},
    {'title': 'Batch Normalization: Accelerating Deep Network Training', 'authors': 'Sergey Ioffe, Christian Szegedy', 'year': 2015, 'tags': ['batch normalization', 'optimization']},
    {'title': 'Word2Vec: Efficient Estimation of Word Representations', 'authors': 'Tomas Mikolov et al.', 'year': 2013, 'tags': ['word embeddings', 'NLP']},
    {'title': 'Random Forests', 'authors': 'Leo Breiman', 'year': 2001, 'tags': ['random forest', 'ensemble methods']},
    {'title': 'Support Vector Machines for Classification', 'authors': 'Corinna Cortes, Vladimir Vapnik', 'year': 1995, 'tags': ['SVM', 'classification']},
    {'title': 'XGBoost: A Scalable Tree Boosting System', 'authors': 'Tianqi Chen, Carlos Guestrin', 'year': 2016, 'tags': ['XGBoost', 'gradient boosting']},
    {'title': 'Graph Neural Networks: A Review of Methods', 'authors': 'Jie Zhou et al.', 'year': 2020, 'tags': ['GNN', 'graph learning']},
    {'title': 'Federated Learning: Challenges and Methods', 'authors': 'Qiang Yang et al.', 'year': 2019, 'tags': ['federated learning', 'privacy']},
    {'title': 'Quantum Computing: An Applied Approach', 'authors': 'Jack Hidary', 'year': 2021, 'tags': ['quantum computing', 'algorithms']},
    {'title': 'Introduction to Algorithms', 'authors': 'Thomas Cormen et al.', 'year': 2009, 'tags': ['algorithms', 'data structures']},
    {'title': 'Методы оптимизации в машинном обучении', 'authors': 'Ботев К.А., Воронцов К.В.', 'year': 2022, 'tags': ['оптимизация', 'ML']},
    {'title': 'Анализ данных на Python', 'authors': 'Уэс Маккинни', 'year': 2020, 'tags': ['Python', 'pandas', 'анализ данных']},
    {'title': 'Статистическое обучение с приложениями в R', 'authors': 'Гарет Джеймс и др.', 'year': 2021, 'tags': ['статистика', 'R']},
    {'title': 'Основы молекулярной биологии клетки', 'authors': 'Альбертс Б. и др.', 'year': 2018, 'tags': ['биология', 'молекулярная биология']},
    {'title': 'Принципы работы с большими данными', 'authors': 'Григорьев А.Н.', 'year': 2023, 'tags': ['big data', 'распределённые системы']},
]


def _transliterate(name: str) -> str:
    """Простая транслитерация для email."""
    table = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e',
        'ё': 'e', 'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k',
        'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r',
        'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts',
        'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ъ': '', 'ы': 'y', 'ь': '',
        'э': 'e', 'ю': 'yu', 'я': 'ya',
    }
    return ''.join(table.get(c, c) for c in name.lower())


def _random_date(start: datetime, end: datetime) -> datetime:
    """Случайная дата в интервале."""
    delta = end - start
    return start + timedelta(seconds=random.randint(0, int(delta.total_seconds())))


class Command(BaseCommand):
    """Заполнение базы данных тестовыми данными (50 пользователей, 50 проектов)."""

    help = 'Заполняет БД тестовыми данными. --flush для очистки перед заполнением.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--flush',
            action='store_true',
            help='Удалить все существующие данные перед заполнением',
        )

    def handle(self, *args, **options):
        if options['flush']:
            self._flush()

        users = self._create_users()
        projects = self._create_projects(users)
        self._create_tasks(projects)
        self._create_join_requests(users, projects)
        self._create_mongo_sources(projects, users)

        self.stdout.write(self.style.SUCCESS('Тестовые данные успешно созданы!'))

    # ── Очистка ──────────────────────────────────────────────────────────────

    def _flush(self):
        self.stdout.write('Очистка существующих данных...')

        from tasks.models import TaskAttachment
        from vk_integration.models import VKPublication, VKToken

        # Удаляем в порядке зависимостей
        TaskAttachment.objects.all().delete()
        TaskHistory.objects.all().delete()
        Task.objects.all().delete()
        VKPublication.objects.all().delete()
        VKToken.objects.all().delete()
        ProjectHistory.objects.all().delete()
        JoinRequest.objects.all().delete()
        ProjectMembership.objects.all().delete()
        Project.objects.all().delete()
        User.objects.filter(is_superuser=False).delete()

        # MongoDB
        try:
            from literature.mongo import get_files_collection, get_sources_collection
            get_sources_collection().delete_many({})
            get_files_collection().delete_many({})
            self.stdout.write('  MongoDB коллекции очищены')
        except Exception as e:
            self.stdout.write(self.style.WARNING(f'  MongoDB недоступна: {e}'))

        self.stdout.write(self.style.SUCCESS('  Данные очищены'))

    # ── Пользователи ─────────────────────────────────────────────────────────

    def _create_users(self) -> list:
        self.stdout.write('Создание пользователей...')
        users = []
        used_emails: set[str] = set()

        for i in range(50):
            is_female = i % 2 == 1
            if is_female:
                first = random.choice(FIRST_NAMES_F)
                last = random.choice(LAST_NAMES_F)
                patronymic = random.choice(PATRONYMICS_F)
            else:
                first = random.choice(FIRST_NAMES_M)
                last = random.choice(LAST_NAMES_M)
                patronymic = random.choice(PATRONYMICS_M)

            full_name = f'{last} {first} {patronymic}'

            # Уникальный email
            base_email = f'{_transliterate(last)}.{_transliterate(first[0])}@example.com'
            email = base_email
            counter = 1
            while email in used_emails:
                email = f'{_transliterate(last)}.{_transliterate(first[0])}{counter}@example.com'
                counter += 1
            used_emails.add(email)

            user, created = User.objects.get_or_create(
                email=email,
                defaults={'full_name': full_name},
            )
            if created:
                user.set_password('testpass123')
                user.save()
            users.append(user)

        self.stdout.write(f'  Создано {len(users)} пользователей')
        return users

    # ── Проекты ──────────────────────────────────────────────────────────────

    def _create_projects(self, users: list) -> list:
        self.stdout.write('Создание проектов...')
        projects = []

        for i, pdata in enumerate(PROJECTS_DATA):
            owner = users[i % len(users)]
            start = datetime(2025, 6, 1) + timedelta(days=random.randint(0, 180))
            end = start + timedelta(days=random.randint(90, 365))

            goal = f'Цель проекта: провести исследование в области «{pdata["area"]}» и получить практически значимые результаты.'
            description = f'Научно-исследовательский проект в области {pdata["area"].lower()}. ' \
                          f'Команда из {random.randint(3, 8)} человек работает над задачей.'

            project, created = Project.objects.get_or_create(
                title=pdata['title'],
                defaults={
                    'area': pdata['area'],
                    'description': description,
                    'goal': goal,
                    'owner': owner,
                    'start_date': start.date(),
                    'end_date': end.date(),
                    'status': random.choice(['in_progress', 'in_progress', 'in_progress', 'done']),
                },
            )

            if created:
                # Владелец — участник с ролью «researcher»
                ProjectMembership.objects.get_or_create(
                    user=owner, project=project,
                    defaults={'project_role': 'researcher'},
                )

                # 3-7 дополнительных участников
                others = [u for u in users if u != owner]
                sample_size = min(random.randint(3, 7), len(others))
                for member in random.sample(others, sample_size):
                    ProjectMembership.objects.get_or_create(
                        user=member, project=project,
                        defaults={'project_role': random.choice(PROJECT_ROLES)},
                    )

                # История изменений проекта (1-3 записи)
                for _ in range(random.randint(1, 3)):
                    ProjectHistory.objects.create(
                        project=project,
                        changed_by=owner,
                        field_name=random.choice(['status', 'description', 'goal']),
                        old_value='Старое значение',
                        new_value='Обновлённое значение',
                    )

            projects.append(project)

        self.stdout.write(f'  Создано {len(projects)} проектов')
        return projects

    # ── Задачи ───────────────────────────────────────────────────────────────

    def _create_tasks(self, projects: list):
        self.stdout.write('Создание задач...')
        task_count = 0

        for project in projects:
            member_ids = list(
                ProjectMembership.objects.filter(project=project).values_list('user_id', flat=True)
            )
            if not member_ids:
                continue

            num_tasks = random.randint(3, 25)
            selected_templates = random.sample(
                TASK_TEMPLATES, min(num_tasks, len(TASK_TEMPLATES)),
            )
            # Если нужно больше задач, добавляем с номерами
            while len(selected_templates) < num_tasks:
                extra = random.choice(TASK_TEMPLATES)
                selected_templates.append(f'{extra} (серия {len(selected_templates) + 1})')

            for title in selected_templates:
                base_title = title.split(' (серия')[0]
                description = TASK_DESCRIPTIONS.get(base_title, f'Задача по направлению «{project.area}».')
                status = random.choice(TASK_STATUSES)

                deadline = project.end_date - timedelta(days=random.randint(0, 60))

                task, created = Task.objects.get_or_create(
                    title=title,
                    project=project,
                    defaults={
                        'description': description,
                        'technical_spec': f'ТЗ: {title}. Ожидаемый результат: отчёт / код / документация.',
                        'created_by_id': project.owner_id,
                        'assignee_id': random.choice(member_ids),
                        'status': status,
                        'deadline': deadline,
                    },
                )
                if created:
                    task_count += 1

                    # История изменений задачи (0-2 записи)
                    if status != 'todo':
                        TaskHistory.objects.create(
                            task=task,
                            changed_by_id=random.choice(member_ids),
                            field_name='status',
                            old_value='todo',
                            new_value='in_progress',
                        )
                    if status == 'done':
                        TaskHistory.objects.create(
                            task=task,
                            changed_by_id=random.choice(member_ids),
                            field_name='status',
                            old_value='in_progress',
                            new_value='done',
                        )

        self.stdout.write(f'  Создано {task_count} задач')

    # ── Заявки на вступление ─────────────────────────────────────────────────

    def _create_join_requests(self, users: list, projects: list):
        self.stdout.write('Создание заявок на вступление...')
        count = 0

        for project in random.sample(projects, min(20, len(projects))):
            members = set(
                ProjectMembership.objects.filter(project=project).values_list('user_id', flat=True)
            )
            non_members = [u for u in users if u.id not in members]
            if not non_members:
                continue

            # 1-3 заявки на проект
            for applicant in random.sample(non_members, min(random.randint(1, 3), len(non_members))):
                status = random.choice(['pending', 'approved', 'rejected', 'pending'])
                jr, created = JoinRequest.objects.get_or_create(
                    user=applicant,
                    project=project,
                    status=status,
                    defaults={
                        'desired_role': random.choice(PROJECT_ROLES),
                        'message': random.choice([
                            'Хочу присоединиться к проекту, имею релевантный опыт.',
                            'Тема исследования совпадает с моей специализацией.',
                            'Готов внести вклад в проект в качестве разработчика.',
                            'Интересуюсь данной областью, хочу получить практический опыт.',
                            '',
                        ]),
                        'reviewed_by': project.owner if status != 'pending' else None,
                        'assigned_role': random.choice(PROJECT_ROLES) if status == 'approved' else None,
                    },
                )
                if created:
                    count += 1

        self.stdout.write(f'  Создано {count} заявок')

    # ── MongoDB: литературные источники ───────────────────────────────────────

    def _create_mongo_sources(self, projects: list, users: list):
        self.stdout.write('Создание литературных источников в MongoDB...')

        try:
            from literature.mongo import get_sources_collection
            col = get_sources_collection()
            # Проверяем подключение
            col.database.client.admin.command('ping')
        except Exception as e:
            self.stdout.write(self.style.WARNING(f'  MongoDB недоступна, пропускаем: {e}'))
            return

        count = 0
        now = datetime.now(timezone.utc)

        for project in projects:
            member_ids = list(
                ProjectMembership.objects.filter(project=project).values_list('user_id', flat=True)
            )
            if not member_ids:
                continue

            # 2-6 источников на проект
            num_sources = random.randint(2, 6)
            selected = random.sample(SOURCE_TEMPLATES, min(num_sources, len(SOURCE_TEMPLATES)))

            for src in selected:
                # Проверяем, не существует ли уже
                existing = col.find_one({
                    'project_id': project.id,
                    'title': src['title'],
                })
                if existing:
                    continue

                doc = {
                    'project_id': project.id,
                    'title': src['title'],
                    'authors': src['authors'],
                    'year': src['year'],
                    'url': f'https://doi.org/10.1000/example.{random.randint(1000, 9999)}',
                    'description': f'Источник по теме проекта «{project.title}».',
                    'tags': src['tags'],
                    'added_by': random.choice(member_ids),
                    'created_at': now - timedelta(days=random.randint(1, 90)),
                    'updated_at': now,
                }
                col.insert_one(doc)
                count += 1

        self.stdout.write(f'  Создано {count} литературных источников в MongoDB')
