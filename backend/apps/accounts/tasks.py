"""
Celery tasks for account operations — demo provisioning, cleanup, lead emails.
"""
import logging
from datetime import timedelta

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def setup_demo_for_lead(self, lead_id: str):
    """
    After a lead submits the request demo form:
    1. Create a demo Organization
    2. Create a User account with temporary password
    3. Create Membership (role: owner)
    4. Copy demo data (template, stores, sample walks)
    5. Set demo expiry (14 days)
    6. Send welcome email with login credentials
    """
    from django.contrib.auth.hashers import make_password
    from django.utils.crypto import get_random_string
    from django.utils.text import slugify

    from .leads import Lead
    from .models import Membership, Organization, User

    try:
        lead = Lead.objects.get(id=lead_id)
    except Lead.DoesNotExist:
        logger.error(f'Lead {lead_id} not found')
        return

    # Create or get user
    temp_password = get_random_string(12)
    user, created = User.objects.get_or_create(
        email=lead.email,
        defaults={
            'first_name': lead.first_name,
            'last_name': lead.last_name,
            'password': make_password(temp_password),
        },
    )

    if not created:
        # User already exists — just set a new temp password
        user.set_password(temp_password)
        user.save(update_fields=['password'])

    # Create demo org
    company = lead.company_name or f'{lead.first_name} {lead.last_name}'
    org_name = f'{company} Demo'
    base_slug = slugify(org_name)
    slug = base_slug
    counter = 1
    while Organization.objects.filter(slug=slug).exists():
        slug = f'{base_slug}-{counter}'
        counter += 1

    org = Organization.objects.create(
        name=org_name,
        slug=slug,
        owner=user,
    )

    # Create owner membership
    Membership.objects.create(
        user=user,
        organization=org,
        role=Membership.Role.OWNER,
    )

    # Create demo data: regions, stores, template
    from apps.stores.models import Region, Store

    region = Region.objects.create(
        organization=org,
        name='Demo Region',
    )

    demo_stores = [
        ('Demo Store #1 — Downtown', '001', '123 Main St', 'Anytown', 'CA', '90210'),
        ('Demo Store #2 — Westside', '002', '456 Oak Ave', 'Anytown', 'CA', '90211'),
        ('Demo Store #3 — Eastside', '003', '789 Elm Dr', 'Anytown', 'CA', '90212'),
    ]
    for name, num, addr, city, state, zipcode in demo_stores:
        Store.objects.create(
            organization=org,
            name=name,
            store_number=num,
            address=addr,
            city=city,
            state=state,
            zip_code=zipcode,
            region=region,
        )

    # Create a demo scoring template
    from apps.walks.models import Criterion, ScoringTemplate, Section

    template = ScoringTemplate.objects.create(
        organization=org,
        name='Demo Store Walk Template',
        is_active=True,
    )
    sections_data = [
        ('Store Appearance', 30, [
            'Exterior signage clean and visible',
            'Entrance area clean and inviting',
            'Floors clean and well-maintained',
        ]),
        ('Product Display', 40, [
            'Shelves fully stocked',
            'Products properly priced',
            'Displays organized and attractive',
            'No expired products visible',
        ]),
        ('Customer Service', 30, [
            'Staff visible and available',
            'Staff greeting customers',
        ]),
    ]
    for idx, (section_name, weight, criteria) in enumerate(sections_data):
        section = Section.objects.create(
            template=template,
            name=section_name,
            order=idx,
            weight=weight,
        )
        for c_idx, criterion_name in enumerate(criteria):
            Criterion.objects.create(
                section=section,
                name=criterion_name,
                order=c_idx,
                max_points=5,
            )

    # Set demo expiry
    lead.demo_org = org
    lead.demo_expires_at = timezone.now() + timedelta(days=14)
    lead.status = 'demo_active'
    lead.save(update_fields=['demo_org', 'demo_expires_at', 'status'])

    # Send welcome email
    _send_demo_welcome_email(lead, user, temp_password, org)

    logger.info(f'Demo setup complete for lead {lead_id}: org={org.id}')


def _send_demo_welcome_email(lead, user, temp_password, org):
    """Send branded welcome email with demo login credentials."""
    import resend
    from django.conf import settings

    if not settings.RESEND_API_KEY:
        logger.warning('RESEND_API_KEY not configured, skipping demo welcome email')
        return

    resend.api_key = settings.RESEND_API_KEY

    login_url = 'https://app.storescore.app/login'

    html = f'''<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
<div style="max-width: 640px; margin: 0 auto; padding: 24px;">

    <div style="background-color: #D40029; border-radius: 12px 12px 0 0; padding: 32px 24px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 700;">Welcome to StoreScore!</h1>
        <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">Your demo is ready</p>
    </div>

    <div style="background-color: white; padding: 32px 24px;">
        <p style="margin: 0 0 16px; font-size: 14px; color: #374151;">Hi {lead.first_name},</p>
        <p style="margin: 0 0 16px; font-size: 14px; color: #374151;">
            Thank you for your interest in StoreScore! We've set up a demo environment for you with sample stores
            and a scoring template so you can see the platform in action.
        </p>

        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <p style="margin: 0 0 8px; font-size: 13px; color: #6b7280; font-weight: 600;">YOUR LOGIN CREDENTIALS</p>
            <p style="margin: 0 0 4px; font-size: 14px; color: #111827;"><strong>Email:</strong> {user.email}</p>
            <p style="margin: 0 0 4px; font-size: 14px; color: #111827;"><strong>Password:</strong> {temp_password}</p>
            <p style="margin: 0; font-size: 14px; color: #111827;"><strong>Organization:</strong> {org.name}</p>
        </div>

        <div style="text-align: center; margin: 32px 0;">
            <a href="{login_url}" style="display: inline-block; background-color: #D40029; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                Log In to Your Demo
            </a>
        </div>

        <p style="margin: 0 0 8px; font-size: 13px; color: #6b7280;">
            Your demo access expires in 14 days. During this time you can:
        </p>
        <ul style="margin: 0 0 16px; padding-left: 20px; font-size: 13px; color: #6b7280;">
            <li>Create and conduct store walks</li>
            <li>See AI-generated walk summaries</li>
            <li>Explore reports and analytics</li>
            <li>Invite team members</li>
        </ul>
        <p style="margin: 0; font-size: 13px; color: #9ca3af;">
            Questions? Reply to this email and we'll be happy to help.
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
            'subject': 'Your StoreScore Demo is Ready!',
            'html': html,
        })
        logger.info(f'Demo welcome email sent to {user.email}')
    except Exception as e:
        logger.error(f'Failed to send demo welcome email to {user.email}: {e}')


@shared_task(bind=True, max_retries=1, default_retry_delay=60)
def cleanup_expired_demos(self):
    """
    Periodic task: find leads with expired demos and deactivate their orgs.
    Run daily via Celery Beat.
    """
    from .leads import Lead
    from .models import Organization

    now = timezone.now()
    expired_leads = Lead.objects.filter(
        demo_expires_at__lt=now,
        status='demo_active',
        demo_org__isnull=False,
    ).select_related('demo_org')

    deactivated = 0
    for lead in expired_leads:
        org = lead.demo_org
        if org and org.is_active:
            org.is_active = False
            org.save(update_fields=['is_active'])
            deactivated += 1

        lead.status = 'closed'
        lead.save(update_fields=['status'])

    logger.info(f'Demo cleanup: deactivated {deactivated} expired demo orgs')
