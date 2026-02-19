"""
Platform admin views — accessible only to is_staff / is_superuser users.
Provides org management across all franchises.
"""

from django.contrib.auth.hashers import make_password
from django.db import transaction

from django.utils.crypto import get_random_string
from django.utils.text import slugify
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.stores.models import Region, Store
from apps.stores.serializers import RegionSerializer, StoreSerializer
from apps.walks.models import Walk

from .models import Membership, Organization, User
from .serializers import MembershipSerializer, OrganizationSerializer, UserSerializer


class PlatformOrgListView(APIView):
    """
    GET  /api/v1/auth/platform/orgs/
        List all organizations with summary stats.

    POST /api/v1/auth/platform/orgs/
        Create a new organization + owner.
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        orgs = Organization.objects.select_related('owner').order_by('-created_at')

        data = []
        for org in orgs:
            store_ct = Store.objects.filter(organization=org).count()
            walk_ct = Walk.objects.filter(organization=org).count()
            completed_ct = Walk.objects.filter(
                organization=org, status='completed'
            ).count()
            member_ct = Membership.objects.filter(organization=org).count()
            last_walk = Walk.objects.filter(
                organization=org, status='completed'
            ).order_by('-completed_date').values_list('completed_date', flat=True).first()

            data.append({
                'id': str(org.id),
                'name': org.name,
                'slug': org.slug,
                'is_active': org.is_active,
                'owner': UserSerializer(org.owner).data,
                'member_count': member_ct,
                'store_count': store_ct,
                'walk_count': walk_ct,
                'completed_walk_count': completed_ct,
                'last_walk_date': last_walk.isoformat() if last_walk else None,
                'created_at': org.created_at.isoformat(),
            })

        return Response(data)

    @transaction.atomic
    def post(self, request):
        """Create a new organization with an owner."""
        org_name = request.data.get('name', '').strip()
        owner_email = request.data.get('owner_email', '').strip().lower()
        owner_first = request.data.get('owner_first_name', '').strip()
        owner_last = request.data.get('owner_last_name', '').strip()

        if not org_name:
            return Response(
                {'detail': 'Organization name is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not owner_email:
            return Response(
                {'detail': 'Owner email is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Create or get owner user
        user, created = User.objects.get_or_create(
            email=owner_email,
            defaults={
                'first_name': owner_first or 'Admin',
                'last_name': owner_last or '',
                'password': make_password(get_random_string(24)),
            },
        )

        # Create org with unique slug
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

        return Response({
            'id': str(org.id),
            'name': org.name,
            'slug': org.slug,
            'is_active': org.is_active,
            'owner': UserSerializer(user).data,
            'member_count': 1,
            'store_count': 0,
            'walk_count': 0,
            'completed_walk_count': 0,
            'last_walk_date': None,
            'created_at': org.created_at.isoformat(),
        }, status=status.HTTP_201_CREATED)


class PlatformOrgDetailView(APIView):
    """
    GET /api/v1/auth/platform/orgs/:id/
        Get org details with stores and members.
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request, org_id):
        try:
            org = Organization.objects.select_related('owner').get(id=org_id)
        except Organization.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)

        stores = Store.objects.filter(organization=org).select_related('region')
        members = Membership.objects.filter(
            organization=org
        ).select_related('user').order_by('created_at')
        regions = Region.objects.filter(organization=org)

        # Include subscription info if available
        subscription_data = None
        try:
            from apps.billing.models import Subscription
            sub = Subscription.objects.select_related('plan').get(organization=org)
            subscription_data = {
                'plan_name': sub.plan.name,
                'status': sub.status,
                'store_count': sub.store_count,
                'discount_percent': sub.discount_percent,
                'promo_discount_name': sub.promo_discount_name,
                'promo_discount_percent': sub.promo_discount_percent,
                'effective_discount_percent': sub.effective_discount_percent,
                'billing_interval': sub.billing_interval,
            }
        except Exception:
            pass

        return Response({
            'organization': {
                'id': str(org.id),
                'name': org.name,
                'slug': org.slug,
                'is_active': org.is_active,
                'owner': UserSerializer(org.owner).data,
                'created_at': org.created_at.isoformat(),
            },
            'stores': StoreSerializer(stores, many=True).data,
            'members': [
                {
                    'id': str(m.id),
                    'user': UserSerializer(m.user).data,
                    'role': m.role,
                    'created_at': m.created_at.isoformat(),
                }
                for m in members
            ],
            'regions': RegionSerializer(regions, many=True).data,
            'subscription': subscription_data,
        })

    def patch(self, request, org_id):
        try:
            org = Organization.objects.get(id=org_id)
        except Organization.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)

        name = request.data.get('name')
        if name:
            org.name = name.strip()
            org.save()

        # Handle promo discount fields
        promo_name = request.data.get('promo_discount_name')
        promo_percent = request.data.get('promo_discount_percent')

        if promo_name is not None or promo_percent is not None:
            from apps.billing.models import Subscription
            try:
                sub = Subscription.objects.get(organization=org)
                update_fields = ['updated_at']

                if promo_name is not None:
                    sub.promo_discount_name = str(promo_name).strip()
                    update_fields.append('promo_discount_name')

                if promo_percent is not None:
                    try:
                        pct = int(promo_percent)
                    except (TypeError, ValueError):
                        return Response(
                            {'detail': 'promo_discount_percent must be an integer.'},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    if not 0 <= pct <= 100:
                        return Response(
                            {'detail': 'promo_discount_percent must be between 0 and 100.'},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    sub.promo_discount_percent = pct
                    update_fields.append('promo_discount_percent')

                sub.save(update_fields=update_fields)

                # Sync coupon to Stripe immediately if subscription is active
                if sub.stripe_subscription_id:
                    _apply_promo_to_stripe(sub)

            except Subscription.DoesNotExist:
                pass

        return Response({
            'id': str(org.id),
            'name': org.name,
            'slug': org.slug,
        })


def _apply_promo_to_stripe(sub):
    """Apply or remove promo coupon on a Stripe subscription."""
    import logging
    from django.conf import settings as django_settings

    logger = logging.getLogger(__name__)

    if not django_settings.STRIPE_SECRET_KEY:
        return

    import stripe
    stripe.api_key = django_settings.STRIPE_SECRET_KEY

    try:
        if sub.promo_discount_percent > 0:
            coupon_id = f'PROMO_{sub.promo_discount_percent}'
            # Create coupon if it doesn't exist
            try:
                stripe.Coupon.retrieve(coupon_id)
            except stripe.error.InvalidRequestError:
                stripe.Coupon.create(
                    id=coupon_id,
                    percent_off=sub.promo_discount_percent,
                    duration='forever',
                    name=f'Promotional Discount ({sub.promo_discount_percent}%)',
                )
            stripe.Subscription.modify(sub.stripe_subscription_id, coupon=coupon_id)
        else:
            # Promo removed — revert to volume discount coupon if applicable
            from apps.billing.views import VOLUME_COUPON_MAP
            volume_coupon = VOLUME_COUPON_MAP.get(sub.discount_percent, '')
            stripe.Subscription.modify(sub.stripe_subscription_id, coupon=volume_coupon or '')
    except Exception as e:
        logger.error(f'Failed to apply promo coupon for {sub.organization}: {e}')


class PlatformOrgStoresView(APIView):
    """
    POST /api/v1/auth/platform/orgs/:id/stores/
        Create a store under a specific organization.
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request, org_id):
        try:
            org = Organization.objects.get(id=org_id)
        except Organization.DoesNotExist:
            return Response({'detail': 'Organization not found.'}, status=404)

        data = request.data.copy()
        serializer = StoreSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        store = serializer.save(organization=org)
        return Response(
            StoreSerializer(store).data,
            status=status.HTTP_201_CREATED,
        )


class PlatformStatsView(APIView):
    """
    GET /api/v1/auth/platform/stats/
        Platform-wide statistics.
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        return Response({
            'total_organizations': Organization.objects.count(),
            'total_stores': Store.objects.count(),
            'total_users': User.objects.count(),
            'total_walks': Walk.objects.count(),
            'total_completed_walks': Walk.objects.filter(status='completed').count(),
        })


class PlatformEngagementView(APIView):
    """GET /api/v1/auth/platform/engagement/ — aggregated engagement stats."""
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        from django.db.models import Count, Q
        from django.utils import timezone
        from datetime import timedelta

        from apps.billing.models import Subscription

        now = timezone.now()
        thirty_days_ago = now - timedelta(days=30)

        # Subscription status counts
        trialing = Subscription.objects.filter(status='trialing').count()
        active = Subscription.objects.filter(status='active').count()
        canceled = Subscription.objects.filter(status='canceled').count()

        # Conversion rate
        total_trials = Subscription.objects.filter(trial_start__isnull=False).count()
        converted = Subscription.objects.filter(
            trial_start__isnull=False, status='active',
        ).count()
        conversion_rate = round(converted / total_trials * 100, 1) if total_trials > 0 else 0

        # Engagement tiers (by completed walk count)
        # OrgScopedModel uses related_name='%(app_label)s_%(class)ss',
        # so Organization -> Walk is 'walks_walks'
        orgs_with_walks = Organization.objects.annotate(
            walk_count=Count('walks_walks', filter=Q(walks_walks__status='completed'))
        )
        zero_walks = orgs_with_walks.filter(walk_count=0).count()
        one_to_five = orgs_with_walks.filter(walk_count__gte=1, walk_count__lte=5).count()
        five_plus = orgs_with_walks.filter(walk_count__gt=5).count()

        # Average walks per org
        total_orgs = Organization.objects.count()
        total_completed = Walk.objects.filter(status='completed').count()
        avg_walks = round(total_completed / total_orgs, 1) if total_orgs > 0 else 0

        # Recent signups (last 30 days, grouped by day)
        recent_orgs = Organization.objects.filter(
            created_at__gte=thirty_days_ago,
        ).extra(select={'day': "DATE(created_at)"}).values('day').annotate(
            count=Count('id'),
        ).order_by('day')

        return Response({
            'total_orgs': total_orgs,
            'trialing': trialing,
            'active': active,
            'canceled': canceled,
            'conversion_rate': conversion_rate,
            'avg_walks_per_org': avg_walks,
            'engagement_tiers': {
                'zero_walks': zero_walks,
                'one_to_five': one_to_five,
                'five_plus': five_plus,
            },
            'recent_signups': list(recent_orgs),
        })


class PlatformLeadFunnelView(APIView):
    """GET /api/v1/auth/platform/lead-funnel/ — lead conversion funnel."""
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        from django.db.models import Count

        from .leads import Lead

        # Lead counts by source
        by_source = list(
            Lead.objects.values('source').annotate(count=Count('id')).order_by('-count')
        )

        # Lead counts by status
        by_status = list(
            Lead.objects.values('status').annotate(count=Count('id')).order_by('-count')
        )

        # Conversion by source
        conversion_by_source = []
        sources = Lead.objects.values_list('source', flat=True).distinct()
        for src in sources:
            total = Lead.objects.filter(source=src).count()
            converted = Lead.objects.filter(source=src, status='converted').count()
            rate = round(converted / total * 100, 1) if total > 0 else 0
            conversion_by_source.append({
                'source': src,
                'total': total,
                'converted': converted,
                'rate': rate,
            })

        return Response({
            'total_leads': Lead.objects.count(),
            'by_source': by_source,
            'by_status': by_status,
            'conversion_by_source': conversion_by_source,
        })


class PlatformOrgActivationView(APIView):
    """POST /api/v1/auth/platform/orgs/:id/activation/ — activate or deactivate an org."""
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request, org_id):
        try:
            org = Organization.objects.get(id=org_id)
        except Organization.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)

        action = request.data.get('action')
        if action not in ('activate', 'deactivate'):
            return Response(
                {'detail': 'action must be "activate" or "deactivate".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        org.is_active = (action == 'activate')
        org.save(update_fields=['is_active'])
        return Response({'id': str(org.id), 'is_active': org.is_active})


class PlatformOrgStoreImportView(APIView):
    """POST /api/v1/auth/platform/orgs/:id/stores/import/ — bulk import stores from CSV."""
    permission_classes = [IsAuthenticated, IsAdminUser]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, org_id):
        import csv
        import io

        try:
            org = Organization.objects.get(id=org_id)
        except Organization.DoesNotExist:
            return Response({'detail': 'Organization not found.'}, status=404)

        csv_file = request.FILES.get('file')
        if not csv_file:
            return Response({'detail': 'No CSV file provided.'}, status=status.HTTP_400_BAD_REQUEST)

        import json
        mapping_raw = request.data.get('column_mapping', '{}')
        try:
            mapping = json.loads(mapping_raw) if isinstance(mapping_raw, str) else mapping_raw
        except json.JSONDecodeError:
            return Response({'detail': 'Invalid column_mapping JSON.'}, status=status.HTTP_400_BAD_REQUEST)

        content = csv_file.read().decode('utf-8-sig')
        reader = csv.reader(io.StringIO(content))
        rows = list(reader)

        if len(rows) < 2:
            return Response({'detail': 'CSV must have header + data rows.'}, status=status.HTTP_400_BAD_REQUEST)

        # Build region lookup
        region_map = {}
        for r in Region.objects.filter(organization=org):
            region_map[r.name.lower()] = r

        created = 0
        errors = []
        for row_idx, row in enumerate(rows[1:], start=2):
            try:
                name = row[mapping.get('name', 0)].strip()
                store_number = row[mapping.get('store_number', 1)].strip() if len(row) > mapping.get('store_number', 1) else ''
                address = row[mapping.get('address', 2)].strip() if len(row) > mapping.get('address', 2) else ''
                city = row[mapping.get('city', 3)].strip() if len(row) > mapping.get('city', 3) else ''
                state_val = row[mapping.get('state', 4)].strip() if len(row) > mapping.get('state', 4) else ''
                zip_code = row[mapping.get('zip_code', 5)].strip() if len(row) > mapping.get('zip_code', 5) else ''
                region_name = row[mapping.get('region', 6)].strip() if len(row) > mapping.get('region', 6) else ''

                if not name:
                    errors.append(f'Row {row_idx}: Missing store name.')
                    continue

                region = region_map.get(region_name.lower()) if region_name else None

                Store.objects.create(
                    organization=org,
                    name=name,
                    store_number=store_number,
                    address=address,
                    city=city,
                    state=state_val,
                    zip_code=zip_code,
                    region=region,
                )
                created += 1
            except (IndexError, ValueError) as e:
                errors.append(f'Row {row_idx}: {e}')

        return Response({'created': created, 'errors': errors[:20]}, status=status.HTTP_201_CREATED)


class LeadListView(APIView):
    """GET/POST /api/v1/auth/leads/ — list leads (admin) or create lead (public)."""

    def get_permissions(self):
        if self.request.method == 'POST':
            return [AllowAny()]
        return [IsAuthenticated(), IsAdminUser()]

    def get(self, request):
        from .leads import Lead
        leads = Lead.objects.all().order_by('-created_at')
        data = []
        for lead in leads:
            data.append({
                'id': str(lead.id),
                'email': lead.email,
                'first_name': lead.first_name,
                'last_name': lead.last_name,
                'company_name': lead.company_name,
                'phone': lead.phone,
                'store_count': lead.store_count,
                'message': lead.message,
                'status': lead.status,
                'source': lead.source,
                'demo_org': str(lead.demo_org_id) if lead.demo_org_id else None,
                'demo_expires_at': lead.demo_expires_at.isoformat() if lead.demo_expires_at else None,
                'created_at': lead.created_at.isoformat(),
            })
        return Response(data)

    def post(self, request):
        from .leads import Lead

        email = request.data.get('email', '').strip().lower()
        first_name = request.data.get('first_name', '').strip()
        last_name = request.data.get('last_name', '').strip()

        if not email or not first_name or not last_name:
            return Response(
                {'detail': 'email, first_name, and last_name are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        lead = Lead.objects.create(
            email=email,
            first_name=first_name,
            last_name=last_name,
            company_name=request.data.get('company_name', '').strip(),
            phone=request.data.get('phone', '').strip(),
            store_count=request.data.get('store_count'),
            message=request.data.get('message', '').strip(),
            source=request.data.get('source', 'website'),
        )

        # Trigger async demo setup + drip campaign
        from .tasks import schedule_drip_campaign, setup_demo_for_lead
        setup_demo_for_lead.delay(str(lead.id))
        schedule_drip_campaign.delay(str(lead.id))

        return Response({
            'id': str(lead.id),
            'message': 'Thank you! Check your email for demo access details.',
        }, status=status.HTTP_201_CREATED)


class LeadDetailView(APIView):
    """GET/PATCH /api/v1/auth/leads/:id/ — view/update lead status."""
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request, lead_id):
        from .leads import Lead
        try:
            lead = Lead.objects.select_related('demo_org').get(id=lead_id)
        except Lead.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)

        return Response({
            'id': str(lead.id),
            'email': lead.email,
            'first_name': lead.first_name,
            'last_name': lead.last_name,
            'company_name': lead.company_name,
            'phone': lead.phone,
            'store_count': lead.store_count,
            'message': lead.message,
            'status': lead.status,
            'source': lead.source,
            'demo_org': {
                'id': str(lead.demo_org.id),
                'name': lead.demo_org.name,
            } if lead.demo_org else None,
            'demo_expires_at': lead.demo_expires_at.isoformat() if lead.demo_expires_at else None,
            'created_at': lead.created_at.isoformat(),
        })

    def patch(self, request, lead_id):
        from .leads import Lead
        try:
            lead = Lead.objects.get(id=lead_id)
        except Lead.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)

        new_status = request.data.get('status')
        if new_status:
            lead.status = new_status
            lead.save(update_fields=['status'])

        return Response({'id': str(lead.id), 'status': lead.status})


class ChatLeadView(APIView):
    """POST /api/v1/auth/chat-lead/ — capture leads from the guided chat widget."""
    permission_classes = [AllowAny]

    def post(self, request):
        import json
        import logging

        logger = logging.getLogger(__name__)

        from .leads import Lead

        name = request.data.get('name', '').strip()
        email = request.data.get('email', '').strip().lower()
        phone = request.data.get('phone', '').strip()
        answers = request.data.get('answers', {})
        page = request.data.get('page', '')

        if not email:
            return Response(
                {'detail': 'email is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Parse name into first/last
        name_parts = name.split(' ', 1)
        first_name = name_parts[0] if name_parts else email.split('@')[0]
        last_name = name_parts[1] if len(name_parts) > 1 else ''

        # Build a summary message from the chat answers
        summary_parts = []
        answer_labels = {
            'greeting': 'Intent',
            'role': 'Role',
            'store-count': 'Store count',
            'current-process': 'Current process',
            'pain-point': 'Pain point',
            'question-topic': 'Question topic',
        }
        for key, label in answer_labels.items():
            if key in answers:
                summary_parts.append(f'{label}: {answers[key]}')
        if page:
            summary_parts.append(f'Page: {page}')

        message = '\n'.join(summary_parts)

        # Check for existing lead
        existing = Lead.objects.filter(email=email).first()
        if existing:
            # Update the existing lead with new chat context
            existing.message = (existing.message + '\n\n--- Chat Widget ---\n' + message).strip()
            if phone and not existing.phone:
                existing.phone = phone
            existing.save(update_fields=['message', 'phone'])

            # Still send notification email
            self._send_notification(existing, answers, page)

            return Response({
                'id': str(existing.id),
                'message': 'Thanks! Someone will reach out shortly.',
            }, status=status.HTTP_200_OK)

        lead = Lead.objects.create(
            email=email,
            first_name=first_name,
            last_name=last_name,
            phone=phone,
            message=message,
            source='chat-widget',
        )

        # Schedule drip campaign
        from .tasks import schedule_drip_campaign
        schedule_drip_campaign.delay(str(lead.id))

        # Send notification email
        self._send_notification(lead, answers, page)

        return Response({
            'id': str(lead.id),
            'message': 'Thanks! Someone will reach out shortly.',
        }, status=status.HTTP_201_CREATED)

    @staticmethod
    def _send_notification(lead, answers, page):
        """Send an email notification to the site owner about the new chat lead."""
        import logging

        import resend
        from django.conf import settings

        logger = logging.getLogger(__name__)

        if not settings.RESEND_API_KEY:
            logger.warning('RESEND_API_KEY not configured, skipping chat lead notification')
            return

        resend.api_key = settings.RESEND_API_KEY

        answer_labels = {
            'greeting': 'Intent',
            'role': 'Role',
            'store-count': 'Store count',
            'current-process': 'Current process',
            'pain-point': 'Pain point',
            'question-topic': 'Question topic',
        }

        answers_html = ''
        for key, label in answer_labels.items():
            if key in answers:
                answers_html += f'<tr><td style="padding:4px 12px 4px 0;font-size:13px;color:#6b7280;font-weight:600;">{label}</td><td style="padding:4px 0;font-size:13px;color:#111827;">{answers[key]}</td></tr>'

        html = f'''<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:640px;margin:0 auto;padding:24px;">
    <div style="background-color:#D40029;border-radius:12px 12px 0 0;padding:24px;text-align:center;">
        <h1 style="color:white;margin:0;font-size:18px;font-weight:700;">New Chat Lead</h1>
        <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:13px;">Someone wants to talk via the chat widget</p>
    </div>
    <div style="background-color:white;padding:24px;">
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:0 0 16px;">
            <p style="margin:0 0 4px;font-size:14px;color:#111827;"><strong>Name:</strong> {lead.first_name} {lead.last_name}</p>
            <p style="margin:0 0 4px;font-size:14px;color:#111827;"><strong>Email:</strong> {lead.email}</p>
            <p style="margin:0 0 4px;font-size:14px;color:#111827;"><strong>Phone:</strong> {lead.phone or '(not provided)'}</p>
            <p style="margin:0;font-size:14px;color:#111827;"><strong>Page:</strong> {page or '(unknown)'}</p>
        </div>
        {f'<table style="width:100%;border-collapse:collapse;margin:0 0 16px;">{answers_html}</table>' if answers_html else ''}
        <p style="margin:0;font-size:12px;color:#9ca3af;">Source: Chat widget &middot; Lead ID: {lead.id}</p>
    </div>
    <div style="padding:16px;text-align:center;background-color:white;border-top:1px solid #e5e7eb;border-radius:0 0 12px 12px;">
        <p style="margin:0;font-size:11px;color:#9ca3af;">StoreScore — Store Quality Management</p>
    </div>
</div>
</body>
</html>'''

        try:
            # Send to the site owner
            owner_email = getattr(settings, 'LEAD_NOTIFICATION_EMAIL', '') or settings.DEFAULT_FROM_EMAIL
            resend.Emails.send({
                'from': settings.DEFAULT_FROM_EMAIL,
                'to': [owner_email],
                'subject': f'Chat Lead: {lead.first_name} {lead.last_name} ({lead.email})',
                'html': html,
            })
            logger.info(f'Chat lead notification sent for {lead.email}')
        except Exception as e:
            logger.error(f'Failed to send chat lead notification for {lead.email}: {e}')


class EmailCaptureView(APIView):
    """POST /api/v1/auth/email-capture/ — lightweight lead capture (email + optional name)."""
    permission_classes = [AllowAny]

    def post(self, request):
        from .leads import Lead

        email = request.data.get('email', '').strip().lower()
        if not email:
            return Response(
                {'detail': 'email is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        first_name = request.data.get('first_name', '').strip() or email.split('@')[0]
        source = request.data.get('source', 'homepage')

        # Check if lead already exists with this email
        existing = Lead.objects.filter(email=email).first()
        if existing:
            return Response({
                'id': str(existing.id),
                'message': 'Thanks! We\'ll be in touch.',
                'existing': True,
            }, status=status.HTTP_200_OK)

        lead = Lead.objects.create(
            email=email,
            first_name=first_name,
            last_name=request.data.get('last_name', '').strip(),
            company_name=request.data.get('company_name', '').strip(),
            source=source,
        )

        # Schedule drip campaign (no full demo setup for email-only captures)
        from .tasks import schedule_drip_campaign
        schedule_drip_campaign.delay(str(lead.id))

        return Response({
            'id': str(lead.id),
            'message': 'Thanks! We\'ll be in touch.',
        }, status=status.HTTP_201_CREATED)
