"""Модели приложения reports."""

from django.conf import settings
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator

from projects.models import Project


class ReportTemplate(models.Model):
    """Шаблон отчета."""
    
    FREQUENCY_CHOICES = [
        ('weekly', 'Еженедельно'),
        ('monthly', 'Ежемесячно'),
        ('quarterly', 'Ежеквартально'),
        ('manual', 'По требованию'),
    ]
    
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='report_templates',
        verbose_name='Проект'
    )
    title = models.CharField('Название', max_length=255)
    description = models.TextField('Описание', blank=True)
    frequency = models.CharField(
        'Периодичность',
        max_length=20,
        choices=FREQUENCY_CHOICES,
        default='weekly'
    )
    deadline_days = models.IntegerField(
        'Дней на заполнение',
        default=3,
        validators=[MinValueValidator(1)]
    )
    
    # LEGACY: JSON-based questions (disabled)
    # questions = models.JSONField(
    #     'Вопросы',
    #     default=list,
    #     help_text='Список вопросов в формате: '
    #               '[{"id": "q1", "label": "Вопрос", '
    #               '"type": "text/select/date"}]'
    # )
    # LEGACY: JSON-based questions (disabled)

    template_file = models.FileField(
        'Файл шаблона (.docx)',
        upload_to='report_templates/%Y/%m/',
        blank=True,
    )

    is_active = models.BooleanField('Активен', default=True)
    created_at = models.DateTimeField('Дата создания', auto_now_add=True)
    updated_at = models.DateTimeField('Дата обновления', auto_now=True)
    
    class Meta:
        verbose_name = 'Шаблон отчета'
        verbose_name_plural = 'Шаблоны отчетов'
        ordering = ['-created_at']
    
    def __str__(self):
        return f'{self.title} ({self.project.title})'


class Report(models.Model):
    """Отчет участника."""
    
    STATUS_CHOICES = [
        ('pending', 'Ожидает заполнения'),
        ('draft', 'Черновик'),
        ('submitted', 'Сдан на проверку'),
        ('reviewed', 'Проверен'),
        ('rejected', 'Отправлен на доработку'),
    ]
    
    template = models.ForeignKey(
        ReportTemplate,
        on_delete=models.CASCADE,
        related_name='reports',
        verbose_name='Шаблон'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reports',
        verbose_name='Участник'
    )
    period_start = models.DateField('Начало периода')
    period_end = models.DateField('Конец периода')
    deadline = models.DateTimeField('Дедлайн')
    
    # LEGACY: JSON-based questions (disabled)
    # answers = models.JSONField('Ответы', default=dict)
    # LEGACY: JSON-based questions (disabled)

    submitted_file = models.FileField(
        'Загруженный отчет (.docx)',
        upload_to='report_submissions/%Y/%m/',
        blank=True,
    )
    status = models.CharField(
        'Статус', max_length=20,
        choices=STATUS_CHOICES, default='pending',
    )
    
    submitted_at = models.DateTimeField('Дата сдачи', null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_reports',
        verbose_name='Проверил'
    )
    reviewed_at = models.DateTimeField('Дата проверки', null=True, blank=True)
    review_comment = models.TextField('Комментарий проверяющего', blank=True)
    
    # Автоматически собранные данные о задачах
    tasks_data = models.JSONField('Данные о задачах', default=dict, blank=True)
    
    created_at = models.DateTimeField('Дата создания', auto_now_add=True)
    updated_at = models.DateTimeField('Дата обновления', auto_now=True)
    
    class Meta:
        verbose_name = 'Отчет'
        verbose_name_plural = 'Отчеты'
        ordering = ['-period_start']
        unique_together = ['template', 'user', 'period_start', 'period_end']
    
    def __str__(self):
        return f'{self.template.title} - {self.user.full_name} ({self.period_start} - {self.period_end})'
    
    @property
    def is_overdue(self):
        """Проверяет, просрочен ли отчет."""
        from django.utils import timezone
        return self.status in ['pending', 'draft'] and timezone.now() > self.deadline


class ReportTask(models.Model):
    """Связь отчета с задачами (для отслеживания прогресса)."""
    
    report = models.ForeignKey(
        Report,
        on_delete=models.CASCADE,
        related_name='report_tasks',
        verbose_name='Отчет'
    )
    task = models.ForeignKey(
        'tasks.Task',
        on_delete=models.CASCADE,
        related_name='report_tasks',
        verbose_name='Задача'
    )
    status_before = models.CharField('Статус до', max_length=50)
    status_after = models.CharField('Статус после', max_length=50, blank=True)
    time_spent = models.DecimalField(
        'Затрачено часов',
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0)]
    )
    comment = models.TextField('Комментарий', blank=True)
    
    class Meta:
        verbose_name = 'Задача в отчете'
        verbose_name_plural = 'Задачи в отчетах'
    
    def __str__(self):
        return f'{self.report} - {self.task.title}'