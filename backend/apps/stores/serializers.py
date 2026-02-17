from rest_framework import serializers

from .integrations import IntegrationConfig, StoreDataPoint
from .models import Goal, OrgSettings, Region, Store


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
            'id', 'subscription_tier', 'ai_photo_analysis',
            'allow_benchmarking', 'benchmarking_period_days',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'subscription_tier', 'created_at', 'updated_at']


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
