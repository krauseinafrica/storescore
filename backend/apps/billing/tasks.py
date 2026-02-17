import logging
from datetime import timedelta

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task
def check_trial_expirations():
    """Check for trials expiring soon and send notification emails."""
    from .models import Subscription

    # Find trials ending in the next 3 days
    now = timezone.now()
    soon = now + timedelta(days=3)

    expiring = Subscription.objects.filter(
        status=Subscription.Status.TRIALING,
        trial_end__gte=now,
        trial_end__lte=soon,
    ).select_related('organization__owner')

    for sub in expiring:
        send_trial_ending_email.delay(str(sub.organization_id))


@shared_task
def send_trial_ending_email(organization_id):
    """Send email warning that trial is ending soon."""
    from django.conf import settings as django_settings
    from apps.accounts.models import Organization

    if not django_settings.RESEND_API_KEY:
        return

    try:
        org = Organization.objects.select_related('owner').get(id=organization_id)
    except Organization.DoesNotExist:
        return

    import resend
    resend.api_key = django_settings.RESEND_API_KEY

    try:
        resend.Emails.send({
            'from': django_settings.DEFAULT_FROM_EMAIL,
            'to': org.owner.email,
            'subject': f'Your StoreScore trial is ending soon - {org.name}',
            'html': f'''
                <h2>Your trial is ending soon</h2>
                <p>Hi {org.owner.first_name},</p>
                <p>Your 30-day free trial for <strong>{org.name}</strong> on StoreScore is ending in 3 days.</p>
                <p>To continue using all features without interruption, please choose a subscription plan.</p>
                <p>If you have questions about which plan is right for you, reply to this email.</p>
                <p>Thanks,<br>The StoreScore Team</p>
            ''',
        })
    except Exception as e:
        logger.error(f'Failed to send trial ending email to {org.owner.email}: {e}')


@shared_task
def send_payment_failed_email(organization_id):
    """Send email warning about failed payment."""
    from django.conf import settings as django_settings
    from apps.accounts.models import Organization

    if not django_settings.RESEND_API_KEY:
        return

    try:
        org = Organization.objects.select_related('owner').get(id=organization_id)
    except Organization.DoesNotExist:
        return

    import resend
    resend.api_key = django_settings.RESEND_API_KEY

    try:
        resend.Emails.send({
            'from': django_settings.DEFAULT_FROM_EMAIL,
            'to': org.owner.email,
            'subject': f'Payment failed for StoreScore - {org.name}',
            'html': f'''
                <h2>Payment Failed</h2>
                <p>Hi {org.owner.first_name},</p>
                <p>We were unable to process your payment for <strong>{org.name}</strong> on StoreScore.</p>
                <p>Please update your payment information to avoid service interruption.
                You have a 7-day grace period before access is restricted.</p>
                <p>Thanks,<br>The StoreScore Team</p>
            ''',
        })
    except Exception as e:
        logger.error(f'Failed to send payment failed email to {org.owner.email}: {e}')


@shared_task
def sync_store_counts():
    """Sync billable store counts for all active subscriptions."""
    from .models import Subscription
    from apps.stores.models import Store

    active_subs = Subscription.objects.filter(
        status__in=[Subscription.Status.ACTIVE, Subscription.Status.TRIALING],
    ).select_related('organization')

    for sub in active_subs:
        count = Store.objects.filter(
            organization=sub.organization, is_active=True,
        ).count()
        count = max(count, 1)

        if count != sub.store_count:
            old_count = sub.store_count
            new_discount = Subscription.get_volume_discount(count)
            sub.store_count = count
            sub.discount_percent = new_discount
            sub.save(update_fields=['store_count', 'discount_percent', 'updated_at'])

            # Update Stripe subscription quantity and coupon
            if sub.stripe_subscription_id:
                _sync_stripe_subscription(sub, count, new_discount)

            logger.info(
                f'Store count updated for {sub.organization.name}: {old_count} -> {count}'
            )


VOLUME_COUPON_MAP = {
    5: 'VOLUME_3',
    10: 'VOLUME_5',
    15: 'VOLUME_10',
}


def _sync_stripe_subscription(sub, store_count, discount_percent):
    """Update Stripe subscription quantity and volume discount coupon."""
    from django.conf import settings as django_settings

    if not django_settings.STRIPE_SECRET_KEY:
        return

    import stripe
    stripe.api_key = django_settings.STRIPE_SECRET_KEY

    try:
        stripe_sub = stripe.Subscription.retrieve(sub.stripe_subscription_id)
        if stripe_sub['items']['data']:
            stripe.SubscriptionItem.modify(
                stripe_sub['items']['data'][0].id,
                quantity=store_count,
            )

        coupon_id = VOLUME_COUPON_MAP.get(discount_percent, '')
        stripe.Subscription.modify(
            sub.stripe_subscription_id,
            coupon=coupon_id or '',
        )
    except Exception as e:
        logger.error(f'Failed to sync Stripe for {sub.organization.name}: {e}')
