import logging

from django.conf import settings as django_settings
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsOrgAdmin, IsOrgMember

from .models import Invoice, Plan, Subscription
from .serializers import InvoiceSerializer, PlanSerializer, SubscriptionSerializer

logger = logging.getLogger(__name__)


class PlanListView(APIView):
    """List available subscription plans. Public endpoint."""
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        plans = Plan.objects.filter(is_active=True).order_by('display_order')
        serializer = PlanSerializer(plans, many=True)
        return Response(serializer.data)


class SubscriptionView(APIView):
    """Get the current organization's subscription."""
    permission_classes = [IsAuthenticated, IsOrgMember]

    def get(self, request):
        try:
            subscription = Subscription.objects.select_related('plan').get(
                organization=request.org,
            )
        except Subscription.DoesNotExist:
            return Response(
                {'detail': 'No subscription found. Contact support.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(SubscriptionSerializer(subscription).data)


class CheckoutView(APIView):
    """Create a Stripe Checkout session for new subscription or plan change."""
    permission_classes = [IsAuthenticated, IsOrgAdmin]

    def post(self, request):
        import stripe
        stripe.api_key = django_settings.STRIPE_SECRET_KEY

        if not stripe.api_key:
            return Response(
                {'detail': 'Stripe is not configured.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        plan_slug = request.data.get('plan')
        billing_interval = request.data.get('billing_interval', 'monthly')
        success_url = request.data.get('success_url', '')
        cancel_url = request.data.get('cancel_url', '')

        try:
            plan = Plan.objects.get(slug=plan_slug, is_active=True)
        except Plan.DoesNotExist:
            return Response(
                {'detail': 'Invalid plan.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        price_id = (
            plan.stripe_price_id_annual if billing_interval == 'annual'
            else plan.stripe_price_id_monthly
        )
        if not price_id:
            return Response(
                {'detail': 'Stripe price not configured for this plan.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # Get or create subscription record
        subscription, _created = Subscription.objects.get_or_create(
            organization=request.org,
            defaults={'plan': plan, 'store_count': 1},
        )

        # Get or create Stripe customer
        if not subscription.stripe_customer_id:
            customer = stripe.Customer.create(
                email=request.user.email,
                name=request.org.name,
                metadata={
                    'organization_id': str(request.org.id),
                    'organization_name': request.org.name,
                },
            )
            subscription.stripe_customer_id = customer.id
            subscription.save(update_fields=['stripe_customer_id'])

        # Count active stores for quantity
        from apps.stores.models import Store
        store_count = Store.objects.filter(
            organization=request.org, is_active=True,
        ).count()
        store_count = max(store_count, 1)

        try:
            checkout_session = stripe.checkout.Session.create(
                customer=subscription.stripe_customer_id,
                mode='subscription',
                line_items=[{
                    'price': price_id,
                    'quantity': store_count,
                }],
                subscription_data={
                    'trial_period_days': 30,
                    'metadata': {
                        'organization_id': str(request.org.id),
                        'plan_slug': plan.slug,
                    },
                },
                success_url=success_url or f'{request.build_absolute_uri("/billing")}?success=true',
                cancel_url=cancel_url or request.build_absolute_uri('/billing'),
                metadata={
                    'organization_id': str(request.org.id),
                },
            )

            # Update local subscription record
            subscription.plan = plan
            subscription.billing_interval = billing_interval
            subscription.store_count = store_count
            subscription.save(update_fields=['plan', 'billing_interval', 'store_count'])

            return Response({'checkout_url': checkout_session.url})

        except stripe.error.StripeError as e:
            logger.error(f'Stripe checkout error: {e}')
            return Response(
                {'detail': 'Failed to create checkout session.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )


class CustomerPortalView(APIView):
    """Create a Stripe Customer Portal session for billing management."""
    permission_classes = [IsAuthenticated, IsOrgAdmin]

    def post(self, request):
        import stripe
        stripe.api_key = django_settings.STRIPE_SECRET_KEY

        if not stripe.api_key:
            return Response(
                {'detail': 'Stripe is not configured.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            subscription = Subscription.objects.get(organization=request.org)
        except Subscription.DoesNotExist:
            return Response(
                {'detail': 'No subscription found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not subscription.stripe_customer_id:
            return Response(
                {'detail': 'No Stripe customer associated with this organization.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return_url = request.data.get('return_url', request.build_absolute_uri('/billing'))

        try:
            portal_session = stripe.billing_portal.Session.create(
                customer=subscription.stripe_customer_id,
                return_url=return_url,
            )
            return Response({'portal_url': portal_session.url})

        except stripe.error.StripeError as e:
            logger.error(f'Stripe portal error: {e}')
            return Response(
                {'detail': 'Failed to create portal session.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )


class InvoiceListView(APIView):
    """List invoices for the current organization."""
    permission_classes = [IsAuthenticated, IsOrgAdmin]

    def get(self, request):
        try:
            subscription = Subscription.objects.get(organization=request.org)
        except Subscription.DoesNotExist:
            return Response([])

        invoices = Invoice.objects.filter(subscription=subscription).order_by('-period_start')
        serializer = InvoiceSerializer(invoices, many=True)
        return Response(serializer.data)


class UpdateStoreCountView(APIView):
    """Sync the billable store count with Stripe."""
    permission_classes = [IsAuthenticated, IsOrgAdmin]

    def post(self, request):
        import stripe
        stripe.api_key = django_settings.STRIPE_SECRET_KEY

        try:
            subscription = Subscription.objects.select_related('plan').get(
                organization=request.org,
            )
        except Subscription.DoesNotExist:
            return Response(
                {'detail': 'No subscription found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        from apps.stores.models import Store
        new_count = Store.objects.filter(
            organization=request.org, is_active=True,
        ).count()
        new_count = max(new_count, 1)

        old_count = subscription.store_count
        subscription.store_count = new_count

        # Update volume discount
        new_discount = Subscription.get_volume_discount(new_count)
        subscription.discount_percent = new_discount
        subscription.save(update_fields=['store_count', 'discount_percent', 'updated_at'])

        # Update Stripe subscription quantity and coupon if we have one
        if subscription.stripe_subscription_id and stripe.api_key:
            try:
                stripe_sub = stripe.Subscription.retrieve(subscription.stripe_subscription_id)
                if stripe_sub['items']['data']:
                    stripe.SubscriptionItem.modify(
                        stripe_sub['items']['data'][0].id,
                        quantity=new_count,
                    )

                # Promo discount overrides volume discount for Stripe coupon
                if subscription.promo_discount_percent > 0:
                    coupon_id = _get_or_create_promo_coupon(subscription.promo_discount_percent)
                else:
                    coupon_id = _get_stripe_coupon_id(new_discount)
                stripe.Subscription.modify(
                    subscription.stripe_subscription_id,
                    coupon=coupon_id or '',
                )
            except stripe.error.StripeError as e:
                logger.error(f'Failed to update Stripe subscription: {e}')

        return Response({
            'store_count': new_count,
            'previous_count': old_count,
            'discount_percent': new_discount,
        })


VOLUME_COUPON_MAP = {
    5: 'VOLUME_3',
    10: 'VOLUME_5',
    15: 'VOLUME_10',
    20: 'VOLUME_25',
}


def _get_stripe_coupon_id(discount_percent):
    """Map a volume discount percentage to the Stripe coupon ID."""
    return VOLUME_COUPON_MAP.get(discount_percent)


def _get_or_create_promo_coupon(percent):
    """Get or create a Stripe coupon for a promotional discount percentage."""
    import stripe
    from django.conf import settings as django_settings
    stripe.api_key = django_settings.STRIPE_SECRET_KEY

    coupon_id = f'PROMO_{percent}'
    try:
        stripe.Coupon.retrieve(coupon_id)
    except stripe.error.InvalidRequestError:
        stripe.Coupon.create(
            id=coupon_id,
            percent_off=percent,
            duration='forever',
            name=f'Promotional Discount ({percent}%)',
        )
    return coupon_id
