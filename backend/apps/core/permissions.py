from rest_framework.permissions import BasePermission

from apps.accounts.models import Membership, Organization

# Role hierarchy levels for comparison
ROLE_HIERARCHY = {
    'owner': 7,
    'admin': 6,
    'regional_manager': 5,
    'store_manager': 4,
    'manager': 3,
    'finance': 2,
    'member': 1,
    'evaluator': 1,
}


def _is_platform_admin(request):
    """Check if the request is from a staff/superuser (platform admin)."""
    user = getattr(request, 'user', None)
    return user and (user.is_staff or user.is_superuser)


def _ensure_org_resolved(request):
    """
    Resolve request.org and request.membership if not already set.

    The OrgMiddleware runs before DRF authentication, so for JWT-authenticated
    requests, request.user may still be AnonymousUser at middleware time.
    This function is called from permission classes (which run after DRF auth)
    to resolve the org when the middleware couldn't.
    """
    if getattr(request, 'org', None) is not None:
        return  # already resolved by middleware

    if not request.user or not request.user.is_authenticated:
        return

    org_id = request.headers.get('X-Organization') or request.query_params.get('org')
    if not org_id:
        return

    try:
        organization = Organization.objects.get(id=org_id)
    except (Organization.DoesNotExist, ValueError):
        return

    try:
        membership = Membership.objects.get(
            user=request.user,
            organization=organization,
        )
        request.org = organization
        request.membership = membership
    except Membership.DoesNotExist:
        if request.user.is_staff or request.user.is_superuser:
            request.org = organization
            request.membership = None


def get_org_from_request(request):
    """
    Return the Organization attached to the request, resolving it if needed.
    Returns None if no org could be determined.
    """
    _ensure_org_resolved(request)
    return getattr(request, 'org', None)


def has_minimum_role(membership, minimum_role):
    """Check if membership role meets or exceeds the minimum required role."""
    if membership is None:
        return False
    user_level = ROLE_HIERARCHY.get(membership.role, 0)
    required_level = ROLE_HIERARCHY.get(minimum_role, 0)
    return user_level >= required_level


def get_accessible_store_ids(request_or_membership):
    """
    Return the set of store IDs a user can access based on their role and assignments.
    Returns None if the user can access ALL stores (owner/admin/finance/manager).
    Accepts either a request object or a membership object for backwards compat.
    """
    # If passed a request object, check for platform admin
    if hasattr(request_or_membership, 'user'):
        if _is_platform_admin(request_or_membership):
            return None  # platform admins see all stores
        membership = getattr(request_or_membership, 'membership', None)
    else:
        membership = request_or_membership

    if membership is None:
        return set()

    role = membership.role

    # These roles see everything in the org
    if role in ('owner', 'admin', 'manager', 'finance'):
        return None  # None means "all stores"

    # Regional managers see stores in their assigned regions + child regions
    if role == 'regional_manager':
        from apps.stores.models import Region, Store
        region_ids = list(
            membership.region_assignments.values_list('region_id', flat=True)
        )
        if not region_ids:
            return set()
        # Also include child regions of assigned regions
        child_region_ids = list(
            Region.objects.filter(parent_id__in=region_ids).values_list('id', flat=True)
        )
        all_region_ids = set(region_ids) | set(child_region_ids)
        return set(
            Store.objects.filter(
                organization=membership.organization,
                region_id__in=all_region_ids,
            ).values_list('id', flat=True)
        )

    # Store managers see only their assigned stores
    if role == 'store_manager':
        store_ids = set(
            membership.store_assignments.values_list('store_id', flat=True)
        )
        return store_ids

    # Evaluators see only their assigned stores
    if role == 'evaluator':
        store_ids = set(
            membership.store_assignments.values_list('store_id', flat=True)
        )
        return store_ids

    # Members see everything (read-only enforced at permission level)
    return None


class IsOrgMember(BasePermission):
    """
    Allows access only if request.org is set (meaning the user is a
    verified member of the organization specified in the request).

    Also resolves org/membership for JWT-authenticated requests where
    the OrgMiddleware couldn't (since DRF auth runs after middleware).
    """

    message = 'You must specify a valid organization via X-Organization header.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        _ensure_org_resolved(request)
        return getattr(request, 'org', None) is not None


class IsOrgAdmin(BasePermission):
    """
    Allows access only if the user has an owner or admin role
    in the organization specified by request.org.
    Platform admins (staff/superuser) always pass.
    """

    message = 'You must be an admin or owner of this organization.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        _ensure_org_resolved(request)
        if _is_platform_admin(request):
            return bool(getattr(request, 'org', None))

        membership = getattr(request, 'membership', None)
        if membership is None:
            return False

        return membership.role in ('owner', 'admin')


class IsOrgManagerOrAbove(BasePermission):
    """
    Allows access for owner, admin, regional_manager, store_manager, or manager.
    Platform admins (staff/superuser) always pass.
    """

    message = 'You must be a manager or above in this organization.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        _ensure_org_resolved(request)
        if _is_platform_admin(request):
            return bool(getattr(request, 'org', None))

        membership = getattr(request, 'membership', None)
        if membership is None:
            return False

        return membership.role in (
            'owner', 'admin', 'regional_manager', 'store_manager', 'manager',
        )


class IsWalkEvaluatorOrAdmin(BasePermission):
    """
    Only allows access if the requesting user is:
    - The evaluator (conducted_by) of the walk, OR
    - An org owner or admin
    This prevents regular managers/store employees from editing walks they
    didn't conduct, while allowing org admins full control.
    """

    message = 'Only the evaluator who conducted this walk or an organization admin can make edits.'

    def has_object_permission(self, request, view, obj):
        # Platform admins (superuser/staff) always bypass
        if _is_platform_admin(request):
            return True
        # Org owners and admins can edit any walk
        membership = getattr(request, 'membership', None)
        if membership and membership.role in ('owner', 'admin'):
            return True
        # Otherwise, only the evaluator who conducted the walk
        walk = obj
        return walk.conducted_by_id == request.user.id


class IsOrgFinanceOrAbove(BasePermission):
    """
    Allows access for finance role and above (read-only analytics/reports).
    Platform admins (staff/superuser) always pass.
    """

    message = 'You must have finance access or above in this organization.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        _ensure_org_resolved(request)
        if _is_platform_admin(request):
            return bool(getattr(request, 'org', None))

        membership = getattr(request, 'membership', None)
        return has_minimum_role(membership, 'finance')
