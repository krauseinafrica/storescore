from django.contrib import admin

from .models import Region, Store


@admin.register(Region)
class RegionAdmin(admin.ModelAdmin):
    list_display = ('name', 'organization', 'created_at')
    list_filter = ('organization',)
    search_fields = ('name',)


@admin.register(Store)
class StoreAdmin(admin.ModelAdmin):
    list_display = ('name', 'store_number', 'region', 'city', 'state', 'is_active', 'organization')
    list_filter = ('is_active', 'region', 'organization')
    search_fields = ('name', 'store_number', 'city')
