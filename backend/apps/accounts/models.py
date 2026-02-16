import uuid

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models

from apps.core.models import TimestampedModel

from .managers import CustomUserManager


class User(AbstractBaseUser, PermissionsMixin):
    """Custom user model with email-based authentication."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
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

    class Meta:
        db_table = 'accounts_organization'

    def __str__(self):
        return self.name


class Membership(TimestampedModel):
    """Represents a user's membership in an organization with a specific role."""

    class Role(models.TextChoices):
        OWNER = 'owner', 'Owner'
        ADMIN = 'admin', 'Admin'
        MANAGER = 'manager', 'Manager'
        MEMBER = 'member', 'Member'

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
