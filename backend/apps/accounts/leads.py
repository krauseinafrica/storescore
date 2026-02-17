"""
Lead model for tracking demo requests and potential customers.
"""
import uuid

from django.db import models

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
    last_name = models.CharField(max_length=150)
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

    class Meta:
        db_table = 'accounts_lead'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.first_name} {self.last_name} ({self.email})'
