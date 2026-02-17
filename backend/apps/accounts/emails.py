"""
Transactional emails for account operations (Resend).
"""
import logging

import resend
from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

logger = logging.getLogger(__name__)

FRONTEND_URL = 'https://app.storescore.app'


def send_invitation_email(user, organization, role):
    """Send a welcome/invitation email to a newly invited team member."""
    if not settings.RESEND_API_KEY:
        logger.warning('RESEND_API_KEY not configured, skipping invitation email')
        return False

    resend.api_key = settings.RESEND_API_KEY

    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    set_password_url = f'{FRONTEND_URL}/reset-password?uid={uid}&token={token}'

    ROLE_LABELS = {
        'owner': 'Owner',
        'admin': 'Admin',
        'regional_manager': 'Regional Manager',
        'store_manager': 'Store Manager',
        'manager': 'Manager',
        'finance': 'Finance',
        'member': 'Member',
    }
    role_label = ROLE_LABELS.get(role, role)

    html = f'''<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
<div style="max-width: 640px; margin: 0 auto; padding: 24px;">

    <div style="background-color: #D40029; border-radius: 12px 12px 0 0; padding: 32px 24px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 700;">Welcome to StoreScore</h1>
        <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">You've been invited to {organization.name}</p>
    </div>

    <div style="background-color: white; padding: 32px 24px;">
        <p style="margin: 0 0 16px; font-size: 14px; color: #374151;">Hi {user.first_name},</p>
        <p style="margin: 0 0 16px; font-size: 14px; color: #374151;">
            You've been added to <strong>{organization.name}</strong> on StoreScore as a <strong>{role_label}</strong>.
        </p>
        <p style="margin: 0 0 24px; font-size: 14px; color: #374151;">
            StoreScore helps your team evaluate store quality, track improvements, and maintain high standards across all locations.
        </p>

        <div style="text-align: center; margin: 32px 0;">
            <a href="{set_password_url}" style="display: inline-block; background-color: #D40029; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                Set Your Password
            </a>
        </div>

        <p style="margin: 0 0 8px; font-size: 13px; color: #6b7280; text-align: center;">
            This link will expire in 24 hours.
        </p>
        <p style="margin: 0; font-size: 13px; color: #9ca3af; text-align: center;">
            After setting your password, sign in at <a href="{FRONTEND_URL}/login" style="color: #D40029;">{FRONTEND_URL}</a>
        </p>
    </div>

    <div style="padding: 24px; text-align: center; border-radius: 0 0 12px 12px; background-color: white; border-top: 1px solid #e5e7eb;">
        <p style="margin: 0; font-size: 12px; color: #9ca3af;">
            StoreScore — Store Quality Management
        </p>
    </div>

</div>
</body>
</html>'''

    try:
        resend.Emails.send({
            'from': settings.DEFAULT_FROM_EMAIL,
            'to': [user.email],
            'subject': f'You\'ve been invited to {organization.name} on StoreScore',
            'html': html,
        })
        logger.info(f'Invitation email sent to {user.email} for {organization.name}')
        return True
    except Exception as e:
        logger.error(f'Failed to send invitation email to {user.email}: {e}')
        return False


def send_password_reset_email(user, admin_initiated=False):
    """Send a password reset email."""
    if not settings.RESEND_API_KEY:
        logger.warning('RESEND_API_KEY not configured, skipping password reset email')
        return False

    resend.api_key = settings.RESEND_API_KEY

    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    reset_url = f'{FRONTEND_URL}/reset-password?uid={uid}&token={token}'

    if admin_initiated:
        intro = 'Your administrator has requested a password reset for your StoreScore account.'
    else:
        intro = 'You requested a password reset for your StoreScore account.'

    html = f'''<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
<div style="max-width: 640px; margin: 0 auto; padding: 24px;">

    <div style="background-color: #D40029; border-radius: 12px 12px 0 0; padding: 32px 24px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 700;">Password Reset</h1>
        <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">StoreScore Account</p>
    </div>

    <div style="background-color: white; padding: 32px 24px;">
        <p style="margin: 0 0 16px; font-size: 14px; color: #374151;">Hi {user.first_name},</p>
        <p style="margin: 0 0 24px; font-size: 14px; color: #374151;">{intro}</p>

        <div style="text-align: center; margin: 32px 0;">
            <a href="{reset_url}" style="display: inline-block; background-color: #D40029; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                Reset Password
            </a>
        </div>

        <p style="margin: 0 0 8px; font-size: 13px; color: #6b7280; text-align: center;">
            This link will expire in 24 hours.
        </p>
        <p style="margin: 0; font-size: 13px; color: #9ca3af; text-align: center;">
            If you did not request this, you can safely ignore this email.
        </p>
    </div>

    <div style="padding: 24px; text-align: center; border-radius: 0 0 12px 12px; background-color: white; border-top: 1px solid #e5e7eb;">
        <p style="margin: 0; font-size: 12px; color: #9ca3af;">
            StoreScore — Store Quality Management
        </p>
    </div>

</div>
</body>
</html>'''

    try:
        resend.Emails.send({
            'from': settings.DEFAULT_FROM_EMAIL,
            'to': [user.email],
            'subject': 'Reset your StoreScore password',
            'html': html,
        })
        logger.info(f'Password reset email sent to {user.email}')
        return True
    except Exception as e:
        logger.error(f'Failed to send password reset email to {user.email}: {e}')
        return False
