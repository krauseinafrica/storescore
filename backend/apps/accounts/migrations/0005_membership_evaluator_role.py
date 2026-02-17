from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0004_add_user_avatar'),
    ]

    operations = [
        migrations.AlterField(
            model_name='membership',
            name='role',
            field=models.CharField(
                choices=[
                    ('owner', 'Owner'),
                    ('admin', 'Admin'),
                    ('regional_manager', 'Regional Manager'),
                    ('store_manager', 'Store Manager'),
                    ('manager', 'Manager'),
                    ('finance', 'Finance'),
                    ('member', 'Member'),
                    ('evaluator', 'Evaluator'),
                ],
                default='member',
                max_length=20,
            ),
        ),
    ]
