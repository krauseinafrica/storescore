from rest_framework import serializers

from .models import Region, Store


class RegionSerializer(serializers.ModelSerializer):
    store_count = serializers.SerializerMethodField()

    class Meta:
        model = Region
        fields = ['id', 'name', 'store_count', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_store_count(self, obj):
        return obj.stores.count()


class StoreSerializer(serializers.ModelSerializer):
    region_name = serializers.CharField(source='region.name', read_only=True, default=None)

    class Meta:
        model = Store
        fields = [
            'id', 'name', 'store_number', 'region', 'region_name',
            'address', 'city', 'state', 'zip_code', 'is_active',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_region(self, value):
        """Ensure the region belongs to the same organization."""
        request = self.context.get('request')
        if value and request and hasattr(request, 'org') and request.org:
            if value.organization_id != request.org.id:
                raise serializers.ValidationError(
                    'Region does not belong to this organization.'
                )
        return value
