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
SITE_URL = 'https://storescore.app'


def _utm(url, source, medium, campaign, content=''):
    """Append UTM parameters to a URL."""
    sep = '&' if '?' in url else '?'
    params = f'utm_source={source}&utm_medium={medium}&utm_campaign={campaign}'
    if content:
        params += f'&utm_content={content}'
    return f'{url}{sep}{params}'


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


# ---------------------------------------------------------------------------
# Drip campaign emails
# ---------------------------------------------------------------------------

def _drip_email_wrapper(first_name, subject_line, body_html):
    """Wrap drip email body in the branded template."""
    return f'''<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
<div style="max-width: 640px; margin: 0 auto; padding: 24px;">

    <div style="background-color: #D40029; border-radius: 12px 12px 0 0; padding: 32px 24px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 700;">StoreScore</h1>
        <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">Store Quality Management</p>
    </div>

    <div style="background-color: white; padding: 32px 24px;">
        <p style="margin: 0 0 16px; font-size: 14px; color: #374151;">Hi {first_name},</p>
        {body_html}
    </div>

    <div style="padding: 24px; text-align: center; border-radius: 0 0 12px 12px; background-color: white; border-top: 1px solid #e5e7eb;">
        <p style="margin: 0 0 4px; font-size: 12px; color: #9ca3af;">
            StoreScore &mdash; Store Quality Management
        </p>
        <p style="margin: 0; font-size: 11px; color: #d1d5db;">
            <a href="{SITE_URL}/unsubscribe?email={{email}}" style="color: #d1d5db; text-decoration: underline;">Unsubscribe</a>
        </p>
    </div>

</div>
</body>
</html>'''


def _drip_cta_button(url, label):
    return f'''<div style="text-align: center; margin: 32px 0;">
    <a href="{url}" style="display: inline-block; background-color: #D40029; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
        {label}
    </a>
</div>'''


def get_drip_email_content(step, lead):
    """
    Return (subject, html) for the given drip step.
    Steps:
      0 = Welcome / product intro
      1 = Feature deep-dive (day 3)
      2 = ROI & success stories (day 7)
      3 = Free account offer (day 14)
    """
    first_name = lead.first_name or 'there'
    email = lead.email

    if step == 0:
        subject = 'Welcome to StoreScore — here\'s how we help'
        features_url = _utm(SITE_URL + '/features', 'drip', 'email', 'welcome', 'cta_button')
        demo_url = _utm(SITE_URL + '/request-demo', 'drip', 'email', 'welcome', 'text_link')
        body = f'''
        <p style="margin: 0 0 16px; font-size: 14px; color: #374151;">
            Thanks for your interest in StoreScore! We help multi-location businesses
            turn every store visit into measurable improvement.
        </p>
        <p style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #111827;">Here's how it works:</p>
        <table style="width: 100%; margin: 16px 0 24px; border-collapse: collapse;">
            <tr>
                <td style="padding: 12px 16px; background: #fef2f2; border-radius: 8px 8px 0 0; border-bottom: 1px solid #fecaca;">
                    <p style="margin: 0; font-size: 14px; color: #991b1b;"><strong>1. Set up templates</strong></p>
                    <p style="margin: 4px 0 0; font-size: 13px; color: #374151;">Create scoring criteria that match your brand standards.</p>
                </td>
            </tr>
            <tr>
                <td style="padding: 12px 16px; background: #fff7ed; border-bottom: 1px solid #fed7aa;">
                    <p style="margin: 0; font-size: 14px; color: #9a3412;"><strong>2. Conduct evaluations</strong></p>
                    <p style="margin: 4px 0 0; font-size: 13px; color: #374151;">Mobile-friendly checklists with photo evidence and GPS verification.</p>
                </td>
            </tr>
            <tr>
                <td style="padding: 12px 16px; background: #f0fdf4; border-radius: 0 0 8px 8px;">
                    <p style="margin: 0; font-size: 14px; color: #166534;"><strong>3. Track & improve</strong></p>
                    <p style="margin: 4px 0 0; font-size: 13px; color: #374151;">AI summaries, action items, and analytics drive real improvement.</p>
                </td>
            </tr>
        </table>
        {_drip_cta_button(features_url, 'Explore Features')}
        <p style="margin: 0; font-size: 13px; color: #9ca3af;">
            Want to see it in action? <a href="{demo_url}" style="color: #D40029;">Request a demo</a> and we'll set up a personalized walkthrough.
        </p>'''

    elif step == 1:
        subject = 'The features that make StoreScore different'
        demo_url = _utm(SITE_URL + '/request-demo', 'drip', 'email', 'features', 'cta_button')
        body = f'''
        <p style="margin: 0 0 16px; font-size: 14px; color: #374151;">
            Still exploring how to standardize quality across your locations? Here are the
            features our customers find most valuable:
        </p>
        <div style="margin: 0 0 16px;">
            <div style="padding: 12px 0; border-bottom: 1px solid #f3f4f6;">
                <p style="margin: 0; font-size: 14px; font-weight: 600; color: #111827;">AI-Powered Summaries</p>
                <p style="margin: 4px 0 0; font-size: 13px; color: #6b7280;">Every evaluation generates an executive summary with pattern detection and prioritized recommendations.</p>
            </div>
            <div style="padding: 12px 0; border-bottom: 1px solid #f3f4f6;">
                <p style="margin: 0; font-size: 14px; font-weight: 600; color: #111827;">Automated Action Items</p>
                <p style="margin: 4px 0 0; font-size: 13px; color: #6b7280;">Low-scoring criteria automatically generate tracked action items with owners, due dates, and photo evidence for resolution.</p>
            </div>
            <div style="padding: 12px 0; border-bottom: 1px solid #f3f4f6;">
                <p style="margin: 0; font-size: 14px; font-weight: 600; color: #111827;">Real-Time Analytics</p>
                <p style="margin: 4px 0 0; font-size: 13px; color: #6b7280;">Track scores over time, compare locations, identify trends &mdash; all in real-time dashboards.</p>
            </div>
            <div style="padding: 12px 0;">
                <p style="margin: 0; font-size: 14px; font-weight: 600; color: #111827;">Smart Scheduling</p>
                <p style="margin: 4px 0 0; font-size: 13px; color: #6b7280;">Set up recurring evaluations and let StoreScore auto-create walks and notify evaluators.</p>
            </div>
        </div>
        {_drip_cta_button(demo_url, 'See It In Action')}'''

    elif step == 2:
        subject = 'Why store quality drives your bottom line'
        pricing_url = _utm(SITE_URL + '/pricing', 'drip', 'email', 'roi', 'cta_button')
        body = f'''
        <p style="margin: 0 0 16px; font-size: 14px; color: #374151;">
            Here's what we've seen across the multi-location businesses using StoreScore:
        </p>
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 0 0 24px;">
            <div style="margin: 0 0 16px;">
                <p style="margin: 0; font-size: 24px; font-weight: 700; color: #D40029;">40%</p>
                <p style="margin: 2px 0 0; font-size: 13px; color: #6b7280;">faster evaluations compared to paper checklists</p>
            </div>
            <div style="margin: 0 0 16px;">
                <p style="margin: 0; font-size: 24px; font-weight: 700; color: #D40029;">100%</p>
                <p style="margin: 2px 0 0; font-size: 13px; color: #6b7280;">visibility into action item follow-through</p>
            </div>
            <div>
                <p style="margin: 0; font-size: 24px; font-weight: 700; color: #D40029;">Real-time</p>
                <p style="margin: 2px 0 0; font-size: 13px; color: #6b7280;">analytics instead of waiting days for compiled reports</p>
            </div>
        </div>
        <p style="margin: 0 0 16px; font-size: 14px; color: #374151;">
            <strong>The connection is clear:</strong> consistent store quality drives better customer
            experiences, which drives repeat visits and higher sales. StoreScore gives you
            the tools to measure and improve that entire chain.
        </p>
        {_drip_cta_button(pricing_url, 'View Pricing')}'''

    elif step == 3:
        subject = 'Start using StoreScore for free'
        signup_url = _utm(SITE_URL + '/signup', 'drip', 'email', 'free_account', 'cta_button')
        pricing_url = _utm(SITE_URL + '/pricing', 'drip', 'email', 'free_account', 'text_link')
        body = f'''
        <p style="margin: 0 0 16px; font-size: 14px; color: #374151;">
            Ready to see what StoreScore can do for your locations?
        </p>
        <p style="margin: 0 0 16px; font-size: 14px; color: #374151;">
            Our <strong>Free plan</strong> includes everything you need to get started:
        </p>
        <ul style="margin: 0 0 24px; padding-left: 20px; font-size: 14px; color: #374151;">
            <li style="margin: 0 0 8px;">Up to 3 stores</li>
            <li style="margin: 0 0 8px;">1 scoring template</li>
            <li style="margin: 0 0 8px;">Unlimited evaluations</li>
            <li style="margin: 0 0 8px;">Basic reporting &amp; analytics</li>
            <li style="margin: 0 0 8px;">Action item tracking</li>
        </ul>
        <p style="margin: 0 0 24px; font-size: 14px; color: #374151;">
            No credit card required. Set up your account in under 5 minutes and start
            conducting your first store walk today.
        </p>
        {_drip_cta_button(signup_url, 'Get Started Free')}
        <p style="margin: 0; font-size: 13px; color: #9ca3af;">
            Need more stores or advanced features? Check out our
            <a href="{pricing_url}" style="color: #D40029;">paid plans</a>
            starting at $29/month.
        </p>'''
    else:
        return None, None

    html = _drip_email_wrapper(first_name, subject, body).replace('{email}', email)
    return subject, html


def _engagement_drip_cache_key(org_id, step):
    """Return a cache key to prevent duplicate engagement emails."""
    from django.utils import timezone
    date_str = timezone.now().strftime('%Y-%m-%d')
    return f'engagement_drip:{org_id}:{step}:{date_str}'


def send_engagement_drip_email(user, org, step, context):
    """
    Send an engagement-aware drip email for trialing orgs.
    Uses Django cache to prevent sending the same step more than once per day.
    Returns True on success.
    """
    from django.core.cache import cache

    if not settings.RESEND_API_KEY:
        return False

    cache_key = _engagement_drip_cache_key(org.id, step)
    if cache.get(cache_key):
        return False  # Already sent today

    resend.api_key = settings.RESEND_API_KEY
    first_name = context.get('first_name', 'there')

    subjects = {
        'add_store': 'Add your first store to StoreScore',
        'invite_team': 'Invite your team to StoreScore',
        'first_walk': 'Complete your first store walk',
        'trial_recap': f'{context.get("days_left", 3)} days left — here\'s what you\'ve built',
    }

    bodies = {
        'add_store': f'''
        <p style="margin: 0 0 16px; font-size: 14px; color: #374151;">
            You signed up for StoreScore — great move! The next step is to add your first store
            so you can start conducting evaluations.
        </p>
        <p style="margin: 0 0 16px; font-size: 14px; color: #374151;">
            It only takes 30 seconds: add your store name, address, and you're ready to go.
        </p>
        {_drip_cta_button(_utm(FRONTEND_URL + '/stores', 'engagement', 'email', 'add_store'), 'Add Your First Store')}''',

        'invite_team': f'''
        <p style="margin: 0 0 16px; font-size: 14px; color: #374151;">
            StoreScore works best as a team tool. Invite a regional manager or store evaluator
            to start building your quality management workflow.
        </p>
        <p style="margin: 0 0 16px; font-size: 14px; color: #374151;">
            Team members get their own login and can conduct evaluations from any device.
        </p>
        {_drip_cta_button(_utm(FRONTEND_URL + '/team', 'engagement', 'email', 'invite_team'), 'Invite Team Members')}''',

        'first_walk': f'''
        <p style="margin: 0 0 16px; font-size: 14px; color: #374151;">
            You've set up your stores — now it's time to conduct your first evaluation!
        </p>
        <p style="margin: 0 0 16px; font-size: 14px; color: #374151;">
            A store walk takes about 15-20 minutes and gives you a scored snapshot of your location's
            quality. You'll also get an AI-generated summary with prioritized recommendations.
        </p>
        {_drip_cta_button(_utm(FRONTEND_URL + '/evaluations', 'engagement', 'email', 'first_walk'), 'Start a Store Walk')}''',

        'trial_recap': f'''
        <p style="margin: 0 0 16px; font-size: 14px; color: #374151;">
            Your trial is wrapping up soon. Here's what you've accomplished with <strong>{context.get('org_name', 'your organization')}</strong>:
        </p>
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 0 0 24px;">
            <div style="display: flex; gap: 16px; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 100px; text-align: center;">
                    <p style="margin: 0; font-size: 24px; font-weight: 700; color: #D40029;">{context.get('store_count', 0)}</p>
                    <p style="margin: 2px 0 0; font-size: 12px; color: #6b7280;">Stores</p>
                </div>
                <div style="flex: 1; min-width: 100px; text-align: center;">
                    <p style="margin: 0; font-size: 24px; font-weight: 700; color: #D40029;">{context.get('member_count', 1)}</p>
                    <p style="margin: 2px 0 0; font-size: 12px; color: #6b7280;">Team members</p>
                </div>
                <div style="flex: 1; min-width: 100px; text-align: center;">
                    <p style="margin: 0; font-size: 24px; font-weight: 700; color: #D40029;">{context.get('walk_count', 0)}</p>
                    <p style="margin: 2px 0 0; font-size: 12px; color: #6b7280;">Walks completed</p>
                </div>
            </div>
        </div>
        <p style="margin: 0 0 16px; font-size: 14px; color: #374151;">
            Choose a plan to keep everything you've built and continue improving store quality.
        </p>
        {_drip_cta_button(_utm(FRONTEND_URL + '/billing', 'engagement', 'email', 'trial_recap'), 'Choose a Plan')}''',
    }

    subject = subjects.get(step)
    body = bodies.get(step)
    if not subject or not body:
        return False

    html = _drip_email_wrapper(first_name, subject, body).replace('{email}', user.email)

    try:
        resend.Emails.send({
            'from': settings.DEFAULT_FROM_EMAIL,
            'to': [user.email],
            'subject': subject,
            'html': html,
        })
        cache.set(cache_key, True, 60 * 60 * 24)  # Prevent re-send for 24h
        logger.info(f'Engagement drip [{step}] sent to {user.email} for org {org.name}')
        return True
    except Exception as e:
        logger.error(f'Failed to send engagement drip [{step}] to {user.email}: {e}')
        return False


def send_drip_email(drip_email_obj):
    """Send a single drip campaign email. Returns True on success."""
    if not settings.RESEND_API_KEY:
        logger.warning('RESEND_API_KEY not configured, skipping drip email')
        return False

    resend.api_key = settings.RESEND_API_KEY
    lead = drip_email_obj.lead

    subject, html = get_drip_email_content(drip_email_obj.step, lead)
    if not subject:
        logger.warning(f'Unknown drip step {drip_email_obj.step} for lead {lead.id}')
        return False

    try:
        resend.Emails.send({
            'from': settings.DEFAULT_FROM_EMAIL,
            'to': [lead.email],
            'subject': subject,
            'html': html,
        })
        logger.info(f'Drip email step {drip_email_obj.step} sent to {lead.email}')
        return True
    except Exception as e:
        logger.error(f'Failed to send drip email step {drip_email_obj.step} to {lead.email}: {e}')
        return False
