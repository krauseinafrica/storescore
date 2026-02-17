from django.db import migrations


def seed_plans(apps, schema_editor):
    Plan = apps.get_model('billing', 'Plan')

    Plan.objects.create(
        name='Starter',
        slug='starter',
        stripe_price_id_monthly='price_1T1UMuDvmPHMOH6QBl9myNxd',
        stripe_price_id_annual='price_1T1UNqDvmPHMOH6QuvaGDKPY',
        price_per_store_monthly=29.00,
        price_per_store_annual=24.00,
        max_users=5,
        max_templates=1,
        max_walks_per_store=10,
        max_stores=None,
        features={
            'core_walks': True,
            'walk_history': True,
            'basic_analytics': True,
            'email_notifications': True,
            'csv_export': False,
            'ai_summaries': False,
            'evaluation_schedules': False,
            'action_items': False,
            'self_assessments': False,
            'email_digests': False,
            'calendar_feeds': False,
            'goals': False,
            'advanced_analytics': False,
            'multiple_templates': False,
            'ai_photo_analysis': False,
            'benchmarking': False,
            'data_integrations': False,
            'external_evaluators': False,
            'api_access': False,
        },
        is_active=True,
        display_order=1,
    )

    Plan.objects.create(
        name='Pro',
        slug='pro',
        stripe_price_id_monthly='price_1T1UPmDvmPHMOH6QDJIYKFVg',
        stripe_price_id_annual='price_1T1UQtDvmPHMOH6Q0bsfjVsF',
        price_per_store_monthly=49.00,
        price_per_store_annual=41.00,
        max_users=25,
        max_templates=None,
        max_walks_per_store=None,
        max_stores=None,
        features={
            'core_walks': True,
            'walk_history': True,
            'basic_analytics': True,
            'email_notifications': True,
            'csv_export': True,
            'ai_summaries': True,
            'evaluation_schedules': True,
            'action_items': True,
            'self_assessments': True,
            'email_digests': True,
            'calendar_feeds': True,
            'goals': True,
            'advanced_analytics': True,
            'multiple_templates': True,
            'ai_photo_analysis': False,
            'benchmarking': False,
            'data_integrations': False,
            'external_evaluators': False,
            'api_access': False,
        },
        is_active=True,
        display_order=2,
    )

    Plan.objects.create(
        name='Enterprise',
        slug='enterprise',
        stripe_price_id_monthly='price_1T1URmDvmPHMOH6QjG8Ec79J',
        stripe_price_id_annual='price_1T1US1DvmPHMOH6QifWxOzY6',
        price_per_store_monthly=79.00,
        price_per_store_annual=66.00,
        max_users=None,
        max_templates=None,
        max_walks_per_store=None,
        max_stores=None,
        features={
            'core_walks': True,
            'walk_history': True,
            'basic_analytics': True,
            'email_notifications': True,
            'csv_export': True,
            'ai_summaries': True,
            'evaluation_schedules': True,
            'action_items': True,
            'self_assessments': True,
            'email_digests': True,
            'calendar_feeds': True,
            'goals': True,
            'advanced_analytics': True,
            'multiple_templates': True,
            'ai_photo_analysis': True,
            'benchmarking': True,
            'data_integrations': True,
            'external_evaluators': True,
            'api_access': True,
        },
        is_active=True,
        display_order=3,
    )


def reverse_seed(apps, schema_editor):
    Plan = apps.get_model('billing', 'Plan')
    Plan.objects.filter(slug__in=['starter', 'pro', 'enterprise']).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('billing', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed_plans, reverse_seed),
    ]
