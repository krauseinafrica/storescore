import csv
import io
import uuid
from datetime import timedelta

from django.db.models import Avg, Count, Q, StdDev
from django.utils import timezone
from rest_framework import status as http_status
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet

from apps.billing.permissions import HasFeature
from apps.core.permissions import IsOrgAdmin, IsOrgManagerOrAbove, IsOrgMember, get_accessible_store_ids
from apps.walks.models import Walk

from .integrations import IntegrationConfig, StoreDataPoint
from .models import Achievement, AwardedAchievement, Challenge, Goal, OrgSettings, Region, Store
from .serializers import (
    AchievementSerializer,
    AwardedAchievementSerializer,
    ChallengeCreateSerializer,
    ChallengeDetailSerializer,
    ChallengeListSerializer,
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


# ==================== Phase 8: Gamification ====================


def _check_gamification_role(request):
    """
    Check if the current user's role is allowed to see gamification.
    Returns True if visible, False otherwise.
    Empty gamification_visible_roles means all roles can see it.
    Platform admins always see it.
    """
    if getattr(request.user, 'is_staff', False) or getattr(request.user, 'is_superuser', False):
        return True

    try:
        settings = OrgSettings.objects.get(organization=request.org)
    except OrgSettings.DoesNotExist:
        return True  # No settings = default visible

    visible_roles = settings.gamification_visible_roles
    if not visible_roles:
        return True  # Empty list = all roles

    membership = getattr(request, 'membership', None)
    if not membership:
        return False

    return membership.role in visible_roles


class LeaderboardView(APIView):
    """
    GET /api/v1/stores/leaderboard/
    Computed leaderboard from Walk data. Supports multiple ranking types.
    Enterprise-only feature (gamification_advanced).
    """
    permission_classes = [IsAuthenticated, IsOrgMember]

    def get_permissions(self):
        return [IsAuthenticated(), IsOrgMember(), HasFeature('gamification_advanced')]

    def get(self, request):
        if not _check_gamification_role(request):
            return Response(
                {'detail': 'Gamification is not available for your role.'},
                status=403,
            )

        from apps.walks.analytics import _completed_walks_qs, _parse_period

        period = request.query_params.get('period', '30d')
        lb_type = request.query_params.get('type', 'avg_score')
        region_id = request.query_params.get('region')
        limit = int(request.query_params.get('limit', '10'))

        walks = _completed_walks_qs(request, period)

        if region_id:
            walks = walks.filter(store__region_id=region_id)

        if not walks.exists():
            return Response([])

        if lb_type == 'walk_count':
            return self._walk_count_leaderboard(walks, period, limit)
        elif lb_type == 'most_improved':
            return self._most_improved_leaderboard(walks, period, limit)
        elif lb_type == 'consistency':
            return self._consistency_leaderboard(walks, limit)
        elif lb_type == 'streak':
            return self._streak_leaderboard(walks, limit)
        else:
            return self._avg_score_leaderboard(walks, period, limit)

    def _avg_score_leaderboard(self, walks, period, limit):
        from apps.walks.analytics import _parse_period

        store_data = (
            walks
            .values('store__id', 'store__name', 'store__store_number', 'store__region__name')
            .annotate(avg_score=Avg('total_score'))
            .order_by('-avg_score')[:limit]
        )

        # Compute prior period for change
        start_date = _parse_period(period)
        prior_avgs = {}
        if start_date:
            duration = timezone.now() - start_date
            prev_start = start_date - duration
            prev_walks = walks.model.objects.filter(
                organization=walks.first().organization if walks.exists() else None,
                status='completed',
                total_score__isnull=False,
                completed_date__gte=prev_start,
                completed_date__lt=start_date,
            )
            for entry in prev_walks.values('store__id').annotate(avg=Avg('total_score')):
                prior_avgs[entry['store__id']] = float(entry['avg'])

        result = []
        for idx, entry in enumerate(store_data):
            store_id = entry['store__id']
            current = float(entry['avg_score'])
            prior = prior_avgs.get(store_id)
            change = round(current - prior, 1) if prior is not None else None
            trend = 'stable'
            if change is not None:
                if change > 2:
                    trend = 'up'
                elif change < -2:
                    trend = 'down'

            result.append({
                'rank': idx + 1,
                'store_id': str(store_id),
                'store_name': entry['store__name'],
                'store_number': entry['store__store_number'] or '',
                'region_name': entry['store__region__name'] or '',
                'value': round(current, 1),
                'change': change,
                'trend': trend,
            })

        return Response(result)

    def _walk_count_leaderboard(self, walks, period, limit):
        store_data = (
            walks
            .values('store__id', 'store__name', 'store__store_number', 'store__region__name')
            .annotate(walk_count=Count('id'))
            .order_by('-walk_count')[:limit]
        )

        result = []
        for idx, entry in enumerate(store_data):
            result.append({
                'rank': idx + 1,
                'store_id': str(entry['store__id']),
                'store_name': entry['store__name'],
                'store_number': entry['store__store_number'] or '',
                'region_name': entry['store__region__name'] or '',
                'value': entry['walk_count'],
                'change': None,
                'trend': 'stable',
            })

        return Response(result)

    def _most_improved_leaderboard(self, walks, period, limit):
        from apps.walks.analytics import _parse_period

        start_date = _parse_period(period)
        if not start_date:
            return Response([])

        duration = timezone.now() - start_date
        prev_start = start_date - duration

        # Current period averages
        current_avgs = {}
        for entry in walks.values('store__id', 'store__name', 'store__store_number', 'store__region__name').annotate(avg=Avg('total_score')):
            current_avgs[entry['store__id']] = entry

        # Prior period averages
        org = walks.first().organization if walks.exists() else None
        if not org:
            return Response([])

        prev_walks = Walk.objects.filter(
            organization=org,
            status='completed',
            total_score__isnull=False,
            completed_date__gte=prev_start,
            completed_date__lt=start_date,
        )
        prior_avgs = {}
        for entry in prev_walks.values('store__id').annotate(avg=Avg('total_score')):
            prior_avgs[entry['store__id']] = float(entry['avg'])

        # Calculate improvement
        improvements = []
        for store_id, data in current_avgs.items():
            prior = prior_avgs.get(store_id)
            if prior is not None:
                improvement = float(data['avg']) - prior
                improvements.append({
                    'store_id': store_id,
                    'store_name': data['store__name'],
                    'store_number': data['store__store_number'] or '',
                    'region_name': data['store__region__name'] or '',
                    'value': round(improvement, 1),
                    'change': round(improvement, 1),
                })

        improvements.sort(key=lambda x: x['value'], reverse=True)

        result = []
        for idx, entry in enumerate(improvements[:limit]):
            result.append({
                'rank': idx + 1,
                'store_id': str(entry['store_id']),
                'store_name': entry['store_name'],
                'store_number': entry['store_number'],
                'region_name': entry['region_name'],
                'value': entry['value'],
                'change': entry['change'],
                'trend': 'up' if entry['value'] > 0 else 'down' if entry['value'] < 0 else 'stable',
            })

        return Response(result)

    def _consistency_leaderboard(self, walks, limit):
        store_data = (
            walks
            .values('store__id', 'store__name', 'store__store_number', 'store__region__name')
            .annotate(
                score_stddev=StdDev('total_score'),
                avg_score=Avg('total_score'),
                walk_count=Count('id'),
            )
            .filter(walk_count__gte=2)
            .order_by('score_stddev')[:limit]
        )

        result = []
        for idx, entry in enumerate(store_data):
            stddev = float(entry['score_stddev'] or 0)
            result.append({
                'rank': idx + 1,
                'store_id': str(entry['store__id']),
                'store_name': entry['store__name'],
                'store_number': entry['store__store_number'] or '',
                'region_name': entry['store__region__name'] or '',
                'value': round(float(entry['avg_score']), 1),
                'change': round(stddev, 1),
                'trend': 'stable',
            })

        return Response(result)

    def _streak_leaderboard(self, walks, limit):
        """
        For each store, count backwards from the current week how many
        consecutive weeks have at least 1 completed walk.
        """
        from django.db.models.functions import ExtractIsoYear, ExtractWeek

        now = timezone.now()
        current_iso = now.isocalendar()
        current_year, current_week = current_iso[0], current_iso[1]

        # Get all (store_id, iso_year, iso_week) combos with at least one walk
        week_data = (
            walks
            .annotate(
                iso_year=ExtractIsoYear('completed_date'),
                iso_week=ExtractWeek('completed_date'),
            )
            .values(
                'store__id', 'store__name', 'store__store_number',
                'store__region__name', 'iso_year', 'iso_week',
            )
            .annotate(cnt=Count('id'))
        )

        # Build a set of (year, week) per store
        store_weeks = {}
        store_info = {}
        for entry in week_data:
            sid = entry['store__id']
            if sid not in store_weeks:
                store_weeks[sid] = set()
                store_info[sid] = {
                    'store_name': entry['store__name'],
                    'store_number': entry['store__store_number'] or '',
                    'region_name': entry['store__region__name'] or '',
                }
            store_weeks[sid].add((entry['iso_year'], entry['iso_week']))

        # Calculate streak for each store
        import datetime as dt

        streaks = []
        for sid, weeks_set in store_weeks.items():
            streak = 0
            year, week = current_year, current_week
            # Walk backwards week by week
            for _ in range(104):  # max 2 years look-back
                if (year, week) in weeks_set:
                    streak += 1
                else:
                    break
                # Go to previous week
                d = dt.date.fromisocalendar(year, week, 1) - dt.timedelta(weeks=1)
                iso = d.isocalendar()
                year, week = iso[0], iso[1]

            if streak > 0:
                info = store_info[sid]
                streaks.append({
                    'store_id': sid,
                    'store_name': info['store_name'],
                    'store_number': info['store_number'],
                    'region_name': info['region_name'],
                    'value': streak,
                })

        streaks.sort(key=lambda x: x['value'], reverse=True)

        result = []
        for idx, entry in enumerate(streaks[:limit]):
            result.append({
                'rank': idx + 1,
                'store_id': str(entry['store_id']),
                'store_name': entry['store_name'],
                'store_number': entry['store_number'],
                'region_name': entry['region_name'],
                'value': entry['value'],
                'change': None,
                'trend': 'stable',
            })

        return Response(result)


class ChallengeViewSet(ModelViewSet):
    """CRUD for challenges. Enterprise-only (gamification_advanced)."""

    def get_permissions(self):
        if self.action in ('list', 'retrieve', 'standings'):
            return [IsAuthenticated(), IsOrgMember(), HasFeature('gamification_advanced')]
        return [IsAuthenticated(), IsOrgAdmin(), HasFeature('gamification_advanced')]

    def check_permissions(self, request):
        super().check_permissions(request)
        # Role-based gamification visibility (skip for create/update by admins)
        if self.action in ('list', 'retrieve', 'standings'):
            if not _check_gamification_role(request):
                self.permission_denied(request, message='Gamification is not available for your role.')

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return ChallengeCreateSerializer
        if self.action == 'retrieve':
            return ChallengeDetailSerializer
        return ChallengeListSerializer

    def get_queryset(self):
        qs = Challenge.objects.filter(
            organization=self.request.org,
        ).select_related('region', 'created_by')

        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == 'true')

        return qs

    def perform_create(self, serializer):
        serializer.save(
            organization=self.request.org,
            created_by=self.request.user,
        )

    @action(detail=True, methods=['get'], url_path='standings')
    def standings(self, request, pk=None):
        """Compute standings for a challenge based on its type."""
        challenge = self.get_object()

        walks = Walk.objects.filter(
            organization=request.org,
            status='completed',
            total_score__isnull=False,
            completed_date__date__gte=challenge.start_date,
            completed_date__date__lte=challenge.end_date,
        )

        if challenge.scope == 'region' and challenge.region:
            walks = walks.filter(store__region=challenge.region)

        # Apply store scoping
        accessible_ids = get_accessible_store_ids(request)
        if accessible_ids is not None:
            walks = walks.filter(store_id__in=accessible_ids)

        # Section-scoped challenges use per-section score averages
        section_name = challenge.section_name.strip() if challenge.section_name else ''

        if challenge.challenge_type == 'score_target':
            standings = self._score_target_standings(walks, challenge, section_name)
        elif challenge.challenge_type == 'most_improved':
            standings = self._most_improved_standings(walks, challenge)
        elif challenge.challenge_type == 'walk_count':
            standings = self._walk_count_standings(walks)
        elif challenge.challenge_type == 'highest_score':
            standings = self._highest_score_standings(walks, section_name)
        else:
            standings = []

        return Response(standings)

    def _section_avg_by_store(self, walks, section_name):
        """
        Compute per-store average section score as a percentage.
        Returns dict: {store_id: {'name': ..., 'avg_pct': float}}.
        """
        from apps.walks.models import Score as WalkScore, Section as WalkSection
        from django.db.models import Sum

        walk_ids = list(walks.values_list('id', flat=True))
        # Get section IDs matching the name
        section_ids = list(
            WalkSection.objects.filter(name__iexact=section_name).values_list('id', flat=True)
        )
        if not section_ids:
            return {}

        # Aggregate scores per walk per store for matching section
        scores = (
            WalkScore.objects.filter(
                walk_id__in=walk_ids,
                criterion__section_id__in=section_ids,
            )
            .values('walk__store__id', 'walk__store__name', 'walk_id')
            .annotate(
                total_points=Sum('points'),
                max_points=Sum('criterion__max_points'),
            )
        )

        # Average the walk-level percentages per store
        store_totals = {}  # {store_id: {'name': str, 'pcts': [float]}}
        for entry in scores:
            sid = entry['walk__store__id']
            if entry['max_points'] and entry['max_points'] > 0:
                pct = (entry['total_points'] / entry['max_points']) * 100
            else:
                continue
            if sid not in store_totals:
                store_totals[sid] = {'name': entry['walk__store__name'], 'pcts': []}
            store_totals[sid]['pcts'].append(pct)

        return {
            sid: {'name': data['name'], 'avg_pct': sum(data['pcts']) / len(data['pcts'])}
            for sid, data in store_totals.items()
            if data['pcts']
        }

    def _score_target_standings(self, walks, challenge, section_name=''):
        target = float(challenge.target_value) if challenge.target_value else 0

        if section_name:
            section_data = self._section_avg_by_store(walks, section_name)
            sorted_stores = sorted(section_data.items(), key=lambda x: x[1]['avg_pct'], reverse=True)
            result = []
            for idx, (store_id, data) in enumerate(sorted_stores):
                val = round(data['avg_pct'], 1)
                result.append({
                    'rank': idx + 1,
                    'store_id': str(store_id),
                    'store_name': data['name'],
                    'value': val,
                    'meets_target': val >= target,
                })
            return result

        data = (
            walks
            .values('store__id', 'store__name')
            .annotate(avg_score=Avg('total_score'))
            .order_by('-avg_score')
        )
        result = []
        for idx, entry in enumerate(data):
            val = round(float(entry['avg_score']), 1)
            result.append({
                'rank': idx + 1,
                'store_id': str(entry['store__id']),
                'store_name': entry['store__name'],
                'value': val,
                'meets_target': val >= target,
            })
        return result

    def _most_improved_standings(self, walks, challenge):
        duration = challenge.end_date - challenge.start_date
        prev_start = challenge.start_date - duration

        current_avgs = {}
        for entry in walks.values('store__id', 'store__name').annotate(avg=Avg('total_score')):
            current_avgs[entry['store__id']] = {'name': entry['store__name'], 'avg': float(entry['avg'])}

        prev_walks = Walk.objects.filter(
            organization=walks.first().organization if walks.exists() else None,
            status='completed',
            total_score__isnull=False,
            completed_date__date__gte=prev_start,
            completed_date__date__lt=challenge.start_date,
        )
        prior_avgs = {}
        for entry in prev_walks.values('store__id').annotate(avg=Avg('total_score')):
            prior_avgs[entry['store__id']] = float(entry['avg'])

        improvements = []
        for store_id, data in current_avgs.items():
            prior = prior_avgs.get(store_id)
            if prior is not None:
                improvement = data['avg'] - prior
                improvements.append({
                    'store_id': str(store_id),
                    'store_name': data['name'],
                    'value': round(improvement, 1),
                    'meets_target': True,
                })

        improvements.sort(key=lambda x: x['value'], reverse=True)
        for idx, entry in enumerate(improvements):
            entry['rank'] = idx + 1
        return improvements

    def _walk_count_standings(self, walks):
        data = (
            walks
            .values('store__id', 'store__name')
            .annotate(walk_count=Count('id'))
            .order_by('-walk_count')
        )
        result = []
        for idx, entry in enumerate(data):
            result.append({
                'rank': idx + 1,
                'store_id': str(entry['store__id']),
                'store_name': entry['store__name'],
                'value': entry['walk_count'],
                'meets_target': True,
            })
        return result

    def _highest_score_standings(self, walks, section_name=''):
        if section_name:
            section_data = self._section_avg_by_store(walks, section_name)
            sorted_stores = sorted(section_data.items(), key=lambda x: x[1]['avg_pct'], reverse=True)
            result = []
            for idx, (store_id, data) in enumerate(sorted_stores):
                result.append({
                    'rank': idx + 1,
                    'store_id': str(store_id),
                    'store_name': data['name'],
                    'value': round(data['avg_pct'], 1),
                    'meets_target': True,
                })
            return result

        from django.db.models import Max
        data = (
            walks
            .values('store__id', 'store__name')
            .annotate(max_score=Max('total_score'))
            .order_by('-max_score')
        )
        result = []
        for idx, entry in enumerate(data):
            result.append({
                'rank': idx + 1,
                'store_id': str(entry['store__id']),
                'store_name': entry['store__name'],
                'value': round(float(entry['max_score']), 1),
                'meets_target': True,
            })
        return result


class AchievementViewSet(ReadOnlyModelViewSet):
    """Read-only viewset for achievements. Requires gamification_basic (Pro+)."""
    serializer_class = AchievementSerializer
    permission_classes = [IsAuthenticated, IsOrgMember]

    def get_permissions(self):
        return [IsAuthenticated(), IsOrgMember(), HasFeature('gamification_basic')]

    def check_permissions(self, request):
        super().check_permissions(request)
        if not _check_gamification_role(request):
            self.permission_denied(request, message='Gamification is not available for your role.')

    def _has_advanced(self, request):
        """Check if the current plan has gamification_advanced."""
        plan = getattr(request, 'plan', None)
        if plan and plan.has_feature('gamification_advanced'):
            return True
        # Platform admins bypass
        if getattr(request.user, 'is_staff', False) or getattr(request.user, 'is_superuser', False):
            return True
        return False

    def get_queryset(self):
        qs = Achievement.objects.filter(is_active=True)
        if not self._has_advanced(self.request):
            qs = qs.filter(plan_tier='basic')
        return qs

    @action(detail=False, methods=['get'], url_path='awarded')
    def awarded(self, request):
        """Get achievements awarded to stores in this organization."""
        awards = AwardedAchievement.objects.filter(
            organization=request.org,
        ).select_related('achievement', 'store', 'user').order_by('-awarded_at')

        if not self._has_advanced(request):
            awards = awards.filter(achievement__plan_tier='basic')

        store_id = request.query_params.get('store')
        if store_id:
            awards = awards.filter(store_id=store_id)

        serializer = AwardedAchievementSerializer(awards, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='check')
    def check(self, request):
        """Manually trigger achievement check for a specific walk."""
        walk_id = request.data.get('walk_id')
        if not walk_id:
            return Response(
                {'detail': 'walk_id is required.'},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        try:
            walk = Walk.objects.get(id=walk_id, organization=request.org)
        except Walk.DoesNotExist:
            return Response(
                {'detail': 'Walk not found.'},
                status=http_status.HTTP_404_NOT_FOUND,
            )

        from .achievements import check_achievements_for_walk
        has_advanced = self._has_advanced(request)
        newly_awarded = check_achievements_for_walk(walk, include_advanced=has_advanced)
        serializer = AwardedAchievementSerializer(newly_awarded, many=True)
        return Response(serializer.data)


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
