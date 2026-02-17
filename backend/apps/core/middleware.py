from django.utils.deprecation import MiddlewareMixin

from apps.accounts.models import Membership, Organization


class OrgMiddleware(MiddlewareMixin):
    """
    Middleware that reads the X-Organization header (or ?org query param)
    and sets request.org to the Organization instance and request.membership
    to the user's Membership instance for that organization.

    Only applies to authenticated requests. Validates that the user
    is a member of the specified organization.
    """

    def process_request(self, request):
        request.org = None
        request.membership = None

        if not hasattr(request, 'user') or not request.user.is_authenticated:
            return None

        # Try header first, then query param
        org_id = request.headers.get('X-Organization') or request.GET.get('org')

        if not org_id:
            return None

        try:
            organization = Organization.objects.get(id=org_id)
        except (Organization.DoesNotExist, ValueError):
            return None

        # Fetch the membership (verifies user is a member and gives us the role)
        try:
            membership = Membership.objects.get(
                user=request.user,
                organization=organization,
            )
            request.org = organization
            request.membership = membership
        except Membership.DoesNotExist:
            # Platform admins (staff/superuser) can masquerade into any org
            if request.user.is_staff or request.user.is_superuser:
                request.org = organization
                request.membership = None
            # else: request.org stays None, access denied by permission classes

        return None
