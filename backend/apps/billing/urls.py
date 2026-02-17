from django.urls import path

from . import views
from .webhooks import stripe_webhook

app_name = 'billing'

urlpatterns = [
    path('plans/', views.PlanListView.as_view(), name='plans'),
    path('subscription/', views.SubscriptionView.as_view(), name='subscription'),
    path('checkout/', views.CheckoutView.as_view(), name='checkout'),
    path('portal/', views.CustomerPortalView.as_view(), name='portal'),
    path('invoices/', views.InvoiceListView.as_view(), name='invoices'),
    path('update-store-count/', views.UpdateStoreCountView.as_view(), name='update-store-count'),
    path('webhooks/stripe/', stripe_webhook, name='stripe-webhook'),
]
