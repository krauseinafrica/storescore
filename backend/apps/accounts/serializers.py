from django.contrib.auth import authenticate
from django.contrib.auth.hashers import make_password
from django.db import transaction
from django.utils.crypto import get_random_string
from django.utils.text import slugify
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Membership, Organization, RegionAssignment, StoreAssignment, User


class UserSerializer(serializers.ModelSerializer):
    """Read-only serializer for user details."""
    full_name = serializers.ReadOnlyField()

    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'full_name', 'date_joined']
        read_only_fields = fields


class OrganizationSerializer(serializers.ModelSerializer):
    """Serializer for organization details."""
    owner = UserSerializer(read_only=True)

    class Meta:
        model = Organization
        fields = ['id', 'name', 'slug', 'owner', 'created_at', 'updated_at']
        read_only_fields = ['id', 'slug', 'owner', 'created_at', 'updated_at']


class MembershipSerializer(serializers.ModelSerializer):
    """Serializer for membership details."""
    organization = OrganizationSerializer(read_only=True)

    class Meta:
        model = Membership
        fields = ['id', 'organization', 'role', 'created_at']
        read_only_fields = fields


class RegisterSerializer(serializers.Serializer):
    """Serializer for user registration. Creates User + Organization + Membership."""
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    org_name = serializers.CharField(max_length=255)

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError('A user with this email already exists.')
        return value.lower()

    @transaction.atomic
    def create(self, validated_data):
        org_name = validated_data.pop('org_name')

        # Create user
        user = User.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data['first_name'],
            last_name=validated_data['last_name'],
        )

        # Create organization with unique slug
        base_slug = slugify(org_name)
        slug = base_slug
        counter = 1
        while Organization.objects.filter(slug=slug).exists():
            slug = f'{base_slug}-{counter}'
            counter += 1

        organization = Organization.objects.create(
            name=org_name,
            slug=slug,
            owner=user,
        )

        # Create owner membership
        Membership.objects.create(
            user=user,
            organization=organization,
            role=Membership.Role.OWNER,
        )

        return user

    def to_representation(self, user):
        refresh = RefreshToken.for_user(user)
        membership = user.memberships.select_related('organization').first()
        return {
            'user': UserSerializer(user).data,
            'organization': OrganizationSerializer(membership.organization).data if membership else None,
            'tokens': {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
            },
        }


class LoginSerializer(serializers.Serializer):
    """Serializer for user login. Validates credentials and returns tokens."""
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = attrs.get('email', '').lower()
        password = attrs.get('password')

        user = authenticate(
            request=self.context.get('request'),
            email=email,
            password=password,
        )

        if not user:
            raise serializers.ValidationError('Invalid email or password.')

        if not user.is_active:
            raise serializers.ValidationError('This account has been deactivated.')

        attrs['user'] = user
        return attrs

    def create(self, validated_data):
        return validated_data['user']

    def to_representation(self, user):
        refresh = RefreshToken.for_user(user)
        memberships = user.memberships.select_related('organization').all()
        return {
            'user': UserSerializer(user).data,
            'memberships': MembershipSerializer(memberships, many=True).data,
            'tokens': {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
            },
        }


class OrgMemberSerializer(serializers.ModelSerializer):
    """Serializer for listing organization members with user details."""
    user = UserSerializer(read_only=True)
    assigned_regions = serializers.SerializerMethodField()
    assigned_stores = serializers.SerializerMethodField()

    class Meta:
        model = Membership
        fields = ['id', 'user', 'role', 'assigned_regions', 'assigned_stores', 'created_at']
        read_only_fields = fields

    def get_assigned_regions(self, obj):
        return list(obj.region_assignments.values('id', 'region__id', 'region__name'))

    def get_assigned_stores(self, obj):
        return list(obj.store_assignments.values('id', 'store__id', 'store__name'))


class InviteMemberSerializer(serializers.Serializer):
    """Serializer for inviting a new member to an organization."""
    email = serializers.EmailField()
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    role = serializers.ChoiceField(
        choices=[
            ('admin', 'Admin'),
            ('regional_manager', 'Regional Manager'),
            ('store_manager', 'Store Manager'),
            ('manager', 'Manager'),
            ('finance', 'Finance'),
            ('member', 'Member'),
        ],
    )
    region_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        default=list,
    )
    store_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        default=list,
    )

    def validate_email(self, value):
        return value.lower()

    def validate(self, attrs):
        org = self.context['organization']
        email = attrs['email']

        # Check if user is already a member of this org
        existing_membership = Membership.objects.filter(
            user__email=email,
            organization=org,
        ).first()

        if existing_membership:
            raise serializers.ValidationError(
                {'email': 'This user is already a member of this organization.'}
            )

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        org = self.context['organization']
        email = validated_data['email']
        first_name = validated_data['first_name']
        last_name = validated_data['last_name']
        role = validated_data['role']
        region_ids = validated_data.get('region_ids', [])
        store_ids = validated_data.get('store_ids', [])

        # Get or create user
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                'first_name': first_name,
                'last_name': last_name,
                'password': make_password(get_random_string(24)),
            },
        )

        # Create membership
        membership = Membership.objects.create(
            user=user,
            organization=org,
            role=role,
        )

        # Create region assignments
        for region_id in region_ids:
            RegionAssignment.objects.create(
                membership=membership,
                region_id=region_id,
            )

        # Create store assignments
        for store_id in store_ids:
            StoreAssignment.objects.create(
                membership=membership,
                store_id=store_id,
            )

        return membership


class UpdateMemberRoleSerializer(serializers.Serializer):
    """Serializer for updating a member's role and assignments."""
    role = serializers.ChoiceField(
        choices=[
            ('admin', 'Admin'),
            ('regional_manager', 'Regional Manager'),
            ('store_manager', 'Store Manager'),
            ('manager', 'Manager'),
            ('finance', 'Finance'),
            ('member', 'Member'),
        ],
    )
    region_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
    )
    store_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
    )
