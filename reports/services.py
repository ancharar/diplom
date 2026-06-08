"""Сервисные функции для работы с отчетами."""

from datetime import timedelta
from django.utils import timezone
from django.db.models import Count, Q

from projects.models import ProjectMembership
from tasks.models import Task
from .models import ReportTemplate, Report, ReportTask


def create_periodic_reports(project_id: int, template_id: int = None):
    """Создание отчетов на период."""
    templates = ReportTemplate.objects.filter(
        project_id=project_id,
        is_active=True
    )
    if template_id:
        templates = templates.filter(id=template_id)
    
    today = timezone.now().date()
    created_count = 0
    
    for template in templates:
        # Определяем период
        if template.frequency == 'weekly':
            start = today - timedelta(days=today.weekday())
            end = start + timedelta(days=6)
        elif template.frequency == 'monthly':
            start = today.replace(day=1)
            next_month = today.replace(day=28) + timedelta(days=4)
            end = next_month - timedelta(days=next_month.day)
        elif template.frequency == 'quarterly':
            quarter = (today.month - 1) // 3
            start_month = quarter * 3 + 1
            start = today.replace(month=start_month, day=1)
            end_month = start_month + 2
            end = today.replace(
                month=end_month,
                day=28,
            ) + timedelta(days=4)
            end = end - timedelta(days=end.day)
        elif template.frequency == 'manual':
            # «По требованию» — период = текущая неделя
            start = today - timedelta(days=today.weekday())
            end = start + timedelta(days=6)
        else:
            continue
        
        # Получаем участников проекта
        members = ProjectMembership.objects.filter(
            project_id=project_id
        ).select_related('user')
        
        for membership in members:
            report, created = Report.objects.get_or_create(
                template=template,
                user=membership.user,
                period_start=start,
                period_end=end,
                defaults={
                    'deadline': timezone.now() + timedelta(days=template.deadline_days),
                    'status': 'pending'
                }
            )
            if created:
                collect_tasks_data(report)
                created_count += 1
                _notify_report_created(report, template, start, end)

    return created_count


def _notify_report_created(report, template, start, end):
    """Уведомить участника о новом отчёте."""
    from notifications.services import create_notification
    deadline_str = report.deadline.strftime('%d.%m.%Y')
    create_notification(
        recipient=report.user,
        notification_type='report_required',
        title=f'Новый отчёт к заполнению: {template.title}',
        message=(
            f'Вам назначен отчёт за период '
            f'{start.strftime("%d.%m.%Y")} — {end.strftime("%d.%m.%Y")}. '
            f'Дедлайн: {deadline_str}.'
        ),
        project=template.project,
    )


def collect_tasks_data(report: Report):
    """Сбор данных о задачах участника за период."""
    tasks = Task.objects.filter(
        assignee=report.user,
        project=report.template.project,
        updated_at__date__gte=report.period_start,
        updated_at__date__lte=report.period_end
    )
    
    tasks_data = {
        'completed': [],
        'in_progress': [],
        'overdue': [],
        'total_count': tasks.count(),
        'completed_count': 0,
        'in_progress_count': 0,
        'overdue_count': 0,
    }
    
    today = timezone.now().date()
    
    for task in tasks:
        task_info = {
            'id': task.id,
            'title': task.title,
            'status': task.status,
            'deadline': task.deadline,
            'updated_at': task.updated_at.isoformat()
        }
        
        if task.status == 'done':
            tasks_data['completed'].append(task_info)
            tasks_data['completed_count'] += 1
        elif task.status == 'in_progress':
            tasks_data['in_progress'].append(task_info)
            tasks_data['in_progress_count'] += 1
        
        if task.deadline and task.deadline < today and task.status != 'done':
            tasks_data['overdue'].append(task_info)
            tasks_data['overdue_count'] += 1
    
    report.tasks_data = tasks_data
    report.save(update_fields=['tasks_data'])
    
    # Создаем связи с задачами
    for task in tasks:
        ReportTask.objects.get_or_create(
            report=report,
            task=task,
            defaults={'status_before': task.status}
        )
    
    return tasks_data


def get_user_reports(user_id: int, project_id: int = None):
    """Получение отчетов пользователя."""
    reports = Report.objects.filter(user_id=user_id).select_related('template')
    if project_id:
        reports = reports.filter(template__project_id=project_id)
    return reports.order_by('-period_start')


def get_project_reports_summary(project_id: int, owner_id: int = None):
    """Получение сводки по отчетам проекта."""
    reports = Report.objects.filter(template__project_id=project_id)
    
    if owner_id:
        # Проверяем, что пользователь владелец
        from projects.models import Project
        project = Project.objects.get(id=project_id)
        if project.owner_id != owner_id:
            return None
    
    total_reports = reports.count()
    submitted_reports = reports.filter(status='submitted').count()
    pending_reports = reports.filter(status__in=['pending', 'draft']).count()
    overdue_reports = reports.filter(status__in=['pending', 'draft'], deadline__lt=timezone.now()).count()
    
    completion_rate = (submitted_reports / total_reports * 100) if total_reports > 0 else 0
    
    # Статистика по пользователям
    user_stats = []
    user_reports = reports.values('user_id', 'user__full_name').annotate(
        total=Count('id'),
        submitted=Count('id', filter=Q(status='submitted')),
        pending=Count('id', filter=Q(status__in=['pending', 'draft'])),
        overdue=Count('id', filter=Q(status__in=['pending', 'draft'], deadline__lt=timezone.now()))
    )
    
    for stat in user_reports:
        user_stats.append({
            'user_id': stat['user_id'],
            'full_name': stat['user__full_name'],
            'total': stat['total'],
            'submitted': stat['submitted'],
            'pending': stat['pending'],
            'overdue': stat['overdue'],
            'completion_rate': (stat['submitted'] / stat['total'] * 100) if stat['total'] > 0 else 0
        })
    
    return {
        'total_reports': total_reports,
        'submitted_reports': submitted_reports,
        'pending_reports': pending_reports,
        'overdue_reports': overdue_reports,
        'completion_rate': round(completion_rate, 1),
        'user_stats': user_stats
    }


# LEGACY: JSON-based questions (disabled)
# def submit_report(report_id: int, user_id: int, data: dict):
#     """Сдача отчета."""
#     report = Report.objects.get(id=report_id, user_id=user_id)
#
#     if report.status in ['submitted', 'reviewed']:
#         raise ValueError('Отчет уже сдан')
#
#     report.answers = data.get('answers', {})
#     report.tasks_data = data.get('tasks_data', report.tasks_data)
#     report.status = 'submitted'
#     report.submitted_at = timezone.now()
#     report.save()
#
#     report_tasks = data.get('report_tasks', [])
#     for task_data in report_tasks:
#         ReportTask.objects.filter(
#             report=report,
#             task_id=task_data.get('task_id')
#         ).update(
#             status_after=task_data.get('status_after', ''),
#             time_spent=task_data.get('time_spent'),
#             comment=task_data.get('comment', '')
#         )
#
#     return report
# LEGACY: JSON-based questions (disabled)


def review_report(report_id: int, reviewer_id: int, action: str, comment: str = ''):
    """Проверка отчета владельцем проекта."""
    report = Report.objects.select_related('template__project').get(id=report_id)
    project = report.template.project
    
    if project.owner_id != reviewer_id:
        raise PermissionError('Только владелец проекта может проверять отчеты')
    
    report.status = action
    report.reviewed_by_id = reviewer_id
    report.reviewed_at = timezone.now()
    report.review_comment = comment
    report.save()
    
    return report