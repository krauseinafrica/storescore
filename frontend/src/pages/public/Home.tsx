import { useState } from 'react';
import { Link } from 'react-router-dom';
import { captureEmail } from '../../api/integrations';
import SEO from '../../components/SEO';

const steps = [
  {
    number: '01',
    title: 'Set Up Templates',
    description:
      'Start with pre-built evaluation templates or create fully custom scoring criteria that reflect your brand standards — from cleanliness and merchandising to safety and customer experience.',
  },
  {
    number: '02',
    title: 'Conduct Evaluations',
    description:
      'Evaluators walk your stores with mobile-friendly checklists, capturing scores, photos, and notes in real time.',
  },
  {
    number: '03',
    title: 'Track & Improve',
    description:
      'AI-generated summaries, action items, and trend analytics turn every evaluation into measurable improvement.',
  },
];

interface PillarResearch {
  studies: { source: string; finding: string }[];
  takeaway: string;
}

interface Pillar {
  icon: JSX.Element;
  title: string;
  headline: string;
  description: string;
  research: PillarResearch;
}

const pillars: Pillar[] = [
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: 'Quality',
    headline: 'Consistent standards, every location',
    description:
      'Structured evaluations ensure every store meets your quality bar. Scoring templates, photo documentation, and SOP references eliminate guesswork.',
    research: {
      studies: [
        {
          source: 'Bain & Company',
          finding: '80% of companies believe they deliver a "superior experience," but only 8% of customers agree — revealing a massive delivery gap that structured evaluations help close.',
        },
        {
          source: 'Harvard Business Review',
          finding: 'Businesses that implement standardized quality frameworks see up to 26% improvement in operational consistency within the first year.',
        },
        {
          source: 'McKinsey & Company',
          finding: 'Companies that systematically measure and manage quality across locations outperform peers by 20% in customer satisfaction scores.',
        },
      ],
      takeaway: 'Structured, consistent quality measurement is the foundation. Without standardized evaluations, the gap between what leadership thinks is happening and what customers actually experience grows wider with every new location.',
    },
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: 'Experience',
    headline: 'Better stores, happier customers',
    description:
      'Identify and fix the issues customers notice most. Track the metrics that drive satisfaction — from store presentation to service delivery.',
    research: {
      studies: [
        {
          source: 'PwC Future of Customer Experience',
          finding: 'Customers are willing to pay a 16% price premium for a great experience, and 32% will walk away from a brand after just one bad experience.',
        },
        {
          source: 'Forrester Research',
          finding: 'CX leaders grow revenue 5.1x faster than CX laggards. A 1-point improvement in CX Index score can translate to over $1 billion in incremental revenue for large retailers.',
        },
        {
          source: 'Qualtrics XM Institute',
          finding: 'Consumers who rate an experience as "very good" are 3.5x more likely to repurchase and 5x more likely to recommend the company.',
        },
      ],
      takeaway: 'Customer experience directly impacts the bottom line. Every store visit is an opportunity to earn loyalty or lose a customer — and most issues are preventable with proactive quality management.',
    },
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    title: 'Performance',
    headline: 'Connect quality to results',
    description:
      'Correlate store scores with sales data, customer feedback, and staffing metrics. Understand the link between operational excellence and bottom-line performance.',
    research: {
      studies: [
        {
          source: 'McKinsey & Company',
          finding: 'Companies that lead in customer experience achieve 2x the revenue growth of experience laggards, with significantly higher shareholder returns over a 5-year period.',
        },
        {
          source: 'Journal of Retailing',
          finding: 'Store-level operational quality scores show a statistically significant correlation (r=0.67) with same-store sales growth across multi-unit retail portfolios.',
        },
        {
          source: 'Deloitte',
          finding: 'Retailers that integrate operational data with financial metrics reduce profit leakage by up to 15% and identify top-performing store practices 3x faster.',
        },
      ],
      takeaway: 'Quality isn\'t just an operational metric — it\'s a financial lever. When you can see the connection between store scores and sales performance, you can prioritize the improvements that drive the most revenue.',
    },
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    title: 'Teams',
    headline: 'Empower every role',
    description:
      'Regional managers get visibility across locations. Store managers get clear action items. Evaluators get streamlined workflows. Everyone stays aligned.',
    research: {
      studies: [
        {
          source: 'Gallup Workplace Report',
          finding: 'Business units with highly engaged employees see 23% higher profitability. Clear expectations and regular feedback are the #1 driver of frontline engagement.',
        },
        {
          source: 'MIT Sloan Management Review',
          finding: 'Organizations where frontline employees have clear operational standards and tools to meet them see 31% lower turnover and 37% higher productivity.',
        },
        {
          source: 'SHRM (Society for Human Resource Management)',
          finding: 'Structured feedback and accountability systems improve employee retention by up to 14.9% and reduce the cost of quality-related rework by 22%.',
        },
      ],
      takeaway: 'Empowered teams perform better. When every role — from evaluators to regional managers — has clear standards, real-time visibility, and actionable feedback, the entire organization improves.',
    },
  },
];

const comparisonRows = [
  { label: 'Evaluation method', before: 'Paper checklists or spreadsheets', after: 'Digital scoring with photo evidence' },
  { label: 'Consistency', before: 'Varies by evaluator and location', after: 'Standardized templates with calibration tools' },
  { label: 'Follow-up', before: 'Email chains and lost notes', after: 'Tracked action items with due dates and owners' },
  { label: 'Reporting', before: 'Manual compilation, days to produce', after: 'Real-time dashboards and trend analytics' },
  { label: 'Accountability', before: 'No visibility into resolution', after: 'Photo evidence, digital signatures, audit trails' },
  { label: 'Scheduling', before: 'Calendar reminders and manual tracking', after: 'Automated scheduling with recurring cadences' },
];

const testimonials = [
  {
    quote:
      'I was able to see the difference in my stores\u2019 warehouse organization and rental department cleanliness and how it affected my store\u2019s total sales.',
    name: 'Regional Manager',
    role: 'Hardware Retail, 12 Locations',
  },
  {
    quote:
      'We used to spend two days compiling walk results into spreadsheets. Now my team gets AI summaries and action items the moment an evaluation is submitted.',
    name: 'VP of Operations',
    role: 'Grocery Chain, 35 Locations',
  },
  {
    quote:
      'The scheduling and follow-up tracking changed everything. Store managers actually complete their corrective actions now because there\u2019s visibility and accountability.',
    name: 'District Manager',
    role: 'Franchise Operations, 22 Locations',
  },
];

const industries = [
  {
    name: 'Hardware & Home Improvement',
    examples: 'Ace Hardware, True Value, Do it Best',
    description: 'Evaluate department merchandising, safety compliance, and customer service standards across locations.',
  },
  {
    name: 'Grocery & Convenience',
    examples: 'Independent grocers, C-stores, co-ops',
    description: 'Monitor food safety, shelf presentation, cleanliness, and regulatory compliance in every store.',
  },
  {
    name: 'Franchise Operations',
    examples: 'QSR, retail, fitness, automotive',
    description: 'Maintain brand standards across franchisees with consistent evaluation criteria and reporting.',
  },
  {
    name: 'Specialty Retail',
    examples: 'Apparel, electronics, pet, sporting goods',
    description: 'Track visual merchandising, inventory presentation, and in-store experience at scale.',
  },
];

const stats = [
  { value: '3 min', label: 'Average setup time per template' },
  { value: '40%', label: 'Faster evaluations vs. paper' },
  { value: '100%', label: 'Follow-up visibility' },
  { value: '∞', label: 'Locations supported' },
];

function EmailCaptureForm({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await captureEmail({ email: email.trim(), first_name: firstName.trim() || undefined, source: 'homepage' });
      setSubmitted(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    const textClass = variant === 'dark' ? 'text-white' : 'text-gray-900';
    const subClass = variant === 'dark' ? 'text-primary-100' : 'text-gray-500';
    return (
      <div className="text-center py-4">
        <div className="flex items-center justify-center gap-2 mb-2">
          <svg className={`w-5 h-5 ${variant === 'dark' ? 'text-green-300' : 'text-green-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className={`text-lg font-semibold ${textClass}`}>You're in!</p>
        </div>
        <p className={`text-sm ${subClass}`}>
          Check your inbox — we'll send you everything you need to get started.
        </p>
      </div>
    );
  }

  const isDark = variant === 'dark';

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-lg mx-auto">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="First name"
          className={`flex-shrink-0 sm:w-36 rounded-lg border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${
            isDark
              ? 'bg-white/10 border-white/20 text-white placeholder:text-white/50'
              : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400'
          }`}
        />
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Work email"
          className={`flex-1 rounded-lg border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${
            isDark
              ? 'bg-white/10 border-white/20 text-white placeholder:text-white/50'
              : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400'
          }`}
        />
        <button
          type="submit"
          disabled={submitting}
          className={`flex-shrink-0 px-6 py-3 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 ${
            isDark
              ? 'bg-white text-primary-600 hover:bg-primary-50'
              : 'bg-primary-600 text-white hover:bg-primary-700'
          }`}
        >
          {submitting ? 'Sending...' : 'Get Started'}
        </button>
      </div>
      {error && <p className={`mt-2 text-sm ${isDark ? 'text-red-300' : 'text-red-600'}`}>{error}</p>}
      <p className={`mt-2 text-xs ${isDark ? 'text-white/50' : 'text-gray-400'}`}>
        Free to start. No credit card required.
      </p>
    </form>
  );
}

function ResearchModal({ pillar, onClose }: { pillar: Pillar; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 rounded-t-2xl flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center flex-shrink-0">
              {pillar.icon}
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-primary-600">
                {pillar.title}
              </div>
              <h3 className="text-lg font-semibold text-gray-900">{pillar.headline}</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          <p className="text-sm text-gray-600 leading-relaxed">{pillar.description}</p>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
              What the research says
            </h4>
            <div className="space-y-4">
              {pillar.research.studies.map((study, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center text-xs font-bold mt-0.5">
                    {i + 1}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-primary-600 mb-0.5">{study.source}</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{study.finding}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
              The takeaway
            </p>
            <p className="text-sm text-gray-700 leading-relaxed">{pillar.research.takeaway}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
          <Link
            to="/request-demo"
            className="w-full inline-flex items-center justify-center px-6 py-2.5 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
            onClick={onClose}
          >
            See StoreScore in Action
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [activePillar, setActivePillar] = useState<Pillar | null>(null);

  return (
    <div>
      <SEO
        title="StoreScore — Retail Store Audit & Quality Management Software"
        description="Store audit and quality management software for multi-location retailers. Standardize store walks, track performance with AI-powered insights, and drive improvement across every location. Start free."
        path="/"
      />
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 sm:pt-28 pb-12 sm:pb-16">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-50 border border-primary-100 text-primary-700 text-sm font-medium mb-8">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Store quality management for multi-location businesses
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight leading-tight">
              Turn every store visit into{' '}
              <span className="text-primary-600">measurable improvement</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-gray-600 leading-relaxed max-w-2xl mx-auto">
              StoreScore replaces paper checklists and spreadsheets with structured evaluations,
              AI-powered insights, and real-time analytics — so every location meets your standards.
            </p>

            {/* Email Capture */}
            <div className="mt-10">
              <EmailCaptureForm variant="light" />
            </div>
          </div>

          {/* Product Mockup */}
          <div className="mt-16 max-w-5xl mx-auto">
            <div className="relative rounded-xl sm:rounded-2xl shadow-2xl ring-1 ring-gray-900/10 overflow-hidden bg-white">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 px-4 py-3 bg-gray-100 border-b border-gray-200">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 ml-4">
                  <div className="max-w-sm mx-auto bg-white rounded-md px-3 py-1 text-xs text-gray-400 border border-gray-200">
                    app.storescore.app/dashboard
                  </div>
                </div>
              </div>
              {/* Dashboard preview */}
              <div className="p-4 sm:p-6 bg-gray-50">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="h-5 w-32 bg-gray-800 rounded" />
                    <div className="h-3 w-48 bg-gray-300 rounded mt-2" />
                  </div>
                  <div className="h-8 w-24 bg-primary-600 rounded-lg" />
                </div>
                {/* KPI Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {[
                    { label: 'Overall Score', value: '87%', color: 'text-green-600', bar: 'bg-green-500', width: 'w-[87%]' },
                    { label: 'Stores Evaluated', value: '24/28', color: 'text-blue-600', bar: 'bg-blue-500', width: 'w-[86%]' },
                    { label: 'Action Items', value: '12', color: 'text-amber-600', bar: 'bg-amber-500', width: 'w-[40%]' },
                    { label: 'Trend', value: '+2.4%', color: 'text-emerald-600', bar: 'bg-emerald-500', width: 'w-[65%]' },
                  ].map((kpi) => (
                    <div key={kpi.label} className="bg-white rounded-lg p-3 ring-1 ring-gray-900/5">
                      <div className="text-[10px] text-gray-400 font-medium">{kpi.label}</div>
                      <div className={`text-lg font-bold ${kpi.color} mt-0.5`}>{kpi.value}</div>
                      <div className="h-1 bg-gray-100 rounded-full mt-2">
                        <div className={`h-1 ${kpi.bar} rounded-full ${kpi.width}`} />
                      </div>
                    </div>
                  ))}
                </div>
                {/* Chart area */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 bg-white rounded-lg p-3 ring-1 ring-gray-900/5">
                    <div className="h-3 w-24 bg-gray-300 rounded mb-3" />
                    <div className="flex items-end gap-1 h-24">
                      {[40, 55, 48, 62, 58, 70, 65, 78, 72, 80, 85, 87].map((h, i) => (
                        <div key={i} className="flex-1 bg-primary-100 rounded-t" style={{ height: `${h}%` }}>
                          <div className="w-full bg-primary-500 rounded-t" style={{ height: `${Math.min(100, h + 10)}%` }} />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-3 ring-1 ring-gray-900/5">
                    <div className="h-3 w-20 bg-gray-300 rounded mb-3" />
                    <div className="space-y-2">
                      {['Store Appearance', 'Product Display', 'Customer Service', 'Safety'].map((name, i) => (
                        <div key={name} className="flex items-center gap-2">
                          <div className="h-2 flex-1 bg-gray-100 rounded-full">
                            <div className={`h-2 rounded-full ${i < 2 ? 'bg-green-500' : i === 2 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${92 - i * 8}%` }} />
                          </div>
                          <span className="text-[9px] text-gray-400 w-16 text-right">{name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Subtle shadow effect below mockup */}
            <div className="mx-8 h-4 bg-gradient-to-b from-gray-200/50 to-transparent rounded-b-xl" />
          </div>

          {/* Stats bar */}
          <div className="mt-16 grid grid-cols-2 lg:grid-cols-4 gap-8 max-w-3xl mx-auto">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl sm:text-4xl font-bold text-primary-600">{stat.value}</div>
                <div className="mt-1 text-sm text-gray-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary-100/30 rounded-full blur-3xl pointer-events-none" />
      </section>

      {/* How It Works */}
      <section className="py-12 sm:py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              How it works
            </h2>
            <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
              Get from setup to actionable insights in three straightforward steps.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
            {steps.map((step, index) => (
              <div key={step.number} className="relative">
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-full w-full h-px bg-gradient-to-r from-primary-200 to-transparent -translate-x-8" />
                )}
                <div className="flex items-center gap-4 mb-4">
                  <span className="text-4xl font-bold text-primary-100">{step.number}</span>
                  <h3 className="text-xl font-semibold text-gray-900">{step.title}</h3>
                </div>
                <p className="text-gray-600 leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Value Pillars */}
      <section className="py-20 sm:py-24 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              The link between quality and performance
            </h2>
            <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
              Store quality drives customer experience. Customer experience drives sales.
              StoreScore helps you measure and improve the entire chain.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            {pillars.map((pillar) => (
              <button
                key={pillar.title}
                type="button"
                onClick={() => setActivePillar(pillar)}
                className="text-left p-8 rounded-2xl bg-white border border-gray-200 hover:border-primary-200 hover:shadow-lg transition-all group cursor-pointer"
              >
                <div className="w-12 h-12 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center mb-5">
                  {pillar.icon}
                </div>
                <div className="text-xs font-semibold uppercase tracking-wider text-primary-600 mb-2">
                  {pillar.title}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{pillar.headline}</h3>
                <p className="text-gray-600 leading-relaxed">{pillar.description}</p>
                <div className="mt-4 flex items-center gap-1.5 text-sm font-medium text-primary-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  See the research
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Research Modal */}
      {activePillar && (
        <ResearchModal pillar={activePillar} onClose={() => setActivePillar(null)} />
      )}

      {/* Before / After Comparison */}
      <section className="py-20 sm:py-24 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Replace guesswork with clarity
            </h2>
            <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
              See how StoreScore transforms the way multi-location businesses
              manage store quality.
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-gray-200">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 w-1/4">
                    &nbsp;
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-500">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Without StoreScore
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-primary-600">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      With StoreScore
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {comparisonRows.map((row) => (
                  <tr key={row.label} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{row.label}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{row.before}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">{row.after}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 sm:py-24 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              What operators are saying
            </h2>
            <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
              Real results from multi-location teams using StoreScore to improve store quality.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="relative p-8 rounded-2xl bg-white border border-gray-200"
              >
                <svg className="absolute top-6 left-6 w-8 h-8 text-primary-100" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179z" />
                </svg>
                <p className="mt-8 text-gray-700 leading-relaxed text-[15px]">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="mt-6 pt-6 border-t border-gray-100">
                  <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                  <p className="text-sm text-gray-500">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Industry Verticals */}
      <section className="py-20 sm:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Built for every retail vertical
            </h2>
            <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
              Whether you run 5 locations or 500, StoreScore adapts to your industry's
              unique quality standards and evaluation needs.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {industries.map((industry) => (
              <div
                key={industry.name}
                className="p-6 rounded-xl bg-white border border-gray-200 hover:border-primary-200 hover:shadow-md transition-all"
              >
                <h3 className="text-base font-semibold text-gray-900 mb-1">{industry.name}</h3>
                <p className="text-xs text-primary-600 font-medium mb-3">{industry.examples}</p>
                <p className="text-sm text-gray-500">{industry.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA with Email Capture */}
      <section className="py-20 sm:py-24 bg-primary-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to raise the bar across every location?
          </h2>
          <p className="text-lg text-primary-100 mb-10 max-w-2xl mx-auto">
            Join multi-location businesses that use StoreScore to maintain consistent
            quality standards, drive accountability, and connect store operations to business results.
          </p>

          <EmailCaptureForm variant="dark" />

          <div className="mt-8 flex items-center justify-center gap-6 text-sm text-primary-200">
            <Link to="/features" className="hover:text-white transition-colors underline underline-offset-2">
              See all features
            </Link>
            <Link to="/pricing" className="hover:text-white transition-colors underline underline-offset-2">
              View pricing
            </Link>
            <Link to="/signup" className="hover:text-white transition-colors underline underline-offset-2">
              Sign up free
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
