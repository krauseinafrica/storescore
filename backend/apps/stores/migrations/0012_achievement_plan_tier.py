from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('stores', '0011_gamification_models'),
    ]

    operations = [
        migrations.AddField(
            model_name='achievement',
            name='plan_tier',
            field=models.CharField(
                choices=[('basic', 'Basic'), ('advanced', 'Advanced')],
                default='basic',
                help_text='Which subscription tier unlocks this achievement.',
                max_length=20,
            ),
        ),
    ]
