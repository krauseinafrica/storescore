from django.urls import path

from .views import (
    InviteMemberView,
    LoginView,
    MeView,
    MemberDetailView,
    MemberListView,
    RegisterView,
    TokenRefreshView,
)

app_name = 'accounts'

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('me/', MeView.as_view(), name='me'),
    path('members/', MemberListView.as_view(), name='member-list'),
    path('members/invite/', InviteMemberView.as_view(), name='member-invite'),
    path('members/<uuid:member_id>/', MemberDetailView.as_view(), name='member-detail'),
]
