"""
Celery tasks for walk processing — AI summary generation and email notifications.
"""

import logging
from datetime import timedelta

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def process_walk_completion(self, walk_id: str, recipient_emails: list[str]):
    """
    After a walk is completed:
    1. Generate an AI summary via Claude API
    2. Store the summary on the walk
    3. Send the results email to specified recipients
    """
    from .models import Walk
    from .services import generate_walk_summary, send_walk_email

    try:
        walk = Walk.objects.select_related(
            'store__organization',
            'template',
            'conducted_by',
        ).get(id=walk_id)
    except Walk.DoesNotExist:
        logger.error(f'Walk {walk_id} not found')
        return

    # Generate AI summary
    logger.info(f'Generating AI summary for walk {walk_id}')
    summary = generate_walk_summary(walk)

    # Store summary on the walk
    walk.ai_summary = summary
    walk.save(update_fields=['ai_summary'])
    logger.info(f'AI summary saved for walk {walk_id}')

    # Send email
    if recipient_emails:
        logger.info(f'Sending walk email to {recipient_emails}')
        send_walk_email(walk, summary, recipient_emails)


@shared_task(bind=True, max_retries=2, default_retry_delay=60)
def send_scheduled_digest_reports(self):
    """
    Periodic task: check all active ReportSchedule entries
    and send digest emails where due.
    - Weekly: sent if last_sent_at is >6 days ago (or never sent)
    - Monthly: sent if last_sent_at is >27 days ago (or never sent)
    """
    from .models import ReportSchedule
    from .services import send_digest_email

    now = timezone.now()
    schedules = ReportSchedule.objects.filter(is_active=True).select_related(
        'user', 'organization'
    )

    sent_count = 0
    for schedule in schedules:
        if schedule.frequency == 'weekly':
            threshold = now - timedelta(days=6)
        else:  # monthly
            threshold = now - timedelta(days=27)

        if schedule.last_sent_at and schedule.last_sent_at > threshold:
            continue  # not due yet

        try:
            success = send_digest_email(schedule)
            if success:
                schedule.last_sent_at = now
                schedule.save(update_fields=['last_sent_at'])
                sent_count += 1
        except Exception as e:
            logger.error(
                f'Failed to send {schedule.frequency} digest to '
                f'{schedule.user.email} for org {schedule.organization.name}: {e}'
            )

    logger.info(f'Scheduled digest reports: sent {sent_count} emails')
