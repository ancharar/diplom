def create_notification(
    recipient,
    notification_type: str,
    title: str,
    message: str = '',
    project=None,
    task=None,
    invitation=None,
):
    from .models import Notification
    return Notification.objects.create(
        recipient=recipient,
        notification_type=notification_type,
        title=title,
        message=message,
        project=project,
        task=task,
        invitation=invitation,
    )
