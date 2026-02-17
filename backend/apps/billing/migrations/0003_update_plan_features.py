from django.db import migrations


def update_features(apps, schema_editor):
    Plan = apps.get_model('billing', 'Plan')

    # Pro: add benchmarking (moved from Enterprise)
    pro = Plan.objects.get(slug='pro')
    pro.features['benchmarking'] = True
    pro.save(update_fields=['features'])

    # Enterprise: add scheduled_reports, custom_branding
    enterprise = Plan.objects.get(slug='enterprise')
    enterprise.features['scheduled_reports'] = True
    enterprise.features['custom_branding'] = True
    enterprise.save(update_fields=['features'])


def reverse_update(apps, schema_editor):
    Plan = apps.get_model('billing', 'Plan')

    pro = Plan.objects.get(slug='pro')
    pro.features['benchmarking'] = False
    pro.save(update_fields=['features'])

    enterprise = Plan.objects.get(slug='enterprise')
    enterprise.features.pop('scheduled_reports', None)
    enterprise.features.pop('custom_branding', None)
    enterprise.save(update_fields=['features'])


class Migration(migrations.Migration):

    dependencies = [
        ('billing', '0002_seed_plans'),
    ]

    operations = [
        migrations.RunPython(update_features, reverse_update),
    ]
