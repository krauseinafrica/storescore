from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('walks', '0012_walk_qr_scanned_at_walk_qr_verified'),
    ]

    operations = [
        migrations.AddField(
            model_name='score',
            name='drivers',
            field=models.ManyToManyField(
                blank=True,
                help_text='Root cause drivers selected when score is 3 or below.',
                related_name='scores',
                to='walks.driver',
            ),
        ),
        migrations.AlterField(
            model_name='score',
            name='driver',
            field=models.ForeignKey(
                blank=True,
                help_text='Deprecated: use drivers M2M instead.',
                null=True,
                on_delete=models.SET_NULL,
                related_name='scores_legacy',
                to='walks.driver',
            ),
        ),
    ]
