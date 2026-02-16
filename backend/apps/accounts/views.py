from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenRefreshView as SimpleJWTTokenRefreshView

from apps.core.permissions import IsOrgAdmin, IsOrgMember

from .models import Membership, RegionAssignment, StoreAssignment
from .serializers import (
    InviteMemberSerializer,
    LoginSerializer,
    MembershipSerializer,
    OrgMemberSerializer,
    RegisterSerializer,
    UpdateMemberRoleSerializer,
    UserSerializer,
)


class RegisterView(APIView):
    """Register a new user, organization, and owner membership."""
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            serializer.to_representation(user),
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    """Authenticate a user and return JWT tokens."""
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            serializer.to_representation(user),
            status=status.HTTP_200_OK,
        )


class TokenRefreshView(SimpleJWTTokenRefreshView):
    """Refresh an access token using a refresh token."""
    pass


class MeView(APIView):
    """Return the current authenticated user's details and memberships."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        memberships = Membership.objects.filter(user=user).select_related('organization')
        return Response({
            'user': UserSerializer(user).data,
            'memberships': MembershipSerializer(memberships, many=True).data,
        })


class MemberListView(APIView):
    """List all members of the current organization."""
    permission_classes = [IsAuthenticated, IsOrgMember]

    def get(self, request):
        memberships = Membership.objects.filter(
            organization=request.org,
        ).select_related('user').prefetch_related(
            'region_assignments__region',
            'store_assignments__store',
        ).order_by('created_at')
        serializer = OrgMemberSerializer(memberships, many=True)
        return Response(serializer.data)


class InviteMemberView(APIView):
    """Invite a new member to the current organization."""
    permission_classes = [IsAuthenticated, IsOrgAdmin]

    def post(self, request):
        serializer = InviteMemberSerializer(
            data=request.data,
            context={'organization': request.org},
        )
        serializer.is_valid(raise_exception=True)
        membership = serializer.save()
        return Response(
            OrgMemberSerializer(membership).data,
            status=status.HTTP_201_CREATED,
        )


class MemberDetailView(APIView):
    """Update or remove a member from the current organization."""
    permission_classes = [IsAuthenticated, IsOrgAdmin]

    def _get_membership(self, request, member_id):
        try:
            return Membership.objects.select_related('user').get(
                id=member_id,
                organization=request.org,
            )
        except (Membership.DoesNotExist, ValueError):
            return None

    def patch(self, request, member_id):
        """Update a member's role."""
        membership = self._get_membership(request, member_id)
        if membership is None:
            return Response(
                {'detail': 'Member not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Prevent changing own role
        if membership.user_id == request.user.id:
            return Response(
                {'detail': 'You cannot change your own role.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Prevent downgrading the org owner
        if membership.role == 'owner':
            return Response(
                {'detail': 'Cannot change the role of the organization owner.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = UpdateMemberRoleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        membership.role = serializer.validated_data['role']
        membership.save(update_fields=['role', 'updated_at'])

        # Update region assignments if provided
        if 'region_ids' in serializer.validated_data:
            membership.region_assignments.all().delete()
            for region_id in serializer.validated_data['region_ids']:
                RegionAssignment.objects.create(
                    membership=membership,
                    region_id=region_id,
                )

        # Update store assignments if provided
        if 'store_ids' in serializer.validated_data:
            membership.store_assignments.all().delete()
            for store_id in serializer.validated_data['store_ids']:
                StoreAssignment.objects.create(
                    membership=membership,
                    store_id=store_id,
                )

        return Response(OrgMemberSerializer(membership).data)

    def delete(self, request, member_id):
        """Remove a member from the organization."""
        membership = self._get_membership(request, member_id)
        if membership is None:
            return Response(
                {'detail': 'Member not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Prevent removing the org owner
        if membership.role == 'owner':
            return Response(
                {'detail': 'Cannot remove the organization owner.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        membership.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
