from django.db import migrations, models

import apps.core.storage


class Migration(migrations.Migration):

    dependencies = [
        ('walks', '0006_reportschedule'),
    ]

    operations = [
        migrations.AlterField(
            model_name='walkphoto',
            name='image',
            field=models.ImageField(upload_to=apps.core.storage.walk_evidence_path),
        ),
    ]
