from rest_framework import serializers

from apps.accounts.serializers import UserSerializer

from .models import (
    ActionItem,
    ActionItemPhoto,
    ActionItemResponse,
    AssessmentPrompt,
    AssessmentSubmission,
    CalendarToken,
    CorrectiveAction,
    Criterion,
    Department,
    DepartmentType,
    Driver,
    EvaluationSchedule,
    IndustryTemplate,
    Score,
    ScoringTemplate,
    Section,
    SelfAssessment,
    SelfAssessmentTemplate,
    SOPCriterionLink,
    SOPDocument,
    Walk,
    WalkPhoto,
    WalkSectionNote,
)


class DriverSerializer(serializers.ModelSerializer):
    criterion_name = serializers.CharField(source='criterion.name', read_only=True)

    class Meta:
        model = Driver
        fields = ['id', 'criterion', 'criterion_name', 'name', 'order', 'is_active']
        read_only_fields = ['id', 'criterion_name']


class SOPCriterionLinkBriefSerializer(serializers.ModelSerializer):
    """Lightweight SOP link for embedding in criteria."""
    sop_title = serializers.CharField(source='sop_document.title', read_only=True)

    class Meta:
        model = SOPCriterionLink
        fields = ['id', 'sop_document', 'sop_title', 'relevant_excerpt', 'is_confirmed']
        read_only_fields = fields


class CriterionSerializer(serializers.ModelSerializer):
    drivers = DriverSerializer(many=True, read_only=True)
    sop_links = serializers.SerializerMethodField()

    class Meta:
        model = Criterion
        fields = ['id', 'name', 'description', 'order', 'max_points', 'sop_text', 'sop_url', 'scoring_guidance', 'drivers', 'sop_links']
        read_only_fields = ['id']

    def get_sop_links(self, obj):
        confirmed_links = obj.sop_links.filter(is_confirmed=True)
        return SOPCriterionLinkBriefSerializer(confirmed_links, many=True).data


class SectionSerializer(serializers.ModelSerializer):
    criteria = CriterionSerializer(many=True, required=False)
    department_name = serializers.CharField(
        source='department.name', read_only=True, default=None,
    )

    class Meta:
        model = Section
        fields = ['id', 'name', 'order', 'weight', 'criteria', 'department', 'department_name']
        read_only_fields = ['id', 'department']


class ScoringTemplateListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing templates."""
    section_count = serializers.SerializerMethodField()
    source_template_name = serializers.CharField(
        source='source_template.name', read_only=True, default=None,
    )

    class Meta:
        model = ScoringTemplate
        fields = ['id', 'name', 'is_active', 'section_count', 'source_template', 'source_template_name', 'created_at', 'updated_at']
        read_only_fields = ['id', 'source_template', 'created_at', 'updated_at']

    def get_section_count(self, obj):
        return obj.sections.count()


class ScoringTemplateDetailSerializer(serializers.ModelSerializer):
    """Full serializer with nested sections and criteria."""
    sections = SectionSerializer(many=True, required=False)
    source_template_name = serializers.CharField(
        source='source_template.name', read_only=True, default=None,
    )

    class Meta:
        model = ScoringTemplate
        fields = ['id', 'name', 'is_active', 'sections', 'source_template', 'source_template_name', 'created_at', 'updated_at']
        read_only_fields = ['id', 'source_template', 'created_at', 'updated_at']

    def create(self, validated_data):
        sections_data = validated_data.pop('sections', [])
        template = ScoringTemplate.objects.create(**validated_data)

        for section_data in sections_data:
            criteria_data = section_data.pop('criteria', [])
            section = Section.objects.create(template=template, **section_data)

            for criterion_data in criteria_data:
                Criterion.objects.create(section=section, **criterion_data)

        return template

    def update(self, instance, validated_data):
        sections_data = validated_data.pop('sections', None)

        instance.name = validated_data.get('name', instance.name)
        instance.is_active = validated_data.get('is_active', instance.is_active)
        instance.save()

        if sections_data is not None:
            # Remove existing sections (cascade deletes criteria)
            instance.sections.all().delete()

            for section_data in sections_data:
                criteria_data = section_data.pop('criteria', [])
                section = Section.objects.create(template=instance, **section_data)

                for criterion_data in criteria_data:
                    Criterion.objects.create(section=section, **criterion_data)

        return instance


class ScoreSerializer(serializers.ModelSerializer):
    criterion_name = serializers.CharField(source='criterion.name', read_only=True)
    driver_name = serializers.CharField(source='driver.name', read_only=True, default=None)
    driver_ids = serializers.PrimaryKeyRelatedField(
        source='drivers', many=True, queryset=Driver.objects.all(),
        required=False,
    )
    driver_names = serializers.SerializerMethodField()

    class Meta:
        model = Score
        fields = ['id', 'criterion', 'criterion_name', 'points', 'notes', 'driver', 'driver_name', 'driver_ids', 'driver_names', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_driver_names(self, obj):
        return [d.name for d in obj.drivers.all()] if obj.pk else []

    def validate(self, attrs):
        criterion = attrs.get('criterion')
        points = attrs.get('points')
        if criterion and points is not None:
            if points > criterion.max_points:
                raise serializers.ValidationError({
                    'points': f'Points cannot exceed the maximum of {criterion.max_points}.'
                })
        return attrs

    def create(self, validated_data):
        drivers_data = validated_data.pop('drivers', [])
        score = super().create(validated_data)
        if drivers_data:
            score.drivers.set(drivers_data)
        return score

    def update(self, instance, validated_data):
        drivers_data = validated_data.pop('drivers', None)
        score = super().update(instance, validated_data)
        if drivers_data is not None:
            score.drivers.set(drivers_data)
        return score


class WalkPhotoSerializer(serializers.ModelSerializer):
    criterion_name = serializers.SerializerMethodField()

    class Meta:
        model = WalkPhoto
        fields = ['id', 'walk', 'section', 'criterion', 'criterion_name', 'score', 'image', 'caption', 'exif_date', 'image_hash', 'is_fresh', 'created_at', 'updated_at']
        read_only_fields = ['id', 'walk', 'exif_date', 'image_hash', 'is_fresh', 'created_at', 'updated_at']

    def get_criterion_name(self, obj):
        if obj.criterion:
            return obj.criterion.name
        return None


class WalkSectionNoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = WalkSectionNote
        fields = ['id', 'walk', 'section', 'notes', 'areas_needing_attention', 'created_at', 'updated_at']
        read_only_fields = ['id', 'walk', 'created_at', 'updated_at']


class WalkListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing walks."""
    store_name = serializers.CharField(source='store.name', read_only=True)
    template_name = serializers.SerializerMethodField()
    conducted_by_name = serializers.CharField(source='conducted_by.full_name', read_only=True)
    is_locked = serializers.BooleanField(read_only=True)
    lock_date = serializers.DateTimeField(read_only=True)
    manager_reviewed_by_name = serializers.SerializerMethodField()
    department_name = serializers.CharField(source='department.name', read_only=True, default=None)
    is_department_walk = serializers.BooleanField(read_only=True)

    class Meta:
        model = Walk
        fields = [
            'id', 'store', 'store_name', 'template', 'template_name',
            'department', 'department_name', 'is_department_walk',
            'conducted_by', 'conducted_by_name', 'scheduled_date',
            'completed_date', 'status', 'total_score',
            'is_locked', 'lock_date',
            'manager_review_status', 'manager_reviewed_by_name',
            'location_verified', 'location_distance_meters',
            'qr_verified',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'total_score', 'is_locked', 'lock_date', 'location_verified', 'location_distance_meters', 'qr_verified', 'created_at', 'updated_at']

    def get_template_name(self, obj):
        if obj.template:
            return obj.template.name
        return None

    def get_manager_reviewed_by_name(self, obj):
        if obj.manager_reviewed_by:
            return obj.manager_reviewed_by.full_name
        return None


class WalkDetailSerializer(serializers.ModelSerializer):
    """Full serializer with nested scores, photos, and section notes."""
    store_name = serializers.CharField(source='store.name', read_only=True)
    store_phone = serializers.CharField(source='store.phone', read_only=True)
    store_manager_name = serializers.CharField(source='store.manager_name', read_only=True)
    store_manager_phone = serializers.CharField(source='store.manager_phone', read_only=True)
    store_manager_email = serializers.CharField(source='store.manager_email', read_only=True)
    store_latitude = serializers.DecimalField(source='store.latitude', max_digits=10, decimal_places=7, read_only=True)
    store_longitude = serializers.DecimalField(source='store.longitude', max_digits=10, decimal_places=7, read_only=True)
    template_name = serializers.SerializerMethodField()
    conducted_by_detail = UserSerializer(source='conducted_by', read_only=True)
    scores = ScoreSerializer(many=True, required=False)
    photos = WalkPhotoSerializer(many=True, read_only=True)
    section_notes = WalkSectionNoteSerializer(many=True, read_only=True)
    is_locked = serializers.BooleanField(read_only=True)
    lock_date = serializers.DateTimeField(read_only=True)
    manager_reviewed_by_name = serializers.SerializerMethodField()
    department_name = serializers.CharField(source='department.name', read_only=True, default=None)
    is_department_walk = serializers.BooleanField(read_only=True)
    department_sections = serializers.SerializerMethodField()

    class Meta:
        model = Walk
        fields = [
            'id', 'store', 'store_name',
            'store_phone', 'store_manager_name', 'store_manager_phone', 'store_manager_email',
            'store_latitude', 'store_longitude',
            'template', 'template_name',
            'department', 'department_name', 'is_department_walk', 'department_sections',
            'conducted_by', 'conducted_by_detail', 'scheduled_date',
            'completed_date', 'status', 'notes', 'total_score',
            'scores', 'photos', 'section_notes', 'ai_summary',
            'is_locked', 'lock_date',
            'evaluator_signature', 'evaluator_signed_at',
            'manager_signature', 'manager_signed_at',
            'manager_reviewed_by', 'manager_reviewed_by_name',
            'manager_review_notes', 'manager_review_status',
            'start_latitude', 'start_longitude',
            'location_verified', 'location_distance_meters',
            'qr_verified', 'qr_scanned_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'total_score', 'is_locked', 'lock_date',
            'evaluator_signature', 'evaluator_signed_at',
            'manager_signature', 'manager_signed_at',
            'manager_reviewed_by', 'manager_reviewed_by_name',
            'manager_review_notes', 'manager_review_status',
            'location_verified', 'location_distance_meters',
            'qr_verified', 'qr_scanned_at',
            'created_at', 'updated_at',
        ]

    def get_template_name(self, obj):
        if obj.template:
            return obj.template.name
        return None

    def get_manager_reviewed_by_name(self, obj):
        if obj.manager_reviewed_by:
            return obj.manager_reviewed_by.full_name
        return None

    def get_department_sections(self, obj):
        """Return sections for department walks."""
        if not obj.department_id:
            return None
        sections = obj.department.sections.prefetch_related(
            'criteria__drivers', 'criteria__sop_links__sop_document',
        ).all()
        return SectionSerializer(sections, many=True).data

    def create(self, validated_data):
        scores_data = validated_data.pop('scores', [])
        walk = Walk.objects.create(**validated_data)

        for score_data in scores_data:
            Score.objects.create(walk=walk, **score_data)

        if scores_data:
            walk.total_score = walk.calculate_total_score()
            walk.save(update_fields=['total_score'])

        return walk

    def update(self, instance, validated_data):
        scores_data = validated_data.pop('scores', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if scores_data is not None:
            # Remove existing scores and recreate
            instance.scores.all().delete()
            for score_data in scores_data:
                Score.objects.create(walk=instance, **score_data)

            instance.total_score = instance.calculate_total_score()
            instance.save(update_fields=['total_score'])

        return instance

    def validate_store(self, value):
        """Ensure the store belongs to the same organization."""
        request = self.context.get('request')
        if value and request and hasattr(request, 'org') and request.org:
            if value.organization_id != request.org.id:
                raise serializers.ValidationError(
                    'Store does not belong to this organization.'
                )
        return value

    def validate_template(self, value):
        """Ensure the template belongs to the same organization."""
        if value is None:
            return value
        request = self.context.get('request')
        if value and request and hasattr(request, 'org') and request.org:
            if value.organization_id != request.org.id:
                raise serializers.ValidationError(
                    'Scoring template does not belong to this organization.'
                )
        return value


# ==================== Feature 1: EvaluationSchedule ====================


class EvaluationScheduleSerializer(serializers.ModelSerializer):
    template_name = serializers.CharField(source='template.name', read_only=True)
    assigned_evaluator_name = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)
    region_name = serializers.CharField(source='region.name', read_only=True, default=None)
    store_name = serializers.CharField(source='store.name', read_only=True, default=None)

    class Meta:
        model = EvaluationSchedule
        fields = [
            'id', 'name', 'template', 'template_name', 'frequency',
            'day_of_month', 'day_of_week', 'assigned_evaluator',
            'assigned_evaluator_name', 'scope', 'region', 'region_name',
            'store', 'store_name', 'created_by', 'created_by_name',
            'is_active', 'next_run_date', 'last_run_date',
            'reminder_days_before', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_by', 'last_run_date', 'created_at', 'updated_at']

    def get_assigned_evaluator_name(self, obj):
        if obj.assigned_evaluator:
            return obj.assigned_evaluator.full_name
        return None

    def validate(self, attrs):
        scope = attrs.get('scope', getattr(self.instance, 'scope', None))
        if scope == 'region' and not attrs.get('region', getattr(self.instance, 'region', None)):
            raise serializers.ValidationError({'region': 'Region is required when scope is "region".'})
        if scope == 'store' and not attrs.get('store', getattr(self.instance, 'store', None)):
            raise serializers.ValidationError({'store': 'Store is required when scope is "store".'})
        return attrs


class CalendarTokenSerializer(serializers.ModelSerializer):
    class Meta:
        model = CalendarToken
        fields = ['token', 'created_at']
        read_only_fields = fields


# ==================== Feature 2: Action Items ====================


class ActionItemPhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActionItemPhoto
        fields = ['id', 'image', 'ai_analysis', 'caption', 'created_at']
        read_only_fields = ['id', 'ai_analysis', 'created_at']


class ActionItemResponseSerializer(serializers.ModelSerializer):
    submitted_by_name = serializers.CharField(source='submitted_by.full_name', read_only=True)
    photos = ActionItemPhotoSerializer(many=True, read_only=True)

    class Meta:
        model = ActionItemResponse
        fields = [
            'id', 'action_item', 'submitted_by', 'submitted_by_name',
            'notes', 'photos', 'created_at',
        ]
        read_only_fields = ['id', 'submitted_by', 'created_at']


class ActionItemListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing action items."""
    criterion_name = serializers.CharField(source='criterion.name', read_only=True)
    store_name = serializers.CharField(source='walk.store.name', read_only=True)
    assigned_to_name = serializers.SerializerMethodField()
    walk_date = serializers.DateField(source='walk.scheduled_date', read_only=True)
    response_count = serializers.SerializerMethodField()

    class Meta:
        model = ActionItem
        fields = [
            'id', 'walk', 'criterion_name', 'store_name', 'status',
            'priority', 'assigned_to', 'assigned_to_name', 'walk_date',
            'due_date', 'response_count', 'created_at',
        ]
        read_only_fields = fields

    def get_assigned_to_name(self, obj):
        if obj.assigned_to:
            return obj.assigned_to.full_name
        return None

    def get_response_count(self, obj):
        return obj.responses.count()


class ActionItemDetailSerializer(serializers.ModelSerializer):
    """Full serializer with responses and photos."""
    criterion_name = serializers.CharField(source='criterion.name', read_only=True)
    criterion_description = serializers.CharField(source='criterion.description', read_only=True)
    criterion_max_points = serializers.IntegerField(source='criterion.max_points', read_only=True)
    score_points = serializers.IntegerField(source='score.points', read_only=True)
    store_name = serializers.CharField(source='walk.store.name', read_only=True)
    walk_date = serializers.DateField(source='walk.scheduled_date', read_only=True)
    assigned_to_name = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)
    original_photo_url = serializers.SerializerMethodField()
    responses = ActionItemResponseSerializer(many=True, read_only=True)

    class Meta:
        model = ActionItem
        fields = [
            'id', 'walk', 'criterion', 'criterion_name', 'criterion_description',
            'criterion_max_points', 'score', 'score_points', 'store_name',
            'walk_date', 'original_photo', 'original_photo_url',
            'assigned_to', 'assigned_to_name', 'created_by', 'created_by_name',
            'status', 'priority', 'description', 'due_date',
            'resolved_at', 'resolved_by', 'responses',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'walk', 'criterion', 'score', 'original_photo',
            'created_by', 'resolved_at', 'resolved_by',
            'created_at', 'updated_at',
        ]

    def get_assigned_to_name(self, obj):
        if obj.assigned_to:
            return obj.assigned_to.full_name
        return None

    def get_original_photo_url(self, obj):
        if obj.original_photo and obj.original_photo.image:
            return obj.original_photo.image.url
        return None


# ==================== Feature 3: Self-Assessments ====================


class AssessmentPromptSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssessmentPrompt
        fields = [
            'id', 'name', 'description', 'ai_evaluation_prompt',
            'order', 'rating_type',
        ]
        read_only_fields = ['id']


class SelfAssessmentTemplateListSerializer(serializers.ModelSerializer):
    prompt_count = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)

    class Meta:
        model = SelfAssessmentTemplate
        fields = [
            'id', 'name', 'description', 'created_by', 'created_by_name',
            'is_active', 'prompt_count', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def get_prompt_count(self, obj):
        return obj.prompts.count()


class SelfAssessmentTemplateDetailSerializer(serializers.ModelSerializer):
    prompts = AssessmentPromptSerializer(many=True, required=False)
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)

    class Meta:
        model = SelfAssessmentTemplate
        fields = [
            'id', 'name', 'description', 'created_by', 'created_by_name',
            'is_active', 'prompts', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def create(self, validated_data):
        prompts_data = validated_data.pop('prompts', [])
        template = SelfAssessmentTemplate.objects.create(**validated_data)
        for prompt_data in prompts_data:
            AssessmentPrompt.objects.create(
                template=template,
                organization=template.organization,
                **prompt_data,
            )
        return template

    def update(self, instance, validated_data):
        prompts_data = validated_data.pop('prompts', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if prompts_data is not None:
            instance.prompts.all().delete()
            for prompt_data in prompts_data:
                AssessmentPrompt.objects.create(
                    template=instance,
                    organization=instance.organization,
                    **prompt_data,
                )
        return instance


class AssessmentSubmissionSerializer(serializers.ModelSerializer):
    prompt_name = serializers.CharField(source='prompt.name', read_only=True)

    class Meta:
        model = AssessmentSubmission
        fields = [
            'id', 'assessment', 'prompt', 'prompt_name', 'image',
            'caption', 'self_rating', 'ai_analysis', 'ai_rating',
            'submitted_at',
        ]
        read_only_fields = ['id', 'ai_analysis', 'ai_rating', 'submitted_at']


class SelfAssessmentListSerializer(serializers.ModelSerializer):
    template_name = serializers.CharField(source='template.name', read_only=True)
    store_name = serializers.CharField(source='store.name', read_only=True)
    submitted_by_name = serializers.CharField(source='submitted_by.full_name', read_only=True)
    submission_count = serializers.SerializerMethodField()

    class Meta:
        model = SelfAssessment
        fields = [
            'id', 'template', 'template_name', 'store', 'store_name',
            'submitted_by', 'submitted_by_name', 'status', 'due_date',
            'submitted_at', 'reviewed_at', 'submission_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = fields

    def get_submission_count(self, obj):
        return obj.submissions.count()


class SelfAssessmentDetailSerializer(serializers.ModelSerializer):
    template_name = serializers.CharField(source='template.name', read_only=True)
    store_name = serializers.CharField(source='store.name', read_only=True)
    submitted_by_name = serializers.CharField(source='submitted_by.full_name', read_only=True)
    reviewed_by_name = serializers.SerializerMethodField()
    submissions = AssessmentSubmissionSerializer(many=True, read_only=True)
    prompts = serializers.SerializerMethodField()

    class Meta:
        model = SelfAssessment
        fields = [
            'id', 'template', 'template_name', 'store', 'store_name',
            'submitted_by', 'submitted_by_name', 'reviewed_by',
            'reviewed_by_name', 'status', 'due_date', 'submitted_at',
            'reviewed_at', 'reviewer_notes', 'submissions', 'prompts',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'template', 'store', 'submitted_by', 'submitted_at',
            'reviewed_at', 'created_at', 'updated_at',
        ]

    def get_reviewed_by_name(self, obj):
        if obj.reviewed_by:
            return obj.reviewed_by.full_name
        return None

    def get_prompts(self, obj):
        return AssessmentPromptSerializer(
            obj.template.prompts.all(), many=True
        ).data


# ==================== Feature 4: Corrective Action Escalation ====================


class CorrectiveActionListSerializer(serializers.ModelSerializer):
    store_name = serializers.CharField(source='store.name', read_only=True)
    responsible_user_name = serializers.SerializerMethodField()
    walk_date = serializers.DateField(source='walk.scheduled_date', read_only=True)

    class Meta:
        model = CorrectiveAction
        fields = [
            'id', 'action_type', 'escalation_level', 'status',
            'walk', 'store', 'store_name', 'walk_date',
            'responsible_user', 'responsible_user_name',
            'days_overdue', 'last_notified_at', 'resolved_at', 'notes',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'action_type', 'escalation_level', 'walk', 'store',
            'responsible_user', 'days_overdue', 'last_notified_at',
            'created_at', 'updated_at',
        ]

    def get_responsible_user_name(self, obj):
        if obj.responsible_user:
            return obj.responsible_user.full_name
        return None


# ==================== Feature 5: SOP Document Management ====================


class SOPCriterionLinkSerializer(serializers.ModelSerializer):
    criterion_name = serializers.CharField(source='criterion.name', read_only=True)
    sop_title = serializers.CharField(source='sop_document.title', read_only=True)

    class Meta:
        model = SOPCriterionLink
        fields = [
            'id', 'sop_document', 'sop_title', 'criterion', 'criterion_name',
            'is_ai_suggested', 'ai_confidence', 'ai_reasoning',
            'is_confirmed', 'relevant_excerpt',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'is_ai_suggested', 'ai_confidence', 'ai_reasoning', 'created_at', 'updated_at']


class SOPDocumentListSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source='uploaded_by.full_name', read_only=True)
    link_count = serializers.SerializerMethodField()

    class Meta:
        model = SOPDocument
        fields = [
            'id', 'title', 'description', 'file', 'file_type', 'file_size_bytes',
            'uploaded_by', 'uploaded_by_name', 'is_active', 'link_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'uploaded_by', 'file_type', 'file_size_bytes', 'created_at', 'updated_at']

    def get_link_count(self, obj):
        return obj.criterion_links.count()


class SOPDocumentDetailSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source='uploaded_by.full_name', read_only=True)
    criterion_links = SOPCriterionLinkSerializer(many=True, read_only=True)

    class Meta:
        model = SOPDocument
        fields = [
            'id', 'title', 'description', 'file', 'file_type', 'file_size_bytes',
            'extracted_text', 'uploaded_by', 'uploaded_by_name', 'is_active',
            'criterion_links', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'uploaded_by', 'file_type', 'file_size_bytes', 'extracted_text', 'created_at', 'updated_at']


# ==================== Departments ====================


class DepartmentTypeListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for browsing the department catalog."""
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    industry_display = serializers.CharField(source='get_industry_display', read_only=True)
    section_count = serializers.SerializerMethodField()

    class Meta:
        model = DepartmentType
        fields = [
            'id', 'name', 'description', 'icon_name',
            'category', 'category_display', 'industry', 'industry_display',
            'is_active', 'install_count', 'section_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = fields

    def get_section_count(self, obj):
        structure = obj.default_structure or {}
        return len(structure.get('sections', []))


class DepartmentTypeDetailSerializer(serializers.ModelSerializer):
    """Full serializer including the default_structure JSON."""
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    industry_display = serializers.CharField(source='get_industry_display', read_only=True)

    class Meta:
        model = DepartmentType
        fields = [
            'id', 'name', 'description', 'icon_name',
            'category', 'category_display', 'industry', 'industry_display',
            'default_structure', 'is_active', 'install_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'install_count', 'created_at', 'updated_at']


class DepartmentListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing org departments."""
    section_count = serializers.SerializerMethodField()
    store_count = serializers.SerializerMethodField()
    department_type_name = serializers.CharField(
        source='department_type.name', read_only=True, default=None,
    )

    class Meta:
        model = Department
        fields = [
            'id', 'name', 'description', 'is_active',
            'department_type', 'department_type_name',
            'section_count', 'store_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_section_count(self, obj):
        return obj.sections.count()

    def get_store_count(self, obj):
        return obj.stores.count()


class DepartmentDetailSerializer(serializers.ModelSerializer):
    """Full serializer with nested sections/criteria for department CRUD."""
    sections = SectionSerializer(many=True, required=False)
    department_type_name = serializers.CharField(
        source='department_type.name', read_only=True, default=None,
    )
    store_count = serializers.SerializerMethodField()

    class Meta:
        model = Department
        fields = [
            'id', 'name', 'description', 'is_active',
            'department_type', 'department_type_name',
            'sections', 'store_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_store_count(self, obj):
        return obj.stores.count()

    def create(self, validated_data):
        sections_data = validated_data.pop('sections', [])
        department = Department.objects.create(**validated_data)

        for section_data in sections_data:
            criteria_data = section_data.pop('criteria', [])
            section = Section.objects.create(department=department, **section_data)
            for criterion_data in criteria_data:
                Criterion.objects.create(section=section, **criterion_data)

        return department

    def update(self, instance, validated_data):
        sections_data = validated_data.pop('sections', None)

        instance.name = validated_data.get('name', instance.name)
        instance.description = validated_data.get('description', instance.description)
        instance.is_active = validated_data.get('is_active', instance.is_active)
        instance.save()

        if sections_data is not None:
            instance.sections.all().delete()
            for section_data in sections_data:
                criteria_data = section_data.pop('criteria', [])
                section = Section.objects.create(department=instance, **section_data)
                for criterion_data in criteria_data:
                    Criterion.objects.create(section=section, **criterion_data)

        return instance


# ==================== Industry Template Library ====================


class IndustryTemplateListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for browsing the template library."""
    created_by_name = serializers.SerializerMethodField()
    industry_display = serializers.CharField(source='get_industry_display', read_only=True)
    section_count = serializers.SerializerMethodField()
    criterion_count = serializers.SerializerMethodField()

    class Meta:
        model = IndustryTemplate
        fields = [
            'id', 'name', 'description', 'industry', 'industry_display',
            'version', 'is_active', 'is_featured', 'install_count',
            'section_count', 'criterion_count',
            'created_by', 'created_by_name',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'install_count', 'created_at', 'updated_at']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.full_name
        return None

    def get_section_count(self, obj):
        structure = obj.structure or {}
        return len(structure.get('sections', []))

    def get_criterion_count(self, obj):
        structure = obj.structure or {}
        return sum(
            len(s.get('criteria', []))
            for s in structure.get('sections', [])
        )


class IndustryTemplateDetailSerializer(serializers.ModelSerializer):
    """Full serializer including the nested structure JSON."""
    created_by_name = serializers.SerializerMethodField()
    industry_display = serializers.CharField(source='get_industry_display', read_only=True)

    class Meta:
        model = IndustryTemplate
        fields = [
            'id', 'name', 'description', 'industry', 'industry_display',
            'version', 'is_active', 'is_featured', 'install_count',
            'structure',
            'created_by', 'created_by_name',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'install_count', 'created_at', 'updated_at']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.full_name
        return None
