import uuid

from django.db import models


class TimestampedModel(models.Model):
    """Abstract base model with created_at and updated_at timestamps."""
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class OrgScopedModel(TimestampedModel):
    """Abstract base model scoped to an organization."""
    organization = models.ForeignKey(
        'accounts.Organization',
        on_delete=models.CASCADE,
        related_name='%(app_label)s_%(class)ss',
    )

    class Meta:
        abstract = True
