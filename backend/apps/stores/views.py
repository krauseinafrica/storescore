import csv
import io
import uuid
from datetime import timedelta

from django.db.models import Avg, Count, Q
from django.utils import timezone
from rest_framework import status as http_status
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

from apps.billing.permissions import HasFeature
from apps.core.permissions import IsOrgAdmin, IsOrgManagerOrAbove, IsOrgMember, get_accessible_store_ids
from apps.walks.models import Walk

from .integrations import IntegrationConfig, StoreDataPoint
from .models import Goal, OrgSettings, Region, Store
from .serializers import (
    GoalSerializer,
    IntegrationConfigSerializer,
    OrgSettingsSerializer,
    RegionSerializer,
    StoreDataPointSerializer,
    StoreSerializer,
)


class RegionViewSet(ModelViewSet):
    """CRUD operations for regions, scoped to the current organization."""
    serializer_class = RegionSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated(), IsOrgMember()]
        return [IsAuthenticated(), IsOrgAdmin()]

    def get_queryset(self):
        qs = Region.objects.filter(
            organization=self.request.org,
        ).select_related('parent', 'manager__user').prefetch_related('children', 'stores')

        # Regional managers only see their assigned regions + children
        membership = getattr(self.request, 'membership', None)
        if membership and membership.role == 'regional_manager':
            region_ids = list(
                membership.region_assignments.values_list('region_id', flat=True)
            )
            child_ids = list(
                Region.objects.filter(parent_id__in=region_ids).values_list('id', flat=True)
            )
            qs = qs.filter(id__in=set(region_ids) | set(child_ids))

        # ?tree=true returns only top-level regions (children nested)
        tree = self.request.query_params.get('tree')
        if tree and tree.lower() == 'true':
            qs = qs.filter(parent__isnull=True)

        return qs

    def perform_create(self, serializer):
        serializer.save(organization=self.request.org)

    @action(detail=True, methods=['post'], url_path='assign-manager')
    def assign_manager(self, request, pk=None):
        """Assign a responsible person (membership) to this region."""
        region = self.get_object()
        membership_id = request.data.get('membership_id')

        if membership_id is None:
            # Clear the manager
            region.manager = None
            region.save(update_fields=['manager'])
            return Response(RegionSerializer(region).data)

        from apps.accounts.models import Membership
        try:
            membership = Membership.objects.get(
                id=membership_id,
                organization=request.org,
            )
        except Membership.DoesNotExist:
            return Response(
                {'detail': 'Membership not found in this organization.'},
                status=http_status.HTTP_404_NOT_FOUND,
            )

        region.manager = membership
        region.save(update_fields=['manager'])
        return Response(RegionSerializer(region).data)


class StoreViewSet(ModelViewSet):
    """CRUD operations for stores, scoped to the current organization."""
    serializer_class = StoreSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated(), IsOrgMember()]
        return [IsAuthenticated(), IsOrgAdmin()]

    def get_queryset(self):
        queryset = Store.objects.filter(organization=self.request.org).select_related('region')

        # Apply role-based store scoping (pass request so platform admins see all)
        accessible_ids = get_accessible_store_ids(self.request)
        if accessible_ids is not None:
            queryset = queryset.filter(id__in=accessible_ids)

        # Optional filters
        region = self.request.query_params.get('region')
        if region:
            queryset = queryset.filter(region_id=region)

        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')

        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(name__icontains=search)

        return queryset

    def perform_create(self, serializer):
        serializer.save(organization=self.request.org)

    @action(detail=True, methods=['post'], url_path='regenerate-qr')
    def regenerate_qr(self, request, pk=None):
        """Regenerate the QR verification token for this store."""
        store = self.get_object()
        store.qr_verification_token = uuid.uuid4()
        store.save(update_fields=['qr_verification_token'])
        return Response(StoreSerializer(store).data)

    @action(detail=True, methods=['post'], url_path='geocode')
    def geocode(self, request, pk=None):
        """Auto-fill lat/lng from the store's address using Nominatim."""
        store = self.get_object()

        from .geocoding import geocode_address
        lat, lng = geocode_address(
            address=store.address,
            city=store.city,
            state=store.state,
            zip_code=store.zip_code,
        )

        if lat is None or lng is None:
            return Response(
                {'detail': 'Could not geocode this address. Try updating the address fields.'},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        store.latitude = lat
        store.longitude = lng
        store.save(update_fields=['latitude', 'longitude'])
        return Response(StoreSerializer(store).data)

    @action(detail=True, methods=['get'], url_path='qr-code')
    def qr_code(self, request, pk=None):
        """Generate and return a downloadable QR code PNG for this store."""
        store = self.get_object()
        qr_url = f'https://app.storescore.app/verify-qr/{store.id}/{store.qr_verification_token}'

        try:
            import qrcode
            qr = qrcode.QRCode(version=1, box_size=10, border=4)
            qr.add_data(qr_url)
            qr.make(fit=True)
            img = qr.make_image(fill_color='black', back_color='white')

            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            buffer.seek(0)

            from django.http import HttpResponse
            response = HttpResponse(buffer.getvalue(), content_type='image/png')
            response['Content-Disposition'] = f'attachment; filename="qr-{store.store_number or store.id}.png"'
            return response
        except ImportError:
            return Response(
                {'detail': 'QR code generation library not installed.'},
                status=http_status.HTTP_503_SERVICE_UNAVAILABLE,
            )


class OrgSettingsView(APIView):
    """
    GET  /api/v1/stores/settings/   - Get org settings (creates defaults if missing)
    PUT  /api/v1/stores/settings/   - Update org settings
    """
    permission_classes = [IsAuthenticated, IsOrgMember]

    def get(self, request):
        settings, _ = OrgSettings.objects.get_or_create(
            organization=request.org,
        )
        return Response(OrgSettingsSerializer(settings).data)

    def put(self, request):
        if not IsOrgAdmin().has_permission(request, self):
            return Response({'detail': 'Admin access required.'}, status=403)

        settings, _ = OrgSettings.objects.get_or_create(
            organization=request.org,
        )
        serializer = OrgSettingsSerializer(settings, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class GoalViewSet(ModelViewSet):
    """CRUD operations for goals, scoped to the current organization. Pro+ feature."""
    serializer_class = GoalSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated(), IsOrgMember(), HasFeature('goals')]
        return [IsAuthenticated(), IsOrgAdmin(), HasFeature('goals')]

    def get_queryset(self):
        qs = Goal.objects.filter(
            organization=self.request.org,
        ).select_related('region', 'store')

        goal_type = self.request.query_params.get('type')
        if goal_type:
            qs = qs.filter(goal_type=goal_type)

        scope = self.request.query_params.get('scope')
        if scope:
            qs = qs.filter(scope=scope)

        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == 'true')

        return qs

    def perform_create(self, serializer):
        serializer.save(organization=self.request.org)


class BenchmarkingView(APIView):
    """
    GET /api/v1/stores/benchmarking/
        Returns anonymized benchmarking data for the current user's accessible stores.
        Pro+ feature.
    """
    permission_classes = [IsAuthenticated, IsOrgMember]

    def get(self, request):
        org = request.org

        # Check plan-level feature gate
        if not HasFeature('benchmarking').has_permission(request, self):
            return Response({
                'enabled': False,
                'detail': 'Store benchmarking requires a Pro or Enterprise plan.',
            })

        try:
            settings = OrgSettings.objects.get(organization=org)
        except OrgSettings.DoesNotExist:
            settings = None

        period_days = settings.benchmarking_period_days if settings else 90
        cutoff = timezone.now() - timedelta(days=period_days)

        # Get all completed walks in the period
        walks = Walk.objects.filter(
            organization=org,
            status='completed',
            completed_date__gte=cutoff,
            total_score__isnull=False,
        )

        # Per-store average scores
        store_scores = (
            walks
            .values('store_id', 'store__name')
            .annotate(avg_score=Avg('total_score'), walk_count=Count('id'))
            .order_by('-avg_score')
        )

        store_list = list(store_scores)
        if not store_list:
            return Response({
                'enabled': True,
                'period_days': period_days,
                'store_count': 0,
                'org_average': None,
                'my_stores': [],
                'distribution': [],
                'goals': [],
            })

        # Org average
        all_avgs = [s['avg_score'] for s in store_list]
        org_avg = sum(all_avgs) / len(all_avgs) if all_avgs else 0

        # Build distribution buckets
        buckets = [
            {'label': '< 50%', 'min': 0, 'max': 50, 'count': 0},
            {'label': '50-60%', 'min': 50, 'max': 60, 'count': 0},
            {'label': '60-70%', 'min': 60, 'max': 70, 'count': 0},
            {'label': '70-80%', 'min': 70, 'max': 80, 'count': 0},
            {'label': '80-90%', 'min': 80, 'max': 90, 'count': 0},
            {'label': '90-100%', 'min': 90, 'max': 101, 'count': 0},
        ]
        for s in store_list:
            avg = float(s['avg_score'])
            for b in buckets:
                if b['min'] <= avg < b['max']:
                    b['count'] += 1
                    break

        # Determine user's accessible stores
        accessible_ids = get_accessible_store_ids(request)
        my_stores = []
        for idx, s in enumerate(store_list):
            if accessible_ids is None or s['store_id'] in accessible_ids:
                percentile = ((len(store_list) - idx) / len(store_list)) * 100
                my_stores.append({
                    'store_id': str(s['store_id']),
                    'store_name': s['store__name'],
                    'avg_score': round(float(s['avg_score']), 1),
                    'walk_count': s['walk_count'],
                    'percentile': round(percentile, 0),
                    'rank': idx + 1,
                    'total_stores': len(store_list),
                })

        # Get applicable goals
        active_goals = Goal.objects.filter(
            organization=org,
            is_active=True,
            goal_type='score_target',
        ).filter(
            Q(scope='organization') |
            Q(scope='store', store_id__in=[s['store_id'] for s in my_stores]) |
            Q(scope='region')
        )

        goal_data = GoalSerializer(active_goals, many=True).data

        return Response({
            'enabled': True,
            'period_days': period_days,
            'store_count': len(store_list),
            'org_average': round(float(org_avg), 1),
            'my_stores': my_stores,
            'distribution': [{'label': b['label'], 'count': b['count']} for b in buckets],
            'goals': goal_data,
        })


# ==================== Phase 4.5: Data Integrations ====================


class IntegrationConfigViewSet(ModelViewSet):
    """CRUD for integration configurations. Admin can create/edit."""
    serializer_class = IntegrationConfigSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated(), IsOrgMember()]
        return [IsAuthenticated(), IsOrgAdmin()]

    def get_queryset(self):
        return IntegrationConfig.objects.filter(
            organization=self.request.org,
        )

    def perform_create(self, serializer):
        serializer.save(organization=self.request.org)


class StoreDataPointViewSet(ModelViewSet):
    """CRUD for store data points with CSV upload support."""
    serializer_class = StoreDataPointSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated(), IsOrgMember()]
        return [IsAuthenticated(), IsOrgManagerOrAbove()]

    def get_queryset(self):
        queryset = StoreDataPoint.objects.filter(
            organization=self.request.org,
        ).select_related('store', 'integration')

        # Apply store-level scoping
        accessible_ids = get_accessible_store_ids(self.request)
        if accessible_ids is not None:
            queryset = queryset.filter(store_id__in=accessible_ids)

        # Filters
        store = self.request.query_params.get('store')
        if store:
            queryset = queryset.filter(store_id=store)

        metric = self.request.query_params.get('metric')
        if metric:
            queryset = queryset.filter(metric=metric)

        date_from = self.request.query_params.get('date_from')
        if date_from:
            queryset = queryset.filter(date__gte=date_from)

        date_to = self.request.query_params.get('date_to')
        if date_to:
            queryset = queryset.filter(date__lte=date_to)

        return queryset

    def perform_create(self, serializer):
        serializer.save(organization=self.request.org)

    @action(
        detail=False,
        methods=['post'],
        url_path='csv-upload',
        parser_classes=[MultiPartParser, FormParser],
    )
    def csv_upload(self, request):
        """
        Bulk create data points from a CSV file.
        Expects: file (CSV), column_mapping (JSON string).
        column_mapping example: {"store_number": 0, "metric": 1, "value": 2, "date": 3}
        """
        csv_file = request.FILES.get('file')
        if not csv_file:
            return Response(
                {'detail': 'No CSV file provided.'},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        import json
        mapping_raw = request.data.get('column_mapping', '{}')
        try:
            mapping = json.loads(mapping_raw) if isinstance(mapping_raw, str) else mapping_raw
        except json.JSONDecodeError:
            return Response(
                {'detail': 'Invalid column_mapping JSON.'},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        # Read CSV
        try:
            content = csv_file.read().decode('utf-8-sig')
            reader = csv.reader(io.StringIO(content))
            rows = list(reader)
        except Exception as e:
            return Response(
                {'detail': f'Failed to read CSV: {e}'},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        if len(rows) < 2:
            return Response(
                {'detail': 'CSV must have a header row and at least one data row.'},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        # Build store lookup by store_number
        store_map = {}
        for store in Store.objects.filter(organization=request.org):
            if store.store_number:
                store_map[store.store_number] = store
            store_map[store.name] = store

        header = rows[0]
        created = 0
        errors = []

        for row_idx, row in enumerate(rows[1:], start=2):
            try:
                store_key = row[mapping.get('store_number', mapping.get('store', 0))]
                metric = row[mapping.get('metric', 1)]
                value = row[mapping.get('value', 2)]
                date_str = row[mapping.get('date', 3)]

                store = store_map.get(store_key.strip())
                if not store:
                    errors.append(f'Row {row_idx}: Store "{store_key}" not found.')
                    continue

                StoreDataPoint.objects.create(
                    organization=request.org,
                    store=store,
                    metric=metric.strip(),
                    value=value.strip(),
                    date=date_str.strip(),
                    source='csv_import',
                )
                created += 1
            except (IndexError, ValueError) as e:
                errors.append(f'Row {row_idx}: {e}')

        return Response({
            'created': created,
            'errors': errors[:20],  # Limit error output
        })
