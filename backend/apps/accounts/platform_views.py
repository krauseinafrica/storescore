"""
Platform admin views — accessible only to is_staff / is_superuser users.
Provides org management across all franchises.
"""

from django.contrib.auth.hashers import make_password
from django.db import transaction

from django.utils.crypto import get_random_string
from django.utils.text import slugify
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.stores.models import Region, Store
from apps.stores.serializers import RegionSerializer, StoreSerializer
from apps.walks.models import Walk

from .models import Membership, Organization, User
from .serializers import MembershipSerializer, OrganizationSerializer, UserSerializer


class PlatformOrgListView(APIView):
    """
    GET  /api/v1/auth/platform/orgs/
        List all organizations with summary stats.

    POST /api/v1/auth/platform/orgs/
        Create a new organization + owner.
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        orgs = Organization.objects.select_related('owner').order_by('-created_at')

        data = []
        for org in orgs:
            store_ct = Store.objects.filter(organization=org).count()
            walk_ct = Walk.objects.filter(organization=org).count()
            completed_ct = Walk.objects.filter(
                organization=org, status='completed'
            ).count()
            member_ct = Membership.objects.filter(organization=org).count()
            last_walk = Walk.objects.filter(
                organization=org, status='completed'
            ).order_by('-completed_date').values_list('completed_date', flat=True).first()

            data.append({
                'id': str(org.id),
                'name': org.name,
                'slug': org.slug,
                'is_active': org.is_active,
                'owner': UserSerializer(org.owner).data,
                'member_count': member_ct,
                'store_count': store_ct,
                'walk_count': walk_ct,
                'completed_walk_count': completed_ct,
                'last_walk_date': last_walk.isoformat() if last_walk else None,
                'created_at': org.created_at.isoformat(),
            })

        return Response(data)

    @transaction.atomic
    def post(self, request):
        """Create a new organization with an owner."""
        org_name = request.data.get('name', '').strip()
        owner_email = request.data.get('owner_email', '').strip().lower()
        owner_first = request.data.get('owner_first_name', '').strip()
        owner_last = request.data.get('owner_last_name', '').strip()

        if not org_name:
            return Response(
                {'detail': 'Organization name is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not owner_email:
            return Response(
                {'detail': 'Owner email is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Create or get owner user
        user, created = User.objects.get_or_create(
            email=owner_email,
            defaults={
                'first_name': owner_first or 'Admin',
                'last_name': owner_last or '',
                'password': make_password(get_random_string(24)),
            },
        )

        # Create org with unique slug
        base_slug = slugify(org_name)
        slug = base_slug
        counter = 1
        while Organization.objects.filter(slug=slug).exists():
            slug = f'{base_slug}-{counter}'
            counter += 1

        org = Organization.objects.create(
            name=org_name,
            slug=slug,
            owner=user,
        )

        # Create owner membership
        Membership.objects.create(
            user=user,
            organization=org,
            role=Membership.Role.OWNER,
        )

        return Response({
            'id': str(org.id),
            'name': org.name,
            'slug': org.slug,
            'is_active': org.is_active,
            'owner': UserSerializer(user).data,
            'member_count': 1,
            'store_count': 0,
            'walk_count': 0,
            'completed_walk_count': 0,
            'last_walk_date': None,
            'created_at': org.created_at.isoformat(),
        }, status=status.HTTP_201_CREATED)


class PlatformOrgDetailView(APIView):
    """
    GET /api/v1/auth/platform/orgs/:id/
        Get org details with stores and members.
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request, org_id):
        try:
            org = Organization.objects.select_related('owner').get(id=org_id)
        except Organization.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)

        stores = Store.objects.filter(organization=org).select_related('region')
        members = Membership.objects.filter(
            organization=org
        ).select_related('user').order_by('created_at')
        regions = Region.objects.filter(organization=org)

        return Response({
            'organization': {
                'id': str(org.id),
                'name': org.name,
                'slug': org.slug,
                'is_active': org.is_active,
                'owner': UserSerializer(org.owner).data,
                'created_at': org.created_at.isoformat(),
            },
            'stores': StoreSerializer(stores, many=True).data,
            'members': [
                {
                    'id': str(m.id),
                    'user': UserSerializer(m.user).data,
                    'role': m.role,
                    'created_at': m.created_at.isoformat(),
                }
                for m in members
            ],
            'regions': RegionSerializer(regions, many=True).data,
        })

    def patch(self, request, org_id):
        try:
            org = Organization.objects.get(id=org_id)
        except Organization.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)

        name = request.data.get('name')
        if name:
            org.name = name.strip()

        org.save()
        return Response({
            'id': str(org.id),
            'name': org.name,
            'slug': org.slug,
        })


class PlatformOrgStoresView(APIView):
    """
    POST /api/v1/auth/platform/orgs/:id/stores/
        Create a store under a specific organization.
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request, org_id):
        try:
            org = Organization.objects.get(id=org_id)
        except Organization.DoesNotExist:
            return Response({'detail': 'Organization not found.'}, status=404)

        data = request.data.copy()
        serializer = StoreSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        store = serializer.save(organization=org)
        return Response(
            StoreSerializer(store).data,
            status=status.HTTP_201_CREATED,
        )


class PlatformStatsView(APIView):
    """
    GET /api/v1/auth/platform/stats/
        Platform-wide statistics.
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        return Response({
            'total_organizations': Organization.objects.count(),
            'total_stores': Store.objects.count(),
            'total_users': User.objects.count(),
            'total_walks': Walk.objects.count(),
            'total_completed_walks': Walk.objects.filter(status='completed').count(),
        })


class PlatformOrgActivationView(APIView):
    """POST /api/v1/auth/platform/orgs/:id/activation/ — activate or deactivate an org."""
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request, org_id):
        try:
            org = Organization.objects.get(id=org_id)
        except Organization.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)

        action = request.data.get('action')
        if action not in ('activate', 'deactivate'):
            return Response(
                {'detail': 'action must be "activate" or "deactivate".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        org.is_active = (action == 'activate')
        org.save(update_fields=['is_active'])
        return Response({'id': str(org.id), 'is_active': org.is_active})


class PlatformOrgStoreImportView(APIView):
    """POST /api/v1/auth/platform/orgs/:id/stores/import/ — bulk import stores from CSV."""
    permission_classes = [IsAuthenticated, IsAdminUser]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, org_id):
        import csv
        import io

        try:
            org = Organization.objects.get(id=org_id)
        except Organization.DoesNotExist:
            return Response({'detail': 'Organization not found.'}, status=404)

        csv_file = request.FILES.get('file')
        if not csv_file:
            return Response({'detail': 'No CSV file provided.'}, status=status.HTTP_400_BAD_REQUEST)

        import json
        mapping_raw = request.data.get('column_mapping', '{}')
        try:
            mapping = json.loads(mapping_raw) if isinstance(mapping_raw, str) else mapping_raw
        except json.JSONDecodeError:
            return Response({'detail': 'Invalid column_mapping JSON.'}, status=status.HTTP_400_BAD_REQUEST)

        content = csv_file.read().decode('utf-8-sig')
        reader = csv.reader(io.StringIO(content))
        rows = list(reader)

        if len(rows) < 2:
            return Response({'detail': 'CSV must have header + data rows.'}, status=status.HTTP_400_BAD_REQUEST)

        # Build region lookup
        region_map = {}
        for r in Region.objects.filter(organization=org):
            region_map[r.name.lower()] = r

        created = 0
        errors = []
        for row_idx, row in enumerate(rows[1:], start=2):
            try:
                name = row[mapping.get('name', 0)].strip()
                store_number = row[mapping.get('store_number', 1)].strip() if len(row) > mapping.get('store_number', 1) else ''
                address = row[mapping.get('address', 2)].strip() if len(row) > mapping.get('address', 2) else ''
                city = row[mapping.get('city', 3)].strip() if len(row) > mapping.get('city', 3) else ''
                state_val = row[mapping.get('state', 4)].strip() if len(row) > mapping.get('state', 4) else ''
                zip_code = row[mapping.get('zip_code', 5)].strip() if len(row) > mapping.get('zip_code', 5) else ''
                region_name = row[mapping.get('region', 6)].strip() if len(row) > mapping.get('region', 6) else ''

                if not name:
                    errors.append(f'Row {row_idx}: Missing store name.')
                    continue

                region = region_map.get(region_name.lower()) if region_name else None

                Store.objects.create(
                    organization=org,
                    name=name,
                    store_number=store_number,
                    address=address,
                    city=city,
                    state=state_val,
                    zip_code=zip_code,
                    region=region,
                )
                created += 1
            except (IndexError, ValueError) as e:
                errors.append(f'Row {row_idx}: {e}')

        return Response({'created': created, 'errors': errors[:20]}, status=status.HTTP_201_CREATED)


class LeadListView(APIView):
    """GET/POST /api/v1/auth/leads/ — list leads (admin) or create lead (public)."""

    def get_permissions(self):
        if self.request.method == 'POST':
            from rest_framework.permissions import AllowAny
            return [AllowAny()]
        return [IsAuthenticated(), IsAdminUser()]

    def get(self, request):
        from .leads import Lead
        leads = Lead.objects.all().order_by('-created_at')
        data = []
        for lead in leads:
            data.append({
                'id': str(lead.id),
                'email': lead.email,
                'first_name': lead.first_name,
                'last_name': lead.last_name,
                'company_name': lead.company_name,
                'phone': lead.phone,
                'store_count': lead.store_count,
                'message': lead.message,
                'status': lead.status,
                'source': lead.source,
                'demo_org': str(lead.demo_org_id) if lead.demo_org_id else None,
                'demo_expires_at': lead.demo_expires_at.isoformat() if lead.demo_expires_at else None,
                'created_at': lead.created_at.isoformat(),
            })
        return Response(data)

    def post(self, request):
        from .leads import Lead

        email = request.data.get('email', '').strip().lower()
        first_name = request.data.get('first_name', '').strip()
        last_name = request.data.get('last_name', '').strip()

        if not email or not first_name or not last_name:
            return Response(
                {'detail': 'email, first_name, and last_name are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        lead = Lead.objects.create(
            email=email,
            first_name=first_name,
            last_name=last_name,
            company_name=request.data.get('company_name', '').strip(),
            phone=request.data.get('phone', '').strip(),
            store_count=request.data.get('store_count'),
            message=request.data.get('message', '').strip(),
            source=request.data.get('source', 'website'),
        )

        # Trigger async demo setup
        from .tasks import setup_demo_for_lead
        setup_demo_for_lead.delay(str(lead.id))

        return Response({
            'id': str(lead.id),
            'message': 'Thank you! Check your email for demo access details.',
        }, status=status.HTTP_201_CREATED)


class LeadDetailView(APIView):
    """GET/PATCH /api/v1/auth/leads/:id/ — view/update lead status."""
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request, lead_id):
        from .leads import Lead
        try:
            lead = Lead.objects.select_related('demo_org').get(id=lead_id)
        except Lead.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)

        return Response({
            'id': str(lead.id),
            'email': lead.email,
            'first_name': lead.first_name,
            'last_name': lead.last_name,
            'company_name': lead.company_name,
            'phone': lead.phone,
            'store_count': lead.store_count,
            'message': lead.message,
            'status': lead.status,
            'source': lead.source,
            'demo_org': {
                'id': str(lead.demo_org.id),
                'name': lead.demo_org.name,
            } if lead.demo_org else None,
            'demo_expires_at': lead.demo_expires_at.isoformat() if lead.demo_expires_at else None,
            'created_at': lead.created_at.isoformat(),
        })

    def patch(self, request, lead_id):
        from .leads import Lead
        try:
            lead = Lead.objects.get(id=lead_id)
        except Lead.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)

        new_status = request.data.get('status')
        if new_status:
            lead.status = new_status
            lead.save(update_fields=['status'])

        return Response({'id': str(lead.id), 'status': lead.status})
