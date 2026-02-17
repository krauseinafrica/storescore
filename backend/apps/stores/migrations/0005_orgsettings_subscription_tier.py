from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('stores', '0004_orgsettings_ai_photo_analysis'),
    ]

    operations = [
        migrations.AddField(
            model_name='orgsettings',
            name='subscription_tier',
            field=models.CharField(
                default='free',
                help_text='Cached subscription tier slug: free, starter, pro, enterprise.',
                max_length=20,
            ),
        ),
    ]
