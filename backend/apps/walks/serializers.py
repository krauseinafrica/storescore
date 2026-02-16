from rest_framework import serializers

from apps.accounts.serializers import UserSerializer

from .models import Criterion, Score, ScoringTemplate, Section, Walk


class CriterionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Criterion
        fields = ['id', 'name', 'description', 'order', 'max_points']
        read_only_fields = ['id']


class SectionSerializer(serializers.ModelSerializer):
    criteria = CriterionSerializer(many=True, required=False)

    class Meta:
        model = Section
        fields = ['id', 'name', 'order', 'weight', 'criteria']
        read_only_fields = ['id']


class ScoringTemplateListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing templates."""
    section_count = serializers.SerializerMethodField()

    class Meta:
        model = ScoringTemplate
        fields = ['id', 'name', 'is_active', 'section_count', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_section_count(self, obj):
        return obj.sections.count()


class ScoringTemplateDetailSerializer(serializers.ModelSerializer):
    """Full serializer with nested sections and criteria."""
    sections = SectionSerializer(many=True, required=False)

    class Meta:
        model = ScoringTemplate
        fields = ['id', 'name', 'is_active', 'sections', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

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

    class Meta:
        model = Score
        fields = ['id', 'criterion', 'criterion_name', 'points', 'notes', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate(self, attrs):
        criterion = attrs.get('criterion')
        points = attrs.get('points')
        if criterion and points is not None:
            if points > criterion.max_points:
                raise serializers.ValidationError({
                    'points': f'Points cannot exceed the maximum of {criterion.max_points}.'
                })
        return attrs


class WalkListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing walks."""
    store_name = serializers.CharField(source='store.name', read_only=True)
    template_name = serializers.CharField(source='template.name', read_only=True)
    conducted_by_name = serializers.CharField(source='conducted_by.full_name', read_only=True)

    class Meta:
        model = Walk
        fields = [
            'id', 'store', 'store_name', 'template', 'template_name',
            'conducted_by', 'conducted_by_name', 'scheduled_date',
            'completed_date', 'status', 'total_score',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'total_score', 'created_at', 'updated_at']


class WalkDetailSerializer(serializers.ModelSerializer):
    """Full serializer with nested scores."""
    store_name = serializers.CharField(source='store.name', read_only=True)
    template_name = serializers.CharField(source='template.name', read_only=True)
    conducted_by_detail = UserSerializer(source='conducted_by', read_only=True)
    scores = ScoreSerializer(many=True, required=False)

    class Meta:
        model = Walk
        fields = [
            'id', 'store', 'store_name', 'template', 'template_name',
            'conducted_by', 'conducted_by_detail', 'scheduled_date',
            'completed_date', 'status', 'notes', 'total_score',
            'scores', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'total_score', 'created_at', 'updated_at']

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
        request = self.context.get('request')
        if value and request and hasattr(request, 'org') and request.org:
            if value.organization_id != request.org.id:
                raise serializers.ValidationError(
                    'Scoring template does not belong to this organization.'
                )
        return value
