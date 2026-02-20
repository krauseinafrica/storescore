import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import SEO from '../../components/SEO';

/* ------------------------------------------------------------------ */
/*  Data types                                                        */
/* ------------------------------------------------------------------ */

interface Tier {
  name: string;
  price: string;
  details: string;
}

interface FeatureRow {
  feature: string;
  storescore: boolean | string;
  competitor: boolean | string;
}

interface FeatureGroup {
  category: string;
  rows: FeatureRow[];
}

interface FAQ {
  q: string;
  a: string;
}

interface CompetitorData {
  name: string;
  slug: string;
  tagline: string;
  description: string;
  founded: string;
  target: string;
  rating: string;
  pricingModel: string;
  tiers: Tier[];
  featureComparison: FeatureGroup[];
  weaknesses: string[];
  strengths: string[];
  switchReasons: { title: string; description: string }[];
  chooseStoreScore: string[];
  chooseCompetitor: string[];
  faqs: FAQ[];
  costExample: { scenario: string; storescore: string; competitor: string };
}

/* ------------------------------------------------------------------ */
/*  Competitor data                                                   */
/* ------------------------------------------------------------------ */

const competitors: Record<string, CompetitorData> = {
  bindy: {
    name: 'Bindy',
    slug: 'bindy',
    tagline: 'The AI-Powered Alternative to Bindy',
    description:
      'Bindy is a retail execution platform with 15+ years in the market, focused on checklists and task management for multi-unit retail and hospitality brands.',
    founded: '2004',
    target: 'Retail & hospitality chains',
    rating: '4.9/5 Capterra (15 reviews)',
    pricingModel: 'Per inspection',
    tiers: [
      { name: 'Basic', price: '$129/mo', details: '10 inspections/month, unlimited users' },
      { name: 'Standard', price: '$249/mo', details: '35 inspections/month, unlimited users' },
      { name: 'Premium', price: '$499/mo', details: '70 inspections/month, unlimited users' },
    ],
    featureComparison: [
      {
        category: 'Inspections & Walks',
        rows: [
          { feature: 'Store walk evaluations', storescore: true, competitor: true },
          { feature: 'Photo documentation', storescore: true, competitor: true },
          { feature: 'Custom scoring templates', storescore: 'Unlimited', competitor: true },
          { feature: 'Department evaluations', storescore: true, competitor: false },
          { feature: 'Quick assessments', storescore: true, competitor: false },
          { feature: 'Self-assessments', storescore: true, competitor: false },
          { feature: 'QR + GPS verification', storescore: true, competitor: false },
        ],
      },
      {
        category: 'AI & Intelligence',
        rows: [
          { feature: 'AI walk summaries', storescore: true, competitor: false },
          { feature: 'AI photo analysis', storescore: true, competitor: false },
          { feature: 'AI-powered action items', storescore: true, competitor: false },
          { feature: 'Trend detection & alerts', storescore: true, competitor: false },
        ],
      },
      {
        category: 'Gamification & Engagement',
        rows: [
          { feature: 'Achievement badges', storescore: true, competitor: false },
          { feature: 'Leaderboards', storescore: true, competitor: false },
          { feature: 'Challenges & competitions', storescore: true, competitor: false },
          { feature: 'Store rankings', storescore: true, competitor: false },
        ],
      },
      {
        category: 'Analytics & Reporting',
        rows: [
          { feature: 'Score trend analytics', storescore: true, competitor: true },
          { feature: 'Store benchmarking', storescore: true, competitor: true },
          { feature: 'Goals & KPI tracking', storescore: true, competitor: false },
          { feature: 'Scheduled PDF reports', storescore: true, competitor: false },
          { feature: 'Sales-quality correlation', storescore: true, competitor: false },
        ],
      },
      {
        category: 'Team & Access',
        rows: [
          { feature: 'Role-based access', storescore: true, competitor: true },
          { feature: 'Unlimited users', storescore: 'Enterprise', competitor: 'All plans' },
          { feature: 'External evaluator access', storescore: true, competitor: false },
          { feature: 'Franchise hierarchy', storescore: true, competitor: true },
        ],
      },
      {
        category: 'Integrations & Platform',
        rows: [
          { feature: 'POS & inventory integrations', storescore: true, competitor: false },
          { feature: 'Calendar feeds (iCal)', storescore: true, competitor: false },
          { feature: 'API access', storescore: true, competitor: false },
          { feature: 'Modern, responsive UI', storescore: true, competitor: false },
        ],
      },
    ],
    weaknesses: [
      'No AI capabilities at all — no summaries, no photo analysis, no intelligent insights',
      'Dated user interface that hasn\'t been modernized',
      'No gamification features — no badges, leaderboards, or engagement tools',
      'No department evaluations or quick assessments',
      'Per-inspection pricing can become unpredictable at scale',
      'No self-assessment workflows for franchisees',
    ],
    strengths: [
      'Unlimited users on all plans — great for large teams',
      '15+ year track record in retail execution',
      'Strong franchise-aware hierarchy and permissions',
      'Retail-focused feature set built specifically for the industry',
    ],
    switchReasons: [
      {
        title: 'AI-Powered Intelligence',
        description:
          'StoreScore uses AI to generate walk summaries, analyze photos for compliance issues, and automatically create prioritized action items. Bindy has zero AI capabilities.',
      },
      {
        title: 'Built-In Gamification',
        description:
          'Drive engagement with achievement badges, store leaderboards, and team challenges. Bindy offers no gamification features at all.',
      },
      {
        title: 'Modern, Intuitive Interface',
        description:
          'A clean, responsive UI built with modern technology. No more working with a dated interface that slows your team down.',
      },
      {
        title: 'Predictable Per-Store Pricing',
        description:
          'Pay per store, not per inspection. Unlimited walks on Pro and Enterprise — no surprises as your evaluation volume grows.',
      },
    ],
    chooseStoreScore: [
      'You want AI-powered walk summaries and photo analysis',
      'Gamification and employee engagement matter to your operation',
      'You need department-level evaluations and quick assessments',
      'You prefer predictable per-store pricing over per-inspection billing',
      'A modern, fast UI is important for team adoption',
    ],
    chooseCompetitor: [
      'You need unlimited users on your lowest-cost plan',
      'You\'re already deeply integrated with Bindy\'s existing workflows',
      'Per-inspection pricing fits your low-volume evaluation needs',
      'You value a 15+ year track record over newer innovation',
    ],
    faqs: [
      {
        q: 'Is StoreScore a direct replacement for Bindy?',
        a: 'Yes. StoreScore covers all core inspection and task management functionality that Bindy offers, plus adds AI-powered intelligence, gamification, department evaluations, and a modern UI. Most teams complete migration in under a week.',
      },
      {
        q: 'How does StoreScore pricing compare to Bindy?',
        a: 'Bindy charges per inspection ($129-$499/mo for 10-70 inspections). StoreScore charges per store ($29-$79/store/mo) with unlimited walks on Pro and Enterprise plans. For active evaluation programs, StoreScore is typically more cost-effective and predictable.',
      },
      {
        q: 'Does StoreScore support franchise hierarchies like Bindy?',
        a: 'Yes. StoreScore is franchise-native with full hierarchy support, self-assessments for franchisees, and owner dashboards — features Bindy doesn\'t offer.',
      },
      {
        q: 'Can I import my Bindy data into StoreScore?',
        a: 'Yes. StoreScore supports CSV imports for historical data, and our team can assist with migration from Bindy to ensure a smooth transition.',
      },
      {
        q: 'Does Bindy have AI features?',
        a: 'No. Bindy does not offer any AI capabilities. StoreScore provides AI walk summaries, AI photo analysis, and AI-powered action item generation.',
      },
      {
        q: 'What makes StoreScore\'s gamification different?',
        a: 'StoreScore includes achievement badges, store leaderboards, team challenges, and competitive rankings — built directly into the evaluation workflow. Bindy has no gamification features.',
      },
    ],
    costExample: {
      scenario: '10 stores, 25 users, ~40 walks/month',
      storescore: '$490/mo (Pro plan, 10 stores)',
      competitor: '$499/mo (Premium, 70 inspections) — and overages if you exceed the cap',
    },
  },

  safetyculture: {
    name: 'SafetyCulture',
    slug: 'safetyculture',
    tagline: 'Built for Retail, Not Just Safety Checklists',
    description:
      'SafetyCulture (formerly iAuditor) is a broad workplace operations platform used across many industries for inspections, training, and compliance.',
    founded: '2004',
    target: 'All industries — construction, manufacturing, retail, hospitality, healthcare',
    rating: '4.6/5 Capterra (253 reviews)',
    pricingModel: 'Per seat',
    tiers: [
      { name: 'Free', price: '$0', details: 'Up to 10 users, 5 templates' },
      { name: 'Premium', price: '$24/seat/mo', details: 'Unlimited templates, advanced analytics' },
      { name: 'Enterprise', price: 'Custom', details: 'SSO, dedicated support, custom integrations' },
    ],
    featureComparison: [
      {
        category: 'Inspections & Walks',
        rows: [
          { feature: 'Store walk evaluations', storescore: true, competitor: true },
          { feature: 'Photo documentation', storescore: true, competitor: true },
          { feature: 'Custom scoring templates', storescore: 'Unlimited', competitor: 'Unlimited (Premium)' },
          { feature: 'Template library', storescore: 'Growing', competitor: '100,000+' },
          { feature: 'Department evaluations', storescore: true, competitor: false },
          { feature: 'Quick assessments', storescore: true, competitor: false },
          { feature: 'Self-assessments', storescore: true, competitor: false },
          { feature: 'QR + GPS verification', storescore: true, competitor: 'GPS only' },
        ],
      },
      {
        category: 'AI & Intelligence',
        rows: [
          { feature: 'AI walk summaries', storescore: true, competitor: 'Basic' },
          { feature: 'AI photo analysis & scoring', storescore: true, competitor: false },
          { feature: 'AI template generation', storescore: false, competitor: true },
          { feature: 'AI-powered action items', storescore: true, competitor: false },
        ],
      },
      {
        category: 'Gamification & Engagement',
        rows: [
          { feature: 'Achievement badges', storescore: true, competitor: false },
          { feature: 'Leaderboards', storescore: true, competitor: false },
          { feature: 'Challenges & competitions', storescore: true, competitor: false },
          { feature: 'Store rankings', storescore: true, competitor: false },
        ],
      },
      {
        category: 'Analytics & Reporting',
        rows: [
          { feature: 'Score trend analytics', storescore: true, competitor: true },
          { feature: 'Store benchmarking', storescore: true, competitor: true },
          { feature: 'Goals & KPI tracking', storescore: true, competitor: false },
          { feature: 'Scheduled PDF reports', storescore: true, competitor: true },
          { feature: 'Sales-quality correlation', storescore: true, competitor: false },
        ],
      },
      {
        category: 'Team & Access',
        rows: [
          { feature: 'Role-based access', storescore: true, competitor: true },
          { feature: 'Users included', storescore: 'Up to unlimited', competitor: '10 free, then $24/seat' },
          { feature: 'External evaluator access', storescore: true, competitor: false },
          { feature: 'Franchise hierarchy', storescore: true, competitor: false },
        ],
      },
      {
        category: 'Integrations & Platform',
        rows: [
          { feature: 'POS & inventory integrations', storescore: true, competitor: false },
          { feature: 'Training modules', storescore: false, competitor: true },
          { feature: 'API access', storescore: true, competitor: true },
          { feature: 'Retail-specific design', storescore: true, competitor: false },
        ],
      },
    ],
    weaknesses: [
      'Not built for retail — it\'s a general-purpose safety platform used across dozens of industries',
      'Expensive at scale: $24/seat x 50 users = $1,200/mo before any add-ons',
      'No gamification features in inspections — only basic training gamification',
      'No franchise-specific features (self-assessments, owner dashboards, hierarchy)',
      'App crashes and sync issues reported in recent reviews',
      'Poor customer support response times cited in user reviews',
      'No department evaluations or retail-specific workflows',
    ],
    strengths: [
      'Massive template library with 100,000+ pre-built templates',
      'Free tier available for up to 10 users — great for trying before buying',
      'Modern, polished mobile app experience',
      'Broad industry support if you need non-retail inspections too',
      'Built-in training and e-learning modules',
      'Large user community and established brand',
    ],
    switchReasons: [
      {
        title: 'Purpose-Built for Retail',
        description:
          'StoreScore is designed specifically for retail and franchise operations — not retrofitted from a safety checklist tool. Every feature is tailored to how store teams actually work.',
      },
      {
        title: 'Predictable Pricing at Scale',
        description:
          'SafetyCulture charges $24 per seat — 50 users costs $1,200/mo. StoreScore charges per store, so adding team members never increases your bill.',
      },
      {
        title: 'Full Gamification Suite',
        description:
          'Badges, leaderboards, challenges, and rankings built into evaluations. SafetyCulture has no gamification in its inspection workflow.',
      },
      {
        title: 'Franchise-Native Architecture',
        description:
          'Self-assessments, franchisee dashboards, multi-level hierarchy, and owner-specific views. SafetyCulture wasn\'t designed for franchise operations.',
      },
    ],
    chooseStoreScore: [
      'You operate retail stores or franchise locations specifically',
      'You want per-store pricing that doesn\'t penalize large teams',
      'Gamification and employee engagement are priorities',
      'You need franchise-native features like self-assessments and owner dashboards',
      'AI photo analysis for visual compliance matters to your operation',
    ],
    chooseCompetitor: [
      'You need inspections across multiple industries beyond retail',
      'A massive pre-built template library is important to get started quickly',
      'You have a small team (under 10) and want a free tier',
      'Built-in training and e-learning modules are a requirement',
    ],
    faqs: [
      {
        q: 'Is StoreScore a direct replacement for SafetyCulture?',
        a: 'For retail and franchise operations, yes. StoreScore provides all core inspection functionality plus retail-specific features like department evaluations, gamification, franchise hierarchy, and AI photo analysis that SafetyCulture lacks.',
      },
      {
        q: 'How does pricing compare to SafetyCulture?',
        a: 'SafetyCulture charges $24/seat/month. For a team of 25 users, that\'s $600/mo. StoreScore charges per store ($29-$79/store/mo) with generous user limits — 10 stores on Pro is $490/mo with up to 25 users included. Larger teams save significantly with StoreScore.',
      },
      {
        q: 'Does SafetyCulture have AI features?',
        a: 'SafetyCulture has basic AI for template generation and report summaries, but lacks AI photo analysis, AI-powered scoring, and intelligent action item generation that StoreScore provides.',
      },
      {
        q: 'Can I use StoreScore for non-retail inspections?',
        a: 'StoreScore is optimized for retail and franchise operations. If you need inspections for construction, manufacturing, or healthcare, SafetyCulture\'s broader scope may be a better fit. For retail-specific needs, StoreScore offers a deeper, more specialized feature set.',
      },
      {
        q: 'What about SafetyCulture\'s template library?',
        a: 'SafetyCulture\'s 100,000+ template library is impressive for variety. StoreScore offers a growing library of retail-specific templates plus AI-powered customization — quality over quantity for store operations.',
      },
      {
        q: 'Does StoreScore offer training modules like SafetyCulture?',
        a: 'StoreScore focuses on evaluations, analytics, and improvement — not e-learning. If built-in training courses are essential, SafetyCulture offers that. StoreScore drives learning through evaluation feedback, action items, and gamification.',
      },
    ],
    costExample: {
      scenario: '10 stores, 25 users',
      storescore: '$490/mo (Pro plan, 10 stores, up to 25 users included)',
      competitor: '$600/mo (Premium, 25 seats at $24/seat)',
    },
  },
};

/* ------------------------------------------------------------------ */
/*  Helper components                                                 */
/* ------------------------------------------------------------------ */

function CheckIcon({ className = 'w-5 h-5 text-green-600' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function XIcon({ className = 'w-5 h-5 text-gray-300' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function CellValue({ value }: { value: boolean | string }) {
  if (value === true) return <CheckIcon />;
  if (value === false) return <XIcon />;
  return <span className="text-sm font-medium text-gray-700">{value}</span>;
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-200">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-5 text-left"
      >
        <span className="text-base font-semibold text-gray-900 pr-4">{question}</span>
        <svg
          className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <p className="pb-5 text-sm text-gray-600 leading-relaxed">{answer}</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Hub fallback for unknown slugs                                    */
/* ------------------------------------------------------------------ */

const hubCards: { slug: string; name: string; blurb: string; overlap: string[] }[] = [
  {
    slug: 'bindy',
    name: 'Bindy',
    blurb: 'Retail execution platform for checklists, task management, and store audits across multi-unit retail and hospitality brands.',
    overlap: ['Store audits & inspections', 'Task management', 'Multi-location retail operations', 'Franchise compliance'],
  },
  {
    slug: 'safetyculture',
    name: 'SafetyCulture',
    blurb: 'Workplace operations platform (formerly iAuditor) for inspections, checklists, and compliance across construction, manufacturing, retail, and more.',
    overlap: ['Inspection checklists & audits', 'Photo documentation', 'Corrective actions & follow-ups', 'Mobile-first field operations'],
  },
];

function CompareHub() {
  return (
    <div>
      <SEO
        title="Compare StoreScore vs Bindy, SafetyCulture & More (2026)"
        description="Thinking about switching from Bindy or SafetyCulture? Compare features, pricing, AI capabilities, and see why retail teams choose StoreScore for store audits and quality management."
        path="/compare"
      />
      <section className="bg-gradient-to-b from-gray-50 to-white py-20 sm:py-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight">
            Compare StoreScore
          </h1>
          <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
            StoreScore is a store quality management platform with AI-powered evaluations, gamification,
            and franchise-native tools. See how we compare to other inspection and audit platforms.
          </p>

          <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {hubCards.map((card) => (
              <Link
                key={card.slug}
                to={`/compare/${card.slug}`}
                className="group flex flex-col bg-white rounded-2xl shadow-sm ring-1 ring-gray-900/5 hover:shadow-lg hover:ring-primary-200 transition-all overflow-hidden"
              >
                {/* Title block */}
                <div className="px-8 pt-10 pb-6">
                  <div className="text-2xl font-bold text-gray-900 group-hover:text-primary-600 transition-colors leading-tight">
                    StoreScore
                  </div>
                  <div className="text-base text-gray-400 mt-1">vs</div>
                  <div className="text-2xl text-gray-600 mt-1 leading-tight">
                    {card.name}
                  </div>
                </div>

                {/* Description */}
                <div className="px-8 pb-6 flex-1">
                  <p className="text-sm text-gray-500 leading-relaxed">
                    {card.blurb}
                  </p>
                </div>

                {/* Overlap tags */}
                <div className="px-8 pb-6">
                  <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Where they overlap
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {card.overlap.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 w-fit"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Footer CTA */}
                <div className="px-8 py-4 border-t border-gray-100 bg-gray-50/50">
                  <span className="text-sm font-semibold text-primary-600 group-hover:text-primary-700 transition-colors">
                    View full comparison &rarr;
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Compare page                                                 */
/* ------------------------------------------------------------------ */

export default function Compare() {
  const { slug } = useParams<{ slug: string }>();
  const data = slug ? competitors[slug] : undefined;
  const [mobileView, setMobileView] = useState<'storescore' | 'competitor'>('storescore');

  if (!data) return <CompareHub />;

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: data.faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: { '@type': 'Answer', text: faq.a },
    })),
  };

  return (
    <div>
      <SEO
        title={`StoreScore vs ${data.name} (2026) | Feature & Pricing Comparison`}
        description={`Compare StoreScore and ${data.name} side by side. See features, pricing, AI capabilities, and find out which store audit platform is right for your retail operation.`}
        path={`/compare/${data.slug}`}
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      </Helmet>

      {/* ── 1. Hero ─────────────────────────────────────────────── */}
      <section className="bg-gradient-to-b from-gray-50 to-white py-16 sm:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">
            Comparison
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight">
            StoreScore vs {data.name}
          </h1>
          <p className="mt-4 text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto">
            {data.tagline}
          </p>
          <p className="mt-3 text-base text-gray-500 max-w-2xl mx-auto">
            {data.description}
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/signup"
              className="inline-flex items-center px-6 py-3 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
            >
              Try StoreScore Free
            </Link>
            <Link
              to="/pricing"
              className="inline-flex items-center px-6 py-3 text-sm font-semibold text-gray-700 bg-white rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              See Pricing
            </Link>
          </div>
        </div>
      </section>

      {/* ── 2. At a Glance ──────────────────────────────────────── */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-12">
            At a Glance
          </h2>

          {/* Quick stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12 max-w-4xl mx-auto">
            <div className="rounded-2xl border-2 border-primary-200 bg-primary-50/50 p-8">
              <div className="text-xs font-semibold text-primary-600 uppercase tracking-wider mb-5">StoreScore</div>
              <dl className="space-y-4">
                <div>
                  <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pricing</dt>
                  <dd className="mt-1 text-base text-gray-900 font-medium">$29–$79/store/mo</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wider">AI Features</dt>
                  <dd className="mt-1 text-base text-gray-900 font-medium">Walk summaries, photo analysis, auto-action items</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Gamification</dt>
                  <dd className="mt-1 text-base text-gray-900 font-medium">Badges, leaderboards, challenges</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Focus</dt>
                  <dd className="mt-1 text-base text-gray-900 font-medium">Retail & franchise</dd>
                </div>
              </dl>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-8">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-5">{data.name}</div>
              <dl className="space-y-4">
                <div>
                  <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pricing</dt>
                  <dd className="mt-1 text-base text-gray-700">{data.pricingModel}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Rating</dt>
                  <dd className="mt-1 text-base text-gray-700">{data.rating}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Founded</dt>
                  <dd className="mt-1 text-base text-gray-700">{data.founded}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Focus</dt>
                  <dd className="mt-1 text-base text-gray-700">{data.target}</dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Verdict boxes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-2xl border-2 border-primary-200 bg-primary-50/30 p-6">
              <h3 className="text-sm font-bold text-primary-700 uppercase tracking-wider mb-3">
                Choose StoreScore if...
              </h3>
              <ul className="space-y-2">
                {data.chooseStoreScore.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-gray-700">
                    <CheckIcon className="w-4 h-4 text-primary-600 mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
                Choose {data.name} if...
              </h3>
              <ul className="space-y-2">
                {data.chooseCompetitor.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="w-4 h-4 mt-0.5 flex-shrink-0 text-center text-gray-400">&bull;</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. Feature Comparison Table ─────────────────────────── */}
      <section className="py-16 sm:py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-4">
            Feature Comparison
          </h2>
          <p className="text-base text-gray-600 text-center mb-12">
            A detailed look at how the two platforms compare across key capabilities.
          </p>

          {/* Mobile toggle */}
          <div className="sm:hidden mb-6">
            <div className="flex rounded-lg bg-gray-100 p-1">
              <button
                onClick={() => setMobileView('storescore')}
                className={`flex-1 py-2 px-3 rounded-md text-center text-sm transition-all ${
                  mobileView === 'storescore'
                    ? 'bg-white shadow-sm text-primary-700 font-semibold'
                    : 'text-gray-500'
                }`}
              >
                StoreScore
              </button>
              <button
                onClick={() => setMobileView('competitor')}
                className={`flex-1 py-2 px-3 rounded-md text-center text-sm transition-all ${
                  mobileView === 'competitor'
                    ? 'bg-white shadow-sm text-gray-900 font-semibold'
                    : 'text-gray-500'
                }`}
              >
                {data.name}
              </button>
            </div>
          </div>

          {/* Mobile: single-column */}
          <div className="sm:hidden">
            <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-900/5 overflow-hidden">
              {data.featureComparison.map((group) => (
                <div key={group.category}>
                  <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                      {group.category}
                    </span>
                  </div>
                  {group.rows.map((row, i) => {
                    const val = mobileView === 'storescore' ? row.storescore : row.competitor;
                    return (
                      <div
                        key={row.feature}
                        className={`flex items-center justify-between px-4 py-3 ${
                          i < group.rows.length - 1 ? 'border-b border-gray-50' : 'border-b border-gray-100'
                        }`}
                      >
                        <span className="text-sm text-gray-700">{row.feature}</span>
                        <div className="flex-shrink-0 ml-3">
                          <CellValue value={val} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Desktop: full grid */}
          <div className="hidden sm:block">
            <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-900/5 overflow-hidden">
              {/* Header */}
              <div className="sticky top-0 z-10 grid grid-cols-[1fr_140px_140px] border-b border-gray-200 bg-white">
                <div className="p-4">
                  <span className="text-sm font-medium text-gray-500">Feature</span>
                </div>
                <div className="p-4 text-center bg-primary-50/50 border-x border-primary-100">
                  <div className="text-sm font-semibold text-primary-700">StoreScore</div>
                </div>
                <div className="p-4 text-center">
                  <div className="text-sm font-semibold text-gray-700">{data.name}</div>
                </div>
              </div>

              {/* Groups */}
              {data.featureComparison.map((group) => (
                <div key={group.category}>
                  <div className="grid grid-cols-[1fr_140px_140px] bg-gray-50 border-b border-gray-100">
                    <div className="px-4 py-2.5">
                      <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                        {group.category}
                      </span>
                    </div>
                    <div className="bg-primary-50/30 border-x border-primary-100" />
                    <div />
                  </div>
                  {group.rows.map((row, i) => (
                    <div
                      key={row.feature}
                      className={`grid grid-cols-[1fr_140px_140px] ${
                        i < group.rows.length - 1 ? 'border-b border-gray-50' : 'border-b border-gray-100'
                      }`}
                    >
                      <div className="px-4 py-3 text-sm text-gray-700">{row.feature}</div>
                      <div className="px-4 py-3 flex items-center justify-center bg-primary-50/30 border-x border-primary-100">
                        <CellValue value={row.storescore} />
                      </div>
                      <div className="px-4 py-3 flex items-center justify-center">
                        <CellValue value={row.competitor} />
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Pricing Comparison ──────────────────────────────── */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-4">
            Pricing Comparison
          </h2>
          <p className="text-base text-gray-600 text-center mb-12">
            Understand the true cost of each platform for your operation.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* StoreScore pricing */}
            <div className="rounded-2xl border-2 border-primary-200 p-6 sm:p-8">
              <div className="text-xs font-semibold text-primary-600 uppercase tracking-wider mb-4">
                StoreScore
              </div>
              <div className="space-y-4 mb-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-gray-900">$29–$79</span>
                  <span className="text-sm text-gray-500">/store/month</span>
                </div>
                <div className="space-y-2 text-sm text-gray-600">
                  <p className="flex items-center gap-2">
                    <CheckIcon className="w-4 h-4 text-primary-600 flex-shrink-0" />
                    Unlimited walks (Pro & Enterprise)
                  </p>
                  <p className="flex items-center gap-2">
                    <CheckIcon className="w-4 h-4 text-primary-600 flex-shrink-0" />
                    Up to 25 users included (Pro)
                  </p>
                  <p className="flex items-center gap-2">
                    <CheckIcon className="w-4 h-4 text-primary-600 flex-shrink-0" />
                    Volume discounts up to 20%
                  </p>
                  <p className="flex items-center gap-2">
                    <CheckIcon className="w-4 h-4 text-primary-600 flex-shrink-0" />
                    14-day free trial, no credit card
                  </p>
                </div>
              </div>
              <Link
                to="/pricing"
                className="inline-flex items-center text-sm font-semibold text-primary-600 hover:text-primary-700"
              >
                View full pricing &rarr;
              </Link>
            </div>

            {/* Competitor pricing */}
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 sm:p-8">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
                {data.name}
              </div>
              <div className="space-y-3 mb-6">
                {data.tiers.map((tier) => (
                  <div key={tier.name} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-semibold text-gray-900">{tier.name}</span>
                      <span className="text-sm font-bold text-gray-700">{tier.price}</span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">{tier.details}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Cost example */}
          <div className="mt-10 max-w-3xl mx-auto bg-gray-50 rounded-2xl border border-gray-200 p-6 sm:p-8">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">
              Real-world example: {data.costExample.scenario}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-primary-50 rounded-xl p-4 border border-primary-100">
                <div className="text-xs font-semibold text-primary-600 mb-1">StoreScore</div>
                <p className="text-sm text-gray-700">{data.costExample.storescore}</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <div className="text-xs font-semibold text-gray-500 mb-1">{data.name}</div>
                <p className="text-sm text-gray-700">{data.costExample.competitor}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. Why Teams Switch ────────────────────────────────── */}
      <section className="py-16 sm:py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-4">
            Why Teams Switch to StoreScore
          </h2>
          <p className="text-base text-gray-600 text-center mb-12">
            The key advantages that drive teams to make the move.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {data.switchReasons.map((reason) => (
              <div
                key={reason.title}
                className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-900/5 p-6 sm:p-8"
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{reason.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{reason.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. Honest Assessment ──────────────────────────────── */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-12">
            Honest Assessment
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">
                Where {data.name} Falls Short
              </h3>
              <ul className="space-y-3">
                {data.weaknesses.map((w) => (
                  <li key={w} className="flex items-start gap-2 text-sm text-gray-600">
                    <XIcon className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">
                Where {data.name} Excels
              </h3>
              <ul className="space-y-3">
                {data.strengths.map((s) => (
                  <li key={s} className="flex items-start gap-2 text-sm text-gray-600">
                    <CheckIcon className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. FAQ ─────────────────────────────────────────────── */}
      <section className="py-16 sm:py-20 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-12">
            Frequently Asked Questions
          </h2>
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-900/5 px-6 sm:px-8">
            {data.faqs.map((faq) => (
              <FaqItem key={faq.q} question={faq.q} answer={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── 8. Bottom CTA ──────────────────────────────────────── */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Ready to try the modern alternative?
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Start your free 14-day trial with full access to every feature. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/signup"
              className="inline-flex items-center px-8 py-3 text-base font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
            >
              Try StoreScore Free
            </Link>
            <Link
              to="/request-demo"
              className="inline-flex items-center px-8 py-3 text-base font-semibold text-gray-700 bg-white rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Request a Demo
            </Link>
          </div>
          <p className="mt-6 text-sm text-gray-400">
            Also comparing other platforms?{' '}
            {Object.values(competitors)
              .filter((c) => c.slug !== data.slug)
              .map((c) => (
                <Link
                  key={c.slug}
                  to={`/compare/${c.slug}`}
                  className="text-primary-600 hover:text-primary-700 font-medium"
                >
                  StoreScore vs {c.name}
                </Link>
              ))}
          </p>
        </div>
      </section>
    </div>
  );
}
