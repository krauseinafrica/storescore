import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import SEO from '../../components/SEO';

type BillingCycle = 'monthly' | 'annual';

interface PricingTier {
  name: string;
  monthlyPrice: number;
  description: string;
  ctaLabel: string;
  ctaLink: string;
  highlighted: boolean;
  features: string[];
  inheritLabel?: string;
}

const tiers: PricingTier[] = [
  {
    name: 'Starter',
    monthlyPrice: 29,
    description: 'The essentials for getting started with store evaluations.',
    ctaLabel: 'Get Started',
    ctaLink: '/signup',
    highlighted: false,
    features: [
      'Up to 5 users',
      '10 walks per store/month',
      '1 scoring template',
      'Walk history & photos',
      'Store comparison overview',
      'Walk completed emails',
      'AI walk summaries',
      'Action items & follow-ups',
      'Email digest reports',
    ],
  },
  {
    name: 'Pro',
    monthlyPrice: 49,
    description: 'AI-powered insights and tools to drive improvement across your stores.',
    ctaLabel: 'Get Started',
    ctaLink: '/signup',
    highlighted: true,
    inheritLabel: 'Everything in Starter, plus:',
    features: [
      'Up to 25 users',
      'Unlimited walks & templates',
      'AI-powered walk summaries',
      'Action items & follow-ups',
      'Achievement badges & milestones',
      'Evaluation scheduling',
      'Self-assessments',
      'Goals & KPI tracking',
      'Advanced analytics & trends',
      'Weekly & monthly email digests',
      'Calendar feeds (iCal)',
      'Store benchmarking & rankings',
      'CSV data export',
    ],
  },
  {
    name: 'Enterprise',
    monthlyPrice: 79,
    description: 'Advanced integrations, analytics, and dedicated support for larger operations.',
    ctaLabel: 'Get Started',
    ctaLink: '/signup',
    highlighted: false,
    inheritLabel: 'Everything in Pro, plus:',
    features: [
      'Unlimited users',
      'Leaderboards, challenges & advanced badges',
      'AI photo analysis & scoring',
      'External evaluator access',
      'POS & inventory integrations',
      'Sales-quality correlation',
      'Scheduled PDF reports',
      'Custom branded emails',
      'API access',
    ],
  },
];

const volumeDiscounts = [
  { range: '1–2 stores', discount: null, label: 'Standard pricing' },
  { range: '3–4 stores', discount: '5%', label: 'Save 5%' },
  { range: '5–9 stores', discount: '10%', label: 'Save 10%' },
  { range: '10–24 stores', discount: '15%', label: 'Save 15%' },
  { range: '25–49 stores', discount: '20%', label: 'Save 20%' },
  { range: '50+ stores', discount: null, label: 'Contact sales' },
];

function formatPrice(monthlyPrice: number, cycle: BillingCycle): string {
  if (cycle === 'annual') {
    const discounted = Math.round(monthlyPrice * 0.84);
    return `$${discounted}`;
  }
  return `$${monthlyPrice}`;
}

function getAnnualTotal(monthlyPrice: number, cycle: BillingCycle): string | null {
  if (cycle !== 'annual') return null;
  const discounted = Math.round(monthlyPrice * 0.84);
  return `$${discounted * 12}/year`;
}

function getVolumeDiscount(stores: number): number {
  if (stores >= 25) return 20;
  if (stores >= 10) return 15;
  if (stores >= 5) return 10;
  if (stores >= 3) return 5;
  return 0;
}

const enterpriseExtras = [
  'Unlimited users',
  'AI photo analysis & scoring',
  'POS & inventory integrations',
  'Sales-quality correlation',
  'Custom branded emails',
  'API access',
];

function PricingCalculator() {
  const [plan, setPlan] = useState<'Starter' | 'Pro' | 'Enterprise'>('Pro');
  const [stores, setStores] = useState(5);
  const [cycle, setCycle] = useState<BillingCycle>('annual');

  const basePrice = plan === 'Starter' ? 29 : plan === 'Pro' ? 49 : 79;
  const isOver50 = stores >= 50;
  const volumePercent = getVolumeDiscount(stores);
  const annualMultiplier = cycle === 'annual' ? 0.84 : 1;
  const volumeMultiplier = 1 - volumePercent / 100;
  const perStore = Math.round(basePrice * annualMultiplier * volumeMultiplier * 100) / 100;
  const totalMonthly = Math.round(perStore * stores * 100) / 100;
  const standardTotal = basePrice * stores;
  const totalSaved = Math.round((standardTotal - totalMonthly) * 100) / 100;

  const planFeatures: Record<string, string[]> = {
    Starter: [
      'Up to 5 users',
      '10 walks per store/month',
      '1 scoring template',
      'AI walk summaries',
      'Action items & follow-ups',
      'Email digest reports',
    ],
    Pro: [
      'Up to 25 users',
      'Unlimited walks & templates',
      'Evaluation scheduling',
      'Goals & KPI tracking',
      'Advanced analytics & trends',
      'Store benchmarking & rankings',
    ],
    Enterprise: [
      'Unlimited users',
      'AI photo analysis & scoring',
      'POS & inventory integrations',
      'Sales-quality correlation',
      'Custom branded emails',
      'API access',
    ],
  };

  const upsellTarget = plan === 'Starter' ? 'Pro' : plan === 'Pro' ? 'Enterprise' : null;
  const upsellExtras: Record<string, string[]> = {
    Pro: [
      'Unlimited walks & templates',
      'Evaluation scheduling',
      'Goals & KPI tracking',
      'Advanced analytics & trends',
      'Store benchmarking & rankings',
      'CSV data export',
    ],
    Enterprise: enterpriseExtras,
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-200">
          {/* Left: Inputs */}
          <div className="p-6 sm:p-8 space-y-6">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Plan
              </label>
              <div className="grid grid-cols-3 gap-3">
                {(['Starter', 'Pro', 'Enterprise'] as const).map((p) => {
                  const price = p === 'Starter' ? 29 : p === 'Pro' ? 49 : 79;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPlan(p)}
                      className={`px-3 py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                        plan === p
                          ? 'border-primary-600 bg-primary-50 text-primary-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <div>{p}</div>
                      <div className="text-xs font-normal mt-0.5 text-gray-400">
                        ${price}/store/mo
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Number of stores
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={1}
                  max={60}
                  value={stores}
                  onChange={(e) => setStores(Number(e.target.value))}
                  className="flex-1 h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-primary-600"
                />
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={stores}
                  onChange={(e) => setStores(Math.max(1, Number(e.target.value) || 1))}
                  className="w-20 rounded-lg border border-gray-300 px-3 py-2 text-center text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Billing
              </label>
              <div className="inline-flex items-center bg-gray-100 rounded-full p-1">
                <button
                  type="button"
                  onClick={() => setCycle('monthly')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${
                    cycle === 'monthly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setCycle('annual')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${
                    cycle === 'annual' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  Annual (-16%)
                </button>
              </div>
            </div>

            {/* Volume Discount Table */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Volume discounts
              </label>
              <div className="rounded-xl border border-gray-200 overflow-hidden text-sm">
                {volumeDiscounts.map((tier) => {
                  const isActive =
                    (tier.range === '1–2 stores' && stores >= 1 && stores <= 2) ||
                    (tier.range === '3–4 stores' && stores >= 3 && stores <= 4) ||
                    (tier.range === '5–9 stores' && stores >= 5 && stores <= 9) ||
                    (tier.range === '10–24 stores' && stores >= 10 && stores <= 24) ||
                    (tier.range === '25–49 stores' && stores >= 25 && stores <= 49) ||
                    (tier.range === '50+ stores' && stores >= 50);
                  return (
                    <div
                      key={tier.range}
                      className={`flex items-center justify-between px-4 py-2 transition-colors ${
                        isActive
                          ? 'bg-primary-50 border-l-2 border-primary-600'
                          : 'border-l-2 border-transparent'
                      }`}
                    >
                      <span className={isActive ? 'font-medium text-gray-900' : 'text-gray-500'}>
                        {tier.range}
                      </span>
                      {tier.discount ? (
                        <span className={`text-xs font-semibold ${isActive ? 'text-primary-700' : 'text-gray-400'}`}>
                          {tier.label}
                        </span>
                      ) : (
                        <span className={`text-xs ${isActive ? 'text-gray-700' : 'text-gray-400'}`}>
                          {tier.label}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Results */}
          <div className="p-6 sm:p-8 bg-gray-50 flex flex-col">
            {isOver50 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
                <div className="w-14 h-14 rounded-2xl bg-primary-100 text-primary-600 flex items-center justify-center mb-4">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Let&apos;s build a custom plan
                </h3>
                <p className="text-sm text-gray-600 mb-6 max-w-xs">
                  With {stores} stores, you qualify for custom pricing
                  with dedicated support and volume savings beyond 20%.
                </p>
                <Link
                  to="/request-demo"
                  className="inline-flex items-center px-6 py-2.5 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Contact Sales
                </Link>
              </div>
            ) : (
              <>
                {/* Price breakdown */}
                <div className="mb-6">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Your estimated cost
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-gray-900">
                      ${totalMonthly.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                    <span className="text-sm text-gray-500">/month</span>
                  </div>
                  <p className="text-sm text-gray-400 mt-0.5">
                    ${perStore.toFixed(2)}/store/month
                  </p>
                  {cycle === 'annual' && (
                    <p className="text-sm text-gray-500 mt-1">
                      ${Math.round(totalMonthly * 12).toLocaleString()}/year billed annually
                    </p>
                  )}
                </div>

                {/* Savings */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Base ({stores} {stores === 1 ? 'store' : 'stores'} x ${basePrice})</span>
                    <span className="text-gray-700">${standardTotal.toLocaleString()}/mo</span>
                  </div>
                  {cycle === 'annual' && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Annual discount</span>
                      <span className="text-green-600 font-medium">-16%</span>
                    </div>
                  )}
                  {volumePercent > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Volume discount</span>
                      <span className="text-green-600 font-medium">-{volumePercent}%</span>
                    </div>
                  )}
                  {totalSaved > 0 && (
                    <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-100">
                      <span className="font-medium text-gray-900">You save</span>
                      <span className="font-semibold text-green-600">
                        ${totalSaved.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/mo
                      </span>
                    </div>
                  )}
                </div>

                {/* Key features */}
                <div className="mb-6">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    Key {plan} features
                  </div>
                  <ul className="space-y-2">
                    {planFeatures[plan].map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                        <svg className="w-4 h-4 text-primary-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Upsell */}
                {upsellTarget && (
                  <div className="bg-primary-50 border border-primary-100 rounded-xl p-4 mb-6">
                    <p className="text-xs font-semibold text-primary-700 uppercase tracking-wide mb-2">
                      Upgrade to {upsellTarget}
                    </p>
                    <ul className="space-y-1.5">
                      {upsellExtras[upsellTarget]?.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-sm text-primary-800">
                          <svg className="w-3.5 h-3.5 text-primary-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          {f}
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() => setPlan(upsellTarget as 'Pro' | 'Enterprise')}
                      className="mt-3 inline-flex text-xs font-semibold text-primary-700 hover:text-primary-800"
                    >
                      Switch to {upsellTarget} &rarr;
                    </button>
                  </div>
                )}

                {/* CTA */}
                <div className="mt-auto">
                  <Link
                    to="/signup"
                    className="w-full inline-flex items-center justify-center px-6 py-3 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    Start Free Trial
                  </Link>
                  <p className="mt-2 text-center text-xs text-gray-400">No credit card required</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div>
      <h3 className="text-base font-semibold text-gray-900 mb-2">{question}</h3>
      <p className="text-sm text-gray-600 leading-relaxed">{answer}</p>
    </div>
  );
}

export default function Pricing() {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'How does the free trial work?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Every plan comes with a 14-day free trial with full access to all Enterprise features — no credit card required. Sign up through a product tour and you\'ll get an extended 30-day trial. When the trial ends, choose a plan to continue or your account will be paused.',
        },
      },
      {
        '@type': 'Question',
        name: 'How does per-store pricing work?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'You pay per active store in your account. For example, 5 stores on the Pro plan at $49/store = $245/month. Volume discounts kick in automatically as you add more locations.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can I change plans later?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes, you can upgrade or downgrade at any time. When upgrading, you\'ll be prorated for the remainder of your billing period. Downgrades take effect at the next billing cycle.',
        },
      },
      {
        '@type': 'Question',
        name: 'How do volume discounts work?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Volume discounts apply automatically based on the number of stores in your account. They stack with annual billing savings — for example, 25 stores on an annual Pro plan saves 16% (annual) plus 20% (volume) off the standard per-store rate.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is there a long-term contract?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'No. Monthly plans can be canceled at any time. Annual plans are billed upfront for the year and can be canceled at renewal.',
        },
      },
      {
        '@type': 'Question',
        name: "What counts as a 'store'?",
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Each distinct location that you evaluate counts as one store. A single physical address with one evaluation history is one store.',
        },
      },
      {
        '@type': 'Question',
        name: 'Do you offer discounts for nonprofits or educational institutions?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes, we offer special pricing for qualified nonprofit organizations and educational institutions. Please contact our sales team for details.',
        },
      },
    ],
  };

  return (
    <div>
      <SEO
        title="Pricing | StoreScore — Store Quality Management from $29/store/mo"
        description="Transparent per-store pricing with volume discounts. Starter, Pro, and Enterprise plans for retail store audits and quality management. Free 14-day trial."
        path="/pricing"
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      </Helmet>
      {/* Hero */}
      <section className="bg-gradient-to-b from-gray-50 to-white py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight">
            Simple, transparent pricing
          </h1>
          <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
            Per-store pricing that scales with your business. Every plan includes a
            14-day free trial — no credit card required.
          </p>

          {/* Billing Toggle */}
          <div className="mt-10 inline-flex items-center gap-3 bg-gray-100 rounded-full p-1">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-5 py-2 text-sm font-medium rounded-full transition-colors ${
                billingCycle === 'monthly'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={`px-5 py-2 text-sm font-medium rounded-full transition-colors ${
                billingCycle === 'annual'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Annual
              <span className="ml-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                -16%
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-20 sm:pb-24 -mt-4">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className={`relative flex flex-col rounded-2xl border-2 p-8 ${
                  tier.highlighted
                    ? 'border-primary-600 shadow-xl shadow-primary-100'
                    : 'border-gray-200'
                }`}
              >
                {tier.highlighted && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center px-4 py-1 rounded-full text-xs font-bold bg-primary-600 text-white uppercase tracking-wide">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">{tier.name}</h3>
                  <p className="mt-1 text-sm text-gray-500">{tier.description}</p>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline">
                    <span className="text-4xl font-bold text-gray-900">
                      {formatPrice(tier.monthlyPrice, billingCycle)}
                    </span>
                    <span className="ml-1 text-sm text-gray-500">/store/mo</span>
                  </div>
                  {billingCycle === 'annual' && (
                    <p className="mt-1 text-sm text-gray-500">
                      {getAnnualTotal(tier.monthlyPrice, billingCycle)} per store billed annually
                    </p>
                  )}
                  {billingCycle === 'monthly' && (
                    <p className="mt-1 text-sm text-gray-400">
                      or save 16% with annual billing
                    </p>
                  )}
                </div>

                <Link
                  to={tier.ctaLink}
                  className={`w-full inline-flex items-center justify-center px-6 py-3 text-sm font-semibold rounded-lg transition-colors ${
                    tier.highlighted
                      ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-sm'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {tier.ctaLabel}
                </Link>
                <p className="mt-2 text-center text-xs text-gray-400">
                  14-day free trial included
                </p>

                <div className="mt-8 border-t border-gray-100 pt-6 flex-1">
                  {tier.inheritLabel && (
                    <p className="text-xs font-semibold text-primary-600 uppercase tracking-wide mb-4">
                      {tier.inheritLabel}
                    </p>
                  )}
                  <ul className="space-y-3">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <svg
                          className="w-5 h-5 text-primary-600 flex-shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        <span className="text-sm text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Calculator */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Calculate your price
            </h2>
            <p className="mt-3 text-base text-gray-600">
              Volume discounts apply automatically on top of annual billing savings.
            </p>
          </div>

          <PricingCalculator />
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 sm:py-20 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-12">
            Frequently asked questions
          </h2>
          <div className="space-y-8">
            <FaqItem
              question="How does the free trial work?"
              answer="Every plan comes with a 14-day free trial with full access to all Enterprise features — no credit card required. Sign up through a product tour and you'll get an extended 30-day trial. When the trial ends, choose a plan to continue or your account will be paused."
            />
            <FaqItem
              question="How does per-store pricing work?"
              answer="You pay per active store in your account. For example, 5 stores on the Pro plan at $49/store = $245/month. Volume discounts kick in automatically as you add more locations."
            />
            <FaqItem
              question="Can I change plans later?"
              answer="Yes, you can upgrade or downgrade at any time. When upgrading, you'll be prorated for the remainder of your billing period. Downgrades take effect at the next billing cycle."
            />
            <FaqItem
              question="How do volume discounts work?"
              answer="Volume discounts apply automatically based on the number of stores in your account. They stack with annual billing savings — for example, 25 stores on an annual Pro plan saves 16% (annual) plus 20% (volume) off the standard per-store rate."
            />
            <FaqItem
              question="Is there a long-term contract?"
              answer="No. Monthly plans can be canceled at any time. Annual plans are billed upfront for the year and can be canceled at renewal."
            />
            <FaqItem
              question="What counts as a 'store'?"
              answer="Each distinct location that you evaluate counts as one store. A single physical address with one evaluation history is one store."
            />
            <FaqItem
              question="Do you offer discounts for nonprofits or educational institutions?"
              answer="Yes, we offer special pricing for qualified nonprofit organizations and educational institutions. Please contact our sales team for details."
            />
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Not sure which plan is right for you?
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Schedule a demo with our team. We&apos;ll walk you through the platform and help you
            choose the best plan for your business.
          </p>
          <Link
            to="/request-demo"
            className="inline-flex items-center px-8 py-3 text-base font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
          >
            Request a Demo
          </Link>
        </div>
      </section>
    </div>
  );
}
