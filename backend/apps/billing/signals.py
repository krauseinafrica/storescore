import logging
from datetime import timedelta

from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone

logger = logging.getLogger(__name__)

DEFAULT_TRIAL_DAYS = 14
EXTENDED_TRIAL_DAYS = 30
TRIAL_PLAN_SLUG = 'enterprise'


@receiver(post_save, sender='accounts.Organization')
def create_trial_subscription(sender, instance, created, **kwargs):
    """Auto-create a trial subscription when a new organization is created."""
    if not created:
        return

    from .models import Plan, Subscription

    try:
        plan = Plan.objects.get(slug=TRIAL_PLAN_SLUG, is_active=True)
    except Plan.DoesNotExist:
        logger.warning(f'Trial plan "{TRIAL_PLAN_SLUG}" not found. Skipping trial for {instance.name}.')
        return

    # Check metadata for trial_source to determine duration
    trial_source = getattr(instance, '_trial_source', '') or ''
    if trial_source == 'product-tour':
        trial_days = EXTENDED_TRIAL_DAYS
    else:
        trial_days = DEFAULT_TRIAL_DAYS

    now = timezone.now()
    Subscription.objects.create(
        organization=instance,
        plan=plan,
        billing_interval='monthly',
        store_count=1,
        status='trialing',
        trial_start=now,
        trial_end=now + timedelta(days=trial_days),
        trial_source=trial_source,
    )

    # Set cached tier on OrgSettings
    from apps.stores.models import OrgSettings
    settings, _ = OrgSettings.objects.get_or_create(organization=instance)
    settings.subscription_tier = TRIAL_PLAN_SLUG
    settings.save(update_fields=['subscription_tier'])

    logger.info(f'Created {trial_days}-day {TRIAL_PLAN_SLUG} trial for {instance.name}')
