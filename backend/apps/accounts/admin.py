from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import Membership, Organization, RegionAssignment, StoreAssignment, User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('email', 'first_name', 'last_name', 'is_staff', 'is_active', 'date_joined')
    list_filter = ('is_staff', 'is_active')
    search_fields = ('email', 'first_name', 'last_name')
    ordering = ('email',)
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal info', {'fields': ('first_name', 'last_name')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'first_name', 'last_name', 'password1', 'password2'),
        }),
    )


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'owner', 'created_at')
    search_fields = ('name', 'slug')
    prepopulated_fields = {'slug': ('name',)}


class RegionAssignmentInline(admin.TabularInline):
    model = RegionAssignment
    extra = 0


class StoreAssignmentInline(admin.TabularInline):
    model = StoreAssignment
    extra = 0


@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = ('user', 'organization', 'role', 'created_at')
    list_filter = ('role',)
    search_fields = ('user__email', 'organization__name')
    inlines = [RegionAssignmentInline, StoreAssignmentInline]


@admin.register(RegionAssignment)
class RegionAssignmentAdmin(admin.ModelAdmin):
    list_display = ('membership', 'region', 'created_at')


@admin.register(StoreAssignment)
class StoreAssignmentAdmin(admin.ModelAdmin):
    list_display = ('membership', 'store', 'created_at')
