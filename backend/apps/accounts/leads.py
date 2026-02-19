"""
Lead model for tracking demo requests and potential customers,
plus DripEmail model for automated email campaigns.
"""
import uuid

from django.db import models
from django.utils import timezone

from apps.core.models import TimestampedModel


class Lead(TimestampedModel):
    """A prospective customer who requested a demo or info."""

    class Status(models.TextChoices):
        NEW = 'new', 'New'
        CONTACTED = 'contacted', 'Contacted'
        DEMO_ACTIVE = 'demo_active', 'Demo Active'
        CONVERTED = 'converted', 'Converted'
        CLOSED = 'closed', 'Closed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField()
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150, blank=True, default='')
    company_name = models.CharField(max_length=255, blank=True, default='')
    phone = models.CharField(max_length=20, blank=True, default='')
    store_count = models.PositiveIntegerField(null=True, blank=True)
    message = models.TextField(blank=True, default='')
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.NEW,
    )
    demo_org = models.ForeignKey(
        'accounts.Organization',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='demo_leads',
        help_text='The demo organization created for this lead.',
    )
    demo_expires_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When the demo access expires.',
    )
    source = models.CharField(
        max_length=50,
        default='website',
        help_text='Lead source: website, referral, etc.',
    )
    unsubscribed = models.BooleanField(
        default=False,
        help_text='Whether the lead has opted out of drip emails.',
    )

    class Meta:
        db_table = 'accounts_lead'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.first_name} {self.last_name} ({self.email})'


class DripEmail(models.Model):
    """A scheduled drip campaign email for a lead."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lead = models.ForeignKey(
        Lead,
        on_delete=models.CASCADE,
        related_name='drip_emails',
    )
    step = models.PositiveSmallIntegerField(
        help_text='Drip step number (0=welcome, 1=features, 2=roi, 3=free account).',
    )
    scheduled_at = models.DateTimeField(
        help_text='When this email should be sent.',
    )
    sent_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When this email was actually sent.',
    )

    class Meta:
        db_table = 'accounts_drip_email'
        ordering = ['scheduled_at']
        unique_together = [('lead', 'step')]

    def __str__(self):
        status = f'sent {self.sent_at}' if self.sent_at else f'scheduled {self.scheduled_at}'
        return f'Drip #{self.step} for {self.lead.email} ({status})'

    @property
    def is_due(self):
        return not self.sent_at and self.scheduled_at <= timezone.now()
