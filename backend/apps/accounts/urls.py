from django.urls import path

from .platform_views import (
    LeadDetailView,
    LeadListView,
    PlatformOrgActivationView,
    PlatformOrgDetailView,
    PlatformOrgListView,
    PlatformOrgStoreImportView,
    PlatformOrgStoresView,
    PlatformStatsView,
)
from .views import (
    AdminUserEditView,
    ChangePasswordView,
    InviteMemberView,
    LoginView,
    MeView,
    MemberDetailView,
    MemberListView,
    OrgProfileView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    ProfileView,
    RegisterView,
    ResendInviteView,
    TokenRefreshView,
)

app_name = 'accounts'

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('me/', MeView.as_view(), name='me'),
    # Organization profile
    path('organization/', OrgProfileView.as_view(), name='org-profile'),
    # Profile management
    path('profile/', ProfileView.as_view(), name='profile'),
    path('profile/change-password/', ChangePasswordView.as_view(), name='change-password'),
    # Password reset (public)
    path('password-reset/', PasswordResetRequestView.as_view(), name='password-reset'),
    path('password-reset/confirm/', PasswordResetConfirmView.as_view(), name='password-reset-confirm'),
    # Team members
    path('members/', MemberListView.as_view(), name='member-list'),
    path('members/invite/', InviteMemberView.as_view(), name='member-invite'),
    path('members/<uuid:member_id>/', MemberDetailView.as_view(), name='member-detail'),
    path('members/<uuid:member_id>/edit-user/', AdminUserEditView.as_view(), name='member-edit-user'),
    path('members/<uuid:member_id>/resend-invite/', ResendInviteView.as_view(), name='member-resend-invite'),
    # Platform admin
    path('platform/stats/', PlatformStatsView.as_view(), name='platform-stats'),
    path('platform/orgs/', PlatformOrgListView.as_view(), name='platform-org-list'),
    path('platform/orgs/<uuid:org_id>/', PlatformOrgDetailView.as_view(), name='platform-org-detail'),
    path('platform/orgs/<uuid:org_id>/stores/', PlatformOrgStoresView.as_view(), name='platform-org-stores'),
    path('platform/orgs/<uuid:org_id>/activation/', PlatformOrgActivationView.as_view(), name='platform-org-activation'),
    path('platform/orgs/<uuid:org_id>/stores/import/', PlatformOrgStoreImportView.as_view(), name='platform-org-store-import'),
    # Leads
    path('leads/', LeadListView.as_view(), name='lead-list'),
    path('leads/<uuid:lead_id>/', LeadDetailView.as_view(), name='lead-detail'),
]
