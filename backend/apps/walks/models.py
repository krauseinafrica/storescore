import uuid
from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.crypto import get_random_string

from apps.core.models import OrgScopedModel, TimestampedModel
from apps.core.storage import action_item_photo_path, assessment_photo_path, criterion_reference_image_path, sop_document_path, walk_evidence_path

WALK_LOCK_DAYS = 14


class IndustryTemplate(TimestampedModel):
    """Platform-level template library entry, not org-scoped.

    Platform admins create these. Organizations can clone them into their own
    ScoringTemplate instances.  The full template structure is stored as JSON
    so that it is decoupled from the org-scoped Section/Criterion models.
    """

    class Industry(models.TextChoices):
        HARDWARE = 'hardware', 'Hardware / Home Improvement'
        GROCERY = 'grocery', 'Grocery'
        CONVENIENCE = 'convenience', 'Convenience Store'
        RESTAURANT = 'restaurant', 'Restaurant / QSR'
        RETAIL = 'retail', 'General Retail'
        PHARMACY = 'pharmacy', 'Pharmacy'
        AUTOMOTIVE = 'automotive', 'Automotive'
        FITNESS = 'fitness', 'Fitness / Gym'
        HOSPITALITY = 'hospitality', 'Hospitality / Hotel'
        DISCOUNT = 'discount', 'Discount / Variety'
        OTHER = 'other', 'Other'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    industry = models.CharField(
        max_length=30,
        choices=Industry.choices,
        default=Industry.RETAIL,
    )
    version = models.PositiveIntegerField(default=1)
    is_active = models.BooleanField(default=True)
    is_featured = models.BooleanField(
        default=False, help_text='Show prominently in the library.',
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='created_industry_templates',
    )
    install_count = models.PositiveIntegerField(
        default=0, help_text='Number of orgs that have installed this template.',
    )
    structure = models.JSONField(
        default=dict,
        help_text='Full template definition: sections → criteria → drivers.',
    )

    class Meta:
        db_table = 'walks_industrytemplate'
        ordering = ['-is_featured', 'industry', 'name']

    def __str__(self):
        return f'{self.name} ({self.get_industry_display()})'


class ScoringTemplate(OrgScopedModel):
    """A scoring template that defines the criteria for store walks."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)
    source_industry_template = models.ForeignKey(
        IndustryTemplate,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='installed_templates',
        help_text='The library template this was cloned from, if any.',
    )
    source_template = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='duplicates',
        help_text='The org template this was duplicated from, if any.',
    )

    class Meta:
        db_table = 'walks_scoringtemplate'
        ordering = ['name']

    def __str__(self):
        return self.name


class DepartmentType(TimestampedModel):
    """Platform-level department catalog. Orgs can install these to create
    department instances with pre-built evaluation sections/criteria."""

    class Category(models.TextChoices):
        STANDARD = 'standard', 'Standard'
        BRANDED = 'branded', 'Branded'
        SPECIALTY = 'specialty', 'Specialty'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    icon_name = models.CharField(
        max_length=50, blank=True, default='',
        help_text='Icon identifier for the frontend.',
    )
    category = models.CharField(
        max_length=20, choices=Category.choices, default=Category.STANDARD,
    )
    industry = models.CharField(
        max_length=30,
        choices=IndustryTemplate.Industry.choices,
        default=IndustryTemplate.Industry.HARDWARE,
    )
    default_structure = models.JSONField(
        default=dict,
        help_text='Default sections → criteria for this department type.',
    )
    is_active = models.BooleanField(default=True)
    install_count = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'walks_departmenttype'
        ordering = ['category', 'name']

    def __str__(self):
        return f'{self.name} ({self.get_category_display()})'


class Department(OrgScopedModel):
    """An org-scoped department instance with its own evaluation sections/criteria."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    department_type = models.ForeignKey(
        DepartmentType,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='installed_departments',
        help_text='The catalog entry this was installed from, if any.',
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'walks_department'
        ordering = ['name']

    def __str__(self):
        return self.name


class Section(TimestampedModel):
    """A section within a scoring template or department, grouping related criteria."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    template = models.ForeignKey(
        ScoringTemplate,
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='sections',
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='sections',
    )
    name = models.CharField(max_length=255)
    order = models.PositiveIntegerField(default=0)
    weight = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        help_text='Weight as a percentage (e.g. 25.00 for 25%)',
    )

    class Meta:
        db_table = 'walks_section'
        ordering = ['order']
        constraints = [
            models.CheckConstraint(
                check=(
                    models.Q(template__isnull=False, department__isnull=True)
                    | models.Q(template__isnull=True, department__isnull=False)
                ),
                name='section_template_or_department',
            ),
        ]

    def __str__(self):
        parent = self.template.name if self.template else self.department.name
        return f'{parent} - {self.name}'


class Criterion(TimestampedModel):
    """An individual scoring criterion within a section."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    section = models.ForeignKey(
        Section,
        on_delete=models.CASCADE,
        related_name='criteria',
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    order = models.PositiveIntegerField(default=0)
    max_points = models.PositiveIntegerField(default=10)
    sop_text = models.TextField(
        blank=True, default='',
        help_text='Rich text SOP guidance for this criterion.',
    )
    sop_url = models.URLField(
        blank=True, default='',
        help_text='Link to external SOP document.',
    )
    scoring_guidance = models.TextField(
        blank=True, default='',
        help_text='Specific guidance on what each score (1-5) means for this criterion.',
    )

    class Meta:
        db_table = 'walks_criterion'
        ordering = ['order']

    def __str__(self):
        return self.name


class CriterionReferenceImage(TimestampedModel):
    """An ideal reference image for a criterion, used by AI to score by comparison."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    criterion = models.ForeignKey(
        Criterion,
        on_delete=models.CASCADE,
        related_name='reference_images',
    )
    image = models.ImageField(upload_to=criterion_reference_image_path)
    description = models.TextField(
        blank=True, default='',
        help_text='What this image shows and what makes it ideal for this criterion.',
    )

    class Meta:
        db_table = 'walks_criterionreferenceimage'
        constraints = [
            models.UniqueConstraint(
                fields=['criterion'],
                name='one_reference_image_per_criterion',
            ),
        ]

    def __str__(self):
        return f'Reference image for {self.criterion.name}'


class Walk(OrgScopedModel):
    """A store walk (audit/inspection) conducted at a store."""

    class Status(models.TextChoices):
        SCHEDULED = 'scheduled', 'Scheduled'
        IN_PROGRESS = 'in_progress', 'In Progress'
        COMPLETED = 'completed', 'Completed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    store = models.ForeignKey(
        'stores.Store',
        on_delete=models.CASCADE,
        related_name='walks',
    )
    template = models.ForeignKey(
        ScoringTemplate,
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name='walks',
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name='walks',
        help_text='Set for department evaluations (one-off, AI-scored).',
    )
    conducted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='walks_conducted',
    )
    scheduled_date = models.DateField()
    started_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When the walk was actually started.',
    )
    completed_date = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.SCHEDULED,
    )
    notes = models.TextField(blank=True, default='')
    total_score = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Computed total score as a percentage.',
    )
    ai_summary = models.TextField(
        blank=True,
        default='',
        help_text='AI-generated summary of the walk results.',
    )

    # Signature fields
    evaluator_signature = models.ImageField(
        upload_to='signatures/',
        null=True,
        blank=True,
        help_text='Evaluator drawn signature image.',
    )
    evaluator_signed_at = models.DateTimeField(null=True, blank=True)
    manager_signature = models.ImageField(
        upload_to='signatures/',
        null=True,
        blank=True,
        help_text='Manager drawn signature image.',
    )
    manager_signed_at = models.DateTimeField(null=True, blank=True)
    manager_reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='reviewed_walks',
    )
    manager_review_notes = models.TextField(blank=True, default='')

    class ManagerReviewStatus(models.TextChoices):
        PENDING_REVIEW = 'pending_review', 'Pending Review'
        REVIEWED = 'reviewed', 'Reviewed'
        DISPUTED = 'disputed', 'Disputed'

    manager_review_status = models.CharField(
        max_length=20,
        choices=ManagerReviewStatus.choices,
        default=ManagerReviewStatus.PENDING_REVIEW,
    )

    # Geolocation verification
    start_latitude = models.DecimalField(
        max_digits=10, decimal_places=7, null=True, blank=True,
        help_text='GPS latitude when the walk was started.',
    )
    start_longitude = models.DecimalField(
        max_digits=10, decimal_places=7, null=True, blank=True,
        help_text='GPS longitude when the walk was started.',
    )
    location_verified = models.BooleanField(
        default=False,
        help_text='Whether the evaluator was verified to be at the store location.',
    )
    location_distance_meters = models.IntegerField(
        null=True, blank=True,
        help_text='Distance in meters from the store when the walk was started.',
    )

    # QR code verification
    qr_verified = models.BooleanField(
        default=False,
        help_text='Whether the walk was verified via QR code scan.',
    )
    qr_scanned_at = models.DateTimeField(
        null=True, blank=True,
        help_text='When the QR code was scanned.',
    )

    class Meta:
        db_table = 'walks_walk'
        ordering = ['-scheduled_date']
        constraints = [
            models.CheckConstraint(
                check=(
                    models.Q(template__isnull=False, department__isnull=True)
                    | models.Q(template__isnull=True, department__isnull=False)
                ),
                name='walk_template_or_department',
            ),
        ]

    def __str__(self):
        return f'{self.store.name} - {self.scheduled_date}'

    @property
    def is_department_walk(self):
        return self.department_id is not None

    @property
    def is_locked(self):
        """Walk is locked 14 days after completion."""
        if self.status != self.Status.COMPLETED or not self.completed_date:
            return False
        lock_date = self.completed_date + timedelta(days=WALK_LOCK_DAYS)
        return timezone.now() >= lock_date

    @property
    def lock_date(self):
        """When this walk will become locked."""
        if self.completed_date:
            return self.completed_date + timedelta(days=WALK_LOCK_DAYS)
        return None

    def calculate_total_score(self):
        """Calculate the total weighted score for this walk."""
        scores = self.scores.select_related('criterion__section').all()
        if not scores.exists():
            return None

        if self.template:
            sections = self.template.sections.prefetch_related('criteria').all()
        elif self.department:
            sections = self.department.sections.prefetch_related('criteria').all()
        else:
            return None

        total_weighted = 0
        total_weight = 0

        for section in sections:
            criteria = section.criteria.all()
            if not criteria.exists():
                continue

            max_possible = sum(c.max_points for c in criteria)
            if max_possible == 0:
                continue

            earned = sum(
                s.points for s in scores if s.criterion.section_id == section.id
            )
            section_percentage = (earned / max_possible) * 100
            total_weighted += section_percentage * float(section.weight)
            total_weight += float(section.weight)

        if total_weight == 0:
            return None

        return round(total_weighted / total_weight, 2)


class Score(TimestampedModel):
    """An individual score for a criterion within a walk."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    walk = models.ForeignKey(
        Walk,
        on_delete=models.CASCADE,
        related_name='scores',
    )
    criterion = models.ForeignKey(
        Criterion,
        on_delete=models.CASCADE,
        related_name='scores',
    )
    points = models.PositiveIntegerField()
    notes = models.TextField(blank=True, default='')
    driver = models.ForeignKey(
        'Driver',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='scores_legacy',
        help_text='Deprecated: use drivers M2M instead.',
    )
    drivers = models.ManyToManyField(
        'Driver',
        blank=True,
        related_name='scores',
        help_text='Root cause drivers selected when score is 3 or below.',
    )

    class Meta:
        db_table = 'walks_score'
        unique_together = ('walk', 'criterion')

    def __str__(self):
        return f'{self.criterion.name}: {self.points}'


class WalkSectionNote(TimestampedModel):
    """Section-level notes and areas needing attention for a walk."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    walk = models.ForeignKey(
        Walk,
        on_delete=models.CASCADE,
        related_name='section_notes',
    )
    section = models.ForeignKey(
        Section,
        on_delete=models.CASCADE,
        related_name='walk_notes',
    )
    notes = models.TextField(blank=True, default='')
    areas_needing_attention = models.TextField(
        blank=True,
        default='',
        help_text='Specific areas flagged for follow-up (e.g., Shelf Maintenance).',
    )

    class Meta:
        db_table = 'walks_walksectionnote'
        unique_together = ('walk', 'section')

    def __str__(self):
        return f'{self.walk} - {self.section.name} notes'


class ReportSchedule(TimestampedModel):
    """A user's subscription to periodic digest report emails."""

    class Frequency(models.TextChoices):
        WEEKLY = 'weekly', 'Weekly'
        MONTHLY = 'monthly', 'Monthly'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        'accounts.Organization',
        on_delete=models.CASCADE,
        related_name='report_schedules',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='report_schedules',
    )
    frequency = models.CharField(
        max_length=10,
        choices=Frequency.choices,
        default=Frequency.WEEKLY,
    )
    is_active = models.BooleanField(default=True)
    last_sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'walks_reportschedule'
        unique_together = ('organization', 'user', 'frequency')

    def __str__(self):
        return f'{self.user.email} - {self.frequency} report ({self.organization.name})'


class WalkPhoto(TimestampedModel):
    """A photo taken during a walk as evidence for a section or specific score."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    walk = models.ForeignKey(
        Walk,
        on_delete=models.CASCADE,
        related_name='photos',
    )
    section = models.ForeignKey(
        Section,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='photos',
        help_text='The section this photo belongs to.',
    )
    criterion = models.ForeignKey(
        Criterion,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='photos',
        help_text='The specific criterion this photo is evidence for.',
    )
    score = models.ForeignKey(
        Score,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='photos',
        help_text='The specific score/criterion this photo is evidence for.',
    )
    image = models.ImageField(upload_to=walk_evidence_path)
    caption = models.CharField(max_length=255, blank=True, default='')
    exif_date = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Date extracted from photo EXIF data.',
    )
    image_hash = models.CharField(
        max_length=64,
        blank=True,
        default='',
        help_text='SHA-256 hash of the image data for duplicate detection.',
    )
    is_fresh = models.BooleanField(
        default=True,
        help_text='Whether the photo passed freshness validation (EXIF date within 24h).',
    )

    class Meta:
        db_table = 'walks_walkphoto'
        ordering = ['created_at']

    def __str__(self):
        return f'Photo for {self.walk} - {self.caption or self.id}'


# ==================== Feature 1: Auto-Scheduled Evaluations ====================


class EvaluationSchedule(OrgScopedModel):
    """A recurring schedule for automatic walk creation with reminders."""

    class Frequency(models.TextChoices):
        WEEKLY = 'weekly', 'Weekly'
        BIWEEKLY = 'biweekly', 'Biweekly'
        MONTHLY = 'monthly', 'Monthly'
        QUARTERLY = 'quarterly', 'Quarterly'

    class Scope(models.TextChoices):
        ORGANIZATION = 'organization', 'Organization-wide'
        REGION = 'region', 'Region'
        STORE = 'store', 'Store'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, help_text='e.g. "Monthly Store Walks"')
    template = models.ForeignKey(
        ScoringTemplate,
        on_delete=models.PROTECT,
        related_name='evaluation_schedules',
    )
    frequency = models.CharField(max_length=10, choices=Frequency.choices)
    day_of_month = models.PositiveIntegerField(
        null=True, blank=True,
        help_text='Day of month for monthly/quarterly schedules (1-28).',
    )
    day_of_week = models.PositiveIntegerField(
        null=True, blank=True,
        help_text='Day of week for weekly/biweekly (0=Monday, 6=Sunday).',
    )
    assigned_evaluator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='assigned_schedules',
        help_text='If null, the store manager is assigned.',
    )
    scope = models.CharField(
        max_length=20, choices=Scope.choices, default=Scope.ORGANIZATION,
    )
    region = models.ForeignKey(
        'stores.Region',
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='evaluation_schedules',
    )
    store = models.ForeignKey(
        'stores.Store',
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='evaluation_schedules',
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='created_schedules',
    )
    is_active = models.BooleanField(default=True)
    next_run_date = models.DateField()
    last_run_date = models.DateField(null=True, blank=True)
    reminder_days_before = models.PositiveIntegerField(default=3)

    class Meta:
        db_table = 'walks_evaluationschedule'
        ordering = ['next_run_date']

    def __str__(self):
        return f'{self.name} ({self.frequency})'


def _generate_calendar_token():
    return get_random_string(length=48)


class CalendarToken(TimestampedModel):
    """Per-user token for subscribing to iCal calendar feeds."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='calendar_token',
    )
    token = models.CharField(
        max_length=48, unique=True, default=_generate_calendar_token,
    )

    class Meta:
        db_table = 'walks_calendartoken'

    def __str__(self):
        return f'Calendar token for {self.user.email}'


# ==================== Feature 2: Corrective Actions ====================


class ActionItem(OrgScopedModel):
    """A follow-up action generated from a low-scoring criterion."""

    class Status(models.TextChoices):
        OPEN = 'open', 'Open'
        IN_PROGRESS = 'in_progress', 'In Progress'
        RESOLVED = 'resolved', 'Resolved'
        PENDING_REVIEW = 'pending_review', 'Pending Review'
        APPROVED = 'approved', 'Approved'
        DISMISSED = 'dismissed', 'Dismissed'

    class Priority(models.TextChoices):
        LOW = 'low', 'Low'
        MEDIUM = 'medium', 'Medium'
        HIGH = 'high', 'High'
        CRITICAL = 'critical', 'Critical'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    walk = models.ForeignKey(
        Walk, on_delete=models.CASCADE, related_name='action_items',
        null=True, blank=True,
    )
    assessment = models.ForeignKey(
        'SelfAssessment', on_delete=models.SET_NULL, related_name='action_items',
        null=True, blank=True,
    )
    assessment_removed = models.BooleanField(
        default=False,
        help_text='Set to True when the linked assessment is deleted, to show indicator.',
    )
    criterion = models.ForeignKey(
        Criterion, on_delete=models.CASCADE, related_name='action_items',
        null=True, blank=True,
    )
    score = models.ForeignKey(
        Score, on_delete=models.CASCADE, related_name='action_items',
        null=True, blank=True,
    )
    store = models.ForeignKey(
        'stores.Store', on_delete=models.CASCADE, related_name='action_items',
        null=True, blank=True,
        help_text='Direct store reference for manual items (when no walk exists).',
    )
    original_photo = models.ForeignKey(
        WalkPhoto, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='action_items',
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='assigned_action_items',
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name='created_action_items',
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.OPEN,
    )
    priority = models.CharField(
        max_length=10, choices=Priority.choices, default=Priority.MEDIUM,
    )
    description = models.TextField(
        blank=True, default='',
        help_text='Auto-generated from criterion + score context.',
    )
    due_date = models.DateField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='resolved_action_items',
    )
    is_manual = models.BooleanField(default=False)
    # Review/sign-off fields
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='reviewed_action_items',
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_notes = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'walks_actionitem'
        ordering = ['-created_at']

    def __str__(self):
        name = self.criterion.name if self.criterion else (self.description[:50] or 'Manual item')
        return f'Action: {name} ({self.status})'


class ActionItemResponse(OrgScopedModel):
    """A follow-up response submitted for an action item."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    action_item = models.ForeignKey(
        ActionItem, on_delete=models.CASCADE, related_name='responses',
    )
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name='action_item_responses',
    )
    notes = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'walks_actionitemresponse'
        ordering = ['created_at']

    def __str__(self):
        return f'Response to {self.action_item} by {self.submitted_by}'


class ActionItemPhoto(OrgScopedModel):
    """Photo evidence attached to an action item response."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    response = models.ForeignKey(
        ActionItemResponse, on_delete=models.CASCADE, related_name='photos',
    )
    image = models.ImageField(upload_to=action_item_photo_path)
    ai_analysis = models.TextField(blank=True, default='')
    caption = models.CharField(max_length=255, blank=True, default='')

    class Meta:
        db_table = 'walks_actionitemphoto'
        ordering = ['created_at']

    def __str__(self):
        return f'Photo for {self.response}'


class ActionItemEvent(OrgScopedModel):
    """Tracks lifecycle events for action item timeline."""

    class EventType(models.TextChoices):
        CREATED = 'created', 'Created'
        ASSIGNED = 'assigned', 'Assigned'
        STATUS_CHANGED = 'status_changed', 'Status Changed'
        RESPONSE_ADDED = 'response_added', 'Response Added'
        PHOTO_UPLOADED = 'photo_uploaded', 'Photo Uploaded'
        AI_VERIFIED = 'ai_verified', 'AI Verified'
        SUBMITTED_FOR_REVIEW = 'submitted_for_review', 'Submitted for Review'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    action_item = models.ForeignKey(
        ActionItem, on_delete=models.CASCADE, related_name='events',
    )
    event_type = models.CharField(max_length=30, choices=EventType.choices)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True,
    )
    notes = models.TextField(blank=True, default='')
    old_status = models.CharField(max_length=20, blank=True, default='')
    new_status = models.CharField(max_length=20, blank=True, default='')
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'walks_actionitemevent'
        ordering = ['created_at']

    def __str__(self):
        return f'{self.event_type} on {self.action_item_id}'


# ==================== Feature 3: Manager Self-Assessments ====================


class SelfAssessmentTemplate(OrgScopedModel):
    """Template defining what photos/checks a manager must submit."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, help_text='e.g. "Monthly Photo Check"')
    description = models.TextField(blank=True, default='')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name='created_assessment_templates',
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'walks_selfassessmenttemplate'
        ordering = ['name']

    def __str__(self):
        return self.name


class AssessmentPrompt(OrgScopedModel):
    """An individual prompt/checkpoint within a self-assessment template."""

    class RatingType(models.TextChoices):
        NONE = 'none', 'Photo Only'
        THREE_SCALE = 'three_scale', 'Good / Fair / Poor'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    template = models.ForeignKey(
        SelfAssessmentTemplate, on_delete=models.CASCADE, related_name='prompts',
    )
    name = models.CharField(max_length=255, help_text='e.g. "Knives Table"')
    description = models.TextField(
        blank=True, default='',
        help_text='Instructions for what to photograph.',
    )
    ai_evaluation_prompt = models.TextField(
        blank=True, default='',
        help_text='What the AI should look for when analyzing the photo.',
    )
    order = models.PositiveIntegerField(default=0)
    rating_type = models.CharField(
        max_length=20, choices=RatingType.choices, default=RatingType.NONE,
    )

    class Meta:
        db_table = 'walks_assessmentprompt'
        ordering = ['order']

    def __str__(self):
        return f'{self.template.name} - {self.name}'


class SelfAssessment(OrgScopedModel):
    """A self-assessment instance assigned to a store manager."""

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        SUBMITTED = 'submitted', 'Submitted'
        REVIEWED = 'reviewed', 'Reviewed'

    class Type(models.TextChoices):
        SELF = 'self', 'Self-Assessment'
        QUICK = 'quick', 'Quick Assessment'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    assessment_type = models.CharField(
        max_length=10, choices=Type.choices, default=Type.SELF,
    )
    template = models.ForeignKey(
        SelfAssessmentTemplate, on_delete=models.PROTECT,
        related_name='assessments',
        null=True, blank=True,
    )
    store = models.ForeignKey(
        'stores.Store', on_delete=models.CASCADE, related_name='self_assessments',
    )
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name='submitted_assessments',
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='reviewed_assessments',
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING,
    )
    area = models.CharField(max_length=255, blank=True, default='')
    due_date = models.DateField(null=True, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewer_notes = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'walks_selfassessment'
        ordering = ['-due_date']

    def __str__(self):
        if self.template:
            return f'{self.template.name} - {self.store.name} ({self.status})'
        return f'Quick ({self.area or "general"}) - {self.store.name} ({self.status})'

    @property
    def is_quick(self):
        return self.assessment_type == self.Type.QUICK


class AssessmentSubmission(OrgScopedModel):
    """A single photo or video submission for one prompt within a self-assessment."""

    class Rating(models.TextChoices):
        GOOD = 'good', 'Good'
        FAIR = 'fair', 'Fair'
        POOR = 'poor', 'Poor'

    ALLOWED_VIDEO_TYPES = {'video/mp4', 'video/quicktime', 'video/x-m4v'}
    MAX_VIDEO_SIZE = 100 * 1024 * 1024  # 100 MB

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    assessment = models.ForeignKey(
        SelfAssessment, on_delete=models.CASCADE, related_name='submissions',
    )
    prompt = models.ForeignKey(
        AssessmentPrompt, on_delete=models.SET_NULL,
        related_name='submissions',
        null=True, blank=True,
    )
    image = models.FileField(upload_to=assessment_photo_path)
    is_video = models.BooleanField(default=False)
    caption = models.CharField(max_length=255, blank=True, default='')
    self_rating = models.CharField(
        max_length=10, choices=Rating.choices, blank=True, default='',
    )
    ai_analysis = models.TextField(blank=True, default='')
    ai_rating = models.CharField(
        max_length=10, choices=Rating.choices, blank=True, default='',
    )
    reviewer_rating = models.CharField(
        max_length=10, choices=Rating.choices, blank=True, default='',
        help_text='Optional override rating set by the reviewer.',
    )
    reviewer_notes = models.TextField(
        blank=True, default='',
        help_text='Optional commentary from the reviewer.',
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='reviewed_submissions',
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'walks_assessmentsubmission'
        ordering = ['submitted_at']

    def __str__(self):
        label = self.prompt.name if self.prompt else 'Quick photo'
        return f'{label} submission for {self.assessment}'


# ==================== Feature 4: Corrective Action Escalation ====================


class CorrectiveAction(OrgScopedModel):
    """Tracks escalation events for overdue evaluations and unacknowledged walks."""

    class ActionType(models.TextChoices):
        OVERDUE_EVALUATION = 'overdue_evaluation', 'Overdue Evaluation'
        UNACKNOWLEDGED_WALK = 'unacknowledged_walk', 'Unacknowledged Walk'
        MANUAL = 'manual', 'Manual'

    class EscalationLevel(models.TextChoices):
        REMINDER = 'reminder', 'Reminder'
        ESCALATED = 'escalated', 'Escalated'
        CRITICAL = 'critical', 'Critical'

    class Status(models.TextChoices):
        OPEN = 'open', 'Open'
        RESOLVED = 'resolved', 'Resolved'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    action_type = models.CharField(max_length=25, choices=ActionType.choices)
    escalation_level = models.CharField(
        max_length=10, choices=EscalationLevel.choices, default=EscalationLevel.REMINDER,
    )
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.OPEN,
    )
    walk = models.ForeignKey(
        Walk, on_delete=models.CASCADE, related_name='corrective_actions',
        null=True, blank=True,
    )
    store = models.ForeignKey(
        'stores.Store', on_delete=models.CASCADE, related_name='corrective_actions',
    )
    responsible_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='corrective_actions',
    )
    days_overdue = models.PositiveIntegerField(default=0)
    last_notified_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, default='')
    is_manual = models.BooleanField(default=False)

    class Meta:
        db_table = 'walks_correctiveaction'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.get_action_type_display()} - {self.store.name} ({self.escalation_level})'


# ==================== Feature 5: SOP Document Management ====================


class SOPDocument(OrgScopedModel):
    """An SOP document uploaded by the organization."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    file = models.FileField(upload_to=sop_document_path)
    file_type = models.CharField(
        max_length=10, blank=True, default='',
        help_text='File extension (pdf, docx, txt).',
    )
    file_size_bytes = models.PositiveIntegerField(default=0)
    extracted_text = models.TextField(
        blank=True, default='',
        help_text='Text extracted from the document for AI analysis.',
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name='uploaded_sop_documents',
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'walks_sopdocument'
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class SOPCriterionLink(TimestampedModel):
    """Links an SOP document to a criterion, optionally AI-suggested."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sop_document = models.ForeignKey(
        SOPDocument, on_delete=models.CASCADE, related_name='criterion_links',
    )
    criterion = models.ForeignKey(
        Criterion, on_delete=models.CASCADE, related_name='sop_links',
    )
    is_ai_suggested = models.BooleanField(default=False)
    ai_confidence = models.FloatField(
        null=True, blank=True,
        help_text='AI confidence score 0-1.',
    )
    ai_reasoning = models.TextField(blank=True, default='')
    is_confirmed = models.BooleanField(
        default=False,
        help_text='Admin must confirm AI suggestions before they appear to evaluators.',
    )
    relevant_excerpt = models.TextField(
        blank=True, default='',
        help_text='Relevant excerpt from the SOP document.',
    )

    class Meta:
        db_table = 'walks_sopcriterionlink'
        unique_together = ('sop_document', 'criterion')
        ordering = ['-ai_confidence']

    def __str__(self):
        return f'{self.sop_document.title} -> {self.criterion.name}'


# ==================== Feature 6: Scoring Drivers ====================


class Driver(OrgScopedModel):
    """A root cause driver that can be selected when scoring neutral or below."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    criterion = models.ForeignKey(
        Criterion, on_delete=models.CASCADE, related_name='drivers',
    )
    name = models.CharField(max_length=255, help_text='e.g. "Staff training needed"')
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'walks_driver'
        ordering = ['order']

    def __str__(self):
        return f'{self.criterion.name} - {self.name}'


# ==================== AI Usage Tracking ====================


class AIUsageLog(TimestampedModel):
    """Tracks token usage and estimated cost for AI API calls."""

    PROVIDER_CHOICES = [
        ('anthropic', 'Anthropic'),
        ('google', 'Google'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        'accounts.Organization',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='ai_usage_logs',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='ai_usage_logs',
    )
    provider = models.CharField(max_length=20, choices=PROVIDER_CHOICES)
    model_name = models.CharField(max_length=100)
    call_type = models.CharField(max_length=50)
    input_tokens = models.PositiveIntegerField(default=0)
    output_tokens = models.PositiveIntegerField(default=0)
    estimated_cost = models.DecimalField(max_digits=10, decimal_places=6)

    class Meta:
        db_table = 'walks_aiusagelog'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.provider}/{self.model_name} - {self.call_type} (${self.estimated_cost})'
