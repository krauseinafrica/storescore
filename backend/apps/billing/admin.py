from django.contrib import admin

from .models import Invoice, Plan, Subscription


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'price_per_store_monthly', 'price_per_store_annual', 'is_active', 'display_order')
    list_editable = ('is_active', 'display_order')
    prepopulated_fields = {'slug': ('name',)}


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ('organization', 'plan', 'status', 'billing_interval', 'store_count', 'discount_percent')
    list_filter = ('status', 'plan', 'billing_interval')
    search_fields = ('organization__name', 'stripe_customer_id', 'stripe_subscription_id')
    raw_id_fields = ('organization', 'plan')


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ('stripe_invoice_id', 'subscription', 'amount', 'status', 'period_start', 'period_end')
    list_filter = ('status',)
    search_fields = ('stripe_invoice_id',)
    raw_id_fields = ('subscription',)
