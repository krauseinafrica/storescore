import hashlib
import hmac
import json
import logging

from django.conf import settings
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from .models import SupportTicket

logger = logging.getLogger(__name__)


@csrf_exempt
@require_POST
def sentry_webhook(request):
    """Handle incoming Sentry webhook events."""
    secret = settings.SENTRY_WEBHOOK_SECRET
    if not secret:
        logger.error('SENTRY_WEBHOOK_SECRET not configured')
        return HttpResponse(status=400)

    # Validate HMAC-SHA256 signature
    signature = request.headers.get('sentry-hook-signature', '')
    expected = hmac.new(
        secret.encode('utf-8'),
        request.body,
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(signature, expected):
        logger.warning('Invalid Sentry webhook signature')
        return HttpResponse(status=401)

    try:
        payload = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return HttpResponse(status=400)

    resource = request.headers.get('sentry-hook-resource', '')
    action = payload.get('action', '')

    if resource == 'issue' and action == 'created':
        _handle_issue_created(payload)

    return HttpResponse(status=200)


def _handle_issue_created(payload):
    """Create a SupportTicket from a new Sentry issue."""
    issue_data = payload.get('data', {}).get('issue', {})
    if not issue_data:
        return

    external_id = str(issue_data.get('id', ''))
    if not external_id:
        return

    # Deduplicate
    if SupportTicket.objects.filter(external_id=external_id).exists():
        logger.info(f'Sentry issue {external_id} already exists, skipping')
        return

    title = (issue_data.get('title', '') or 'Untitled Sentry Issue')[:255]
    culprit = issue_data.get('culprit', '')
    level = issue_data.get('level', 'error')
    times_seen = issue_data.get('count', 1)
    permalink = issue_data.get('permalink', '')
    short_id = issue_data.get('shortId', '')

    # Extract error type and message from metadata
    metadata = issue_data.get('metadata', {})
    error_type = metadata.get('type', '')
    error_value = metadata.get('value', '')
    error_filename = metadata.get('filename', '')

    description_parts = []
    if error_type and error_value:
        description_parts.append(f'{error_type}: {error_value}')
    elif error_value:
        description_parts.append(error_value)
    if culprit:
        description_parts.append(f'Location: {culprit}')
    if error_filename:
        description_parts.append(f'File: {error_filename}')
    description_parts.append(f'Level: {level}')
    description_parts.append(f'Times seen: {times_seen}')
    if short_id:
        description_parts.append(f'Sentry ID: {short_id}')
    if permalink:
        description_parts.append(f'URL: {permalink}')
    description = '\n'.join(description_parts)

    # Map level to priority
    if level in ('error', 'fatal'):
        priority = 'high'
    elif level == 'warning':
        priority = 'medium'
    else:
        priority = 'low'

    SupportTicket.objects.create(
        source='sentry',
        organization=None,
        user=None,
        subject=title,
        description=description,
        external_id=external_id,
        category='bug',
        priority=priority,
    )
    logger.info(f'Created ticket from Sentry issue {external_id}: {title}')
