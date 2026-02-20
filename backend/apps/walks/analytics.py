"""
Analytics views for the walks app.

Provides org-wide overview stats, score trends over time, store comparisons,
section-level breakdowns, and CSV export.
"""

import csv
import statistics
from collections import defaultdict
from datetime import timedelta
from decimal import Decimal

from django.db.models import Avg, Count, F, Max, Q as models_Q, StdDev, Value
from django.db.models.functions import Coalesce, TruncMonth, TruncWeek
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsOrgMember, get_accessible_store_ids

from .models import ActionItem, Driver, ReportSchedule, Score, Section, Walk


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

        # Pre-aggregate all criterion averages in a single query
        criterion_avgs = dict(
            Score.objects.filter(walk_id__in=walk_ids)
            .values('criterion_id')
            .annotate(avg_points=Avg('points'))
            .values_list('criterion_id', 'avg_points')
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
                avg_points = criterion_avgs.get(criterion.id)

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
                'action_items': {
                    'total': 0,
                    'open': 0,
                    'resolved': 0,
                    'avg_resolution_days': None,
                },
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

        # Action items for this store
        store_action_items = ActionItem.objects.filter(
            organization=request.org,
            walk_id__in=walk_ids,
        )
        ai_total = store_action_items.count()
        ai_open = store_action_items.filter(
            status__in=['open', 'in_progress'],
        ).count()
        ai_resolved = store_action_items.filter(
            status__in=['resolved', 'pending_review', 'approved'],
        ).count()
        ai_avg_resolution = None
        resolved_ai = store_action_items.filter(
            resolved_at__isnull=False,
        )
        if resolved_ai.exists():
            res_days = []
            for ai in resolved_ai:
                delta = ai.resolved_at - ai.created_at
                res_days.append(delta.total_seconds() / 86400)
            ai_avg_resolution = round(sum(res_days) / len(res_days), 1) if res_days else None

        return Response({
            'store_id': str(store_id),
            'latest_walk': latest_data,
            'walk_count': agg['walk_count'],
            'avg_score': round(float(agg['avg_score']), 1) if agg['avg_score'] else None,
            'score_history': score_history,
            'section_trends': section_trends,
            'action_items': {
                'total': ai_total,
                'open': ai_open,
                'resolved': ai_resolved,
                'avg_resolution_days': ai_avg_resolution,
            },
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

        template_ids = walks.values_list('template_id', flat=True).distinct()
        sections = (
            Section.objects.filter(template_id__in=template_ids)
            .prefetch_related('criteria')
            .order_by('order')
        )

        # Pre-compute per-section max_points to avoid repeated queries
        section_meta = {}  # section_id -> {name, order, avg_max}
        for section in sections:
            criteria = list(section.criteria.all())
            if not criteria:
                continue
            total_max = sum(c.max_points for c in criteria)
            avg_max = total_max / len(criteria) if criteria else 10
            section_meta[section.id] = {
                'name': section.name,
                'order': section.order,
                'avg_max': avg_max,
            }

        if not section_meta:
            return Response([])

        # Single aggregation query across all sections, grouped by section + month
        monthly_data = (
            Score.objects.filter(
                walk_id__in=walk_ids,
                criterion__section_id__in=section_meta.keys(),
            )
            .annotate(month=TruncMonth('walk__completed_date'))
            .values('criterion__section_id', 'month')
            .annotate(
                total_avg_points=Avg('points'),
                score_count=Count('id'),
            )
            .order_by('criterion__section_id', 'month')
        )

        # Group results by section
        section_monthly_map = defaultdict(list)
        for entry in monthly_data:
            sid = entry['criterion__section_id']
            meta = section_meta.get(sid)
            if not meta:
                continue
            avg_pts = float(entry['total_avg_points'])
            avg_max = meta['avg_max']
            pct = (avg_pts / avg_max) * 100 if avg_max > 0 else 0
            section_monthly_map[sid].append({
                'month': entry['month'].strftime('%Y-%m'),
                'avg_percentage': round(pct, 1),
            })

        # Build result in section order
        result = []
        for sid, meta in sorted(section_meta.items(), key=lambda x: x[1]['order']):
            result.append({
                'section_name': meta['name'],
                'points': section_monthly_map.get(sid, []),
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


class SectionStoreComparisonView(APIView):
    """
    GET /api/v1/walks/analytics/section-stores/

    Per-store average % for a given section, with per-criterion breakdown.
    Accepts: ?section={name}&period=90d
    """
    permission_classes = [IsAuthenticated, IsOrgMember]

    def get(self, request):
        section_name = request.query_params.get('section', '')
        period = request.query_params.get('period', '90d')

        if not section_name:
            return Response({'detail': 'section parameter required'}, status=400)

        walks = _completed_walks_qs(request, period)
        walk_ids = walks.values_list('id', flat=True)

        if not walk_ids:
            return Response({
                'section_name': section_name,
                'org_avg': 0,
                'stores': [],
                'criteria': [],
            })

        # Get scores for this section
        scores = Score.objects.filter(
            walk_id__in=walk_ids,
            criterion__section__name=section_name,
        ).select_related('criterion', 'walk__store')

        if not scores.exists():
            return Response({
                'section_name': section_name,
                'org_avg': 0,
                'stores': [],
                'criteria': [],
            })

        # Org-wide avg per criterion
        criteria_data = (
            scores.values('criterion__name', 'criterion__max_points')
            .annotate(avg_pts=Avg('points'))
            .order_by('criterion__name')
        )
        criteria_list = []
        org_total_pct = 0
        for c in criteria_data:
            max_pts = c['criterion__max_points'] or 1
            pct = (float(c['avg_pts']) / max_pts) * 100
            criteria_list.append({
                'name': c['criterion__name'],
                'avg_percentage': round(pct, 1),
            })
            org_total_pct += pct
        org_avg = round(org_total_pct / len(criteria_list), 1) if criteria_list else 0

        # Per-store averages
        store_data = (
            scores.values('walk__store__id', 'walk__store__name')
            .annotate(avg_pts=Avg('points'), walk_count=Count('walk', distinct=True))
            .order_by('walk__store__name')
        )

        # Get max_points for the section's criteria
        section_criteria = scores.values_list('criterion__max_points', flat=True).distinct()
        avg_max = sum(section_criteria) / len(section_criteria) if section_criteria else 1

        stores = []
        for s in store_data:
            pct = (float(s['avg_pts']) / avg_max) * 100
            stores.append({
                'store_id': str(s['walk__store__id']),
                'store_name': s['walk__store__name'],
                'avg_percentage': round(pct, 1),
                'walk_count': s['walk_count'],
            })

        return Response({
            'section_name': section_name,
            'org_avg': org_avg,
            'stores': stores,
            'criteria': criteria_list,
        })


class EvaluatorTrendsView(APIView):
    """
    GET /api/v1/walks/analytics/evaluator-trends/{evaluator_id}/

    Monthly score trend + section bias for one evaluator.
    Accepts: ?period=90d
    """
    permission_classes = [IsAuthenticated, IsOrgMember]

    def get(self, request, evaluator_id):
        period = request.query_params.get('period', '90d')
        walks = _completed_walks_qs(request, period)

        ev_walks = walks.filter(conducted_by_id=evaluator_id)
        if not ev_walks.exists():
            return Response({
                'evaluator_id': str(evaluator_id),
                'evaluator_name': '',
                'monthly_scores': [],
                'section_bias': [],
                'store_comparison': [],
            })

        # Get evaluator name
        first_walk = ev_walks.select_related('conducted_by').first()
        name = f'{first_walk.conducted_by.first_name} {first_walk.conducted_by.last_name}'.strip()
        if not name:
            name = first_walk.conducted_by.email

        # Monthly scores: evaluator avg vs org avg
        ev_monthly = (
            ev_walks.annotate(month=TruncMonth('completed_date'))
            .values('month')
            .annotate(avg_score=Avg('total_score'), walk_count=Count('id'))
            .order_by('month')
        )

        org_monthly = (
            walks.annotate(month=TruncMonth('completed_date'))
            .values('month')
            .annotate(avg_score=Avg('total_score'))
            .order_by('month')
        )
        org_monthly_map = {
            entry['month'].strftime('%Y-%m'): round(float(entry['avg_score']), 1)
            for entry in org_monthly if entry['avg_score']
        }

        monthly_scores = []
        for entry in ev_monthly:
            month_str = entry['month'].strftime('%Y-%m')
            monthly_scores.append({
                'month': month_str,
                'avg_score': round(float(entry['avg_score']), 1) if entry['avg_score'] else 0,
                'org_avg': org_monthly_map.get(month_str, 0),
                'walk_count': entry['walk_count'],
            })

        # Section bias: evaluator avg vs org avg per section
        ev_walk_ids = ev_walks.values_list('id', flat=True)
        all_walk_ids = walks.values_list('id', flat=True)

        template_ids = walks.values_list('template_id', flat=True).distinct()
        sections = Section.objects.filter(template_id__in=template_ids).order_by('order')

        section_bias = []
        for section in sections:
            criteria = list(section.criteria.all())
            if not criteria:
                continue
            avg_max = sum(c.max_points for c in criteria) / len(criteria)

            ev_scores = Score.objects.filter(
                walk_id__in=ev_walk_ids,
                criterion__section=section,
            ).aggregate(avg=Avg('points'))

            org_scores = Score.objects.filter(
                walk_id__in=all_walk_ids,
                criterion__section=section,
            ).aggregate(avg=Avg('points'))

            ev_avg = (float(ev_scores['avg']) / avg_max) * 100 if ev_scores['avg'] else 0
            org_avg = (float(org_scores['avg']) / avg_max) * 100 if org_scores['avg'] else 0

            section_bias.append({
                'section_name': section.name,
                'evaluator_avg': round(ev_avg, 1),
                'org_avg': round(org_avg, 1),
                'difference': round(ev_avg - org_avg, 1),
            })

        # Store comparison: evaluator avg vs org avg per store
        ev_store_scores = (
            ev_walks.values('store__id', 'store__name')
            .annotate(ev_avg=Avg('total_score'))
            .order_by('store__name')
        )

        store_comparison = []
        for ss in ev_store_scores:
            org_store_avg = (
                walks.filter(store_id=ss['store__id'])
                .aggregate(avg=Avg('total_score'))
            )
            store_comparison.append({
                'store_id': str(ss['store__id']),
                'store_name': ss['store__name'],
                'evaluator_avg': round(float(ss['ev_avg']), 1) if ss['ev_avg'] else 0,
                'org_avg': round(float(org_store_avg['avg']), 1) if org_store_avg['avg'] else 0,
            })

        return Response({
            'evaluator_id': str(evaluator_id),
            'evaluator_name': name,
            'monthly_scores': monthly_scores,
            'section_bias': section_bias,
            'store_comparison': store_comparison,
        })


class ActionItemAnalyticsView(APIView):
    """
    GET /api/v1/walks/analytics/action-items/

    Aggregate action item statistics.
    Accepts: ?period=90d
    """
    permission_classes = [IsAuthenticated, IsOrgMember]

    def get(self, request):
        period = request.query_params.get('period', '90d')
        start_date = _parse_period(period)

        # Include ALL action items (both walk-linked and assessment-linked)
        items = ActionItem.objects.filter(organization=request.org)

        # Apply role-based store scoping
        accessible_ids = get_accessible_store_ids(request)
        if accessible_ids is not None:
            items = items.filter(
                models_Q(walk__store_id__in=accessible_ids)
                | models_Q(store_id__in=accessible_ids)
            )

        if start_date is not None:
            items = items.filter(created_at__gte=start_date)

        total = items.count()
        if total == 0:
            return Response({
                'total': 0,
                'open': 0,
                'in_progress': 0,
                'resolved': 0,
                'pending_review': 0,
                'approved': 0,
                'dismissed': 0,
                'avg_resolution_days': None,
                'by_store': [],
                'by_section': [],
                'by_priority': [],
                'monthly_trend': [],
            })

        # Status counts
        status_counts = dict(
            items.values('status')
            .annotate(count=Count('id'))
            .values_list('status', 'count')
        )

        # Average resolution time
        resolved_items = items.filter(
            status=ActionItem.Status.RESOLVED,
            resolved_at__isnull=False,
        )
        avg_resolution = None
        if resolved_items.exists():
            total_days = 0
            count = 0
            for item in resolved_items:
                delta = item.resolved_at - item.created_at
                total_days += delta.total_seconds() / 86400
                count += 1
            avg_resolution = round(total_days / count, 1) if count > 0 else None

        # By store — use direct store FK (falls back to walk__store for older items)
        by_store = (
            items.annotate(
                effective_store_id=Coalesce('store_id', 'walk__store_id'),
                effective_store_name=Coalesce('store__name', 'walk__store__name'),
            )
            .values('effective_store_id', 'effective_store_name')
            .annotate(
                total=Count('id'),
                open=Count('id', filter=models_Q(status='open')),
                resolved=Count('id', filter=models_Q(status='resolved')),
            )
            .order_by('-total')
        )
        store_list = [
            {
                'store_id': str(s['effective_store_id']),
                'store_name': s['effective_store_name'],
                'total': s['total'],
                'open': s['open'],
                'resolved': s['resolved'],
            }
            for s in by_store if s['effective_store_id']
        ]

        # By section (only relevant for walk-linked items with criteria)
        by_section = (
            items.filter(criterion__isnull=False)
            .values('criterion__section__name')
            .annotate(count=Count('id'))
            .order_by('-count')
        )
        section_list = [
            {'section_name': s['criterion__section__name'], 'count': s['count']}
            for s in by_section if s['criterion__section__name']
        ]

        # By priority
        by_priority = (
            items.values('priority')
            .annotate(count=Count('id'))
            .order_by('-count')
        )
        priority_list = [
            {'priority': p['priority'], 'count': p['count']}
            for p in by_priority
        ]

        # Monthly trend
        monthly = (
            items.annotate(month=TruncMonth('created_at'))
            .values('month')
            .annotate(
                created=Count('id'),
                resolved=Count('id', filter=models_Q(status='resolved')),
            )
            .order_by('month')
        )
        monthly_list = [
            {
                'month': m['month'].strftime('%Y-%m'),
                'created': m['created'],
                'resolved': m['resolved'],
            }
            for m in monthly
        ]

        return Response({
            'total': total,
            'open': status_counts.get('open', 0),
            'in_progress': status_counts.get('in_progress', 0),
            'resolved': status_counts.get('resolved', 0),
            'pending_review': status_counts.get('pending_review', 0),
            'approved': status_counts.get('approved', 0),
            'dismissed': status_counts.get('dismissed', 0),
            'avg_resolution_days': avg_resolution,
            'by_store': store_list,
            'by_section': section_list,
            'by_priority': priority_list,
            'monthly_trend': monthly_list,
        })


class DriverAnalyticsView(APIView):
    """
    GET /api/v1/walks/analytics/drivers/

    Aggregate driver selection statistics.
    Accepts: ?period=90d
    """
    permission_classes = [IsAuthenticated, IsOrgMember]

    def get(self, request):
        period = request.query_params.get('period', '90d')
        walks = _completed_walks_qs(request, period)
        walk_ids = walks.values_list('id', flat=True)

        # Count configured drivers
        template_ids = walks.values_list('template_id', flat=True).distinct()
        total_configured = Driver.objects.filter(
            criterion__section__template_id__in=template_ids,
            is_active=True,
        ).count()

        # Get scores with drivers (M2M)
        scores_with_drivers = Score.objects.filter(
            walk_id__in=walk_ids,
            drivers__isnull=False,
        ).distinct()

        # Also check legacy FK driver
        scores_with_legacy = Score.objects.filter(
            walk_id__in=walk_ids,
            driver__isnull=False,
        )

        # Combine driver selections
        # M2M: count per driver
        m2m_counts = (
            scores_with_drivers
            .values('drivers__id', 'drivers__name', 'drivers__criterion__name')
            .annotate(count=Count('id'))
            .order_by('-count')
        )

        # Legacy FK: count per driver
        legacy_counts = (
            scores_with_legacy
            .values('driver__id', 'driver__name', 'driver__criterion__name')
            .annotate(count=Count('id'))
            .order_by('-count')
        )

        # Merge driver counts
        driver_counts = {}
        for d in m2m_counts:
            key = str(d['drivers__id'])
            driver_counts[key] = {
                'name': d['drivers__name'],
                'count': d['count'],
                'criterion_name': d['drivers__criterion__name'],
            }
        for d in legacy_counts:
            key = str(d['driver__id'])
            if key in driver_counts:
                driver_counts[key]['count'] += d['count']
            else:
                driver_counts[key] = {
                    'name': d['driver__name'],
                    'count': d['count'],
                    'criterion_name': d['driver__criterion__name'],
                }

        total_selections = sum(d['count'] for d in driver_counts.values())
        top_drivers = sorted(driver_counts.values(), key=lambda x: -x['count'])[:10]

        # By section
        section_drivers = (
            scores_with_drivers
            .values('criterion__section__name')
            .annotate(count=Count('drivers', distinct=False))
            .order_by('-count')
        )
        by_section = []
        for sd in section_drivers:
            # Get top driver for this section
            top = (
                scores_with_drivers.filter(criterion__section__name=sd['criterion__section__name'])
                .values('drivers__name')
                .annotate(cnt=Count('id'))
                .order_by('-cnt')
                .first()
            )
            by_section.append({
                'section_name': sd['criterion__section__name'],
                'count': sd['count'],
                'top_driver': top['drivers__name'] if top else None,
            })

        # By store
        by_store = (
            scores_with_drivers
            .values('walk__store__id', 'walk__store__name')
            .annotate(count=Count('drivers', distinct=False))
            .order_by('-count')
        )
        store_list = [
            {
                'store_id': str(s['walk__store__id']),
                'store_name': s['walk__store__name'],
                'count': s['count'],
            }
            for s in by_store
        ]

        # Monthly trend
        monthly = (
            scores_with_drivers
            .annotate(month=TruncMonth('walk__completed_date'))
            .values('month')
            .annotate(count=Count('drivers', distinct=False))
            .order_by('month')
        )
        monthly_list = [
            {'month': m['month'].strftime('%Y-%m'), 'count': m['count']}
            for m in monthly
        ]

        return Response({
            'total_selections': total_selections,
            'total_configured': total_configured,
            'top_drivers': top_drivers,
            'by_section': by_section,
            'by_store': store_list,
            'monthly_trend': monthly_list,
        })


# SLA thresholds in days: {priority: (green_max, amber_max)}
# red = anything above amber_max
SLA_THRESHOLDS = {
    'critical': (1, 3),
    'high': (3, 7),
    'medium': (7, 14),
    'low': (14, 30),
}


class ResolutionAnalyticsView(APIView):
    """
    GET /api/v1/walks/analytics/resolution/

    Resolution time analytics: how quickly action items get resolved,
    broken down by priority level with SLA compliance tracking.

    Accepts: ?period=90d|6m|1y|all (default: 90d)
    """
    permission_classes = [IsAuthenticated, IsOrgMember]

    def get(self, request):
        period = request.query_params.get('period', '90d')
        start_date = _parse_period(period)

        # Base queryset: all action items in this org within the period
        items = ActionItem.objects.filter(organization=request.org)

        # Apply role-based store scoping
        accessible_ids = get_accessible_store_ids(request)
        if accessible_ids is not None:
            items = items.filter(
                models_Q(walk__store_id__in=accessible_ids)
                | models_Q(store_id__in=accessible_ids)
            )

        if start_date is not None:
            items = items.filter(created_at__gte=start_date)

        total = items.count()
        if total == 0:
            return Response({
                'summary': {
                    'avg_resolution_days': None,
                    'median_resolution_days': None,
                    'total_resolved': 0,
                    'total_approved': 0,
                    'avg_approval_days': None,
                },
                'by_priority': [],
                'by_store': [],
                'by_region': [],
                'monthly_trend': [],
            })

        # ---- Summary ----
        resolved_items = list(
            items.filter(
                resolved_at__isnull=False,
            ).values_list('created_at', 'resolved_at')
        )
        resolution_days_list = [
            (resolved - created).total_seconds() / 86400
            for created, resolved in resolved_items
        ]
        total_resolved = len(resolution_days_list)

        avg_resolution = (
            round(sum(resolution_days_list) / total_resolved, 1)
            if total_resolved > 0 else None
        )
        median_resolution = (
            round(statistics.median(resolution_days_list), 1)
            if total_resolved > 0 else None
        )

        # Approved items (reviewed/signed off)
        approved_items = list(
            items.filter(
                status=ActionItem.Status.APPROVED,
                reviewed_at__isnull=False,
            ).values_list('created_at', 'reviewed_at')
        )
        total_approved = len(approved_items)
        approval_days_list = [
            (reviewed - created).total_seconds() / 86400
            for created, reviewed in approved_items
        ]
        avg_approval = (
            round(sum(approval_days_list) / total_approved, 1)
            if total_approved > 0 else None
        )

        summary = {
            'avg_resolution_days': avg_resolution,
            'median_resolution_days': median_resolution,
            'total_resolved': total_resolved,
            'total_approved': total_approved,
            'avg_approval_days': avg_approval,
        }

        # ---- By Priority ----
        priority_order = ['critical', 'high', 'medium', 'low']
        by_priority = []
        for prio in priority_order:
            prio_items = items.filter(priority=prio)
            prio_count = prio_items.count()
            if prio_count == 0:
                continue

            prio_resolved = list(
                prio_items.filter(
                    resolved_at__isnull=False,
                ).values_list('created_at', 'resolved_at')
            )
            prio_days = [
                (resolved - created).total_seconds() / 86400
                for created, resolved in prio_resolved
            ]
            resolved_count = len(prio_days)
            avg_days = round(sum(prio_days) / resolved_count, 1) if resolved_count > 0 else None
            median_days = round(statistics.median(prio_days), 1) if resolved_count > 0 else None

            # SLA compliance
            green_max, amber_max = SLA_THRESHOLDS.get(prio, (7, 14))
            sla_met = sum(1 for d in prio_days if d <= green_max)
            sla_met_pct = round((sla_met / resolved_count) * 100, 1) if resolved_count > 0 else 0

            by_priority.append({
                'priority': prio,
                'count': prio_count,
                'resolved_count': resolved_count,
                'avg_days': avg_days,
                'median_days': median_days,
                'sla_met_count': sla_met,
                'sla_met_pct': sla_met_pct,
            })

        # ---- By Store ----
        # Get store info from walk or direct store FK
        store_items_walk = (
            items.filter(walk__store__isnull=False)
            .values('walk__store__id', 'walk__store__name')
            .annotate(
                total=Count('id'),
                resolved=Count('id', filter=models_Q(resolved_at__isnull=False)),
                critical_open=Count(
                    'id',
                    filter=models_Q(priority='critical', status__in=['open', 'in_progress']),
                ),
                high_open=Count(
                    'id',
                    filter=models_Q(priority='high', status__in=['open', 'in_progress']),
                ),
            )
            .order_by('-total')
        )

        by_store = []
        for s in store_items_walk:
            store_id = s['walk__store__id']
            # Calculate avg resolution for this store
            store_resolved = list(
                items.filter(
                    walk__store_id=store_id,
                    resolved_at__isnull=False,
                ).values_list('created_at', 'resolved_at')
            )
            store_res_days = [
                (resolved - created).total_seconds() / 86400
                for created, resolved in store_resolved
            ]
            store_avg_res = (
                round(sum(store_res_days) / len(store_res_days), 1)
                if store_res_days else None
            )

            by_store.append({
                'store_id': str(store_id),
                'store_name': s['walk__store__name'],
                'total': s['total'],
                'resolved': s['resolved'],
                'avg_resolution_days': store_avg_res,
                'critical_open': s['critical_open'],
                'high_open': s['high_open'],
            })

        # ---- By Region ----
        region_items = (
            items.filter(walk__store__region__isnull=False)
            .values('walk__store__region__id', 'walk__store__region__name')
            .annotate(
                total=Count('id'),
                resolved=Count('id', filter=models_Q(resolved_at__isnull=False)),
            )
            .order_by('-total')
        )

        by_region = []
        for r in region_items:
            region_id = r['walk__store__region__id']
            region_resolved = list(
                items.filter(
                    walk__store__region_id=region_id,
                    resolved_at__isnull=False,
                ).values_list('created_at', 'resolved_at')
            )
            region_days = [
                (resolved - created).total_seconds() / 86400
                for created, resolved in region_resolved
            ]
            region_avg = (
                round(sum(region_days) / len(region_days), 1)
                if region_days else None
            )

            by_region.append({
                'region_id': str(region_id),
                'region_name': r['walk__store__region__name'],
                'total': r['total'],
                'resolved': r['resolved'],
                'avg_resolution_days': region_avg,
            })

        # ---- Monthly Trend ----
        monthly_created = (
            items.annotate(month=TruncMonth('created_at'))
            .values('month')
            .annotate(created_count=Count('id'))
            .order_by('month')
        )
        created_map = {
            m['month'].strftime('%Y-%m'): m['created_count']
            for m in monthly_created
        }

        # Monthly resolved counts and avg resolution
        monthly_resolved_qs = (
            items.filter(resolved_at__isnull=False)
            .annotate(month=TruncMonth('resolved_at'))
            .values('month')
            .annotate(resolved_count=Count('id'))
            .order_by('month')
        )
        resolved_map = {
            m['month'].strftime('%Y-%m'): m['resolved_count']
            for m in monthly_resolved_qs
        }

        # Compute avg resolution per month (by resolution month)
        resolved_with_dates = (
            items.filter(resolved_at__isnull=False)
            .annotate(month=TruncMonth('resolved_at'))
            .values_list('month', 'created_at', 'resolved_at')
        )
        month_days_map = defaultdict(list)
        for month, created, resolved in resolved_with_dates:
            month_key = month.strftime('%Y-%m')
            days = (resolved - created).total_seconds() / 86400
            month_days_map[month_key].append(days)

        all_months = sorted(set(list(created_map.keys()) + list(resolved_map.keys())))
        monthly_trend = []
        for month_key in all_months:
            days_list = month_days_map.get(month_key, [])
            monthly_trend.append({
                'month': month_key,
                'avg_resolution_days': (
                    round(sum(days_list) / len(days_list), 1)
                    if days_list else None
                ),
                'resolved_count': resolved_map.get(month_key, 0),
                'created_count': created_map.get(month_key, 0),
            })

        return Response({
            'summary': summary,
            'by_priority': by_priority,
            'by_store': by_store,
            'by_region': by_region,
            'monthly_trend': monthly_trend,
        })
