"""
Achievement checking logic. Called after walk completion to auto-award badges.
"""
import logging
from datetime import timedelta
from decimal import Decimal

from django.db.models import Avg, Count, Q
from django.utils import timezone

from apps.walks.models import ActionItem, Walk

from .models import Achievement, AwardedAchievement

logger = logging.getLogger(__name__)


def check_achievements_for_walk(walk, include_advanced=None):
    """
    Check all active achievements after a walk is completed.
    Returns a list of newly awarded AwardedAchievement instances.

    If include_advanced is None (auto-check from walk completion), the org's
    subscription plan is used to determine which tiers to check. Pass
    include_advanced=True/False to override (e.g. from manual check endpoint).
    """
    if walk.status != Walk.Status.COMPLETED:
        return []

    # Determine which achievement tiers to check
    if include_advanced is None:
        # Auto-detect from the org's subscription plan
        include_advanced = False
        try:
            subscription = walk.organization.subscriptions.select_related('plan').first()
            if subscription and subscription.plan.has_feature('gamification_advanced'):
                include_advanced = True
        except Exception:
            pass

    achievements = Achievement.objects.filter(is_active=True)
    if not include_advanced:
        achievements = achievements.filter(plan_tier='basic')

    newly_awarded = []

    for achievement in achievements:
        try:
            if _is_already_awarded(achievement, walk):
                continue

            met = _check_criteria(achievement, walk)
            if met:
                award = AwardedAchievement.objects.create(
                    achievement=achievement,
                    organization=walk.organization,
                    store=walk.store,
                    user=walk.conducted_by,
                    walk=walk,
                    awarded_at=timezone.now(),
                )
                newly_awarded.append(award)
        except Exception:
            logger.exception(
                'Error checking achievement %s for walk %s', achievement.id, walk.id
            )

    return newly_awarded


def _is_already_awarded(achievement, walk):
    """Check if this achievement was already awarded to this store in this org."""
    return AwardedAchievement.objects.filter(
        achievement=achievement,
        organization=walk.organization,
        store=walk.store,
    ).exists()


def _store_completed_walks(walk):
    """Get completed walks for the same store and org."""
    return Walk.objects.filter(
        organization=walk.organization,
        store=walk.store,
        status=Walk.Status.COMPLETED,
        total_score__isnull=False,
    ).order_by('completed_date')


def _check_criteria(achievement, walk):
    """Dispatch to the right checker based on criteria_type."""
    criteria_type = achievement.criteria_type
    value = int(achievement.criteria_value)

    if criteria_type == Achievement.CriteriaType.PERFECT_SCORE:
        return _check_perfect_score(walk, value)
    elif criteria_type == Achievement.CriteriaType.SCORE_ABOVE_90:
        return _check_score_above_90(walk, value)
    elif criteria_type == Achievement.CriteriaType.WALK_STREAK:
        return _check_walk_streak(walk, value)
    elif criteria_type == Achievement.CriteriaType.SCORE_STREAK:
        return _check_score_streak(walk, value)
    elif criteria_type == Achievement.CriteriaType.WALK_COUNT:
        return _check_walk_count(walk, value)
    elif criteria_type == Achievement.CriteriaType.IMPROVEMENT:
        return _check_improvement(walk, value)
    elif criteria_type == Achievement.CriteriaType.ACTION_SPEED:
        return _check_action_speed(walk, value)

    return False


def _check_perfect_score(walk, count_needed):
    """Walk scored 100%. count_needed = number of perfect walks needed."""
    perfect_count = _store_completed_walks(walk).filter(
        total_score__gte=Decimal('99.99')
    ).count()
    return perfect_count >= count_needed


def _check_score_above_90(walk, count_needed):
    """Walk scored 90%+. count_needed = number of such walks needed."""
    above_90_count = _store_completed_walks(walk).filter(
        total_score__gte=Decimal('90.0')
    ).count()
    return above_90_count >= count_needed


def _check_walk_streak(walk, weeks_needed):
    """N consecutive weeks with at least 1 completed walk."""
    now = timezone.now()
    walks = _store_completed_walks(walk).filter(
        completed_date__isnull=False,
    ).order_by('-completed_date')

    if not walks.exists():
        return False

    # Check backwards from now, week by week
    consecutive = 0
    for week_offset in range(weeks_needed + 5):  # Check a few extra weeks
        week_start = now - timedelta(weeks=week_offset + 1)
        week_end = now - timedelta(weeks=week_offset)
        has_walk = walks.filter(
            completed_date__gte=week_start,
            completed_date__lt=week_end,
        ).exists()

        if has_walk:
            consecutive += 1
            if consecutive >= weeks_needed:
                return True
        else:
            consecutive = 0

    return False


def _check_score_streak(walk, count_needed):
    """N consecutive walks above 80%."""
    walks = _store_completed_walks(walk).order_by('-completed_date')[:count_needed]
    walk_list = list(walks)

    if len(walk_list) < count_needed:
        return False

    return all(
        w.total_score is not None and w.total_score >= Decimal('80.0')
        for w in walk_list
    )


def _check_walk_count(walk, count_needed):
    """Total completed walks."""
    total = _store_completed_walks(walk).count()
    return total >= count_needed


def _check_improvement(walk, percentage_needed):
    """Score improved by N% from first walk to latest."""
    walks = _store_completed_walks(walk).order_by('completed_date')
    if walks.count() < 2:
        return False

    first_walk = walks.first()
    latest_walk = walks.last()

    if first_walk.total_score is None or latest_walk.total_score is None:
        return False
    if first_walk.total_score <= 0:
        return False

    improvement = float(latest_walk.total_score) - float(first_walk.total_score)
    return improvement >= percentage_needed


def _check_action_speed(walk, count_needed):
    """Resolved N action items within 48 hours."""
    fast_resolved = ActionItem.objects.filter(
        organization=walk.organization,
        walk__store=walk.store,
        status=ActionItem.Status.RESOLVED,
        resolved_at__isnull=False,
    ).extra(
        where=["resolved_at - created_at <= interval '48 hours'"],
    ).count()
    return fast_resolved >= count_needed
