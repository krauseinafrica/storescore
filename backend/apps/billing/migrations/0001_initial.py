import django.db.models.deletion
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('accounts', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Plan',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=50)),
                ('slug', models.SlugField(unique=True)),
                ('stripe_price_id_monthly', models.CharField(blank=True, default='', max_length=100)),
                ('stripe_price_id_annual', models.CharField(blank=True, default='', max_length=100)),
                ('price_per_store_monthly', models.DecimalField(decimal_places=2, max_digits=8)),
                ('price_per_store_annual', models.DecimalField(decimal_places=2, max_digits=8)),
                ('max_users', models.IntegerField(blank=True, help_text='Maximum users allowed. Null = unlimited.', null=True)),
                ('max_templates', models.IntegerField(blank=True, help_text='Maximum scoring templates. Null = unlimited.', null=True)),
                ('max_walks_per_store', models.IntegerField(blank=True, help_text='Maximum walks per store per month. Null = unlimited.', null=True)),
                ('max_stores', models.IntegerField(blank=True, help_text='Maximum stores. Null = unlimited.', null=True)),
                ('features', models.JSONField(default=dict, help_text='Feature flags, e.g. {"ai_summaries": true, "csv_export": true}')),
                ('is_active', models.BooleanField(default=True)),
                ('display_order', models.IntegerField(default=0)),
            ],
            options={
                'db_table': 'billing_plan',
                'ordering': ['display_order'],
            },
        ),
        migrations.CreateModel(
            name='Subscription',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('stripe_customer_id', models.CharField(blank=True, default='', max_length=100)),
                ('stripe_subscription_id', models.CharField(blank=True, default='', max_length=100)),
                ('billing_interval', models.CharField(choices=[('monthly', 'Monthly'), ('annual', 'Annual')], default='monthly', max_length=10)),
                ('store_count', models.IntegerField(default=1, help_text='Billable store count.')),
                ('status', models.CharField(choices=[('trialing', 'Trialing'), ('active', 'Active'), ('past_due', 'Past Due'), ('canceled', 'Canceled'), ('free', 'Free')], default='free', max_length=20)),
                ('trial_start', models.DateTimeField(blank=True, null=True)),
                ('trial_end', models.DateTimeField(blank=True, null=True)),
                ('current_period_start', models.DateTimeField(blank=True, null=True)),
                ('current_period_end', models.DateTimeField(blank=True, null=True)),
                ('cancel_at_period_end', models.BooleanField(default=False)),
                ('discount_percent', models.IntegerField(default=0, help_text='Volume discount percentage applied (0, 10, 20, or 30).')),
                ('organization', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='subscription', to='accounts.organization')),
                ('plan', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='subscriptions', to='billing.plan')),
            ],
            options={
                'db_table': 'billing_subscription',
            },
        ),
        migrations.CreateModel(
            name='Invoice',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('stripe_invoice_id', models.CharField(max_length=100, unique=True)),
                ('amount', models.DecimalField(decimal_places=2, max_digits=10)),
                ('status', models.CharField(default='open', max_length=20)),
                ('invoice_url', models.URLField(blank=True, default='')),
                ('invoice_pdf', models.URLField(blank=True, default='')),
                ('period_start', models.DateTimeField()),
                ('period_end', models.DateTimeField()),
                ('subscription', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='invoices', to='billing.subscription')),
            ],
            options={
                'db_table': 'billing_invoice',
                'ordering': ['-period_start'],
            },
        ),
    ]
