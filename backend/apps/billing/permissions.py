from rest_framework.permissions import BasePermission


class HasFeature(BasePermission):
    """
    Check if the org's plan includes a specific feature.

    Usage:
        permission_classes = [IsOrgMember, HasFeature('ai_summaries')]

    Or instantiate directly:
        HasFeature('ai_summaries')
    """
    message = 'This feature is not available on your current plan.'

    def __init__(self, feature_name=None):
        self.feature_name = feature_name

    def has_permission(self, request, view):
        # Platform admins bypass
        if getattr(request.user, 'is_staff', False) or getattr(request.user, 'is_superuser', False):
            return True

        plan = getattr(request, 'plan', None)
        if plan is None:
            return False

        feature = self.feature_name or getattr(view, 'required_feature', None)
        if feature is None:
            return True

        return plan.has_feature(feature)


class HasActiveSubscription(BasePermission):
    """Check if org has an active (non-expired) subscription."""
    message = 'An active subscription is required to access this feature.'

    def has_permission(self, request, view):
        if getattr(request.user, 'is_staff', False) or getattr(request.user, 'is_superuser', False):
            return True

        subscription = getattr(request, 'subscription', None)
        if subscription is None:
            return False
        return subscription.is_active_subscription


class IsWithinStoreLimit(BasePermission):
    """Check if org is within their plan's store limit."""
    message = 'You have reached the maximum number of stores for your plan.'

    def has_permission(self, request, view):
        if getattr(request.user, 'is_staff', False) or getattr(request.user, 'is_superuser', False):
            return True

        plan = getattr(request, 'plan', None)
        if plan is None:
            return True  # No plan configured, allow

        if plan.max_stores is None:
            return True  # Unlimited

        from apps.stores.models import Store
        org = getattr(request, 'org', None)
        if org is None:
            return True

        current_count = Store.objects.filter(organization=org, is_active=True).count()
        return current_count < plan.max_stores


class IsWithinWalkLimit(BasePermission):
    """Check if org is within their plan's walks/month limit per store."""
    message = 'You have reached the maximum number of walks for this month on your current plan.'

    def has_permission(self, request, view):
        if getattr(request.user, 'is_staff', False) or getattr(request.user, 'is_superuser', False):
            return True

        plan = getattr(request, 'plan', None)
        if plan is None:
            return True

        if plan.max_walks_per_store is None:
            return True  # Unlimited

        org = getattr(request, 'org', None)
        if org is None:
            return True

        # Get the store from the request data (for walk creation)
        store_id = request.data.get('store')
        if not store_id:
            return True

        from django.utils import timezone
        from apps.walks.models import Walk

        now = timezone.now()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        walk_count = Walk.objects.filter(
            organization=org,
            store_id=store_id,
            created_at__gte=month_start,
        ).count()

        return walk_count < plan.max_walks_per_store
