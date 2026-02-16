from rest_framework.permissions import BasePermission


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
    Allows access only if the user has an owner, admin, or manager role
    in the organization specified by request.org.
    """

    message = 'You must be a manager, admin, or owner of this organization.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        membership = getattr(request, 'membership', None)
        if membership is None:
            return False

        return membership.role in ('owner', 'admin', 'manager')
