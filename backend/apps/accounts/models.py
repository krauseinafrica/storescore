import uuid

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models

from apps.core.models import TimestampedModel
from apps.core.storage import user_avatar_path

from .managers import CustomUserManager

# Import Lead and DripEmail models so Django discovers them
from .leads import DripEmail, Lead  # noqa: F401


class User(AbstractBaseUser, PermissionsMixin):
    """Custom user model with email-based authentication."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    avatar = models.ImageField(upload_to=user_avatar_path, blank=True, default='')
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name']

    objects = CustomUserManager()

    class Meta:
        db_table = 'accounts_user'

    def __str__(self):
        return self.email

    @property
    def full_name(self):
        return f'{self.first_name} {self.last_name}'.strip()


class Organization(TimestampedModel):
    """An organization that groups users and data."""

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
        OTHER = 'other', 'Other'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True, max_length=255)
    owner = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='owned_organizations',
    )
    logo = models.ImageField(
        upload_to='apps.core.storage.org_file_path',
        blank=True,
        default='',
    )
    industry = models.CharField(
        max_length=30,
        choices=Industry.choices,
        default=Industry.RETAIL,
        blank=True,
    )
    address = models.CharField(max_length=255, blank=True, default='')
    city = models.CharField(max_length=100, blank=True, default='')
    state = models.CharField(max_length=50, blank=True, default='')
    zip_code = models.CharField(max_length=20, blank=True, default='')
    phone = models.CharField(max_length=30, blank=True, default='')
    is_active = models.BooleanField(
        default=True,
        help_text='Inactive organizations are disabled and cannot be accessed.',
    )

    class Meta:
        db_table = 'accounts_organization'

    def __str__(self):
        return self.name


class Membership(TimestampedModel):
    """Represents a user's membership in an organization with a specific role."""

    class Role(models.TextChoices):
        OWNER = 'owner', 'Owner'
        ADMIN = 'admin', 'Admin'
        REGIONAL_MANAGER = 'regional_manager', 'Regional Manager'
        STORE_MANAGER = 'store_manager', 'Store Manager'
        MANAGER = 'manager', 'Manager'
        FINANCE = 'finance', 'Finance'
        MEMBER = 'member', 'Member'
        EVALUATOR = 'evaluator', 'Evaluator'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='memberships',
    )
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='memberships',
    )
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.MEMBER,
    )

    class Meta:
        db_table = 'accounts_membership'
        unique_together = ('user', 'organization')

    def __str__(self):
        return f'{self.user.email} - {self.organization.name} ({self.role})'


class RegionAssignment(TimestampedModel):
    """Links a user to specific regions they can access."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    membership = models.ForeignKey(
        Membership,
        on_delete=models.CASCADE,
        related_name='region_assignments',
    )
    region = models.ForeignKey(
        'stores.Region',
        on_delete=models.CASCADE,
        related_name='user_assignments',
    )

    class Meta:
        db_table = 'accounts_regionassignment'
        unique_together = ('membership', 'region')

    def __str__(self):
        return f'{self.membership.user.email} → {self.region.name}'


class StoreAssignment(TimestampedModel):
    """Links a user to specific stores they can access."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    membership = models.ForeignKey(
        Membership,
        on_delete=models.CASCADE,
        related_name='store_assignments',
    )
    store = models.ForeignKey(
        'stores.Store',
        on_delete=models.CASCADE,
        related_name='user_assignments',
    )

    class Meta:
        db_table = 'accounts_storeassignment'
        unique_together = ('membership', 'store')

    def __str__(self):
        return f'{self.membership.user.email} → {self.store.name}'


class SupportTicket(TimestampedModel):
    """A support ticket submitted by an organization member."""

    class Status(models.TextChoices):
        OPEN = 'open', 'Open'
        IN_PROGRESS = 'in_progress', 'In Progress'
        RESOLVED = 'resolved', 'Resolved'
        CLOSED = 'closed', 'Closed'

    class Priority(models.TextChoices):
        LOW = 'low', 'Low'
        MEDIUM = 'medium', 'Medium'
        HIGH = 'high', 'High'

    class Category(models.TextChoices):
        BUG = 'bug', 'Bug'
        UI_FEEDBACK = 'ui_feedback', 'UI Feedback'
        ENHANCEMENT = 'enhancement', 'Enhancement Request'
        QUESTION = 'question', 'Question'
        OTHER = 'other', 'Other'

    class Source(models.TextChoices):
        MANUAL = 'manual', 'Manual'
        SENTRY = 'sentry', 'Sentry'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='support_tickets',
        null=True,
        blank=True,
    )
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name='support_tickets',
        null=True,
        blank=True,
    )
    source = models.CharField(
        max_length=20,
        choices=Source.choices,
        default=Source.MANUAL,
    )
    external_id = models.CharField(max_length=100, blank=True, default='')
    subject = models.CharField(max_length=255)
    description = models.TextField()
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.OPEN,
    )
    priority = models.CharField(
        max_length=20,
        choices=Priority.choices,
        default=Priority.MEDIUM,
    )
    category = models.CharField(
        max_length=20,
        choices=Category.choices,
        default=Category.OTHER,
    )
    resolution_notes = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'accounts_supportticket'
        ordering = ['-created_at']

    def __str__(self):
        return f'[{self.status}] {self.subject}'


class TicketMessage(models.Model):
    """A message in a support ticket thread."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket = models.ForeignKey(
        SupportTicket,
        on_delete=models.CASCADE,
        related_name='messages',
    )
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ticket_messages',
    )
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'accounts_ticketmessage'
        ordering = ['created_at']

    def __str__(self):
        sender = self.user.email if self.user else 'System'
        return f'{sender}: {self.message[:50]}'
