from django.db import migrations


def add_gamification_features(apps, schema_editor):
    Plan = apps.get_model('billing', 'Plan')

    # Starter: no gamification
    starter = Plan.objects.get(slug='starter')
    starter.features['gamification_basic'] = False
    starter.features['gamification_advanced'] = False
    starter.save(update_fields=['features'])

    # Pro: basic gamification (achievement badges)
    pro = Plan.objects.get(slug='pro')
    pro.features['gamification_basic'] = True
    pro.features['gamification_advanced'] = False
    pro.save(update_fields=['features'])

    # Enterprise: full gamification (leaderboards, challenges, all achievements)
    enterprise = Plan.objects.get(slug='enterprise')
    enterprise.features['gamification_basic'] = True
    enterprise.features['gamification_advanced'] = True
    enterprise.save(update_fields=['features'])


def reverse_gamification_features(apps, schema_editor):
    Plan = apps.get_model('billing', 'Plan')

    for slug in ('starter', 'pro', 'enterprise'):
        plan = Plan.objects.get(slug=slug)
        plan.features.pop('gamification_basic', None)
        plan.features.pop('gamification_advanced', None)
        plan.save(update_fields=['features'])


class Migration(migrations.Migration):

    dependencies = [
        ('billing', '0003_update_plan_features'),
    ]

    operations = [
        migrations.RunPython(add_gamification_features, reverse_gamification_features),
    ]
