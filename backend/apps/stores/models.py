import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone

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

    # Gamification
    gamification_enabled = models.BooleanField(
        default=False,
        help_text='Enable leaderboards, challenges, and achievements.',
    )
    gamification_visible_roles = models.JSONField(
        default=list,
        blank=True,
        help_text='Roles that can see gamification features. Empty list means all roles.',
    )

    # Action item default deadlines (in business days)
    action_item_deadline_critical = models.PositiveIntegerField(
        default=1,
        help_text='Default deadline in days for critical priority action items.',
    )
    action_item_deadline_high = models.PositiveIntegerField(
        default=3,
        help_text='Default deadline in days for high priority action items.',
    )
    action_item_deadline_medium = models.PositiveIntegerField(
        default=7,
        help_text='Default deadline in days for medium priority action items.',
    )
    action_item_deadline_low = models.PositiveIntegerField(
        default=14,
        help_text='Default deadline in days for low priority action items.',
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


# ==================== Phase 8: Gamification ====================


class Challenge(OrgScopedModel):
    """Admin-created time-bound competitions between stores."""

    class ChallengeType(models.TextChoices):
        SCORE_TARGET = 'score_target', 'Score Target'
        MOST_IMPROVED = 'most_improved', 'Most Improved'
        WALK_COUNT = 'walk_count', 'Walk Count'
        HIGHEST_SCORE = 'highest_score', 'Highest Score'

    class Scope(models.TextChoices):
        ORGANIZATION = 'organization', 'Organization-wide'
        REGION = 'region', 'Region'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    challenge_type = models.CharField(max_length=20, choices=ChallengeType.choices)
    scope = models.CharField(max_length=20, choices=Scope.choices, default=Scope.ORGANIZATION)
    region = models.ForeignKey(
        Region,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='challenges',
        help_text='Target region (when scope is region).',
    )
    target_value = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True,
        help_text='Target value (e.g. 85.0 for score_target).',
    )
    start_date = models.DateField()
    end_date = models.DateField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='created_challenges',
    )
    is_active = models.BooleanField(default=True)
    prizes_text = models.TextField(
        blank=True,
        default='',
        help_text='Description of prizes or rewards for challenge winners.',
    )
    section_name = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text='If set, only scores from this template section are used for standings.',
    )

    class Meta:
        db_table = 'stores_challenge'
        ordering = ['-start_date']

    def __str__(self):
        return self.name

    @property
    def is_ongoing(self):
        today = timezone.now().date()
        return self.start_date <= today <= self.end_date

    @property
    def days_remaining(self):
        today = timezone.now().date()
        if today > self.end_date:
            return 0
        return (self.end_date - today).days


class Achievement(TimestampedModel):
    """Platform-level badge definitions (not org-scoped)."""

    class Tier(models.TextChoices):
        BRONZE = 'bronze', 'Bronze'
        SILVER = 'silver', 'Silver'
        GOLD = 'gold', 'Gold'
        PLATINUM = 'platinum', 'Platinum'

    class CriteriaType(models.TextChoices):
        PERFECT_SCORE = 'perfect_score', 'Perfect Score'
        SCORE_ABOVE_90 = 'score_above_90', 'Score Above 90%'
        WALK_STREAK = 'walk_streak', 'Walk Streak'
        SCORE_STREAK = 'score_streak', 'Score Streak'
        WALK_COUNT = 'walk_count', 'Walk Count'
        IMPROVEMENT = 'improvement', 'Improvement'
        ACTION_SPEED = 'action_speed', 'Action Speed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    icon_name = models.CharField(max_length=50, default='star')
    tier = models.CharField(max_length=10, choices=Tier.choices, default=Tier.BRONZE)
    criteria_type = models.CharField(max_length=20, choices=CriteriaType.choices)
    criteria_value = models.DecimalField(
        max_digits=8, decimal_places=2,
        help_text='Threshold value for criteria evaluation.',
    )
    plan_tier = models.CharField(
        max_length=20,
        choices=[('basic', 'Basic'), ('advanced', 'Advanced')],
        default='basic',
        help_text='Which subscription tier unlocks this achievement.',
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'stores_achievement'
        ordering = ['tier', 'name']

    def __str__(self):
        return f'{self.name} ({self.get_tier_display()})'


class AwardedAchievement(OrgScopedModel):
    """Tracks earned badges for stores/users within an organization."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    achievement = models.ForeignKey(
        Achievement,
        on_delete=models.CASCADE,
        related_name='awards',
    )
    store = models.ForeignKey(
        Store,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='awarded_achievements',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='awarded_achievements',
    )
    walk = models.ForeignKey(
        'walks.Walk',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='awarded_achievements',
        help_text='The walk that triggered this achievement.',
    )
    awarded_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'stores_awardedachievement'
        ordering = ['-awarded_at']
        constraints = [
            models.UniqueConstraint(
                fields=['achievement', 'organization', 'store'],
                name='unique_achievement_per_org_store',
            ),
        ]

    def __str__(self):
        target = self.store.name if self.store else (self.user.email if self.user else 'Unknown')
        return f'{self.achievement.name} -> {target}'
