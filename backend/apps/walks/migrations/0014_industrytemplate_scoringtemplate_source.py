import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('walks', '0013_score_drivers_alter_score_driver'),
    ]

    operations = [
        migrations.CreateModel(
            name='IndustryTemplate',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=255)),
                ('description', models.TextField(blank=True, default='')),
                ('industry', models.CharField(
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
                )),
                ('version', models.PositiveIntegerField(default=1)),
                ('is_active', models.BooleanField(default=True)),
                ('is_featured', models.BooleanField(default=False, help_text='Show prominently in the library.')),
                ('install_count', models.PositiveIntegerField(default=0, help_text='Number of orgs that have installed this template.')),
                ('structure', models.JSONField(default=dict, help_text='Full template definition: sections → criteria → drivers.')),
                ('created_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='created_industry_templates',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'db_table': 'walks_industrytemplate',
                'ordering': ['-is_featured', 'industry', 'name'],
            },
        ),
        migrations.AddField(
            model_name='scoringtemplate',
            name='source_industry_template',
            field=models.ForeignKey(
                blank=True,
                help_text='The library template this was cloned from, if any.',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='installed_templates',
                to='walks.industrytemplate',
            ),
        ),
    ]
