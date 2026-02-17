import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0003_add_roles_and_assignments'),
        ('stores', '0002_integrationconfig_storedatapoint'),
    ]

    operations = [
        migrations.CreateModel(
            name='OrgSettings',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('allow_benchmarking', models.BooleanField(default=False, help_text='Allow store managers to see anonymized performance rankings.')),
                ('benchmarking_period_days', models.PositiveIntegerField(default=90, help_text='Number of days to look back for benchmarking data.')),
                ('organization', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='settings', to='accounts.organization')),
            ],
            options={
                'db_table': 'stores_orgsettings',
            },
        ),
        migrations.CreateModel(
            name='Goal',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(help_text='Goal name (e.g. "Minimum Score Target")', max_length=255)),
                ('goal_type', models.CharField(choices=[('score_target', 'Score Target'), ('walk_frequency', 'Walk Frequency')], max_length=20)),
                ('scope', models.CharField(choices=[('organization', 'Organization-wide'), ('region', 'Region'), ('store', 'Store')], default='organization', max_length=20)),
                ('target_value', models.DecimalField(decimal_places=2, help_text='Target value (percentage for score_target, walks/month for walk_frequency).', max_digits=8)),
                ('is_active', models.BooleanField(default=True)),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='stores_goals', to='accounts.organization')),
                ('region', models.ForeignKey(blank=True, help_text='Target region (when scope is region).', null=True, on_delete=django.db.models.deletion.CASCADE, related_name='goals', to='stores.region')),
                ('store', models.ForeignKey(blank=True, help_text='Target store (when scope is store).', null=True, on_delete=django.db.models.deletion.CASCADE, related_name='goals', to='stores.store')),
            ],
            options={
                'db_table': 'stores_goal',
                'ordering': ['-created_at'],
            },
        ),
    ]
