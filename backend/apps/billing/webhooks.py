import logging
from datetime import datetime, timezone as dt_timezone

from django.conf import settings
from django.http import HttpResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from .models import Invoice, Subscription

logger = logging.getLogger(__name__)


def _ts_to_dt(timestamp):
    """Convert a Stripe Unix timestamp to a timezone-aware datetime."""
    if timestamp is None:
        return None
    return datetime.fromtimestamp(timestamp, tz=dt_timezone.utc)


def _handle_subscription_created(data):
    """Handle customer.subscription.created event."""
    stripe_sub = data['object']
    customer_id = stripe_sub['customer']
    stripe_sub_id = stripe_sub['id']
    status_map = {
        'trialing': Subscription.Status.TRIALING,
        'active': Subscription.Status.ACTIVE,
        'past_due': Subscription.Status.PAST_DUE,
        'canceled': Subscription.Status.CANCELED,
        'incomplete': Subscription.Status.PAST_DUE,
        'incomplete_expired': Subscription.Status.CANCELED,
        'unpaid': Subscription.Status.PAST_DUE,
    }

    try:
        subscription = Subscription.objects.get(stripe_customer_id=customer_id)
    except Subscription.DoesNotExist:
        logger.warning(f'No subscription found for Stripe customer {customer_id}')
        return

    subscription.stripe_subscription_id = stripe_sub_id
    subscription.status = status_map.get(stripe_sub['status'], Subscription.Status.ACTIVE)
    subscription.current_period_start = _ts_to_dt(stripe_sub.get('current_period_start'))
    subscription.current_period_end = _ts_to_dt(stripe_sub.get('current_period_end'))

    if stripe_sub.get('trial_start'):
        subscription.trial_start = _ts_to_dt(stripe_sub['trial_start'])
    if stripe_sub.get('trial_end'):
        subscription.trial_end = _ts_to_dt(stripe_sub['trial_end'])

    # Extract quantity (store count) from first item
    items = stripe_sub.get('items', {}).get('data', [])
    if items:
        subscription.store_count = items[0].get('quantity', 1)

    subscription.save()
    logger.info(f'Subscription created for {subscription.organization.name}: {stripe_sub_id}')

    # Update OrgSettings cached tier
    _sync_org_tier(subscription)


def _handle_subscription_updated(data):
    """Handle customer.subscription.updated event."""
    stripe_sub = data['object']
    stripe_sub_id = stripe_sub['id']

    status_map = {
        'trialing': Subscription.Status.TRIALING,
        'active': Subscription.Status.ACTIVE,
        'past_due': Subscription.Status.PAST_DUE,
        'canceled': Subscription.Status.CANCELED,
        'incomplete': Subscription.Status.PAST_DUE,
        'incomplete_expired': Subscription.Status.CANCELED,
        'unpaid': Subscription.Status.PAST_DUE,
    }

    try:
        subscription = Subscription.objects.get(stripe_subscription_id=stripe_sub_id)
    except Subscription.DoesNotExist:
        # Try by customer ID as fallback
        try:
            subscription = Subscription.objects.get(stripe_customer_id=stripe_sub['customer'])
            subscription.stripe_subscription_id = stripe_sub_id
        except Subscription.DoesNotExist:
            logger.warning(f'No subscription found for Stripe subscription {stripe_sub_id}')
            return

    subscription.status = status_map.get(stripe_sub['status'], subscription.status)
    subscription.current_period_start = _ts_to_dt(stripe_sub.get('current_period_start'))
    subscription.current_period_end = _ts_to_dt(stripe_sub.get('current_period_end'))
    subscription.cancel_at_period_end = stripe_sub.get('cancel_at_period_end', False)

    if stripe_sub.get('trial_start'):
        subscription.trial_start = _ts_to_dt(stripe_sub['trial_start'])
    if stripe_sub.get('trial_end'):
        subscription.trial_end = _ts_to_dt(stripe_sub['trial_end'])

    items = stripe_sub.get('items', {}).get('data', [])
    if items:
        subscription.store_count = items[0].get('quantity', 1)

    subscription.save()
    logger.info(f'Subscription updated for {subscription.organization.name}: {stripe_sub["status"]}')

    _sync_org_tier(subscription)


def _handle_subscription_deleted(data):
    """Handle customer.subscription.deleted event."""
    stripe_sub = data['object']
    stripe_sub_id = stripe_sub['id']

    try:
        subscription = Subscription.objects.get(stripe_subscription_id=stripe_sub_id)
    except Subscription.DoesNotExist:
        logger.warning(f'No subscription found for deleted Stripe subscription {stripe_sub_id}')
        return

    subscription.status = Subscription.Status.CANCELED
    subscription.save(update_fields=['status', 'updated_at'])
    logger.info(f'Subscription canceled for {subscription.organization.name}')

    _sync_org_tier(subscription)


def _handle_invoice_paid(data):
    """Handle invoice.paid event - record successful payment."""
    stripe_invoice = data['object']
    subscription_id = stripe_invoice.get('subscription')

    if not subscription_id:
        return

    try:
        subscription = Subscription.objects.get(stripe_subscription_id=subscription_id)
    except Subscription.DoesNotExist:
        logger.warning(f'No subscription found for invoice subscription {subscription_id}')
        return

    Invoice.objects.update_or_create(
        stripe_invoice_id=stripe_invoice['id'],
        defaults={
            'subscription': subscription,
            'amount': stripe_invoice['amount_paid'] / 100,  # Stripe uses cents
            'status': 'paid',
            'invoice_url': stripe_invoice.get('hosted_invoice_url', ''),
            'invoice_pdf': stripe_invoice.get('invoice_pdf', ''),
            'period_start': _ts_to_dt(stripe_invoice.get('period_start')),
            'period_end': _ts_to_dt(stripe_invoice.get('period_end')),
        },
    )

    # Ensure subscription is active after payment
    if subscription.status == Subscription.Status.PAST_DUE:
        subscription.status = Subscription.Status.ACTIVE
        subscription.save(update_fields=['status', 'updated_at'])

    logger.info(f'Invoice paid for {subscription.organization.name}: ${stripe_invoice["amount_paid"] / 100}')


def _handle_invoice_payment_failed(data):
    """Handle invoice.payment_failed event."""
    stripe_invoice = data['object']
    subscription_id = stripe_invoice.get('subscription')

    if not subscription_id:
        return

    try:
        subscription = Subscription.objects.get(stripe_subscription_id=subscription_id)
    except Subscription.DoesNotExist:
        return

    subscription.status = Subscription.Status.PAST_DUE
    subscription.save(update_fields=['status', 'updated_at'])

    logger.warning(f'Payment failed for {subscription.organization.name}')

    # Send warning email via Celery
    from .tasks import send_payment_failed_email
    send_payment_failed_email.delay(str(subscription.organization_id))


def _handle_trial_will_end(data):
    """Handle customer.subscription.trial_will_end event (3 days before)."""
    stripe_sub = data['object']

    try:
        subscription = Subscription.objects.get(stripe_subscription_id=stripe_sub['id'])
    except Subscription.DoesNotExist:
        return

    from .tasks import send_trial_ending_email
    send_trial_ending_email.delay(str(subscription.organization_id))

    logger.info(f'Trial ending soon for {subscription.organization.name}')


def _sync_org_tier(subscription):
    """Update the cached subscription_tier on OrgSettings."""
    from apps.stores.models import OrgSettings
    OrgSettings.objects.update_or_create(
        organization=subscription.organization,
        defaults={'subscription_tier': subscription.plan.slug if subscription.is_active_subscription else 'free'},
    )


EVENT_HANDLERS = {
    'customer.subscription.created': _handle_subscription_created,
    'customer.subscription.updated': _handle_subscription_updated,
    'customer.subscription.deleted': _handle_subscription_deleted,
    'invoice.paid': _handle_invoice_paid,
    'invoice.payment_failed': _handle_invoice_payment_failed,
    'customer.subscription.trial_will_end': _handle_trial_will_end,
}


@csrf_exempt
@require_POST
def stripe_webhook(request):
    """Stripe webhook endpoint."""
    import stripe

    payload = request.body
    sig_header = request.META.get('HTTP_STRIPE_SIGNATURE', '')

    if not settings.STRIPE_WEBHOOK_SECRET:
        logger.error('STRIPE_WEBHOOK_SECRET not configured')
        return HttpResponse(status=400)

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET,
        )
    except ValueError:
        logger.error('Invalid Stripe webhook payload')
        return HttpResponse(status=400)
    except stripe.error.SignatureVerificationError:
        logger.error('Invalid Stripe webhook signature')
        return HttpResponse(status=400)

    event_type = event['type']
    handler = EVENT_HANDLERS.get(event_type)

    if handler:
        try:
            handler(event['data'])
        except Exception:
            logger.exception(f'Error handling Stripe event {event_type}')
            return HttpResponse(status=500)
    else:
        logger.debug(f'Unhandled Stripe event type: {event_type}')

    return HttpResponse(status=200)
