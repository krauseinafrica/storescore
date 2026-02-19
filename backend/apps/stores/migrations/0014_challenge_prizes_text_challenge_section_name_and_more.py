from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('stores', '0013_orgsettings_deadline_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='challenge',
            name='prizes_text',
            field=models.TextField(blank=True, default='', help_text='Description of prizes or rewards for challenge winners.'),
        ),
        migrations.AddField(
            model_name='challenge',
            name='section_name',
            field=models.CharField(blank=True, default='', help_text='If set, only scores from this template section are used for standings.', max_length=255),
        ),
        migrations.AddField(
            model_name='orgsettings',
            name='gamification_visible_roles',
            field=models.JSONField(blank=True, default=list, help_text='Roles that can see gamification features. Empty list means all roles.'),
        ),
    ]
