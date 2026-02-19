import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('walks', '0024_aiusagelog'),
    ]

    operations = [
        # SelfAssessment: add assessment_type
        migrations.AddField(
            model_name='selfassessment',
            name='assessment_type',
            field=models.CharField(
                choices=[('self', 'Self-Assessment'), ('quick', 'Quick Assessment')],
                default='self',
                max_length=10,
            ),
        ),
        # SelfAssessment: add area
        migrations.AddField(
            model_name='selfassessment',
            name='area',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        # SelfAssessment: make template nullable
        migrations.AlterField(
            model_name='selfassessment',
            name='template',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='assessments',
                to='walks.selfassessmenttemplate',
            ),
        ),
        # SelfAssessment: make due_date nullable
        migrations.AlterField(
            model_name='selfassessment',
            name='due_date',
            field=models.DateField(blank=True, null=True),
        ),
        # AssessmentSubmission: make prompt nullable with SET_NULL
        migrations.AlterField(
            model_name='assessmentsubmission',
            name='prompt',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='submissions',
                to='walks.assessmentprompt',
            ),
        ),
    ]
