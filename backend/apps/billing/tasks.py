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
    """Send branded email warning that trial is ending soon, with personalized stats."""
    from django.conf import settings as django_settings
    from apps.accounts.models import Membership, Organization
    from apps.stores.models import Store
    from apps.walks.models import Walk

    if not django_settings.RESEND_API_KEY:
        return

    try:
        org = Organization.objects.select_related('owner').get(id=organization_id)
    except Organization.DoesNotExist:
        return

    store_count = Store.objects.filter(organization=org, is_active=True).count()
    walk_count = Walk.objects.filter(organization=org, status='completed').count()
    member_count = Membership.objects.filter(organization=org).count()

    stats_html = ''
    if store_count or walk_count or member_count > 1:
        stats_html = f'''
            <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:16px 0;">
                <p style="font-size:14px;color:#374151;margin:0 0 8px;font-weight:600;">Here's what you've built so far:</p>
                <table style="width:100%;">
                    <tr>
                        <td style="padding:4px 12px 4px 0;font-size:24px;font-weight:700;color:#D40029;">{store_count}</td>
                        <td style="padding:4px 12px 4px 0;font-size:24px;font-weight:700;color:#D40029;">{walk_count}</td>
                        <td style="padding:4px 0;font-size:24px;font-weight:700;color:#D40029;">{member_count}</td>
                    </tr>
                    <tr>
                        <td style="padding:0 12px 0 0;font-size:12px;color:#6b7280;">Stores</td>
                        <td style="padding:0 12px 0 0;font-size:12px;color:#6b7280;">Walks Completed</td>
                        <td style="font-size:12px;color:#6b7280;">Team Members</td>
                    </tr>
                </table>
            </div>
        '''

    import resend
    resend.api_key = django_settings.RESEND_API_KEY

    base_url = django_settings.FRONTEND_URL.rstrip('/')

    try:
        resend.Emails.send({
            'from': django_settings.DEFAULT_FROM_EMAIL,
            'to': org.owner.email,
            'subject': f'Your StoreScore trial is ending soon - {org.name}',
            'html': f'''
                <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 16px;">
                    <img src="{base_url}/storescore-logo.png" alt="StoreScore" style="height:28px;margin-bottom:24px;" />
                    <h2 style="color:#111827;font-size:20px;margin:0 0 12px;">Your trial is ending soon</h2>
                    <p style="color:#374151;font-size:15px;line-height:1.6;">Hi {org.owner.first_name},</p>
                    <p style="color:#374151;font-size:15px;line-height:1.6;">
                        Your free trial for <strong>{org.name}</strong> on StoreScore ends in <strong>3 days</strong>.
                    </p>
                    {stats_html}
                    <p style="color:#374151;font-size:15px;line-height:1.6;">
                        Choose a plan now to keep your data and continue improving store operations with your team.
                    </p>
                    <a href="{base_url}/billing" style="display:inline-block;background:#D40029;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;margin:12px 0;">
                        Choose a Plan
                    </a>
                    <p style="color:#6b7280;font-size:13px;line-height:1.6;margin-top:20px;">
                        Questions? Just reply to this email &mdash; we're happy to help.
                    </p>
                    <p style="color:#374151;font-size:15px;">Thanks,<br>The StoreScore Team</p>
                </div>
            ''',
        })
    except Exception as e:
        logger.error(f'Failed to send trial ending email to {org.owner.email}: {e}')


@shared_task
def check_trial_expired():
    """Check for trials that expired yesterday and send follow-up email."""
    from .models import Subscription

    now = timezone.now()
    yesterday = now - timedelta(days=1)

    expired = Subscription.objects.filter(
        status=Subscription.Status.TRIALING,
        trial_end__gte=yesterday - timedelta(hours=12),
        trial_end__lte=now,
    ).select_related('organization__owner')

    for sub in expired:
        send_trial_expired_email.delay(str(sub.organization_id))


@shared_task
def send_trial_expired_email(organization_id):
    """Send email after trial expiry — offer 7-day extension for engaged users."""
    from django.conf import settings as django_settings
    from apps.accounts.models import Organization
    from apps.walks.models import Walk

    if not django_settings.RESEND_API_KEY:
        return

    try:
        org = Organization.objects.select_related('owner').get(id=organization_id)
    except Organization.DoesNotExist:
        return

    walk_count = Walk.objects.filter(organization=org, status='completed').count()

    import resend
    resend.api_key = django_settings.RESEND_API_KEY

    base_url = django_settings.FRONTEND_URL.rstrip('/')

    if walk_count >= 3:
        # Engaged user — offer 7-day extension
        subject = f'We extended your StoreScore trial - {org.name}'
        body = f'''
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 16px;">
                <img src="{base_url}/storescore-logo.png" alt="StoreScore" style="height:28px;margin-bottom:24px;" />
                <h2 style="color:#111827;font-size:20px;margin:0 0 12px;">You've earned a 7-day extension!</h2>
                <p style="color:#374151;font-size:15px;line-height:1.6;">Hi {org.owner.first_name},</p>
                <p style="color:#374151;font-size:15px;line-height:1.6;">
                    Your trial for <strong>{org.name}</strong> just expired, but we noticed you've completed
                    <strong>{walk_count} store walks</strong> &mdash; great progress!
                </p>
                <p style="color:#374151;font-size:15px;line-height:1.6;">
                    We've added <strong>7 more days</strong> to your trial so you can keep the momentum going.
                    When you're ready to commit, choose a plan that works for your team.
                </p>
                <a href="{base_url}/billing" style="display:inline-block;background:#D40029;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;margin:12px 0;">
                    View Plans
                </a>
                <p style="color:#6b7280;font-size:13px;line-height:1.6;margin-top:20px;">
                    Reply to this email if you have any questions.
                </p>
                <p style="color:#374151;font-size:15px;">Thanks,<br>The StoreScore Team</p>
            </div>
        '''
        # Actually extend the trial
        from .models import Subscription
        try:
            sub = Subscription.objects.get(organization=org, status=Subscription.Status.TRIALING)
            sub.trial_end = timezone.now() + timedelta(days=7)
            sub.save(update_fields=['trial_end', 'updated_at'])
            logger.info(f'Extended trial by 7 days for {org.name} ({walk_count} walks)')
        except Subscription.DoesNotExist:
            pass
    else:
        subject = f'Your StoreScore trial has ended - {org.name}'
        body = f'''
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 16px;">
                <img src="{base_url}/storescore-logo.png" alt="StoreScore" style="height:28px;margin-bottom:24px;" />
                <h2 style="color:#111827;font-size:20px;margin:0 0 12px;">Your trial has ended</h2>
                <p style="color:#374151;font-size:15px;line-height:1.6;">Hi {org.owner.first_name},</p>
                <p style="color:#374151;font-size:15px;line-height:1.6;">
                    Your free trial for <strong>{org.name}</strong> on StoreScore has ended.
                </p>
                <p style="color:#374151;font-size:15px;line-height:1.6;">
                    Your data is still safe. Choose a plan to pick up right where you left off.
                </p>
                <a href="{base_url}/billing" style="display:inline-block;background:#D40029;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;margin:12px 0;">
                    Choose a Plan
                </a>
                <p style="color:#6b7280;font-size:13px;line-height:1.6;margin-top:20px;">
                    Need more time to evaluate? Reply and we'll work something out.
                </p>
                <p style="color:#374151;font-size:15px;">Thanks,<br>The StoreScore Team</p>
            </div>
        '''

    try:
        resend.Emails.send({
            'from': django_settings.DEFAULT_FROM_EMAIL,
            'to': org.owner.email,
            'subject': subject,
            'html': body,
        })
    except Exception as e:
        logger.error(f'Failed to send trial expired email to {org.owner.email}: {e}')


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
    20: 'VOLUME_25',
}


def _sync_stripe_subscription(sub, store_count, discount_percent):
    """Update Stripe subscription quantity and volume/promo discount coupon."""
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

        # Promo discount overrides volume discount
        if sub.promo_discount_percent > 0:
            coupon_id = _get_or_create_promo_coupon(sub.promo_discount_percent)
        else:
            coupon_id = VOLUME_COUPON_MAP.get(discount_percent, '')
        stripe.Subscription.modify(
            sub.stripe_subscription_id,
            coupon=coupon_id or '',
        )
    except Exception as e:
        logger.error(f'Failed to sync Stripe for {sub.organization.name}: {e}')


def _get_or_create_promo_coupon(percent):
    """Get or create a Stripe coupon for a promotional discount percentage."""
    import stripe
    from django.conf import settings as django_settings
    stripe.api_key = django_settings.STRIPE_SECRET_KEY

    coupon_id = f'PROMO_{percent}'
    try:
        stripe.Coupon.retrieve(coupon_id)
    except stripe.error.InvalidRequestError:
        stripe.Coupon.create(
            id=coupon_id,
            percent_off=percent,
            duration='forever',
            name=f'Promotional Discount ({percent}%)',
        )
    return coupon_id
