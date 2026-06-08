from django.conf import settings
from django.db import models


class Notification(models.Model):
    TYPE_CHOICES = [
        ('project_invitation', 'Приглашение в проект'),
        ('task_assigned', 'Назначена задача'),
        ('report_required', 'Требуется отчёт'),
        ('report_reminder', 'Напоминание об отчёте'),
    ]

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
        verbose_name='Получатель',
    )
    notification_type = models.CharField(
        'Тип', max_length=50, choices=TYPE_CHOICES,
    )
    title = models.CharField('Заголовок', max_length=255)
    message = models.TextField('Сообщение', blank=True)
    is_read = models.BooleanField('Прочитано', default=False)

    project = models.ForeignKey(
        'projects.Project',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='notifications',
        verbose_name='Проект',
    )
    task = models.ForeignKey(
        'tasks.Task',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='notifications',
        verbose_name='Задача',
    )
    invitation = models.ForeignKey(
        'projects.ProjectInvitation',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='notifications',
        verbose_name='Приглашение',
    )
    created_at = models.DateTimeField('Дата создания', auto_now_add=True)

    class Meta:
        verbose_name = 'Уведомление'
        verbose_name_plural = 'Уведомления'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.recipient} — {self.title}'
