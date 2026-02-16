import uuid

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0002_organization_logo'),
        ('stores', '0002_integrationconfig_storedatapoint'),
    ]

    operations = [
        # Expand role choices on Membership
        migrations.AlterField(
            model_name='membership',
            name='role',
            field=models.CharField(
                choices=[
                    ('owner', 'Owner'),
                    ('admin', 'Admin'),
                    ('regional_manager', 'Regional Manager'),
                    ('store_manager', 'Store Manager'),
                    ('manager', 'Manager'),
                    ('finance', 'Finance'),
                    ('member', 'Member'),
                ],
                default='member',
                max_length=20,
            ),
        ),
        # RegionAssignment model
        migrations.CreateModel(
            name='RegionAssignment',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('membership', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='region_assignments',
                    to='accounts.membership',
                )),
                ('region', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='user_assignments',
                    to='stores.region',
                )),
            ],
            options={
                'db_table': 'accounts_regionassignment',
                'unique_together': {('membership', 'region')},
            },
        ),
        # StoreAssignment model
        migrations.CreateModel(
            name='StoreAssignment',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('membership', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='store_assignments',
                    to='accounts.membership',
                )),
                ('store', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='user_assignments',
                    to='stores.store',
                )),
            ],
            options={
                'db_table': 'accounts_storeassignment',
                'unique_together': {('membership', 'store')},
            },
        ),
    ]
