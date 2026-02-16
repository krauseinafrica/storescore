"""
Integration models for connecting stores to external data sources
(Eagle POS, Mango Report, CSV imports, manual entry).
"""

import uuid

from django.db import models

from apps.core.models import OrgScopedModel, TimestampedModel


class IntegrationConfig(OrgScopedModel):
    """Per-organization integration connection settings."""

    class IntegrationType(models.TextChoices):
        MANUAL = 'manual', 'Manual Entry'
        CSV = 'csv', 'CSV Import'
        API = 'api', 'API Connection'
        WEBHOOK = 'webhook', 'Webhook Receiver'

    class Provider(models.TextChoices):
        EAGLE = 'eagle', 'Eagle POS (Epicor)'
        MANGO = 'mango', 'Mango Report'
        ACENET = 'acenet', 'Acenet'
        CUSTOM = 'custom', 'Custom'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    integration_type = models.CharField(
        max_length=20,
        choices=IntegrationType.choices,
        default=IntegrationType.MANUAL,
    )
    provider = models.CharField(
        max_length=20,
        choices=Provider.choices,
        default=Provider.CUSTOM,
    )
    config = models.JSONField(
        default=dict,
        blank=True,
        help_text='Connection config: API keys, endpoints, schedules, column mappings.',
    )
    is_active = models.BooleanField(default=True)
    last_sync_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'stores_integrationconfig'
        ordering = ['name']

    def __str__(self):
        return f'{self.name} ({self.get_provider_display()})'


class StoreDataPoint(OrgScopedModel):
    """
    Flexible time-series data storage for any store metric.
    Supports manual entry, CSV imports, and API-sourced data.
    """

    class Source(models.TextChoices):
        MANUAL = 'manual', 'Manual Entry'
        CSV_IMPORT = 'csv_import', 'CSV Import'
        EAGLE_API = 'eagle_api', 'Eagle API'
        MANGO_IMPORT = 'mango_import', 'Mango Import'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    store = models.ForeignKey(
        'stores.Store',
        on_delete=models.CASCADE,
        related_name='data_points',
    )
    metric = models.CharField(
        max_length=100,
        db_index=True,
        help_text='Metric key: weekly_sales, transaction_count, oos_percentage, etc.',
    )
    value = models.DecimalField(max_digits=14, decimal_places=2)
    date = models.DateField(db_index=True)
    source = models.CharField(
        max_length=20,
        choices=Source.choices,
        default=Source.MANUAL,
    )
    integration = models.ForeignKey(
        IntegrationConfig,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='data_points',
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text='Raw data, import batch ID, notes, etc.',
    )

    class Meta:
        db_table = 'stores_storedatapoint'
        ordering = ['-date']
        indexes = [
            models.Index(fields=['store', 'metric', 'date']),
        ]

    def __str__(self):
        return f'{self.store.name} — {self.metric}: {self.value} ({self.date})'
