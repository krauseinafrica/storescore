import uuid

from django.conf import settings
from django.db import models

from apps.core.models import OrgScopedModel, TimestampedModel


class ScoringTemplate(OrgScopedModel):
    """A scoring template that defines the criteria for store walks."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'walks_scoringtemplate'
        ordering = ['name']

    def __str__(self):
        return self.name


class Section(TimestampedModel):
    """A section within a scoring template, grouping related criteria."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    template = models.ForeignKey(
        ScoringTemplate,
        on_delete=models.CASCADE,
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

    def __str__(self):
        return f'{self.template.name} - {self.name}'


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

    class Meta:
        db_table = 'walks_criterion'
        ordering = ['order']

    def __str__(self):
        return self.name


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
        related_name='walks',
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

    class Meta:
        db_table = 'walks_walk'
        ordering = ['-scheduled_date']

    def __str__(self):
        return f'{self.store.name} - {self.scheduled_date}'

    def calculate_total_score(self):
        """Calculate the total weighted score for this walk."""
        scores = self.scores.select_related('criterion__section').all()
        if not scores.exists():
            return None

        sections = self.template.sections.prefetch_related('criteria').all()
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
    score = models.ForeignKey(
        Score,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='photos',
        help_text='The specific score/criterion this photo is evidence for.',
    )
    image = models.ImageField(upload_to='apps.core.storage.walk_evidence_path')
    caption = models.CharField(max_length=255, blank=True, default='')

    class Meta:
        db_table = 'walks_walkphoto'
        ordering = ['created_at']

    def __str__(self):
        return f'Photo for {self.walk} - {self.caption or self.id}'
