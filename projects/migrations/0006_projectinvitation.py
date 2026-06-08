import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('projects', '0005_delete_projectinvitation'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ProjectInvitation',
            fields=[
                (
                    'id',
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name='ID',
                    ),
                ),
                (
                    'project_role',
                    models.CharField(
                        default='developer',
                        max_length=50,
                        verbose_name='Роль',
                    ),
                ),
                (
                    'status',
                    models.CharField(
                        choices=[
                            ('pending', 'На рассмотрении'),
                            ('accepted', 'Принято'),
                            ('declined', 'Отклонено'),
                        ],
                        default='pending',
                        max_length=20,
                        verbose_name='Статус',
                    ),
                ),
                (
                    'created_at',
                    models.DateTimeField(
                        auto_now_add=True,
                        verbose_name='Дата создания',
                    ),
                ),
                (
                    'project',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='invitations',
                        to='projects.project',
                    ),
                ),
                (
                    'receiver',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='received_invitations',
                        to=settings.AUTH_USER_MODEL,
                        verbose_name='Получатель',
                    ),
                ),
                (
                    'sender',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='sent_invitations',
                        to=settings.AUTH_USER_MODEL,
                        verbose_name='Отправитель',
                    ),
                ),
            ],
            options={
                'verbose_name': 'Приглашение в проект',
                'verbose_name_plural': 'Приглашения в проект',
                'unique_together': {('project', 'receiver')},
            },
        ),
    ]
