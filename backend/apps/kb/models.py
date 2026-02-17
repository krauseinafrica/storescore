import uuid

from django.db import models

from apps.core.models import TimestampedModel


class KnowledgeArticle(TimestampedModel):
    """A knowledge base article containing help/documentation content."""

    class Category(models.TextChoices):
        GETTING_STARTED = 'getting_started', 'Getting Started'
        STORE_MANAGEMENT = 'store_management', 'Store Management'
        EVALUATIONS = 'evaluations', 'Evaluations'
        ACTION_TRACKING = 'action_tracking', 'Action Tracking'
        AI_FEATURES = 'ai_features', 'AI Features'
        REPORTS = 'reports', 'Reports'
        SCHEDULING = 'scheduling', 'Scheduling'
        TEAM = 'team', 'Team'
        SETTINGS = 'settings', 'Settings'
        BILLING = 'billing', 'Billing'

    class FeatureTier(models.TextChoices):
        STARTER = 'starter', 'Starter'
        PRO = 'pro', 'Pro'
        ENTERPRISE = 'enterprise', 'Enterprise'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200, unique=True)
    summary = models.TextField(help_text='1-2 sentence description for search results.')
    category = models.CharField(max_length=30, choices=Category.choices)
    feature_tier = models.CharField(
        max_length=20,
        choices=FeatureTier.choices,
        default=FeatureTier.STARTER,
    )
    app_route = models.CharField(max_length=100, blank=True, default='')
    icon_name = models.CharField(max_length=50, blank=True, default='')
    order = models.IntegerField(default=0)
    is_published = models.BooleanField(default=True)

    class Meta:
        db_table = 'kb_article'
        ordering = ['category', 'order']

    def __str__(self):
        return self.title


class KnowledgeSection(TimestampedModel):
    """A section within a knowledge base article."""

    class FeatureTier(models.TextChoices):
        STARTER = 'starter', 'Starter'
        PRO = 'pro', 'Pro'
        ENTERPRISE = 'enterprise', 'Enterprise'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    article = models.ForeignKey(
        KnowledgeArticle,
        on_delete=models.CASCADE,
        related_name='sections',
    )
    anchor = models.SlugField(max_length=100)
    title = models.CharField(max_length=200)
    content = models.TextField(help_text='HTML content for this section.')
    feature_tier = models.CharField(
        max_length=20,
        choices=FeatureTier.choices,
        default=FeatureTier.STARTER,
    )
    order = models.IntegerField(default=0)

    class Meta:
        db_table = 'kb_section'
        ordering = ['order']
        unique_together = [('article', 'anchor')]

    def __str__(self):
        return f"{self.article.title} - {self.title}"


class OnboardingLesson(TimestampedModel):
    """An ordered lesson in the getting-started course, optionally linked to a KB section."""

    class FeatureTier(models.TextChoices):
        STARTER = 'starter', 'Starter'
        PRO = 'pro', 'Pro'
        ENTERPRISE = 'enterprise', 'Enterprise'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    section = models.ForeignKey(
        KnowledgeSection,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='onboarding_lessons',
    )
    title = models.CharField(max_length=200)
    summary = models.CharField(max_length=300, blank=True, default='')
    content = models.TextField(blank=True, default='')
    app_route = models.CharField(max_length=100, blank=True, default='')
    action_label = models.CharField(max_length=100, blank=True, default='')
    roles = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text='Comma-separated roles this applies to. Empty = all roles.',
    )
    feature_tier = models.CharField(
        max_length=20,
        choices=FeatureTier.choices,
        default=FeatureTier.STARTER,
    )
    order = models.IntegerField(default=0)
    is_published = models.BooleanField(default=True)

    class Meta:
        db_table = 'kb_onboarding_lesson'
        ordering = ['order']

    def __str__(self):
        return self.title


class UserLessonProgress(TimestampedModel):
    """Tracks per-user completion of onboarding lessons."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='lesson_progress',
    )
    lesson = models.ForeignKey(
        OnboardingLesson,
        on_delete=models.CASCADE,
        related_name='user_progress',
    )
    completed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'kb_user_lesson_progress'
        unique_together = [('user', 'lesson')]

    def __str__(self):
        return f"{self.user} - {self.lesson.title}"
