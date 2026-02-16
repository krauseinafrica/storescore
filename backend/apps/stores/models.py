import uuid

from django.db import models

from apps.core.models import OrgScopedModel

# Import integration models so Django discovers them
from apps.stores.integrations import IntegrationConfig, StoreDataPoint  # noqa: F401


class Region(OrgScopedModel):
    """A geographic or logical grouping of stores within an organization."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)

    class Meta:
        db_table = 'stores_region'
        ordering = ['name']

    def __str__(self):
        return self.name


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

    class Meta:
        db_table = 'stores_store'
        ordering = ['name']

    def __str__(self):
        if self.store_number:
            return f'{self.name} (#{self.store_number})'
        return self.name
