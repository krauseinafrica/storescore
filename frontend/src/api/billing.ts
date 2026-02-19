import api from './client';
import { getOrgId } from '../utils/org';

export interface Plan {
  id: string;
  name: string;
  slug: string;
  price_per_store_monthly: string;
  price_per_store_annual: string;
  max_users: number | null;
  max_templates: number | null;
  max_walks_per_store: number | null;
  max_stores: number | null;
  features: Record<string, boolean>;
  display_order: number;
}

export interface Subscription {
  id: string;
  plan: string;
  plan_name: string;
  plan_slug: string;
  plan_features: Record<string, boolean>;
  stripe_customer_id: string;
  billing_interval: 'monthly' | 'annual';
  store_count: number;
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'free';
  is_active_subscription: boolean;
  trial_start: string | null;
  trial_end: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  discount_percent: number;
  promo_discount_name: string;
  promo_discount_percent: number;
  effective_discount_percent: number;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  stripe_invoice_id: string;
  amount: string;
  status: string;
  invoice_url: string;
  invoice_pdf: string;
  period_start: string;
  period_end: string;
  created_at: string;
}

export async function getPlans(): Promise<Plan[]> {
  const response = await api.get<Plan[]>('/billing/plans/');
  return response.data;
}

export async function getSubscription(): Promise<Subscription> {
  const orgId = getOrgId();
  const response = await api.get<Subscription>('/billing/subscription/', {
    headers: { 'X-Organization': orgId },
  });
  return response.data;
}

export async function createCheckoutSession(data: {
  plan: string;
  billing_interval: 'monthly' | 'annual';
  success_url?: string;
  cancel_url?: string;
}): Promise<{ checkout_url: string }> {
  const orgId = getOrgId();
  const response = await api.post<{ checkout_url: string }>('/billing/checkout/', data, {
    headers: { 'X-Organization': orgId },
  });
  return response.data;
}

export async function createPortalSession(return_url?: string): Promise<{ portal_url: string }> {
  const orgId = getOrgId();
  const response = await api.post<{ portal_url: string }>('/billing/portal/', { return_url }, {
    headers: { 'X-Organization': orgId },
  });
  return response.data;
}

export async function getInvoices(): Promise<Invoice[]> {
  const orgId = getOrgId();
  const response = await api.get<Invoice[]>('/billing/invoices/', {
    headers: { 'X-Organization': orgId },
  });
  return response.data;
}

export async function updateStoreCount(): Promise<{
  store_count: number;
  previous_count: number;
  discount_percent: number;
}> {
  const orgId = getOrgId();
  const response = await api.post('/billing/update-store-count/', {}, {
    headers: { 'X-Organization': orgId },
  });
  return response.data;
}
