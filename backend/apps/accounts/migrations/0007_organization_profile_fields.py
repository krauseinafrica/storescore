from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0006_organization_is_active_lead'),
    ]

    operations = [
        migrations.AddField(
            model_name='organization',
            name='industry',
            field=models.CharField(
                blank=True,
                choices=[
                    ('hardware', 'Hardware / Home Improvement'),
                    ('grocery', 'Grocery'),
                    ('convenience', 'Convenience Store'),
                    ('restaurant', 'Restaurant / QSR'),
                    ('retail', 'General Retail'),
                    ('pharmacy', 'Pharmacy'),
                    ('automotive', 'Automotive'),
                    ('fitness', 'Fitness / Gym'),
                    ('hospitality', 'Hospitality / Hotel'),
                    ('other', 'Other'),
                ],
                default='retail',
                max_length=30,
            ),
        ),
        migrations.AddField(
            model_name='organization',
            name='address',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='organization',
            name='city',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        migrations.AddField(
            model_name='organization',
            name='state',
            field=models.CharField(blank=True, default='', max_length=50),
        ),
        migrations.AddField(
            model_name='organization',
            name='zip_code',
            field=models.CharField(blank=True, default='', max_length=20),
        ),
        migrations.AddField(
            model_name='organization',
            name='phone',
            field=models.CharField(blank=True, default='', max_length=30),
        ),
    ]
