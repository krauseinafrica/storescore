# Generated manually - gamification models (tables already exist, apply with --fake)
import django.db.models.deletion
import django.utils.timezone
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0007_organization_profile_fields'),
        ('stores', '0010_store_departments'),
        ('walks', '0015_departmenttype_scoringtemplate_source_template_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Achievement',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=255)),
                ('description', models.TextField(blank=True, default='')),
                ('icon_name', models.CharField(default='star', max_length=50)),
                ('tier', models.CharField(choices=[('bronze', 'Bronze'), ('silver', 'Silver'), ('gold', 'Gold'), ('platinum', 'Platinum')], default='bronze', max_length=10)),
                ('criteria_type', models.CharField(choices=[('perfect_score', 'Perfect Score'), ('score_above_90', 'Score Above 90%'), ('walk_streak', 'Walk Streak'), ('score_streak', 'Score Streak'), ('walk_count', 'Walk Count'), ('improvement', 'Improvement'), ('action_speed', 'Action Speed')], max_length=20)),
                ('criteria_value', models.DecimalField(decimal_places=2, help_text='Threshold value for criteria evaluation.', max_digits=8)),
                ('is_active', models.BooleanField(default=True)),
            ],
            options={
                'db_table': 'stores_achievement',
                'ordering': ['tier', 'name'],
            },
        ),
        migrations.AddField(
            model_name='orgsettings',
            name='gamification_enabled',
            field=models.BooleanField(default=False, help_text='Enable leaderboards, challenges, and achievements.'),
        ),
        migrations.CreateModel(
            name='Challenge',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=255)),
                ('description', models.TextField(blank=True, default='')),
                ('challenge_type', models.CharField(choices=[('score_target', 'Score Target'), ('most_improved', 'Most Improved'), ('walk_count', 'Walk Count'), ('highest_score', 'Highest Score')], max_length=20)),
                ('scope', models.CharField(choices=[('organization', 'Organization-wide'), ('region', 'Region')], default='organization', max_length=20)),
                ('target_value', models.DecimalField(blank=True, decimal_places=2, help_text='Target value (e.g. 85.0 for score_target).', max_digits=8, null=True)),
                ('start_date', models.DateField()),
                ('end_date', models.DateField()),
                ('is_active', models.BooleanField(default=True)),
                ('created_by', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='created_challenges', to=settings.AUTH_USER_MODEL)),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='%(app_label)s_%(class)ss', to='accounts.organization')),
                ('region', models.ForeignKey(blank=True, help_text='Target region (when scope is region).', null=True, on_delete=django.db.models.deletion.CASCADE, related_name='challenges', to='stores.region')),
            ],
            options={
                'db_table': 'stores_challenge',
                'ordering': ['-start_date'],
            },
        ),
        migrations.CreateModel(
            name='AwardedAchievement',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('awarded_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('achievement', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='awards', to='stores.achievement')),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='%(app_label)s_%(class)ss', to='accounts.organization')),
                ('store', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='awarded_achievements', to='stores.store')),
                ('user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='awarded_achievements', to=settings.AUTH_USER_MODEL)),
                ('walk', models.ForeignKey(blank=True, help_text='The walk that triggered this achievement.', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='awarded_achievements', to='walks.walk')),
            ],
            options={
                'db_table': 'stores_awardedachievement',
                'ordering': ['-awarded_at'],
                'constraints': [models.UniqueConstraint(fields=('achievement', 'organization', 'store'), name='unique_achievement_per_org_store')],
            },
        ),
    ]
