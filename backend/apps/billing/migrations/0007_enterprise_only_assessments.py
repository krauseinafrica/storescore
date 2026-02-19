from django.db import migrations


def set_pro_assessments_false(apps, schema_editor):
    Plan = apps.get_model('billing', 'Plan')
    for plan in Plan.objects.filter(slug='pro'):
        features = plan.features or {}
        features['self_assessments'] = False
        plan.features = features
        plan.save(update_fields=['features'])
    for plan in Plan.objects.filter(slug='enterprise'):
        features = plan.features or {}
        features['self_assessments'] = True
        plan.features = features
        plan.save(update_fields=['features'])


def set_pro_assessments_true(apps, schema_editor):
    Plan = apps.get_model('billing', 'Plan')
    for plan in Plan.objects.filter(slug='pro'):
        features = plan.features or {}
        features['self_assessments'] = True
        plan.features = features
        plan.save(update_fields=['features'])


class Migration(migrations.Migration):

    dependencies = [
        ('billing', '0006_subscription_promo_fields'),
    ]

    operations = [
        migrations.RunPython(set_pro_assessments_false, set_pro_assessments_true),
    ]
