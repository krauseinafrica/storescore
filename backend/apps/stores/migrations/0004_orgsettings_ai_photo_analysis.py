from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('stores', '0003_orgsettings_goal'),
    ]

    operations = [
        migrations.AddField(
            model_name='orgsettings',
            name='ai_photo_analysis',
            field=models.BooleanField(
                default=False,
                help_text='Enable AI-powered photo analysis for walk evaluations (premium feature).',
            ),
        ),
    ]
