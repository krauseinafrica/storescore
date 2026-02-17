import { useState } from 'react';
import { Link } from 'react-router-dom';

type BillingCycle = 'monthly' | 'annual';

interface PricingTier {
  name: string;
  monthlyPrice: number | null;
  description: string;
  ctaLabel: string;
  ctaLink: string;
  highlighted: boolean;
  features: { name: string; included: boolean }[];
}

const tiers: PricingTier[] = [
  {
    name: 'Free',
    monthlyPrice: 0,
    description: 'Try StoreScore with a single location. Perfect for getting started.',
    ctaLabel: 'Get Started Free',
    ctaLink: '/request-demo',
    highlighted: false,
    features: [
      { name: '1 store', included: true },
      { name: '2 team members', included: true },
      { name: '5 walks per month', included: true },
      { name: 'Basic scoring templates', included: true },
      { name: 'Walk history (30 days)', included: true },
      { name: 'Email support', included: true },
      { name: 'AI summaries', included: false },
      { name: 'Action items', included: false },
      { name: 'Scheduling', included: false },
      { name: 'SOP management', included: false },
      { name: 'Data integrations', included: false },
      { name: 'Advanced analytics', included: false },
      { name: 'Custom branding', included: false },
      { name: 'API access', included: false },
    ],
  },
  {
    name: 'Starter',
    monthlyPrice: 29,
    description: 'For growing businesses with a handful of locations to manage.',
    ctaLabel: 'Start Trial',
    ctaLink: '/request-demo',
    highlighted: false,
    features: [
      { name: 'Up to 10 stores', included: true },
      { name: '10 team members', included: true },
      { name: 'Unlimited walks', included: true },
      { name: 'Custom scoring templates', included: true },
      { name: 'Full walk history', included: true },
      { name: 'Priority email support', included: true },
      { name: 'AI summaries', included: true },
      { name: 'Action items', included: true },
      { name: 'Scheduling', included: true },
      { name: 'SOP management', included: false },
      { name: 'Data integrations', included: false },
      { name: 'Advanced analytics', included: false },
      { name: 'Custom branding', included: false },
      { name: 'API access', included: false },
    ],
  },
  {
    name: 'Pro',
    monthlyPrice: 79,
    description: 'For established multi-location businesses that need the full suite.',
    ctaLabel: 'Start Trial',
    ctaLink: '/request-demo',
    highlighted: true,
    features: [
      { name: 'Up to 50 stores', included: true },
      { name: 'Unlimited team members', included: true },
      { name: 'Unlimited walks', included: true },
      { name: 'Custom scoring templates', included: true },
      { name: 'Full walk history', included: true },
      { name: 'Priority support + chat', included: true },
      { name: 'AI summaries', included: true },
      { name: 'Action items', included: true },
      { name: 'Scheduling', included: true },
      { name: 'SOP management', included: true },
      { name: 'Data integrations', included: true },
      { name: 'Advanced analytics', included: true },
      { name: 'Custom branding', included: false },
      { name: 'API access', included: false },
    ],
  },
  {
    name: 'Enterprise',
    monthlyPrice: null,
    description: 'For large franchise operations and enterprise retail organizations.',
    ctaLabel: 'Contact Sales',
    ctaLink: '/request-demo',
    highlighted: false,
    features: [
      { name: 'Unlimited stores', included: true },
      { name: 'Unlimited team members', included: true },
      { name: 'Unlimited walks', included: true },
      { name: 'Custom scoring templates', included: true },
      { name: 'Full walk history', included: true },
      { name: 'Dedicated account manager', included: true },
      { name: 'AI summaries', included: true },
      { name: 'Action items', included: true },
      { name: 'Scheduling', included: true },
      { name: 'SOP management', included: true },
      { name: 'Data integrations', included: true },
      { name: 'Advanced analytics', included: true },
      { name: 'Custom branding', included: true },
      { name: 'API access', included: true },
    ],
  },
];

function formatPrice(monthlyPrice: number | null, cycle: BillingCycle): string {
  if (monthlyPrice === null) return 'Custom';
  if (monthlyPrice === 0) return '$0';
  if (cycle === 'annual') {
    const discounted = Math.round(monthlyPrice * 0.8);
    return `$${discounted}`;
  }
  return `$${monthlyPrice}`;
}

function getAnnualTotal(monthlyPrice: number | null): string | null {
  if (monthlyPrice === null || monthlyPrice === 0) return null;
  const discounted = Math.round(monthlyPrice * 0.8);
  return `$${discounted * 12}/year`;
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

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-b from-gray-50 to-white py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight">
            Simple, transparent pricing
          </h1>
          <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
            Choose the plan that fits your business. Start free, upgrade when you are ready.
            All paid plans include a 14-day free trial.
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
                -20%
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-20 sm:pb-24 -mt-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 lg:gap-8">
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
                    {tier.monthlyPrice !== null && tier.monthlyPrice > 0 && (
                      <span className="ml-1 text-sm text-gray-500">/month</span>
                    )}
                  </div>
                  {billingCycle === 'annual' && getAnnualTotal(tier.monthlyPrice) && (
                    <p className="mt-1 text-sm text-gray-500">
                      {getAnnualTotal(tier.monthlyPrice)} billed annually
                    </p>
                  )}
                  {billingCycle === 'monthly' && tier.monthlyPrice !== null && tier.monthlyPrice > 0 && (
                    <p className="mt-1 text-sm text-gray-400">
                      or save 20% with annual billing
                    </p>
                  )}
                </div>

                <Link
                  to={tier.ctaLink}
                  className={`w-full inline-flex items-center justify-center px-6 py-3 text-sm font-semibold rounded-lg transition-colors ${
                    tier.highlighted
                      ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-sm'
                      : tier.monthlyPrice === 0
                        ? 'bg-gray-900 text-white hover:bg-gray-800 shadow-sm'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {tier.ctaLabel}
                </Link>

                <div className="mt-8 border-t border-gray-100 pt-6 flex-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
                    What&apos;s included
                  </p>
                  <ul className="space-y-3">
                    {tier.features.map((feature) => (
                      <li key={feature.name} className="flex items-start gap-3">
                        {feature.included ? (
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
                        ) : (
                          <svg
                            className="w-5 h-5 text-gray-300 flex-shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        )}
                        <span
                          className={`text-sm ${
                            feature.included ? 'text-gray-700' : 'text-gray-400'
                          }`}
                        >
                          {feature.name}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
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
              question="Can I change plans later?"
              answer="Yes, you can upgrade or downgrade at any time. When upgrading, you'll be prorated for the remainder of your billing period. Downgrades take effect at the next billing cycle."
            />
            <FaqItem
              question="What happens when my free trial ends?"
              answer="After the 14-day trial, you'll be prompted to enter payment information to continue with your selected plan. Your data and configuration will be preserved."
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
            Schedule a demo with our team. We will walk you through the platform and help you
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
