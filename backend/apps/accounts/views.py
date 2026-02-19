from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenRefreshView as SimpleJWTTokenRefreshView

from apps.core.permissions import IsOrgAdmin, IsOrgMember
from apps.core.storage import process_uploaded_image
from apps.core.throttles import LoginRateThrottle, PasswordResetRateThrottle, SignupRateThrottle

from django.db import transaction
from django.utils.text import slugify

from .emails import send_invitation_email, send_password_reset_email
from .models import Membership, Organization, RegionAssignment, StoreAssignment, SupportTicket, TicketMessage, User
from .serializers import (
    AdminUserUpdateSerializer,
    ChangePasswordSerializer,
    InviteMemberSerializer,
    LoginSerializer,
    MembershipSerializer,
    OrganizationSerializer,
    OrgMemberSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    ProfileUpdateSerializer,
    RegisterSerializer,
    SupportTicketCreateSerializer,
    SupportTicketSerializer,
    TicketMessageSerializer,
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
    throttle_classes = [LoginRateThrottle]

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


class OrgProfileView(APIView):
    """View and update the current organization's profile."""
    permission_classes = [IsAuthenticated, IsOrgMember]

    def get(self, request):
        return Response(OrganizationSerializer(request.org).data)

    def patch(self, request):
        if not IsOrgAdmin().has_permission(request, self):
            return Response({'detail': 'Admin access required.'}, status=403)
        serializer = OrganizationSerializer(request.org, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


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

        # Send welcome/invitation email
        send_invitation_email(
            membership.user,
            request.org,
            serializer.validated_data['role'],
        )

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


class ProfileView(APIView):
    """View and update the authenticated user's profile."""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        user = request.user

        # Handle avatar upload separately
        if 'avatar' in request.FILES:
            processed = process_uploaded_image(request.FILES['avatar'])
            user.avatar.save(processed.name, processed, save=True)

        # Handle profile field updates
        data = {}
        for field in ('first_name', 'last_name', 'email'):
            if field in request.data:
                data[field] = request.data[field]

        if data:
            serializer = ProfileUpdateSerializer(user, data=data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()

        user.refresh_from_db()
        return Response(UserSerializer(user).data)

    def delete(self, request):
        """Remove avatar."""
        user = request.user
        if user.avatar:
            user.avatar.delete(save=True)
        return Response(UserSerializer(user).data)


class ChangePasswordView(APIView):
    """Change the authenticated user's password."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data,
            context={'request': request},
        )
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data['new_password'])
        request.user.save(update_fields=['password'])
        return Response({'detail': 'Password changed successfully.'})


class PasswordResetRequestView(APIView):
    """Request a password reset email."""
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [PasswordResetRateThrottle]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email'].lower()

        try:
            user = User.objects.get(email=email, is_active=True)
        except User.DoesNotExist:
            # Don't reveal whether the email exists
            return Response({'detail': 'If an account with that email exists, a reset link has been sent.'})

        send_password_reset_email(user)

        return Response({'detail': 'If an account with that email exists, a reset link has been sent.'})


class PasswordResetConfirmView(APIView):
    """Confirm a password reset with uid, token, and new password."""
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            uid = force_str(urlsafe_base64_decode(serializer.validated_data['uid']))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response(
                {'detail': 'Invalid reset link.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not default_token_generator.check_token(user, serializer.validated_data['token']):
            return Response(
                {'detail': 'This reset link has expired or already been used.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(serializer.validated_data['new_password'])
        user.save(update_fields=['password'])
        return Response({'detail': 'Password has been reset successfully.'})


class AdminUserEditView(APIView):
    """Admin endpoint to edit a user's profile within the org."""
    permission_classes = [IsAuthenticated, IsOrgAdmin]

    def patch(self, request, member_id):
        """Update a member's user profile (name, email)."""
        try:
            membership = Membership.objects.select_related('user').get(
                id=member_id,
                organization=request.org,
            )
        except (Membership.DoesNotExist, ValueError):
            return Response({'detail': 'Member not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = AdminUserUpdateSerializer(
            membership.user,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(OrgMemberSerializer(membership).data)

    def post(self, request, member_id):
        """Send a password reset email to a member."""
        try:
            membership = Membership.objects.select_related('user').get(
                id=member_id,
                organization=request.org,
            )
        except (Membership.DoesNotExist, ValueError):
            return Response({'detail': 'Member not found.'}, status=status.HTTP_404_NOT_FOUND)

        user = membership.user
        send_password_reset_email(user, admin_initiated=True)

        return Response({'detail': f'Password reset email sent to {user.email}.'})


class ResendInviteView(APIView):
    """Resend the invitation email to a team member."""
    permission_classes = [IsAuthenticated, IsOrgAdmin]

    def post(self, request, member_id):
        try:
            membership = Membership.objects.select_related('user', 'organization').get(
                id=member_id,
                organization=request.org,
            )
        except (Membership.DoesNotExist, ValueError):
            return Response(
                {'detail': 'Member not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        sent = send_invitation_email(
            membership.user,
            membership.organization,
            membership.role,
        )

        if sent:
            return Response({'detail': f'Invitation email resent to {membership.user.email}.'})
        return Response(
            {'detail': 'Failed to send invitation email. Please try again later.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


class SelfServeSignupView(APIView):
    """Self-serve signup: creates User + Org + Membership, returns JWT tokens."""
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [SignupRateThrottle]

    @transaction.atomic
    def post(self, request):
        from rest_framework_simplejwt.tokens import RefreshToken

        email = request.data.get('email', '').strip().lower()
        password = request.data.get('password', '')
        first_name = request.data.get('first_name', '').strip()
        last_name = request.data.get('last_name', '').strip()
        company_name = request.data.get('company_name', '').strip()
        trial_source = request.data.get('trial_source', '').strip()

        # Validation
        errors = {}
        if not email:
            errors['email'] = 'Email is required.'
        if not password:
            errors['password'] = 'Password is required.'
        else:
            from django.contrib.auth.password_validation import validate_password
            from django.core.exceptions import ValidationError as DjangoValidationError
            try:
                validate_password(password)
            except DjangoValidationError as e:
                errors['password'] = list(e.messages)
        if not first_name:
            errors['first_name'] = 'First name is required.'
        if not last_name:
            errors['last_name'] = 'Last name is required.'
        if not company_name:
            errors['company_name'] = 'Company name is required.'

        if email and User.objects.filter(email=email).exists():
            errors['email'] = 'A user with this email already exists.'

        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)

        # Create user
        user = User.objects.create_user(
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
        )

        # Create organization with unique slug
        base_slug = slugify(company_name)
        slug = base_slug or 'org'
        counter = 1
        while Organization.objects.filter(slug=slug).exists():
            slug = f'{base_slug}-{counter}'
            counter += 1

        org = Organization(name=company_name, slug=slug, owner=user)
        # Pass trial_source to the signal via a transient attribute
        org._trial_source = trial_source
        org.save()

        # Create owner membership
        Membership.objects.create(
            user=user,
            organization=org,
            role=Membership.Role.OWNER,
        )

        # Schedule drip campaign
        from .tasks import schedule_drip_campaign
        from .leads import Lead

        # Create a lead record for tracking
        lead = Lead.objects.create(
            email=email,
            first_name=first_name,
            last_name=last_name,
            company_name=company_name,
            source=trial_source or 'self-serve',
            status='converted',
            demo_org=org,
        )
        schedule_drip_campaign.delay(str(lead.id))

        # Return JWT tokens for auto-login
        refresh = RefreshToken.for_user(user)
        return Response({
            'user': UserSerializer(user).data,
            'organization': OrganizationSerializer(org).data,
            'tokens': {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
            },
        }, status=status.HTTP_201_CREATED)


class SupportTicketListView(APIView):
    """List tickets for the current org, or create a new ticket."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.core.permissions import get_org_from_request
        org = get_org_from_request(request)

        # Platform admins can request all tickets via ?scope=platform
        if request.user.is_staff and request.query_params.get('scope') == 'platform':
            tickets = SupportTicket.objects.all()
        elif org:
            tickets = SupportTicket.objects.filter(organization=org)
        else:
            tickets = SupportTicket.objects.none()

        tickets = tickets.select_related('user', 'organization').prefetch_related('messages__user')
        return Response(SupportTicketSerializer(tickets, many=True).data)

    def post(self, request):
        from apps.core.permissions import get_org_from_request
        org = get_org_from_request(request)
        if not org:
            return Response({'detail': 'Organization required.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = SupportTicketCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        ticket = SupportTicket.objects.create(
            organization=org,
            user=request.user,
            subject=serializer.validated_data['subject'],
            description=serializer.validated_data['description'],
            priority=serializer.validated_data['priority'],
            category=serializer.validated_data.get('category', 'other'),
        )

        # Create initial message from description
        TicketMessage.objects.create(
            ticket=ticket,
            user=request.user,
            message=serializer.validated_data['description'],
        )

        # Send notification
        from .tasks import send_ticket_notification
        send_ticket_notification.delay(str(ticket.id))

        ticket.refresh_from_db()
        return Response(
            SupportTicketSerializer(ticket).data,
            status=status.HTTP_201_CREATED,
        )


class SupportTicketDetailView(APIView):
    """Get ticket detail or add a message."""
    permission_classes = [IsAuthenticated]

    def _get_ticket(self, request, ticket_id):
        from apps.core.permissions import get_org_from_request
        try:
            ticket = SupportTicket.objects.select_related(
                'user', 'organization'
            ).prefetch_related('messages__user').get(id=ticket_id)
        except SupportTicket.DoesNotExist:
            return None

        # Staff can see all tickets (including Sentry tickets with no org)
        if request.user.is_staff:
            return ticket

        org = get_org_from_request(request)
        if not org or ticket.organization_id != org.id:
            return None
        return ticket

    def get(self, request, ticket_id):
        ticket = self._get_ticket(request, ticket_id)
        if not ticket:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(SupportTicketSerializer(ticket).data)

    def post(self, request, ticket_id):
        """Add a message to the ticket."""
        ticket = self._get_ticket(request, ticket_id)
        if not ticket:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        message_text = request.data.get('message', '').strip()
        if not message_text:
            return Response({'detail': 'Message is required.'}, status=status.HTTP_400_BAD_REQUEST)

        msg = TicketMessage.objects.create(
            ticket=ticket,
            user=request.user,
            message=message_text,
        )

        # Update ticket status if platform admin is replying
        if request.user.is_staff and ticket.status == 'open':
            ticket.status = 'in_progress'
            ticket.save(update_fields=['status', 'updated_at'])

        return Response(TicketMessageSerializer(msg).data, status=status.HTTP_201_CREATED)

    def patch(self, request, ticket_id):
        """Update ticket fields (admin only)."""
        if not (request.user.is_staff or hasattr(request, 'membership') and request.membership and request.membership.role in ('owner', 'admin')):
            return Response({'detail': 'Admin access required.'}, status=status.HTTP_403_FORBIDDEN)
        ticket = self._get_ticket(request, ticket_id)
        if not ticket:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        update_fields = ['updated_at']

        new_status = request.data.get('status')
        if new_status and new_status in dict(SupportTicket.Status.choices):
            ticket.status = new_status
            update_fields.append('status')

        new_category = request.data.get('category')
        if new_category and new_category in dict(SupportTicket.Category.choices):
            ticket.category = new_category
            update_fields.append('category')

        if 'resolution_notes' in request.data:
            ticket.resolution_notes = request.data['resolution_notes']
            update_fields.append('resolution_notes')

        if len(update_fields) > 1:
            ticket.save(update_fields=update_fields)

        # Sync resolution to Sentry if applicable
        if new_status in ('resolved', 'closed') and ticket.source == 'sentry' and ticket.external_id:
            from .tasks import resolve_sentry_issue
            resolve_sentry_issue.delay(ticket.external_id)

        return Response(SupportTicketSerializer(ticket).data)
