import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import SEO from '../../components/SEO';

interface FeatureSection {
  title: string;
  description: string;
  icon: React.ReactNode;
  highlights: string[];
  /** Optional pair of images shown instead of the placeholder */
  images?: { src: string; alt: string }[];
  /** Stack images vertically instead of side-by-side grid (useful for mixed mobile/desktop screenshots) */
  imageLayout?: 'grid' | 'stacked';
  /** Which plan tier includes this feature */
  planTier: 'all' | 'pro' | 'enterprise';
}

const tierBadge: Record<string, { label: string; bg: string; text: string }> = {
  all: { label: 'All Plans', bg: 'bg-gray-100', text: 'text-gray-600' },
  pro: { label: 'Pro + Enterprise', bg: 'bg-violet-50', text: 'text-violet-700' },
  enterprise: { label: 'Enterprise', bg: 'bg-primary-50', text: 'text-primary-700' },
};

const features: FeatureSection[] = [
  {
    title: 'Store Walks & Evaluations',
    description:
      'Conduct structured, consistent evaluations across every location. Customizable scoring templates let you measure what matters most to your business, from cleanliness and merchandising to safety and customer experience.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    highlights: [
      'Customizable scoring templates with weighted sections',
      'Photo documentation with GPS and QR verification',
      'Digital signatures from evaluators and store managers',
      'Historical trend tracking per location',
    ],
    images: [
      { src: 'https://images-media.nyc3.cdn.digitaloceanspaces.com/storescore-files/Screenshot%202026-02-19%20at%209.48.38%E2%80%AFPM.png', alt: 'New Store Walk setup screen on mobile — select store, template, and date' },
      { src: 'https://images-media.nyc3.cdn.digitaloceanspaces.com/storescore-files/Screenshot%202026-02-19%20at%209.49.16%E2%80%AFPM.png', alt: 'Live store walk scoring — Curb Appeal section with 1-5 rating and root cause drivers' },
    ],
    planTier: 'all',
  },
  {
    title: 'Quick Assessments',
    description:
      'Capture store conditions in seconds with freeform photo assessments. Snap photos of any area, and AI analyzes them to identify issues, score conditions, and suggest action items for your review — no template required.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    highlights: [
      'Freeform photo capture with no template setup needed',
      'AI-powered analysis of store conditions from photos',
      'Automatic issue detection and severity scoring',
      'AI-suggested action items with accept/dismiss review',
    ],
    images: [
      { src: 'https://images-media.nyc3.cdn.digitaloceanspaces.com/storescore-files/AI%20Photo.png', alt: 'Store aisle photo captured during a quick assessment' },
      { src: 'https://images-media.nyc3.cdn.digitaloceanspaces.com/storescore-files/AI%20Analysis.png', alt: 'AI analysis results with findings and auto-generated action items' },
    ],
    planTier: 'enterprise',
  },
  {
    title: 'AI Photo Analysis',
    description:
      'Powered by advanced AI vision, StoreScore analyzes photos captured during walks and assessments. It identifies merchandising gaps, safety hazards, cleanliness issues, and more — giving you objective, consistent evaluations at scale.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
    highlights: [
      'AI vision analysis of every uploaded photo',
      'Identifies merchandising, safety, and cleanliness issues',
      'Objective scoring removes evaluator subjectivity',
      'Detailed written observations for each photo',
    ],
    images: [
      { src: 'https://images-media.nyc3.cdn.digitaloceanspaces.com/storescore-files/Screenshot%202026-02-19%20at%2011.36.09%E2%80%AFPM.png', alt: 'AI photo analysis of a knife department — identifying display issues, pricing, and merchandising gaps' },
      { src: 'https://images-media.nyc3.cdn.digitaloceanspaces.com/storescore-files/AI%20Analysis.png', alt: 'Detailed AI analysis with key findings and suggested action items' },
    ],
    planTier: 'enterprise',
  },
  {
    title: 'Department Evaluations',
    description:
      'Evaluate individual departments within a store using specialized criteria. Hardware, paint, lumber, rental — each department gets its own scoring template, trends, and action items for targeted improvement.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    highlights: [
      'Department-specific scoring templates and criteria',
      'Track trends per department across all stores',
      'Compare department performance across locations',
      'Targeted action items by department',
    ],
    images: [
      { src: 'https://images-media.nyc3.cdn.digitaloceanspaces.com/storescore-files/Screenshot%202026-02-19%20at%2010.29.45%E2%80%AFPM.png', alt: 'Rental department evaluation in progress with AI photo analysis scoring equipment condition' },
    ],
    planTier: 'all',
  },
  {
    title: 'AI-Powered Summaries',
    description:
      'Get instant, actionable insights from every evaluation. Our AI analyzes scores, notes, and photos to generate executive summaries that highlight critical issues and commendable performance.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    highlights: [
      'Automatic walk summary generation after completion',
      'Photo analysis with AI-driven observations',
      'Pattern detection across multiple evaluations',
      'Actionable recommendations prioritized by impact',
    ],
    images: [
      { src: 'https://images-media.nyc3.cdn.digitaloceanspaces.com/storescore-files/Screenshot%202026-02-19%20at%2010.29.45%E2%80%AFPM.png', alt: 'AI analysis generating detailed observations from a store photo — identifying safety and cleanliness issues automatically' },
      { src: 'https://images-media.nyc3.cdn.digitaloceanspaces.com/storescore-files/AI%20Analysis.png', alt: 'AI-powered summary with key findings, ratings, and auto-generated action items from photo analysis' },
    ],
    planTier: 'all',
  },
  {
    title: 'Gamification & Leaderboards',
    description:
      'Drive engagement and healthy competition across your stores. Leaderboards rank locations by score, badges reward consistency and improvement, and challenges motivate teams to hit targets.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    ),
    highlights: [
      'Store leaderboards ranked by evaluation scores',
      'Achievement badges for streaks, perfect scores, and milestones',
      'Time-bound challenges with targets and prizes',
      'Visible progress tracking for store teams',
    ],
    images: [
      { src: 'https://images-media.nyc3.cdn.digitaloceanspaces.com/storescore-files/Screenshot%202026-02-19%20at%2010.24.18%E2%80%AFPM.png', alt: 'Leaderboard ranking stores by longest streak — Maplewood 1st, Capital City 2nd, Lakewood 3rd' },
      { src: 'https://images-media.nyc3.cdn.digitaloceanspaces.com/storescore-files/Screenshot%202026-02-19%20at%2010.22.55%E2%80%AFPM.png', alt: 'Achievements tab showing recently earned badges and full achievement grid with bronze, silver, gold, and platinum tiers' },
    ],
    imageLayout: 'stacked',
    planTier: 'pro',
  },
  {
    title: 'Team Management',
    description:
      'Organize your team with role-based access across regions and stores. Assign evaluators, manage permissions, and ensure the right people see the right data at every level of your organization.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    highlights: [
      'Role-based access: owner, admin, regional manager, store manager, evaluator',
      'Region and store assignments for granular permissions',
      'Invite team members with automated onboarding',
      'Activity tracking and accountability across locations',
    ],
    images: [
      { src: 'https://images-media.nyc3.cdn.digitaloceanspaces.com/storescore-files/Screenshot%202026-02-19%20at%209.55.19%E2%80%AFPM.png', alt: 'Evaluator Insights — scoring patterns, average scores, and consistency analysis per evaluator' },
    ],
    planTier: 'all',
  },
  {
    title: 'Reporting & Analytics',
    description:
      'Transform evaluation data into strategic insights. Track scores over time, compare locations, identify trends, and generate reports that drive real improvements across your multi-location business.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    highlights: [
      'Dashboard with score trends and location comparisons',
      'Region-level and organization-level analytics',
      'Section-by-section performance breakdowns',
      'Exportable reports for stakeholder presentations',
    ],
    images: [
      { src: 'https://images-media.nyc3.cdn.digitaloceanspaces.com/storescore-files/Screenshot%202026-02-19%20at%209.54.53%E2%80%AFPM.png', alt: 'Store Deep Dive analytics — individual store score history, section trends, and KPI cards' },
      { src: 'https://images-media.nyc3.cdn.digitaloceanspaces.com/storescore-files/Screenshot%202026-02-19%20at%209.55.06%E2%80%AFPM.png', alt: 'Section Analysis with criteria scores, by-store comparison charts, and monthly trends' },
    ],
    planTier: 'pro',
  },
  {
    title: 'Action Items & Follow-ups',
    description:
      'Never let an issue slip through the cracks. Automatically generate action items from low-scoring criteria, assign owners, set due dates, and track resolution with photo evidence.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    highlights: [
      'Auto-generated from evaluation results',
      'Priority levels: low, medium, high, critical',
      'Photo-based resolution evidence',
      'Escalation workflows for overdue items',
    ],
    images: [
      { src: 'https://images-media.nyc3.cdn.digitaloceanspaces.com/storescore-files/Screenshot%202026-02-19%20at%2010.33.33%E2%80%AFPM.png', alt: 'Action item detail with photo evidence, priority level, and resolution tracking' },
      { src: 'https://images-media.nyc3.cdn.digitaloceanspaces.com/storescore-files/Screenshot%202026-02-19%20at%2010.35.49%E2%80%AFPM.png', alt: 'Action items list with priority levels, status tracking, and assignment details' },
    ],
    imageLayout: 'stacked',
    planTier: 'all',
  },
  {
    title: 'Scheduling & Automation',
    description:
      'Set it and forget it. Schedule evaluations on a weekly, biweekly, monthly, or quarterly cadence. Walks are auto-created and assigned, with reminders sent to evaluators before each due date.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    highlights: [
      'Recurring schedules: weekly, biweekly, monthly, quarterly',
      'Organization, region, or store-level scoping',
      'Automatic walk creation and evaluator assignment',
      'Calendar integration with .ics export',
    ],
    images: [
      { src: 'https://images-media.nyc3.cdn.digitaloceanspaces.com/storescore-files/Screenshot%202026-02-19%20at%2010.12.51%E2%80%AFPM.png', alt: 'Evaluation schedules list showing active monthly and biweekly recurring schedules' },
      { src: 'https://images-media.nyc3.cdn.digitaloceanspaces.com/storescore-files/Screenshot%202026-02-19%20at%2010.12.31%E2%80%AFPM.png', alt: 'New Schedule creation form with template, frequency, scope, and reminder settings' },
    ],
    planTier: 'pro',
  },
  {
    title: 'SOP Management',
    description:
      'Link your standard operating procedures directly to evaluation criteria. Evaluators can reference SOPs during walks, and managers can track compliance against documented standards.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    highlights: [
      'Upload and manage SOP documents',
      'AI-suggested criterion-to-SOP linking',
      'In-walk SOP reference for evaluators',
      'Compliance tracking against documented standards',
    ],
    images: [
      { src: 'https://images-media.nyc3.cdn.digitaloceanspaces.com/storescore-files/Screenshot%202026-02-20%20at%208.55.34%E2%80%AFAM.png', alt: 'SOP management — upload, organize, and link standard operating procedures to evaluation criteria' },
    ],
    planTier: 'pro',
  },
  {
    title: 'Data Integrations',
    description:
      'Bring in data from external systems to enrich your store performance picture. Import POS sales figures, customer satisfaction surveys, shrink reports, and more — then correlate them with evaluation scores to see how store quality drives business results.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
      </svg>
    ),
    highlights: [
      'Import sales, shrink, and customer satisfaction data via CSV or API',
      'Track department-level metrics like paint mixing volume or tool rental revenue',
      'Manual entry for ad-hoc KPIs like safety incidents or staffing hours',
      'Correlate external metrics with evaluation scores to measure impact',
    ],
    planTier: 'enterprise',
  },
];

function slugify(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export default function Features() {
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);

  const closeLightbox = useCallback(() => setLightbox(null), []);

  useEffect(() => {
    if (!lightbox) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKey);
    };
  }, [lightbox, closeLightbox]);

  return (
    <div>
      <SEO
        title="Features | StoreScore — Store Walks, AI Photo Analysis, Gamification & More"
        description="Store walks, AI photo analysis, quick assessments, department evaluations, gamification, team management, reporting dashboards, and scheduling — all in one retail audit platform."
        path="/features"
      />
      <section className="relative overflow-hidden bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight">
              Store Quality Management,{' '}
              <span className="text-primary-600">Simplified</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-gray-600 leading-relaxed">
              The all-in-one platform for multi-location businesses to conduct evaluations,
              track performance, and drive consistent quality across every retail store and
              franchise location.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/request-demo"
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3 text-base font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
              >
                Request a Demo
              </Link>
              <Link
                to="/pricing"
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3 text-base font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                View Pricing
              </Link>
            </div>
          </div>
        </div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary-100/30 rounded-full blur-3xl pointer-events-none" />
      </section>

      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Everything you need to manage store quality
            </h2>
            <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
              From scheduling evaluations to tracking corrective actions, StoreScore provides
              the tools your team needs to maintain excellence across every location.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => (
              <a
                key={feature.title}
                href={`#${slugify(feature.title)}`}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(slugify(feature.title))?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                className="p-6 rounded-xl border border-gray-200 hover:border-primary-200 hover:shadow-md transition-all group cursor-pointer"
              >
                <div className="w-12 h-12 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center mb-4 group-hover:bg-primary-100 transition-colors">
                  {feature.icon}
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <span className={`inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full mb-2 ${tierBadge[feature.planTier].bg} ${tierBadge[feature.planTier].text}`}>
                  {tierBadge[feature.planTier].label}
                </span>
                <p className="text-sm text-gray-500 line-clamp-3">{feature.description}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-24 sm:space-y-32">
          {features.map((feature, index) => {
            const isReversed = index % 2 === 1;
            return (
              <div
                key={feature.title}
                id={slugify(feature.title)}
                className={`flex flex-col ${
                  isReversed ? 'lg:flex-row-reverse' : 'lg:flex-row'
                } items-center gap-12 lg:gap-16 scroll-mt-8`}
              >
                <div className="flex-1 max-w-lg">
                  <div className="w-14 h-14 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center mb-6">
                    {feature.icon}
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
                    {feature.title}
                  </h3>
                  <span className={`inline-block text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full mb-4 ${tierBadge[feature.planTier].bg} ${tierBadge[feature.planTier].text}`}>
                    {tierBadge[feature.planTier].label}
                  </span>
                  <p className="text-gray-600 leading-relaxed mb-6">{feature.description}</p>
                  <ul className="space-y-3">
                    {feature.highlights.map((highlight) => (
                      <li key={highlight} className="flex items-start gap-3">
                        <svg
                          className="w-5 h-5 text-primary-600 mt-0.5 flex-shrink-0"
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
                        <span className="text-sm text-gray-600">{highlight}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex-1 w-full max-w-lg">
                  {feature.images && feature.images.length > 0 ? (
                    <div className={
                      feature.images.length === 1
                        ? 'flex justify-center'
                        : feature.imageLayout === 'stacked'
                          ? 'space-y-3'
                          : 'grid grid-cols-2 gap-3'
                    }>
                      {feature.images.map((img) => (
                        <img
                          key={img.src}
                          src={img.src}
                          alt={img.alt}
                          loading="lazy"
                          onClick={() => setLightbox(img)}
                          className={`rounded-2xl shadow-lg ring-1 ring-gray-900/10 cursor-pointer hover:ring-primary-300 hover:shadow-xl transition-all ${feature.images!.length === 1 ? 'max-w-sm w-full' : 'w-full'}`}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="aspect-[4/3] rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50 border border-gray-200 flex items-center justify-center">
                      <div className="text-center p-8">
                        <div className="w-16 h-16 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center mx-auto mb-4">
                          {feature.icon}
                        </div>
                        <p className="text-sm font-medium text-gray-400">{feature.title}</p>
                        <p className="text-xs text-gray-300 mt-1">Screenshot coming soon</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="py-20 sm:py-24 bg-primary-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to elevate your store quality?
          </h2>
          <p className="text-lg text-primary-100 mb-8 max-w-2xl mx-auto">
            Join multi-location businesses that trust StoreScore to maintain consistent
            quality standards across every retail store and franchise location.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/request-demo"
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3 text-base font-semibold text-primary-600 bg-white rounded-lg hover:bg-primary-50 transition-colors shadow-sm"
            >
              Request a Demo
            </Link>
            <Link
              to="/pricing"
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3 text-base font-semibold text-white border-2 border-white/30 rounded-lg hover:bg-white/10 transition-colors"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-8"
          onClick={closeLightbox}
        >
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors z-10"
            aria-label="Close"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={lightbox.src}
            alt={lightbox.alt}
            className="max-w-full max-h-[90vh] rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
