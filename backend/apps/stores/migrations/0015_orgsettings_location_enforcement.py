from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('stores', '0014_challenge_prizes_text_challenge_section_name_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='orgsettings',
            name='location_enforcement',
            field=models.CharField(
                choices=[('advisory', 'Advisory (warn only)'), ('strict', 'Strict (block if too far)')],
                default='advisory',
                help_text='Whether GPS verification is advisory (warn) or strict (block walk creation).',
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name='orgsettings',
            name='verification_radius_meters',
            field=models.PositiveIntegerField(
                default=500,
                help_text='Maximum allowed distance in meters from store for GPS verification (50-5000).',
            ),
        ),
    ]
