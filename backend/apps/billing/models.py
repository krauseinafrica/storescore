import uuid

from django.db import models
from django.utils import timezone

from apps.core.models import TimestampedModel


class Plan(TimestampedModel):
    """Defines available subscription plans."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=50)
    slug = models.SlugField(unique=True)
    stripe_price_id_monthly = models.CharField(max_length=100, blank=True, default='')
    stripe_price_id_annual = models.CharField(max_length=100, blank=True, default='')
    price_per_store_monthly = models.DecimalField(max_digits=8, decimal_places=2)
    price_per_store_annual = models.DecimalField(max_digits=8, decimal_places=2)
    max_users = models.IntegerField(
        null=True, blank=True,
        help_text='Maximum users allowed. Null = unlimited.',
    )
    max_templates = models.IntegerField(
        null=True, blank=True,
        help_text='Maximum scoring templates. Null = unlimited.',
    )
    max_walks_per_store = models.IntegerField(
        null=True, blank=True,
        help_text='Maximum walks per store per month. Null = unlimited.',
    )
    max_stores = models.IntegerField(
        null=True, blank=True,
        help_text='Maximum stores. Null = unlimited.',
    )
    features = models.JSONField(
        default=dict,
        help_text='Feature flags, e.g. {"ai_summaries": true, "csv_export": true}',
    )
    is_active = models.BooleanField(default=True)
    display_order = models.IntegerField(default=0)

    class Meta:
        db_table = 'billing_plan'
        ordering = ['display_order']

    def __str__(self):
        return self.name

    def has_feature(self, feature_name):
        """Check if this plan includes a specific feature."""
        return self.features.get(feature_name, False)


class Subscription(TimestampedModel):
    """An organization's active subscription."""

    class Status(models.TextChoices):
        TRIALING = 'trialing', 'Trialing'
        ACTIVE = 'active', 'Active'
        PAST_DUE = 'past_due', 'Past Due'
        CANCELED = 'canceled', 'Canceled'
        FREE = 'free', 'Free'

    class BillingInterval(models.TextChoices):
        MONTHLY = 'monthly', 'Monthly'
        ANNUAL = 'annual', 'Annual'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.OneToOneField(
        'accounts.Organization',
        on_delete=models.CASCADE,
        related_name='subscription',
    )
    plan = models.ForeignKey(Plan, on_delete=models.PROTECT, related_name='subscriptions')
    stripe_customer_id = models.CharField(max_length=100, blank=True, default='')
    stripe_subscription_id = models.CharField(max_length=100, blank=True, default='')
    billing_interval = models.CharField(
        max_length=10,
        choices=BillingInterval.choices,
        default=BillingInterval.MONTHLY,
    )
    store_count = models.IntegerField(default=1, help_text='Billable store count.')
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.FREE,
    )
    trial_start = models.DateTimeField(null=True, blank=True)
    trial_end = models.DateTimeField(null=True, blank=True)
    current_period_start = models.DateTimeField(null=True, blank=True)
    current_period_end = models.DateTimeField(null=True, blank=True)
    cancel_at_period_end = models.BooleanField(default=False)
    discount_percent = models.IntegerField(
        default=0,
        help_text='Volume discount percentage applied (0, 10, 20, or 30).',
    )

    class Meta:
        db_table = 'billing_subscription'

    def __str__(self):
        return f'{self.organization.name} - {self.plan.name} ({self.status})'

    @property
    def is_active_subscription(self):
        """Check if subscription allows access (trialing, active, or within grace period)."""
        if self.status in (self.Status.TRIALING, self.Status.ACTIVE):
            return True
        if self.status == self.Status.FREE:
            return True
        # Grace period: 7 days after subscription lapses
        if self.status == self.Status.PAST_DUE and self.current_period_end:
            grace_end = self.current_period_end + timezone.timedelta(days=7)
            return timezone.now() < grace_end
        return False

    @property
    def is_trialing(self):
        return self.status == self.Status.TRIALING and self.trial_end and timezone.now() < self.trial_end

    @staticmethod
    def get_volume_discount(store_count):
        """Return the volume discount percentage based on store count."""
        if store_count >= 10:
            return 15
        if store_count >= 5:
            return 10
        if store_count >= 3:
            return 5
        return 0


class Invoice(TimestampedModel):
    """Record of Stripe invoices for billing history."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    subscription = models.ForeignKey(
        Subscription,
        on_delete=models.CASCADE,
        related_name='invoices',
    )
    stripe_invoice_id = models.CharField(max_length=100, unique=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, default='open')
    invoice_url = models.URLField(blank=True, default='')
    invoice_pdf = models.URLField(blank=True, default='')
    period_start = models.DateTimeField()
    period_end = models.DateTimeField()

    class Meta:
        db_table = 'billing_invoice'
        ordering = ['-period_start']

    def __str__(self):
        return f'Invoice {self.stripe_invoice_id} - ${self.amount}'
