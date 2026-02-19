from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('billing', '0005_subscription_trial_source_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='subscription',
            name='promo_discount_name',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Admin-assigned promotional discount label, e.g. "Partner Rate".',
                max_length=100,
            ),
        ),
        migrations.AddField(
            model_name='subscription',
            name='promo_discount_percent',
            field=models.IntegerField(
                default=0,
                help_text='Promotional discount percentage (0-100). When > 0, overrides volume discount.',
            ),
        ),
    ]
