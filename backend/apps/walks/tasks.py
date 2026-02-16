"""
Celery tasks for walk processing — AI summary generation and email notifications.
"""

import logging

from celery import shared_task

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
