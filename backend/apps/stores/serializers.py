from rest_framework import serializers

from .integrations import IntegrationConfig, StoreDataPoint
from .models import Achievement, AwardedAchievement, Challenge, Goal, OrgSettings, Region, Store


class RegionChildSerializer(serializers.ModelSerializer):
    """Lightweight serializer for nested children — no recursion."""
    store_count = serializers.SerializerMethodField()
    manager_name = serializers.SerializerMethodField()

    class Meta:
        model = Region
        fields = [
            'id', 'name', 'color', 'store_count', 'manager', 'manager_name',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_store_count(self, obj):
        return obj.stores.count()

    def get_manager_name(self, obj):
        if obj.manager and obj.manager.user:
            return obj.manager.user.full_name
        return None


class RegionSerializer(serializers.ModelSerializer):
    store_count = serializers.SerializerMethodField()
    parent_name = serializers.CharField(source='parent.name', read_only=True, default=None)
    manager_name = serializers.SerializerMethodField()
    children = RegionChildSerializer(many=True, read_only=True)

    class Meta:
        model = Region
        fields = [
            'id', 'name', 'color', 'parent', 'parent_name',
            'manager', 'manager_name', 'children',
            'store_count', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_store_count(self, obj):
        count = obj.stores.count()
        # Include stores from child regions
        for child in obj.children.all():
            count += child.stores.count()
        return count

    def get_manager_name(self, obj):
        if obj.manager and obj.manager.user:
            return obj.manager.user.full_name
        return None

    def validate_parent(self, value):
        if value is None:
            return value
        # Prevent nesting deeper than one level
        if value.parent_id is not None:
            raise serializers.ValidationError(
                'Cannot nest more than one level deep. The selected parent already has a parent.'
            )
        # Prevent self-reference
        if self.instance and value.pk == self.instance.pk:
            raise serializers.ValidationError('A region cannot be its own parent.')
        # Prevent making a parent into a child
        if self.instance and self.instance.children.exists():
            raise serializers.ValidationError(
                'This region has sub-regions and cannot become a child itself.'
            )
        return value


class StoreSerializer(serializers.ModelSerializer):
    region_name = serializers.CharField(source='region.name', read_only=True, default=None)
    department_ids = serializers.PrimaryKeyRelatedField(
        source='departments', many=True,
        queryset=Store.departments.rel.model.objects.all(),
        required=False,
    )
    department_names = serializers.SerializerMethodField()

    class Meta:
        model = Store
        fields = [
            'id', 'name', 'store_number', 'region', 'region_name',
            'address', 'city', 'state', 'zip_code', 'is_active',
            'latitude', 'longitude',
            'phone', 'manager_name', 'manager_phone', 'manager_email',
            'qr_verification_token', 'verification_method',
            'department_ids', 'department_names',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'qr_verification_token', 'created_at', 'updated_at']

    def get_department_names(self, obj):
        return list(obj.departments.values_list('name', flat=True))

    def validate_region(self, value):
        """Ensure the region belongs to the same organization."""
        request = self.context.get('request')
        if value and request and hasattr(request, 'org') and request.org:
            if value.organization_id != request.org.id:
                raise serializers.ValidationError(
                    'Region does not belong to this organization.'
                )
        return value


class OrgSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrgSettings
        fields = [
            'id', 'subscription_tier',
            'location_enforcement', 'verification_radius_meters',
            'ai_photo_analysis',
            'allow_benchmarking', 'benchmarking_period_days',
            'gamification_enabled', 'gamification_visible_roles',
            'action_item_deadline_critical', 'action_item_deadline_high',
            'action_item_deadline_medium', 'action_item_deadline_low',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'subscription_tier', 'created_at', 'updated_at']

    def validate_verification_radius_meters(self, value):
        if value < 50 or value > 5000:
            raise serializers.ValidationError('Verification radius must be between 50 and 5000 meters.')
        return value


class GoalSerializer(serializers.ModelSerializer):
    region_name = serializers.CharField(source='region.name', read_only=True, default=None)
    store_name = serializers.CharField(source='store.name', read_only=True, default=None)

    class Meta:
        model = Goal
        fields = [
            'id', 'name', 'goal_type', 'scope',
            'region', 'region_name', 'store', 'store_name',
            'target_value', 'is_active',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate(self, attrs):
        scope = attrs.get('scope', 'organization')
        if scope == 'region' and not attrs.get('region'):
            raise serializers.ValidationError({'region': 'Region is required when scope is region.'})
        if scope == 'store' and not attrs.get('store'):
            raise serializers.ValidationError({'store': 'Store is required when scope is store.'})
        if scope == 'organization':
            attrs['region'] = None
            attrs['store'] = None
        elif scope == 'region':
            attrs['store'] = None
        return attrs


# ==================== Phase 4.5: Data Integrations ====================


class IntegrationConfigSerializer(serializers.ModelSerializer):
    data_point_count = serializers.SerializerMethodField()

    class Meta:
        model = IntegrationConfig
        fields = [
            'id', 'name', 'integration_type', 'provider', 'config',
            'is_active', 'last_sync_at', 'data_point_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'last_sync_at', 'created_at', 'updated_at']

    def get_data_point_count(self, obj):
        return obj.data_points.count()


class StoreDataPointSerializer(serializers.ModelSerializer):
    store_name = serializers.CharField(source='store.name', read_only=True, default=None)
    integration_name = serializers.CharField(source='integration.name', read_only=True, default=None)

    class Meta:
        model = StoreDataPoint
        fields = [
            'id', 'store', 'store_name', 'metric', 'value', 'date',
            'source', 'integration', 'integration_name', 'metadata',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_store(self, value):
        """Ensure the store belongs to the same organization."""
        request = self.context.get('request')
        if value and request and hasattr(request, 'org') and request.org:
            if value.organization_id != request.org.id:
                raise serializers.ValidationError(
                    'Store does not belong to this organization.'
                )
        return value


# ==================== Phase 8: Gamification ====================


class ChallengeListSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()
    region_name = serializers.CharField(source='region.name', read_only=True, default=None)
    is_ongoing = serializers.BooleanField(read_only=True)
    days_remaining = serializers.IntegerField(read_only=True)

    class Meta:
        model = Challenge
        fields = [
            'id', 'name', 'challenge_type', 'scope',
            'region', 'region_name', 'target_value',
            'start_date', 'end_date', 'is_active',
            'is_ongoing', 'days_remaining',
            'prizes_text', 'section_name',
            'created_by', 'created_by_name',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f'{obj.created_by.first_name} {obj.created_by.last_name}'.strip() or obj.created_by.email
        return None


class ChallengeDetailSerializer(ChallengeListSerializer):
    description = serializers.CharField(required=False, default='')

    class Meta(ChallengeListSerializer.Meta):
        fields = ChallengeListSerializer.Meta.fields + ['description']


class ChallengeCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Challenge
        fields = [
            'name', 'description', 'challenge_type', 'scope',
            'region', 'target_value', 'start_date', 'end_date', 'is_active',
            'prizes_text', 'section_name',
        ]

    def validate(self, attrs):
        if attrs.get('end_date') and attrs.get('start_date'):
            if attrs['end_date'] <= attrs['start_date']:
                raise serializers.ValidationError(
                    {'end_date': 'End date must be after start date.'}
                )
        scope = attrs.get('scope', 'organization')
        if scope == 'region' and not attrs.get('region'):
            raise serializers.ValidationError(
                {'region': 'Region is required when scope is region.'}
            )
        if scope == 'organization':
            attrs['region'] = None
        return attrs


class AchievementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Achievement
        fields = [
            'id', 'name', 'description', 'icon_name', 'tier',
            'criteria_type', 'criteria_value', 'plan_tier', 'is_active',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class AwardedAchievementSerializer(serializers.ModelSerializer):
    achievement = AchievementSerializer(read_only=True)
    store_name = serializers.CharField(source='store.name', read_only=True, default=None)
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = AwardedAchievement
        fields = [
            'id', 'achievement', 'store', 'store_name',
            'user', 'user_name', 'walk', 'awarded_at',
        ]
        read_only_fields = ['id', 'awarded_at']

    def get_user_name(self, obj):
        if obj.user:
            return f'{obj.user.first_name} {obj.user.last_name}'.strip() or obj.user.email
        return None


class LeaderboardEntrySerializer(serializers.Serializer):
    rank = serializers.IntegerField()
    store_id = serializers.CharField()
    store_name = serializers.CharField()
    store_number = serializers.CharField()
    region_name = serializers.CharField()
    value = serializers.FloatField()
    change = serializers.FloatField(allow_null=True)
    trend = serializers.CharField()
