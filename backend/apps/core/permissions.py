from rest_framework.permissions import BasePermission

# Role hierarchy levels for comparison
ROLE_HIERARCHY = {
    'owner': 7,
    'admin': 6,
    'regional_manager': 5,
    'store_manager': 4,
    'manager': 3,
    'finance': 2,
    'member': 1,
}


def has_minimum_role(membership, minimum_role):
    """Check if membership role meets or exceeds the minimum required role."""
    if membership is None:
        return False
    user_level = ROLE_HIERARCHY.get(membership.role, 0)
    required_level = ROLE_HIERARCHY.get(minimum_role, 0)
    return user_level >= required_level


def get_accessible_store_ids(membership):
    """
    Return the set of store IDs a user can access based on their role and assignments.
    Returns None if the user can access ALL stores (owner/admin/finance/manager).
    """
    if membership is None:
        return set()

    role = membership.role

    # These roles see everything in the org
    if role in ('owner', 'admin', 'manager', 'finance'):
        return None  # None means "all stores"

    # Regional managers see stores in their assigned regions
    if role == 'regional_manager':
        from apps.stores.models import Store
        region_ids = list(
            membership.region_assignments.values_list('region_id', flat=True)
        )
        if not region_ids:
            return set()
        return set(
            Store.objects.filter(
                organization=membership.organization,
                region_id__in=region_ids,
            ).values_list('id', flat=True)
        )

    # Store managers see only their assigned stores
    if role == 'store_manager':
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
    """

    message = 'You must specify a valid organization via X-Organization header.'

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request, 'org', None) is not None
        )


class IsOrgAdmin(BasePermission):
    """
    Allows access only if the user has an owner or admin role
    in the organization specified by request.org.
    """

    message = 'You must be an admin or owner of this organization.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        membership = getattr(request, 'membership', None)
        if membership is None:
            return False

        return membership.role in ('owner', 'admin')


class IsOrgManagerOrAbove(BasePermission):
    """
    Allows access for owner, admin, regional_manager, store_manager, or manager.
    """

    message = 'You must be a manager or above in this organization.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        membership = getattr(request, 'membership', None)
        if membership is None:
            return False

        return membership.role in (
            'owner', 'admin', 'regional_manager', 'store_manager', 'manager',
        )


class IsOrgFinanceOrAbove(BasePermission):
    """
    Allows access for finance role and above (read-only analytics/reports).
    """

    message = 'You must have finance access or above in this organization.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        membership = getattr(request, 'membership', None)
        return has_minimum_role(membership, 'finance')
