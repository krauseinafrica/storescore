"""
Analytics views for the walks app.

Provides org-wide overview stats, score trends over time, store comparisons,
section-level breakdowns, and CSV export.
"""

import csv
from datetime import timedelta
from decimal import Decimal

from django.db.models import Avg, Count, F, Max, StdDev, Value
from django.db.models.functions import TruncMonth, TruncWeek
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsOrgMember, get_accessible_store_ids

from .models import ReportSchedule, Score, Section, Walk


def _parse_period(period_str):
    """Convert a period string to a start date."""
    now = timezone.now()
    mapping = {
        '30d': now - timedelta(days=30),
        '90d': now - timedelta(days=90),
        '6m': now - timedelta(days=182),
        '1y': now - timedelta(days=365),
        'all': None,
    }
    return mapping.get(period_str, mapping['90d'])


def _completed_walks_qs(request, period_str=None):
    """Return a base queryset of completed walks for the org and period, scoped by role."""
    qs = Walk.objects.filter(
        organization=request.org,
        status=Walk.Status.COMPLETED,
        total_score__isnull=False,
    )

    # Apply role-based store scoping (pass request so platform admins see all)
    accessible_ids = get_accessible_store_ids(request)
    if accessible_ids is not None:
        qs = qs.filter(store_id__in=accessible_ids)

    if period_str is None:
        period_str = '90d'
    start_date = _parse_period(period_str)
    if start_date is not None:
        qs = qs.filter(completed_date__gte=start_date)
    return qs


class OverviewView(APIView):
    """
    GET /api/v1/walks/analytics/overview/

    Org-wide overview statistics.
    Accepts: ?period=30d|90d|6m|1y|all (default: 90d)
    """
    permission_classes = [IsAuthenticated, IsOrgMember]

    def get(self, request):
        period = request.query_params.get('period', '90d')
        walks = _completed_walks_qs(request, period)

        total_walks = walks.count()
        total_stores = walks.values('store').distinct().count()

        agg = walks.aggregate(avg_score=Avg('total_score'))
        avg_score = agg['avg_score']

        # Best store
        best_store_data = (
            walks.values('store__name', 'store__id')
            .annotate(avg=Avg('total_score'))
            .order_by('-avg')
            .first()
        )
        best_store = None
        if best_store_data:
            best_store = {
                'id': str(best_store_data['store__id']),
                'name': best_store_data['store__name'],
                'avg_score': round(float(best_store_data['avg']), 1),
            }

        # Score trend: compare current period avg vs previous period avg
        score_trend = 'stable'
        start_date = _parse_period(period)
        if start_date is not None and avg_score is not None:
            # Calculate the duration of the current period
            now = timezone.now()
            duration = now - start_date
            prev_start = start_date - duration
            prev_walks = Walk.objects.filter(
                organization=request.org,
                status=Walk.Status.COMPLETED,
                total_score__isnull=False,
                completed_date__gte=prev_start,
                completed_date__lt=start_date,
            )
            prev_agg = prev_walks.aggregate(prev_avg=Avg('total_score'))
            prev_avg = prev_agg['prev_avg']
            if prev_avg is not None:
                diff = float(avg_score) - float(prev_avg)
                if diff > 2:
                    score_trend = 'up'
                elif diff < -2:
                    score_trend = 'down'

        return Response({
            'total_walks': total_walks,
            'total_stores_walked': total_stores,
            'avg_score': round(float(avg_score), 1) if avg_score is not None else None,
            'best_store': best_store,
            'score_trend': score_trend,
        })


class TrendsView(APIView):
    """
    GET /api/v1/walks/analytics/trends/

    Score trends over time, grouped by week or month.
    Accepts: ?granularity=weekly|monthly (default: monthly)
             ?period=90d|6m|1y|all
             ?store={id}
    """
    permission_classes = [IsAuthenticated, IsOrgMember]

    def get(self, request):
        period = request.query_params.get('period', '90d')
        granularity = request.query_params.get('granularity', 'monthly')
        store_id = request.query_params.get('store')

        walks = _completed_walks_qs(request, period)

        if store_id:
            walks = walks.filter(store_id=store_id)

        trunc_fn = TruncWeek if granularity == 'weekly' else TruncMonth

        data = (
            walks
            .annotate(period=trunc_fn('completed_date'))
            .values('period')
            .annotate(
                avg_score=Avg('total_score'),
                walk_count=Count('id'),
            )
            .order_by('period')
        )

        result = []
        for entry in data:
            p = entry['period']
            if granularity == 'weekly':
                period_label = p.strftime('%Y-W%W')
            else:
                period_label = p.strftime('%Y-%m')

            result.append({
                'period': period_label,
                'avg_score': round(float(entry['avg_score']), 1),
                'walk_count': entry['walk_count'],
            })

        return Response(result)


class StoreComparisonView(APIView):
    """
    GET /api/v1/walks/analytics/stores/

    Store comparison and ranking.
    Accepts: ?period=90d|6m|1y|all
             ?region={id}
             ?sort=avg_score|-avg_score|walk_count|-walk_count
    """
    permission_classes = [IsAuthenticated, IsOrgMember]

    def get(self, request):
        period = request.query_params.get('period', '90d')
        region_id = request.query_params.get('region')
        sort_param = request.query_params.get('sort', '-avg_score')

        walks = _completed_walks_qs(request, period)

        if region_id:
            walks = walks.filter(store__region_id=region_id)

        store_data = (
            walks
            .values(
                'store__id',
                'store__name',
                'store__store_number',
                'store__region__name',
            )
            .annotate(
                avg_score=Avg('total_score'),
                walk_count=Count('id'),
                last_walk_date=Max('completed_date'),
            )
        )

        # Sort
        allowed_sorts = {
            'avg_score': 'avg_score',
            '-avg_score': '-avg_score',
            'walk_count': 'walk_count',
            '-walk_count': '-walk_count',
        }
        order_field = allowed_sorts.get(sort_param, '-avg_score')
        store_data = store_data.order_by(order_field)

        result = []
        for entry in store_data:
            # Calculate trend: compare latest walk score vs average
            store_id = entry['store__id']
            latest_walk = (
                walks
                .filter(store_id=store_id)
                .order_by('-completed_date')
                .values_list('total_score', flat=True)
                .first()
            )

            trend = 'stable'
            if latest_walk is not None and entry['avg_score'] is not None:
                diff = float(latest_walk) - float(entry['avg_score'])
                if diff > 3:
                    trend = 'improving'
                elif diff < -3:
                    trend = 'declining'

            result.append({
                'store_id': str(store_id),
                'store_name': entry['store__name'],
                'store_number': entry['store__store_number'],
                'region_name': entry['store__region__name'] or '',
                'avg_score': round(float(entry['avg_score']), 1),
                'walk_count': entry['walk_count'],
                'last_walk_date': (
                    entry['last_walk_date'].isoformat()
                    if entry['last_walk_date'] else None
                ),
                'trend': trend,
            })

        return Response(result)


class SectionBreakdownView(APIView):
    """
    GET /api/v1/walks/analytics/sections/

    Section-level breakdown with per-criterion averages.
    Accepts: ?period=90d|6m|1y|all
             ?store={id}
    """
    permission_classes = [IsAuthenticated, IsOrgMember]

    def get(self, request):
        period = request.query_params.get('period', '90d')
        store_id = request.query_params.get('store')

        walks = _completed_walks_qs(request, period)

        if store_id:
            walks = walks.filter(store_id=store_id)

        walk_ids = walks.values_list('id', flat=True)

        if not walk_ids:
            return Response([])

        # Get all scores for these walks
        scores = Score.objects.filter(walk_id__in=walk_ids).select_related(
            'criterion__section'
        )

        # Get all sections from templates used in these walks
        template_ids = walks.values_list('template_id', flat=True).distinct()
        sections = (
            Section.objects.filter(template_id__in=template_ids)
            .prefetch_related('criteria')
            .order_by('order')
        )

        result = []
        for section in sections:
            criteria_data = []
            section_total_pct = Decimal('0')
            criteria_count = 0

            for criterion in section.criteria.all().order_by('order'):
                criterion_scores = scores.filter(criterion=criterion)
                agg = criterion_scores.aggregate(avg_points=Avg('points'))
                avg_points = agg['avg_points']

                if avg_points is not None:
                    avg_pct = (float(avg_points) / criterion.max_points) * 100
                else:
                    avg_pct = 0.0
                    avg_points = 0

                criteria_data.append({
                    'name': criterion.name,
                    'avg_points': round(float(avg_points), 1) if avg_points else 0,
                    'max_points': criterion.max_points,
                    'avg_percentage': round(avg_pct, 1),
                })

                section_total_pct += Decimal(str(avg_pct))
                criteria_count += 1

            section_avg_pct = (
                float(section_total_pct / criteria_count)
                if criteria_count > 0
                else 0.0
            )

            result.append({
                'section_name': section.name,
                'avg_percentage': round(section_avg_pct, 1),
                'criteria': criteria_data,
            })

        return Response(result)


class StoreScorecardView(APIView):
    """
    GET /api/v1/walks/analytics/scorecard/:store_id/

    Store scorecard: latest walk details, score history, section trends.
    Accepts: ?period=90d|6m|1y|all
    """
    permission_classes = [IsAuthenticated, IsOrgMember]

    def get(self, request, store_id):
        period = request.query_params.get('period', '1y')
        walks = _completed_walks_qs(request, period).filter(store_id=store_id)

        if not walks.exists():
            return Response({
                'store_id': str(store_id),
                'latest_walk': None,
                'walk_count': 0,
                'avg_score': None,
                'score_history': [],
                'section_trends': [],
            })

        # Latest walk
        latest = walks.order_by('-completed_date').first()
        latest_data = None
        if latest:
            latest_data = {
                'id': str(latest.id),
                'date': latest.completed_date.isoformat() if latest.completed_date else None,
                'total_score': float(latest.total_score) if latest.total_score else None,
                'conducted_by': f'{latest.conducted_by.first_name} {latest.conducted_by.last_name}'.strip(),
            }

        # Aggregate stats
        agg = walks.aggregate(
            avg_score=Avg('total_score'),
            walk_count=Count('id'),
        )

        # Score history (all walks over time)
        history = (
            walks.order_by('completed_date')
            .values_list('completed_date', 'total_score', 'id')
        )
        score_history = [
            {
                'date': h[0].isoformat() if h[0] else None,
                'score': round(float(h[1]), 1) if h[1] else None,
                'walk_id': str(h[2]),
            }
            for h in history
        ]

        # Section trends: avg score per section per month
        walk_ids = walks.values_list('id', flat=True)
        scores = Score.objects.filter(walk_id__in=walk_ids).select_related(
            'criterion__section', 'walk'
        )

        template_ids = walks.values_list('template_id', flat=True).distinct()
        sections = (
            Section.objects.filter(template_id__in=template_ids)
            .order_by('order')
        )

        section_trends = []
        for section in sections:
            monthly_data = (
                scores.filter(criterion__section=section)
                .annotate(month=TruncMonth('walk__completed_date'))
                .values('month')
                .annotate(
                    avg_pct=Avg('points') * Decimal('100') / Decimal(str(section.criteria.first().max_points if section.criteria.exists() else 10)),
                )
                .order_by('month')
            )
            # Recalculate properly
            section_monthly = []
            for entry in (
                scores.filter(criterion__section=section)
                .annotate(month=TruncMonth('walk__completed_date'))
                .values('month')
                .annotate(avg_points=Avg('points'))
                .order_by('month')
            ):
                max_pts = section.criteria.first().max_points if section.criteria.exists() else 10
                pct = (float(entry['avg_points']) / max_pts) * 100
                section_monthly.append({
                    'month': entry['month'].strftime('%Y-%m'),
                    'avg_percentage': round(pct, 1),
                })

            section_trends.append({
                'section_name': section.name,
                'monthly': section_monthly,
            })

        return Response({
            'store_id': str(store_id),
            'latest_walk': latest_data,
            'walk_count': agg['walk_count'],
            'avg_score': round(float(agg['avg_score']), 1) if agg['avg_score'] else None,
            'score_history': score_history,
            'section_trends': section_trends,
        })


class RegionComparisonView(APIView):
    """
    GET /api/v1/walks/analytics/regions/

    Region-level comparison: avg scores, walk counts, store counts per region.
    Accepts: ?period=90d|6m|1y|all
    """
    permission_classes = [IsAuthenticated, IsOrgMember]

    def get(self, request):
        period = request.query_params.get('period', '90d')
        walks = _completed_walks_qs(request, period).select_related('store__region')

        region_data = (
            walks.filter(store__region__isnull=False)
            .values('store__region__id', 'store__region__name')
            .annotate(
                avg_score=Avg('total_score'),
                walk_count=Count('id'),
                store_count=Count('store', distinct=True),
            )
            .order_by('-avg_score')
        )

        result = []
        for entry in region_data:
            # Best and worst store in region
            region_walks = walks.filter(store__region_id=entry['store__region__id'])
            store_scores = (
                region_walks.values('store__id', 'store__name')
                .annotate(avg=Avg('total_score'))
                .order_by('-avg')
            )
            best = store_scores.first()
            worst = store_scores.last()

            result.append({
                'region_id': str(entry['store__region__id']),
                'region_name': entry['store__region__name'],
                'avg_score': round(float(entry['avg_score']), 1),
                'walk_count': entry['walk_count'],
                'store_count': entry['store_count'],
                'best_store': {
                    'id': str(best['store__id']),
                    'name': best['store__name'],
                    'avg_score': round(float(best['avg']), 1),
                } if best else None,
                'worst_store': {
                    'id': str(worst['store__id']),
                    'name': worst['store__name'],
                    'avg_score': round(float(worst['avg']), 1),
                } if worst else None,
            })

        return Response(result)


class SectionTrendsView(APIView):
    """
    GET /api/v1/walks/analytics/section-trends/

    Section-level score trends over time (monthly).
    Accepts: ?period=90d|6m|1y|all
             ?store={id}
    """
    permission_classes = [IsAuthenticated, IsOrgMember]

    def get(self, request):
        period = request.query_params.get('period', '6m')
        store_id = request.query_params.get('store')

        walks = _completed_walks_qs(request, period)
        if store_id:
            walks = walks.filter(store_id=store_id)

        walk_ids = walks.values_list('id', flat=True)
        if not walk_ids:
            return Response([])

        scores = Score.objects.filter(walk_id__in=walk_ids).select_related(
            'criterion__section', 'walk'
        )

        template_ids = walks.values_list('template_id', flat=True).distinct()
        sections = (
            Section.objects.filter(template_id__in=template_ids)
            .prefetch_related('criteria')
            .order_by('order')
        )

        result = []
        for section in sections:
            criteria = list(section.criteria.all())
            if not criteria:
                continue

            total_max = sum(c.max_points for c in criteria)

            monthly = (
                scores.filter(criterion__section=section)
                .annotate(month=TruncMonth('walk__completed_date'))
                .values('month')
                .annotate(
                    total_avg_points=Avg('points'),
                    score_count=Count('id'),
                )
                .order_by('month')
            )

            points = []
            for entry in monthly:
                # Average percentage for the section that month
                avg_pts = float(entry['total_avg_points'])
                avg_max = total_max / len(criteria) if criteria else 10
                pct = (avg_pts / avg_max) * 100 if avg_max > 0 else 0

                points.append({
                    'month': entry['month'].strftime('%Y-%m'),
                    'avg_percentage': round(pct, 1),
                })

            result.append({
                'section_name': section.name,
                'points': points,
            })

        return Response(result)


class ExportCSVView(APIView):
    """
    GET /api/v1/walks/analytics/export/

    CSV export of walk data.
    Accepts: ?period=90d|6m|1y|all
             ?store={id}
             ?format=csv
    """
    permission_classes = [IsAuthenticated, IsOrgMember]

    def get(self, request):
        period = request.query_params.get('period', '90d')
        store_id = request.query_params.get('store')

        walks = _completed_walks_qs(request, period).select_related(
            'store', 'store__region', 'conducted_by', 'template',
        ).order_by('-completed_date')

        if store_id:
            walks = walks.filter(store_id=store_id)

        # Get all section names for the column headers
        template_ids = walks.values_list('template_id', flat=True).distinct()
        sections = (
            Section.objects.filter(template_id__in=template_ids)
            .order_by('order')
        )
        section_names = list(sections.values_list('name', flat=True).distinct())

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="storescore_export.csv"'

        writer = csv.writer(response)

        # Header row
        header = [
            'Walk Date',
            'Store',
            'Store Number',
            'Region',
            'Evaluator',
            'Total Score',
        ]
        header.extend(section_names)
        header.append('Status')
        writer.writerow(header)

        # Data rows
        for walk in walks:
            evaluator_name = (
                f'{walk.conducted_by.first_name} {walk.conducted_by.last_name}'.strip()
                or walk.conducted_by.email
            )

            row = [
                walk.completed_date.strftime('%Y-%m-%d') if walk.completed_date else '',
                walk.store.name,
                walk.store.store_number,
                walk.store.region.name if walk.store.region else '',
                evaluator_name,
                f'{walk.total_score:.1f}%' if walk.total_score is not None else '',
            ]

            # Calculate section scores for this walk
            walk_scores = Score.objects.filter(walk=walk).select_related(
                'criterion__section'
            )

            for section_name in section_names:
                section_criteria_scores = walk_scores.filter(
                    criterion__section__name=section_name
                )
                if section_criteria_scores.exists():
                    total_earned = sum(s.points for s in section_criteria_scores)
                    total_max = sum(
                        s.criterion.max_points for s in section_criteria_scores
                    )
                    if total_max > 0:
                        pct = (total_earned / total_max) * 100
                        row.append(f'{pct:.1f}%')
                    else:
                        row.append('')
                else:
                    row.append('')

            row.append(walk.get_status_display())
            writer.writerow(row)

        return response


class ReportScheduleView(APIView):
    """
    GET  /api/v1/walks/analytics/report-schedules/
        List the current user's report subscriptions for the org.

    POST /api/v1/walks/analytics/report-schedules/
        Create or update a report subscription.
        Body: {"frequency": "weekly"|"monthly", "is_active": true}

    DELETE /api/v1/walks/analytics/report-schedules/
        Delete a subscription.
        Body: {"frequency": "weekly"|"monthly"}
    """
    permission_classes = [IsAuthenticated, IsOrgMember]

    def get(self, request):
        schedules = ReportSchedule.objects.filter(
            organization=request.org,
            user=request.user,
        )
        data = [
            {
                'id': str(s.id),
                'frequency': s.frequency,
                'is_active': s.is_active,
                'last_sent_at': s.last_sent_at.isoformat() if s.last_sent_at else None,
            }
            for s in schedules
        ]
        return Response(data)

    def post(self, request):
        frequency = request.data.get('frequency')
        if frequency not in ('weekly', 'monthly'):
            return Response(
                {'detail': 'frequency must be "weekly" or "monthly"'},
                status=400,
            )

        is_active = request.data.get('is_active', True)

        schedule, created = ReportSchedule.objects.update_or_create(
            organization=request.org,
            user=request.user,
            frequency=frequency,
            defaults={'is_active': is_active},
        )

        return Response({
            'id': str(schedule.id),
            'frequency': schedule.frequency,
            'is_active': schedule.is_active,
            'last_sent_at': schedule.last_sent_at.isoformat() if schedule.last_sent_at else None,
        }, status=201 if created else 200)

    def delete(self, request):
        frequency = request.data.get('frequency')
        if frequency not in ('weekly', 'monthly'):
            return Response(
                {'detail': 'frequency must be "weekly" or "monthly"'},
                status=400,
            )

        deleted, _ = ReportSchedule.objects.filter(
            organization=request.org,
            user=request.user,
            frequency=frequency,
        ).delete()

        if deleted:
            return Response(status=204)
        return Response({'detail': 'Not found'}, status=404)


class EvaluatorConsistencyView(APIView):
    """
    GET /api/v1/walks/analytics/evaluator-consistency/

    Detect evaluators with suspiciously uniform scoring patterns.
    Flags evaluators who routinely give the same score (e.g., all 4s or all 5s),
    indicating they may not be evaluating stores carefully.

    Accepts: ?period=30d|90d|6m|1y|all (default: 90d)
             ?min_walks=3 (minimum walks to include in analysis)

    Returns per-evaluator:
    - avg_score, score_std_dev (standard deviation across all criterion scores)
    - dominant_score (the score value they give most often)
    - dominant_score_pct (what % of their scores are the dominant value)
    - unique_score_values (how many distinct score values they use)
    - flag_level: 'high' (>80% same score), 'medium' (>60%), 'normal'
    """
    permission_classes = [IsAuthenticated, IsOrgMember]

    def get(self, request):
        period = request.query_params.get('period', '90d')
        min_walks = int(request.query_params.get('min_walks', '3'))

        walks = _completed_walks_qs(request, period)

        # Get evaluators with enough walks
        evaluator_data = (
            walks.values('conducted_by__id', 'conducted_by__first_name', 'conducted_by__last_name', 'conducted_by__email')
            .annotate(walk_count=Count('id'), avg_total_score=Avg('total_score'))
            .filter(walk_count__gte=min_walks)
            .order_by('-walk_count')
        )

        result = []
        for ev in evaluator_data:
            user_id = ev['conducted_by__id']
            name = f"{ev['conducted_by__first_name']} {ev['conducted_by__last_name']}".strip()
            if not name:
                name = ev['conducted_by__email']

            # Get all individual criterion scores for this evaluator's walks
            ev_walk_ids = walks.filter(conducted_by_id=user_id).values_list('id', flat=True)
            scores = Score.objects.filter(walk_id__in=ev_walk_ids)
            total_scores = scores.count()

            if total_scores == 0:
                continue

            # Aggregate: std dev, distinct values
            agg = scores.aggregate(
                score_std_dev=StdDev('points'),
                avg_points=Avg('points'),
            )
            std_dev = float(agg['score_std_dev'] or 0)
            avg_points = float(agg['avg_points'] or 0)

            # Find dominant score (most frequent value)
            score_distribution = (
                scores.values('points')
                .annotate(count=Count('id'))
                .order_by('-count')
            )
            score_dist_list = list(score_distribution)
            dominant = score_dist_list[0] if score_dist_list else {'points': 0, 'count': 0}
            dominant_score = dominant['points']
            dominant_pct = round((dominant['count'] / total_scores) * 100, 1) if total_scores > 0 else 0

            unique_values = len(score_dist_list)

            # Build distribution map (e.g., {1: 5, 2: 10, 3: 20, 4: 50, 5: 15})
            distribution = {entry['points']: entry['count'] for entry in score_dist_list}

            # Flag level
            if dominant_pct >= 80:
                flag_level = 'high'
            elif dominant_pct >= 60:
                flag_level = 'medium'
            else:
                flag_level = 'normal'

            # Per-store breakdown: avg score per store for this evaluator
            store_scores = (
                walks.filter(conducted_by_id=user_id)
                .values('store__id', 'store__name')
                .annotate(avg=Avg('total_score'), cnt=Count('id'))
                .order_by('-avg')
            )
            store_score_range = 0
            stores_list = []
            store_avgs = []
            for ss in store_scores:
                avg = round(float(ss['avg']), 1) if ss['avg'] else 0
                store_avgs.append(avg)
                stores_list.append({
                    'store_id': str(ss['store__id']),
                    'store_name': ss['store__name'],
                    'avg_score': avg,
                    'walk_count': ss['cnt'],
                })
            if store_avgs:
                store_score_range = round(max(store_avgs) - min(store_avgs), 1)

            result.append({
                'evaluator_id': str(user_id),
                'evaluator_name': name,
                'walk_count': ev['walk_count'],
                'avg_total_score': round(float(ev['avg_total_score']), 1) if ev['avg_total_score'] else None,
                'avg_criterion_score': round(avg_points, 2),
                'score_std_dev': round(std_dev, 2),
                'dominant_score': dominant_score,
                'dominant_score_pct': dominant_pct,
                'unique_score_values': unique_values,
                'score_distribution': distribution,
                'flag_level': flag_level,
                'total_criterion_scores': total_scores,
                'store_score_range': store_score_range,
                'stores': stores_list,
            })

        # Sort: flagged evaluators first
        flag_order = {'high': 0, 'medium': 1, 'normal': 2}
        result.sort(key=lambda x: (flag_order.get(x['flag_level'], 2), -x['walk_count']))

        return Response(result)
