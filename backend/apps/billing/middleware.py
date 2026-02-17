import logging

from django.http import JsonResponse

logger = logging.getLogger(__name__)

# Paths that should never be blocked by subscription checks
EXEMPT_PATHS = (
    '/api/v1/billing/',
    '/api/v1/auth/',
    '/api/health/',
    '/admin/',
    '/static/',
)

# HTTP methods that are read-only (allowed when subscription is expired)
READ_ONLY_METHODS = ('GET', 'HEAD', 'OPTIONS')


class SubscriptionMiddleware:
    """
    Check org has active subscription and attach subscription info to request.

    Runs after OrgMiddleware. Attaches request.subscription and request.plan.

    When a subscription is expired/canceled:
    - Read-only access is allowed (GET requests) so users can still view their data
    - Write operations (POST/PUT/PATCH/DELETE) return 402 Payment Required
    - After 90 days of inactivity, the org will be archived (handled by a separate task)
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.subscription = None
        request.plan = None

        # Skip for exempt paths
        if any(request.path.startswith(p) for p in EXEMPT_PATHS):
            return self.get_response(request)

        # Only check if we have a resolved org (set by OrgMiddleware)
        org = getattr(request, 'org', None)
        if org is None:
            return self.get_response(request)

        # Platform admins bypass subscription checks
        user = getattr(request, 'user', None)
        if user and (getattr(user, 'is_staff', False) or getattr(user, 'is_superuser', False)):
            # Still attach subscription info if available
            self._attach_subscription(request, org)
            return self.get_response(request)

        # Try to attach subscription
        subscription = self._attach_subscription(request, org)

        if subscription is None:
            # No subscription at all — read-only mode
            if request.method not in READ_ONLY_METHODS:
                return JsonResponse(
                    {
                        'detail': 'A subscription is required to make changes. Please choose a plan.',
                        'code': 'subscription_required',
                    },
                    status=402,
                )
            return self.get_response(request)

        # Check if subscription is active
        if not subscription.is_active_subscription:
            # Expired subscription — allow read-only access, block writes
            if request.method not in READ_ONLY_METHODS:
                return JsonResponse(
                    {
                        'detail': (
                            'Your subscription has expired. '
                            'Your account is in read-only mode. '
                            'Please choose a plan to continue making changes.'
                        ),
                        'code': 'subscription_expired',
                        'status': subscription.status,
                    },
                    status=402,
                )

        return self.get_response(request)

    def _attach_subscription(self, request, org):
        """Attach subscription and plan to the request. Returns subscription or None."""
        from apps.billing.models import Subscription

        try:
            subscription = Subscription.objects.select_related('plan').get(
                organization=org,
            )
            request.subscription = subscription
            request.plan = subscription.plan
            return subscription
        except Subscription.DoesNotExist:
            return None
