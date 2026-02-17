from rest_framework import serializers

from .models import Invoice, Plan, Subscription


class PlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plan
        fields = [
            'id', 'name', 'slug',
            'price_per_store_monthly', 'price_per_store_annual',
            'max_users', 'max_templates', 'max_walks_per_store', 'max_stores',
            'features', 'display_order',
        ]


class SubscriptionSerializer(serializers.ModelSerializer):
    plan_name = serializers.CharField(source='plan.name', read_only=True)
    plan_slug = serializers.CharField(source='plan.slug', read_only=True)
    plan_features = serializers.JSONField(source='plan.features', read_only=True)
    is_active_subscription = serializers.BooleanField(read_only=True)

    class Meta:
        model = Subscription
        fields = [
            'id', 'plan', 'plan_name', 'plan_slug', 'plan_features',
            'stripe_customer_id', 'billing_interval', 'store_count',
            'status', 'is_active_subscription',
            'trial_start', 'trial_end',
            'current_period_start', 'current_period_end',
            'cancel_at_period_end', 'discount_percent',
            'created_at', 'updated_at',
        ]
        read_only_fields = fields


class InvoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Invoice
        fields = [
            'id', 'stripe_invoice_id', 'amount', 'status',
            'invoice_url', 'invoice_pdf',
            'period_start', 'period_end',
            'created_at',
        ]
        read_only_fields = fields
