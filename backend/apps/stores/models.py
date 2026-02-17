import uuid

from django.conf import settings
from django.db import models

from apps.core.models import OrgScopedModel, TimestampedModel

# Import integration models so Django discovers them
from apps.stores.integrations import IntegrationConfig, StoreDataPoint  # noqa: F401


class Region(OrgScopedModel):
    """A geographic or logical grouping of stores within an organization."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    parent = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='children',
        help_text='Parent region for one-level nesting.',
    )
    manager = models.ForeignKey(
        'accounts.Membership',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='managed_regions',
        help_text='The responsible person for this region.',
    )
    color = models.CharField(
        max_length=7,
        default='#3B82F6',
        blank=True,
        help_text='Hex color code for map markers and UI (e.g. #3B82F6).',
    )

    class Meta:
        db_table = 'stores_region'
        ordering = ['name']

    def __str__(self):
        return self.name

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.parent:
            if self.parent.parent_id is not None:
                raise ValidationError(
                    {'parent': 'Cannot nest more than one level deep. The selected parent already has a parent.'}
                )
            if self.pk and self.children.exists():
                raise ValidationError(
                    {'parent': 'This region has sub-regions and cannot become a child itself.'}
                )
            if self.parent_id == self.pk:
                raise ValidationError(
                    {'parent': 'A region cannot be its own parent.'}
                )


class Store(OrgScopedModel):
    """A retail store location belonging to an organization."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    store_number = models.CharField(max_length=50, blank=True, default='')
    region = models.ForeignKey(
        Region,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='stores',
    )
    address = models.CharField(max_length=255, blank=True, default='')
    city = models.CharField(max_length=100, blank=True, default='')
    state = models.CharField(max_length=100, blank=True, default='')
    zip_code = models.CharField(max_length=20, blank=True, default='')
    is_active = models.BooleanField(default=True)
    latitude = models.DecimalField(
        max_digits=10, decimal_places=7, null=True, blank=True,
        help_text='Store latitude for geolocation verification.',
    )
    longitude = models.DecimalField(
        max_digits=10, decimal_places=7, null=True, blank=True,
        help_text='Store longitude for geolocation verification.',
    )
    phone = models.CharField(max_length=20, blank=True, default='')
    manager_name = models.CharField(max_length=100, blank=True, default='')
    manager_phone = models.CharField(max_length=20, blank=True, default='')
    manager_email = models.EmailField(blank=True, default='')

    # Department associations
    departments = models.ManyToManyField(
        'walks.Department',
        blank=True,
        related_name='stores',
        help_text='Departments available at this store.',
    )

    # QR code location verification
    qr_verification_token = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        help_text='Token encoded in the store QR code for walk verification.',
    )

    class VerificationMethod(models.TextChoices):
        GPS_ONLY = 'gps_only', 'GPS Only'
        QR_ONLY = 'qr_only', 'QR Code Only'
        GPS_AND_QR = 'gps_and_qr', 'GPS + QR (Both Required)'
        EITHER = 'either', 'GPS or QR (Either)'

    verification_method = models.CharField(
        max_length=20,
        choices=VerificationMethod.choices,
        default=VerificationMethod.GPS_ONLY,
        help_text='How location should be verified when starting a walk at this store.',
    )

    class Meta:
        db_table = 'stores_store'
        ordering = ['name']

    def __str__(self):
        if self.store_number:
            return f'{self.name} (#{self.store_number})'
        return self.name


class OrgSettings(TimestampedModel):
    """Organization-level settings configured by franchise owner/admin."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.OneToOneField(
        'accounts.Organization',
        on_delete=models.CASCADE,
        related_name='settings',
    )
    # Subscription tier (cached from billing for quick lookups)
    subscription_tier = models.CharField(
        max_length=20,
        default='free',
        help_text='Cached subscription tier slug: free, starter, pro, enterprise.',
    )

    # Premium features
    ai_photo_analysis = models.BooleanField(
        default=False,
        help_text='Enable AI-powered photo analysis for walk evaluations (premium feature).',
    )

    # Benchmarking
    allow_benchmarking = models.BooleanField(
        default=False,
        help_text='Allow store managers to see anonymized performance rankings.',
    )
    benchmarking_period_days = models.PositiveIntegerField(
        default=90,
        help_text='Number of days to look back for benchmarking data.',
    )

    class Meta:
        db_table = 'stores_orgsettings'

    def __str__(self):
        return f'Settings for {self.organization.name}'


class Goal(OrgScopedModel):
    """A performance goal set by franchise owner/admin."""

    class GoalType(models.TextChoices):
        SCORE_TARGET = 'score_target', 'Score Target'
        WALK_FREQUENCY = 'walk_frequency', 'Walk Frequency'

    class Scope(models.TextChoices):
        ORGANIZATION = 'organization', 'Organization-wide'
        REGION = 'region', 'Region'
        STORE = 'store', 'Store'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, help_text='Goal name (e.g. "Minimum Score Target")')
    goal_type = models.CharField(max_length=20, choices=GoalType.choices)
    scope = models.CharField(max_length=20, choices=Scope.choices, default=Scope.ORGANIZATION)
    region = models.ForeignKey(
        Region,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='goals',
        help_text='Target region (when scope is region).',
    )
    store = models.ForeignKey(
        Store,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='goals',
        help_text='Target store (when scope is store).',
    )
    target_value = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        help_text='Target value (percentage for score_target, walks/month for walk_frequency).',
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'stores_goal'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.name} ({self.goal_type})'
