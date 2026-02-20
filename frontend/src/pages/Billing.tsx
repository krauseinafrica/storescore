import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import InfoButton from '../components/InfoButton';
import {
  getPlans,
  getSubscription,
  getInvoices,
  createCheckoutSession,
  createPortalSession,
  type Plan,
  type Subscription,
  type Invoice,
} from '../api/billing';

const STATUS_LABELS: Record<string, string> = {
  trialing: 'Trial',
  active: 'Active',
  past_due: 'Past Due',
  canceled: 'Canceled',
  free: 'Free',
};

const STATUS_COLORS: Record<string, string> = {
  trialing: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  past_due: 'bg-amber-100 text-amber-700',
  canceled: 'bg-red-100 text-red-700',
  free: 'bg-gray-100 text-gray-600',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatCurrency(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
}

type Tab = 'overview' | 'plans' | 'invoices';

export default function Billing() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');

  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly');
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [plansData, subData, invoicesData] = await Promise.all([
          getPlans().catch(() => []),
          getSubscription().catch(() => null),
          isAdmin ? getInvoices().catch(() => []) : Promise.resolve([]),
        ]);
        setPlans(plansData);
        setSubscription(subData);
        setInvoices(invoicesData);
        if (subData?.billing_interval) {
          setBillingInterval(subData.billing_interval);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [isAdmin]);

  const handleCheckout = async (planSlug: string) => {
    setCheckoutLoading(planSlug);
    try {
      const { checkout_url } = await createCheckoutSession({
        plan: planSlug,
        billing_interval: billingInterval,
        success_url: window.location.origin + '/billing?success=true',
        cancel_url: window.location.origin + '/billing',
      });
      window.location.href = checkout_url;
    } catch {
      alert('Failed to start checkout. Please try again.');
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const { portal_url } = await createPortalSession(window.location.href);
      window.location.href = portal_url;
    } catch {
      alert('Failed to open billing portal. Please try again.');
    } finally {
      setPortalLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-12 text-center">
        <h1 className="text-xl font-bold text-gray-900">Access Denied</h1>
        <p className="text-sm text-gray-500 mt-2">Admin access is required to manage billing.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  const successParam = new URLSearchParams(window.location.search).get('success');

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 pb-24">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Billing & Subscription</h1>
        <p className="mt-0.5 text-sm text-gray-500">Manage your plan, billing, and invoices</p>
      </div>

      {/* Success banner */}
      {successParam === 'true' && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium text-green-800">Subscription activated successfully!</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 max-w-sm">
        {([
          { key: 'overview' as Tab, label: 'Overview' },
          { key: 'plans' as Tab, label: 'Plans' },
          { key: 'invoices' as Tab, label: 'Invoices' },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-6">
          {/* Current plan card */}
          <div className="bg-white rounded-xl ring-1 ring-gray-900/5 p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Current Plan</h2>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-2xl font-bold text-gray-900">
                    {subscription?.plan_name || 'Free'}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    STATUS_COLORS[subscription?.status || 'free']
                  }`}>
                    {STATUS_LABELS[subscription?.status || 'free']}
                  </span>
                </div>
              </div>
              {subscription?.stripe_customer_id && (
                <button
                  onClick={handlePortal}
                  disabled={portalLoading}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  {portalLoading ? 'Opening...' : 'Manage Billing'}
                </button>
              )}
            </div>

            {subscription && (() => {
              const currentPlan = plans.find((p) => p.slug === subscription.plan_slug);
              const perStore = currentPlan
                ? parseFloat(subscription.billing_interval === 'annual' ? currentPlan.price_per_store_annual : currentPlan.price_per_store_monthly)
                : 0;
              const subtotal = perStore * subscription.store_count;
              const effectiveDiscount = subscription.effective_discount_percent ?? subscription.discount_percent;
              const hasPromo = subscription.promo_discount_percent > 0;
              const discountLabel = hasPromo && subscription.promo_discount_name
                ? `${subscription.promo_discount_name} (${effectiveDiscount}%)`
                : `Volume discount (${effectiveDiscount}%)`;
              const discountAmount = subtotal * (effectiveDiscount / 100);
              const estimatedTotal = subtotal - discountAmount;
              const isTrial = subscription.status === 'trialing' && subscription.trial_end;
              const daysLeft = isTrial
                ? Math.ceil((new Date(subscription.trial_end!).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                : 0;

              return (
                <>
                  {/* Trial banner — the single source of truth */}
                  {isTrial && (
                    <div className="mt-6 bg-blue-50 rounded-lg p-5">
                      <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-blue-900">
                            Your free trial ends {formatDate(subscription.trial_end!)}
                            <span className="font-normal text-blue-700"> — {daysLeft > 0 ? `${daysLeft} days remaining` : 'ending soon'}</span>
                          </p>

                          {currentPlan && (
                            <div className="mt-3 bg-white/70 rounded-lg p-4">
                              <p className="text-sm font-semibold text-gray-900 mb-2">
                                On {formatDate(subscription.trial_end!)}, your {subscription.plan_name} plan will cost:
                              </p>
                              <div className="space-y-1 text-sm max-w-sm">
                                <div className="flex justify-between">
                                  <span className="text-gray-600">
                                    {subscription.store_count} stores x {formatCurrency(perStore)}/store
                                  </span>
                                  <span className="text-gray-800">{formatCurrency(subtotal)}/mo</span>
                                </div>
                                {effectiveDiscount > 0 && (
                                  <div className="flex justify-between text-green-700">
                                    <span>{discountLabel}</span>
                                    <span>-{formatCurrency(discountAmount)}</span>
                                  </div>
                                )}
                                <div className="flex justify-between pt-2 mt-1 border-t border-blue-200 font-bold text-base">
                                  <span className="text-gray-900">You'll pay</span>
                                  <span className="text-gray-900">{formatCurrency(estimatedTotal)}/mo</span>
                                </div>
                                {subscription.billing_interval === 'annual' && (
                                  <div className="flex justify-between text-xs text-gray-500 pt-0.5">
                                    <span>Billed annually</span>
                                    <span>{formatCurrency(estimatedTotal * 12)}/yr</span>
                                  </div>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 mt-2">
                                Based on your current {subscription.store_count} active stores. Add or remove stores and this updates automatically.
                              </p>
                            </div>
                          )}

                          <p className="text-xs text-blue-600 mt-3">
                            Without an active subscription after your trial, your account becomes read-only.
                            You can still view data, but won't be able to create walks or make changes.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Plan details grid */}
                  <div className={`grid grid-cols-2 sm:grid-cols-4 gap-4 ${isTrial ? 'mt-4 pt-4 border-t border-gray-100' : 'mt-6 pt-4 border-t border-gray-100'}`}>
                    <div>
                      <p className="text-xs text-gray-400">Billing</p>
                      <p className="text-sm font-medium text-gray-900 capitalize">
                        {subscription.billing_interval}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Stores</p>
                      <p className="text-sm font-medium text-gray-900">{subscription.store_count}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Discount</p>
                      <p className="text-sm font-medium text-gray-900">
                        {effectiveDiscount > 0
                          ? hasPromo && subscription.promo_discount_name
                            ? `${subscription.promo_discount_name} (${effectiveDiscount}%)`
                            : `${effectiveDiscount}% off`
                          : 'None'}
                      </p>
                    </div>
                    {subscription.current_period_end && !isTrial && (
                      <div>
                        <p className="text-xs text-gray-400">
                          {subscription.cancel_at_period_end ? 'Cancels on' : 'Renews on'}
                        </p>
                        <p className="text-sm font-medium text-gray-900">
                          {formatDate(subscription.current_period_end)}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Cost breakdown for active (non-trial) subscriptions */}
                  {!isTrial && currentPlan && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <div className="space-y-1.5 text-sm max-w-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-500">
                            {subscription.store_count} stores x {formatCurrency(perStore)}/store
                          </span>
                          <span className="text-gray-700">{formatCurrency(subtotal)}/mo</span>
                        </div>
                        {effectiveDiscount > 0 && (
                          <div className="flex justify-between text-green-600">
                            <span>{discountLabel}</span>
                            <span>-{formatCurrency(discountAmount)}/mo</span>
                          </div>
                        )}
                        <div className="flex justify-between pt-1.5 border-t border-gray-100 font-semibold">
                          <span className="text-gray-900">Total</span>
                          <span className="text-gray-900">{formatCurrency(estimatedTotal)}/mo</span>
                        </div>
                        {subscription.billing_interval === 'annual' && (
                          <div className="flex justify-between text-xs text-gray-400">
                            <span>Billed annually</span>
                            <span>{formatCurrency(estimatedTotal * 12)}/yr</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}

            {/* Past due warning */}
            {subscription?.status === 'past_due' && (
              <div className="mt-4 bg-amber-50 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-amber-900">Payment past due</p>
                    <p className="text-sm text-amber-700 mt-1">
                      Please update your payment method to continue using StoreScore.
                      Your account is currently in read-only mode — you can view your
                      data but cannot create new walks or make changes.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Canceled / expired */}
            {(subscription?.status === 'canceled' || (!subscription?.is_active_subscription && subscription?.status !== 'trialing' && subscription?.status !== 'past_due')) && (
              <div className="mt-4 bg-red-50 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-red-900">Subscription inactive</p>
                    <p className="text-sm text-red-700 mt-1">
                      Your account is in read-only mode. Choose a plan below to restore
                      full access. Inactive accounts are archived after 90 days.
                    </p>
                    <button
                      onClick={() => setTab('plans')}
                      className="mt-2 px-4 py-1.5 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Choose a Plan
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Volume discounts info — hidden when promo is active */}
          {!(subscription?.promo_discount_percent && subscription.promo_discount_percent > 0) && (
          <div className="bg-white rounded-xl ring-1 ring-gray-900/5 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Volume Discounts</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              {[
                { range: '1-2 stores', discount: '0%', active: (subscription?.store_count || 0) < 3 },
                { range: '3-4 stores', discount: '5% off', active: (subscription?.store_count || 0) >= 3 && (subscription?.store_count || 0) < 5 },
                { range: '5-9 stores', discount: '10% off', active: (subscription?.store_count || 0) >= 5 && (subscription?.store_count || 0) < 10 },
                { range: '10+ stores', discount: '15% off', active: (subscription?.store_count || 0) >= 10 },
              ].map((tier) => (
                <div
                  key={tier.range}
                  className={`rounded-lg p-3 ${
                    tier.active
                      ? 'bg-primary-50 ring-2 ring-primary-500'
                      : 'bg-gray-50'
                  }`}
                >
                  <p className="text-xs text-gray-500">{tier.range}</p>
                  <p className={`text-sm font-bold ${tier.active ? 'text-primary-700' : 'text-gray-600'}`}>
                    {tier.discount}
                  </p>
                </div>
              ))}
            </div>
          </div>
          )}
        </div>
      )}

      {tab === 'plans' && (
        <div>
          {/* Billing interval toggle */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <InfoButton contextKey="billing-plans" />
            <span className={`text-sm font-medium ${billingInterval === 'monthly' ? 'text-gray-900' : 'text-gray-400'}`}>
              Monthly
            </span>
            <button
              onClick={() => setBillingInterval(billingInterval === 'monthly' ? 'annual' : 'monthly')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                billingInterval === 'annual' ? 'bg-primary-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                  billingInterval === 'annual' ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`text-sm font-medium ${billingInterval === 'annual' ? 'text-gray-900' : 'text-gray-400'}`}>
              Annual
            </span>
            {billingInterval === 'annual' && (
              <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                Save ~16%
              </span>
            )}
          </div>

          {/* Plan cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map((plan) => {
              const price = billingInterval === 'annual'
                ? plan.price_per_store_annual
                : plan.price_per_store_monthly;
              const isCurrentPlan = subscription?.plan_slug === plan.slug;
              const isPopular = plan.slug === 'enterprise';

              // Custom feature lists per tier with descriptions
              const PLAN_FEATURES: Record<string, { label: string; included: boolean }[]> = {
                starter: [
                  { label: `Up to ${plan.max_users || 'unlimited'} users`, included: true },
                  { label: `${plan.max_walks_per_store || 'Unlimited'} walks per store/month`, included: true },
                  { label: '1 scoring template', included: true },
                  { label: 'Walk history & photos', included: true },
                  { label: 'Store comparison overview', included: true },
                  { label: 'Walk completed emails', included: true },
                  { label: 'AI walk summaries', included: false },
                  { label: 'Action items & follow-ups', included: false },
                  { label: 'Email digest reports', included: false },
                ],
                pro: [
                  { label: `Up to ${plan.max_users || 'unlimited'} users`, included: true },
                  { label: 'Unlimited walks & templates', included: true },
                  { label: 'AI-powered walk summaries', included: true },
                  { label: 'Action items & follow-ups', included: true },
                  { label: 'Achievement badges & milestones', included: true },
                  { label: 'Evaluation scheduling', included: true },
                  { label: 'Self-assessments', included: true },
                  { label: 'Goals & KPI tracking', included: true },
                  { label: 'Advanced analytics & trends', included: true },
                  { label: 'Weekly & monthly email digests', included: true },
                  { label: 'Calendar feeds (iCal)', included: true },
                  { label: 'Store benchmarking & rankings', included: true },
                  { label: 'CSV data export', included: true },
                ],
                enterprise: [
                  { label: 'Unlimited users', included: true },
                  { label: 'Everything in Pro, plus:', included: true },
                  { label: 'Leaderboards, challenges & advanced badges', included: true },
                  { label: 'AI photo analysis & scoring', included: true },
                  { label: 'External evaluator access', included: true },
                  { label: 'POS & inventory integrations', included: true },
                  { label: 'Sales-quality correlation', included: true },
                  { label: 'Scheduled PDF reports', included: true },
                  { label: 'Custom branded emails', included: true },
                  { label: 'API access', included: true },
                  { label: 'Priority support (4hr response)', included: true },
                ],
              };

              const PLAN_DESCRIPTIONS: Record<string, string> = {
                starter: 'The essentials for getting started with store evaluations.',
                pro: 'AI-powered insights and tools to drive improvement across your stores.',
                enterprise: 'Advanced integrations, analytics, and dedicated support for larger operations.',
              };

              const features = PLAN_FEATURES[plan.slug] || [];

              return (
                <div
                  key={plan.id}
                  className={`bg-white rounded-xl shadow-sm p-6 relative flex flex-col ${
                    isPopular
                      ? 'ring-2 ring-primary-500'
                      : 'ring-1 ring-gray-900/5'
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-primary-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                        Most Popular
                      </span>
                    </div>
                  )}

                  <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">{PLAN_DESCRIPTIONS[plan.slug]}</p>
                  <div className="mt-3">
                    <span className="text-3xl font-bold text-gray-900">
                      {formatCurrency(price)}
                    </span>
                    <span className="text-sm text-gray-500">/store/mo</span>
                  </div>
                  {subscription && subscription.store_count > 0 && (() => {
                    const priceNum = parseFloat(price);
                    const storeCount = subscription.store_count;
                    const discount = subscription.effective_discount_percent ?? subscription.discount_percent;
                    const subtotal = priceNum * storeCount;
                    const total = subtotal - (subtotal * discount / 100);
                    return (
                      <p className="mt-1.5 text-xs text-gray-500">
                        <span className="font-medium text-gray-700">{formatCurrency(total)}/mo</span>
                        {' '}for your {storeCount} stores
                        {discount > 0 && <span className="text-green-600"> ({discount}% off)</span>}
                      </p>
                    );
                  })()}

                  <div className="mt-5 mb-6 flex-1">
                    {plan.slug === 'pro' && (
                      <p className="text-xs font-semibold text-primary-600 uppercase tracking-wide mb-2">
                        Everything in Starter, plus:
                      </p>
                    )}
                    <ul className="space-y-2 text-sm">
                      {features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          {feature.included ? (
                            <svg className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                          <span className={feature.included ? 'text-gray-700' : 'text-gray-400'}>
                            {feature.label}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    {isCurrentPlan ? (
                      <button
                        disabled
                        className="w-full py-2.5 rounded-lg text-sm font-semibold bg-gray-100 text-gray-500 cursor-default"
                      >
                        Current Plan
                      </button>
                    ) : subscription?.is_active_subscription || subscription?.status === 'trialing' ? (
                      <button
                        onClick={handlePortal}
                        disabled={portalLoading}
                        className="w-full py-2.5 rounded-lg text-sm font-semibold bg-gray-900 text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
                      >
                        {portalLoading ? 'Opening...' : 'Select Plan'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleCheckout(plan.slug)}
                        disabled={checkoutLoading === plan.slug}
                        className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${
                          isPopular
                            ? 'bg-primary-600 text-white hover:bg-primary-700'
                            : 'bg-gray-900 text-white hover:bg-gray-800'
                        }`}
                      >
                        {checkoutLoading === plan.slug ? 'Redirecting...' : 'Get Started'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Volume discounts + trial note */}
          <div className="mt-6 bg-gray-50 rounded-xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h4 className="text-sm font-semibold text-gray-900">Volume discounts on all plans</h4>
                <p className="text-xs text-gray-500 mt-0.5">Automatically applied as you add stores</p>
              </div>
              <div className="flex gap-3 text-xs">
                <span className="px-2.5 py-1 rounded-full bg-white ring-1 ring-gray-200 text-gray-600">3-4 stores: <strong>5% off</strong></span>
                <span className="px-2.5 py-1 rounded-full bg-white ring-1 ring-gray-200 text-gray-600">5-9 stores: <strong>10% off</strong></span>
                <span className="px-2.5 py-1 rounded-full bg-white ring-1 ring-gray-200 text-gray-600">10+ stores: <strong>15% off</strong></span>
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 mt-4">
            All plans include a 14-day free trial with full Enterprise access. No credit card required.
          </p>
        </div>
      )}

      {tab === 'invoices' && (
        <div>
          {invoices.length === 0 ? (
            <div className="bg-white rounded-xl ring-1 ring-gray-900/5 p-8 text-center">
              <svg className="w-12 h-12 text-gray-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="mt-3 text-sm text-gray-500">No invoices yet</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl ring-1 ring-gray-900/5 shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {formatDate(invoice.period_start)}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {formatCurrency(invoice.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          invoice.status === 'paid'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {invoice.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {invoice.invoice_url && (
                          <a
                            href={invoice.invoice_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                          >
                            View
                          </a>
                        )}
                        {invoice.invoice_pdf && (
                          <a
                            href={invoice.invoice_pdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary-600 hover:text-primary-700 font-medium ml-3"
                          >
                            PDF
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
