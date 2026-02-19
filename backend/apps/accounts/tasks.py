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

    login_url = 'https://app.storescore.app/login?utm_source=demo&utm_medium=email&utm_campaign=demo_welcome&utm_content=cta_button'

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


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def schedule_drip_campaign(self, lead_id: str):
    """
    Schedule the drip email series for a new lead.
    Called when a lead is created (either from demo request or email capture).

    Drip schedule:
      Step 0: Immediately (welcome / product intro)
      Step 1: Day 3 (feature deep-dive)
      Step 2: Day 7 (ROI & success stories)
      Step 3: Day 14 (free account offer)
    """
    from .leads import DripEmail, Lead

    try:
        lead = Lead.objects.get(id=lead_id)
    except Lead.DoesNotExist:
        logger.error(f'Lead {lead_id} not found for drip scheduling')
        return

    if lead.unsubscribed:
        logger.info(f'Lead {lead_id} is unsubscribed, skipping drip campaign')
        return

    now = timezone.now()
    drip_schedule = [
        (0, timedelta(minutes=2)),    # Welcome — slight delay for delivery
        (1, timedelta(days=3)),       # Feature deep-dive
        (2, timedelta(days=7)),       # ROI & success
        (3, timedelta(days=14)),      # Free account offer
    ]

    created_count = 0
    for step, delay in drip_schedule:
        _, was_created = DripEmail.objects.get_or_create(
            lead=lead,
            step=step,
            defaults={'scheduled_at': now + delay},
        )
        if was_created:
            created_count += 1

    logger.info(f'Scheduled {created_count} drip emails for lead {lead_id}')


@shared_task(bind=True, max_retries=2, default_retry_delay=30)
def send_ticket_notification(self, ticket_id: str):
    """Send email notification to platform admins when a new ticket is created."""
    from django.conf import settings as django_settings

    if not django_settings.RESEND_API_KEY:
        return

    from .models import SupportTicket
    try:
        ticket = SupportTicket.objects.select_related('user', 'organization').get(id=ticket_id)
    except SupportTicket.DoesNotExist:
        return

    import resend
    resend.api_key = django_settings.RESEND_API_KEY

    user_name = ticket.user.full_name if ticket.user else 'System'
    user_email = ticket.user.email if ticket.user else 'N/A'
    org_name = ticket.organization.name if ticket.organization else 'N/A'

    owner_email = getattr(django_settings, 'LEAD_NOTIFICATION_EMAIL', '') or django_settings.DEFAULT_FROM_EMAIL
    try:
        resend.Emails.send({
            'from': django_settings.DEFAULT_FROM_EMAIL,
            'to': [owner_email],
            'subject': f'New Support Ticket: {ticket.subject}',
            'html': f'''
                <h2>New Support Ticket</h2>
                <p><strong>From:</strong> {user_name} ({user_email})</p>
                <p><strong>Organization:</strong> {org_name}</p>
                <p><strong>Subject:</strong> {ticket.subject}</p>
                <p><strong>Priority:</strong> {ticket.priority}</p>
                <hr>
                <p>{ticket.description}</p>
            ''',
        })
    except Exception as e:
        logger.error(f'Failed to send ticket notification for {ticket_id}: {e}')


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def resolve_sentry_issue(self, external_id: str):
    """Resolve a Sentry issue via their API when the ticket is resolved locally."""
    import requests
    from django.conf import settings as django_settings

    auth_token = django_settings.SENTRY_AUTH_TOKEN
    if not auth_token:
        logger.warning('SENTRY_AUTH_TOKEN not configured, skipping Sentry resolve')
        return

    url = f'https://sentry.io/api/0/issues/{external_id}/'
    headers = {
        'Authorization': f'Bearer {auth_token}',
        'Content-Type': 'application/json',
    }

    try:
        resp = requests.put(url, json={'status': 'resolved'}, headers=headers, timeout=10)
        if resp.ok:
            logger.info(f'Resolved Sentry issue {external_id}')
        else:
            logger.error(f'Failed to resolve Sentry issue {external_id}: {resp.status_code} {resp.text}')
    except Exception as e:
        logger.error(f'Error resolving Sentry issue {external_id}: {e}')
        raise self.retry(exc=e)


@shared_task(bind=True, max_retries=1, default_retry_delay=60)
def check_trial_engagement(self):
    """
    Daily task: check engagement milestones for trialing orgs
    and schedule conditional drip emails for missing actions.
    """
    from apps.billing.models import Subscription
    from apps.stores.models import Store
    from .emails import send_engagement_drip_email
    from .models import Membership

    now = timezone.now()

    trialing_subs = Subscription.objects.filter(
        status='trialing',
        trial_end__gt=now,
    ).select_related('organization', 'organization__owner')

    sent_count = 0
    for sub in trialing_subs:
        org = sub.organization
        owner = org.owner
        days_since_start = (now - sub.trial_start).days if sub.trial_start else 0

        # Engagement checks
        has_stores = Store.objects.filter(organization=org).exists()
        has_team = Membership.objects.filter(organization=org).count() >= 2
        from apps.walks.models import Walk
        has_walks = Walk.objects.filter(organization=org, status='completed').exists()
        has_ai_summary = Walk.objects.filter(
            organization=org, ai_summary__isnull=False
        ).exclude(ai_summary='').exists()

        # Day 2: "Add your first store" if no stores
        if days_since_start >= 2 and not has_stores:
            if send_engagement_drip_email(owner, org, 'add_store', {
                'first_name': owner.first_name,
                'org_name': org.name,
            }):
                sent_count += 1

        # Day 5: "Invite your team" if solo
        elif days_since_start >= 5 and not has_team:
            if send_engagement_drip_email(owner, org, 'invite_team', {
                'first_name': owner.first_name,
                'org_name': org.name,
            }):
                sent_count += 1

        # Day 8: "Complete your first walk" if 0 walks
        elif days_since_start >= 8 and not has_walks:
            if send_engagement_drip_email(owner, org, 'first_walk', {
                'first_name': owner.first_name,
                'org_name': org.name,
            }):
                sent_count += 1

        # Day 11: "3 days left" with personalized stats
        elif days_since_start >= 11:
            store_count = Store.objects.filter(organization=org).count()
            member_count = Membership.objects.filter(organization=org).count()
            walk_count = Walk.objects.filter(organization=org, status='completed').count()
            if send_engagement_drip_email(owner, org, 'trial_recap', {
                'first_name': owner.first_name,
                'org_name': org.name,
                'store_count': store_count,
                'member_count': member_count,
                'walk_count': walk_count,
                'has_ai_summary': has_ai_summary,
                'days_left': max(0, (sub.trial_end - now).days),
            }):
                sent_count += 1

    if sent_count:
        logger.info(f'Engagement drip: sent {sent_count} emails')


@shared_task(bind=True, max_retries=1, default_retry_delay=60)
def process_drip_emails(self):
    """
    Periodic task: find all due drip emails and send them.
    Run hourly via Celery Beat.
    """
    from .emails import send_drip_email
    from .leads import DripEmail

    now = timezone.now()
    due_emails = (
        DripEmail.objects
        .filter(sent_at__isnull=True, scheduled_at__lte=now, lead__unsubscribed=False)
        .exclude(lead__status='closed')
        .select_related('lead')
        .order_by('scheduled_at')[:50]  # batch limit
    )

    sent = 0
    for drip in due_emails:
        success = send_drip_email(drip)
        if success:
            drip.sent_at = now
            drip.save(update_fields=['sent_at'])
            sent += 1

    if sent:
        logger.info(f'Drip campaign: sent {sent} emails')


@shared_task(bind=True)
def send_onboarding_reminder_emails(self):
    """
    Daily task: check orgs created in the last 3-7 days that haven't
    completed key onboarding steps. Send a reminder email to the org
    admins listing incomplete items.
    """
    from apps.stores.models import Store
    from apps.walks.models import Department, ScoringTemplate, Walk
    from .models import Membership, Organization

    import resend
    from django.conf import settings

    if not settings.RESEND_API_KEY:
        return

    resend.api_key = settings.RESEND_API_KEY
    now = timezone.now()

    # Check orgs created 3-7 days ago (send reminder once in this window)
    window_start = now - timedelta(days=7)
    window_end = now - timedelta(days=3)

    orgs = Organization.objects.filter(
        created_at__gte=window_start,
        created_at__lte=window_end,
        is_active=True,
    )

    sent_count = 0
    for org in orgs:
        # Build checklist
        checklist = []
        stores = Store.objects.filter(organization=org)
        departments = Department.objects.filter(organization=org)
        members = Membership.objects.filter(organization=org)
        templates = ScoringTemplate.objects.filter(organization=org)
        walks = Walk.objects.filter(organization=org, status='completed')

        org_configured = bool(org.industry and org.industry != 'retail')
        stores_with_depts = stores.filter(departments__isnull=False).distinct().count()

        items = [
            ('Configure organization settings', org_configured),
            ('Add a store', stores.exists()),
            ('Add departments', departments.exists()),
            ('Apply departments to stores', stores_with_depts > 0),
            ('Invite a team member', members.count() >= 2),
            ('Set up a scoring template', templates.exists()),
            ('Complete your first store walk', walks.exists()),
        ]

        incomplete = [(label, done) for label, done in items if not done]
        if not incomplete:
            continue  # All done, no reminder needed

        completed_count = len(items) - len(incomplete)

        # Get admin emails
        admin_emails = list(
            members.filter(role__in=['owner', 'admin'])
            .values_list('user__email', flat=True)
        )
        if not admin_emails:
            continue

        # Build email
        checklist_html = ''
        for label, done in items:
            icon = '&#9989;' if done else '&#9744;'
            style = 'color:#9ca3af;text-decoration:line-through;' if done else 'color:#374151;'
            checklist_html += f'<div style="padding:6px 0;font-size:14px;{style}">{icon} {label}</div>'

        pct = round((completed_count / len(items)) * 100)

        html = f'''<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:640px;margin:0 auto;padding:24px;">
<div style="background:#D40029;border-radius:12px 12px 0 0;padding:32px 24px;text-align:center;">
    <h1 style="color:white;margin:0;font-size:22px;">Complete Your StoreScore Setup</h1>
    <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">{org.name} — {pct}% complete</p>
</div>
<div style="background:white;padding:24px;border-radius:0 0 12px 12px;">
    <p style="margin:0 0 16px;font-size:14px;color:#374151;">
        You're making progress! Here's what's left to get the most out of StoreScore:
    </p>
    <div style="padding:16px;background:#f9fafb;border-radius:8px;margin-bottom:16px;">
        {checklist_html}
    </div>
    <div style="text-align:center;">
        <a href="https://storescore.app/getting-started"
           style="display:inline-block;padding:12px 32px;background:#D40029;color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">
            Continue Setup
        </a>
    </div>
</div>
<div style="text-align:center;padding:16px;">
    <p style="margin:0;font-size:11px;color:#9ca3af;">StoreScore — Store Quality Management</p>
</div>
</div></body></html>'''

        try:
            resend.Emails.send({
                'from': settings.DEFAULT_FROM_EMAIL,
                'to': admin_emails,
                'subject': f'Complete your StoreScore setup — {len(incomplete)} step(s) remaining',
                'html': html,
            })
            sent_count += 1
        except Exception as e:
            logger.error(f'Failed to send onboarding reminder for org {org.id}: {e}')

    if sent_count:
        logger.info(f'Onboarding reminders: sent {sent_count} emails')
