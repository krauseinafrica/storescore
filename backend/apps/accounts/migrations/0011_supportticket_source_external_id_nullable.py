import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0010_supportticket_category_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='supportticket',
            name='source',
            field=models.CharField(
                choices=[('manual', 'Manual'), ('sentry', 'Sentry')],
                default='manual',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='supportticket',
            name='external_id',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        migrations.AlterField(
            model_name='supportticket',
            name='organization',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='support_tickets',
                to='accounts.organization',
            ),
        ),
        migrations.AlterField(
            model_name='supportticket',
            name='user',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='support_tickets',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
