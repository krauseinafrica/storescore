import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('walks', '0007_alter_walkphoto_image'),
    ]

    operations = [
        migrations.AddField(
            model_name='walkphoto',
            name='criterion',
            field=models.ForeignKey(
                blank=True,
                help_text='The specific criterion this photo is evidence for.',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='photos',
                to='walks.criterion',
            ),
        ),
    ]
