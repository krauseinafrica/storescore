import { useState } from 'react';
import { Link } from 'react-router-dom';
import { captureEmail } from '../../api/integrations';
import SEO from '../../components/SEO';

const CDN = 'https://images-media.nyc3.cdn.digitaloceanspaces.com/storescore-files';

const steps = [
  {
    number: '01',
    title: 'Snap a Photo',
    description: 'Walk your store and capture photos of any department or area — no template setup required.',
    image: `${CDN}/AI%20Photo%20Before.png`,
    imageAlt: 'Store aisle before improvement — sparse shelves and disorganized products',
  },
  {
    number: '02',
    title: 'AI Analyzes Instantly',
    description: 'AI identifies issues, scores conditions, and generates prioritized action items automatically.',
    image: `${CDN}/AI%20Analysis.png`,
    imageAlt: 'AI analysis showing key findings and suggested action items with priority levels',
  },
  {
    number: '03',
    title: 'Track Improvement',
    description: 'Store teams fix flagged issues. Follow-up photos prove resolution. Scores climb.',
    image: `${CDN}/AI%20Photo.png`,
    imageAlt: 'Same aisle after improvement — organized shelves, full stock, clean presentation',
  },
];

const testimonials = [
  {
    quote:
      'I could see how warehouse organization and rental department cleanliness directly affected my store\u2019s total sales.',
    name: 'Regional Manager',
    role: 'Hardware Retail, 12 Locations',
  },
  {
    quote:
      'We used to spend two days compiling walk results into spreadsheets. Now we get AI summaries and action items the moment an evaluation is submitted.',
    name: 'VP of Operations',
    role: 'Grocery Chain, 35 Locations',
  },
  {
    quote:
      'Store managers actually complete their corrective actions now because there\u2019s visibility and accountability.',
    name: 'District Manager',
    role: 'Franchise Operations, 22 Locations',
  },
];

const industries = [
  { name: 'Hardware & Home Improvement', examples: 'Ace Hardware, True Value, Do it Best' },
  { name: 'Grocery & Convenience', examples: 'Independent grocers, C-stores, co-ops' },
  { name: 'Franchise Operations', examples: 'QSR, retail, fitness, automotive' },
  { name: 'Specialty Retail', examples: 'Apparel, electronics, pet, sporting goods' },
];

const capabilities = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    title: 'Store Walks',
    desc: 'Structured evaluations with weighted scoring templates',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    title: 'AI Photo Analysis',
    desc: 'Snap a photo — AI scores it and flags issues',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    title: 'GPS & QR Verification',
    desc: 'Proof that evaluators are physically on-site',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: 'Action Items',
    desc: 'Auto-generated with priority, owners, and due dates',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: 'Analytics & Reports',
    desc: 'Score trends, rankings, and section breakdowns',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    ),
    title: 'Gamification',
    desc: 'Leaderboards, badges, and challenges drive engagement',
  },
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

export default function Home() {
  return (
    <div>
      <SEO
        title="StoreScore — Store Quality Management for Hardware, Retail & Franchise"
        description="AI-powered store evaluations for multi-location businesses. Photo analysis, GPS verification, action items, and leaderboards. Start free."
        path="/"
      />

      {/* ─── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 sm:pt-28 pb-12">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight leading-tight">
              Keep every store{' '}
              <span className="text-primary-600">consistently excellent</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-gray-600 leading-relaxed">
              AI-powered evaluations, photo analysis, and real-time analytics
              for multi-location retailers and franchise operators.
            </p>
            <div className="mt-8">
              <EmailCaptureForm variant="light" />
            </div>
          </div>
        </div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary-100/30 rounded-full blur-3xl pointer-events-none" />
      </section>

      {/* ─── Before → AI → After (visual story) ───────────── */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              From problem to solution in seconds
            </h2>
            <p className="mt-3 text-lg text-gray-600 max-w-2xl mx-auto">
              Snap a photo. AI does the rest.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {steps.map((step, index) => (
              <div key={step.number} className="relative">
                {/* Arrow between steps (desktop only) */}
                {index < steps.length - 1 && (
                  <div className="hidden md:flex absolute top-1/3 -right-4 lg:-right-5 z-10 w-8 lg:w-10 items-center justify-center">
                    <svg className="w-6 h-6 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </div>
                )}

                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
                  {/* Image */}
                  <div className="aspect-[4/3] overflow-hidden bg-gray-100">
                    <img
                      src={step.image}
                      alt={step.imageAlt}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {/* Caption */}
                  <div className="p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs font-bold text-primary-600 bg-primary-50 px-2.5 py-1 rounded-full">
                        {step.number}
                      </span>
                      <h3 className="text-lg font-semibold text-gray-900">{step.title}</h3>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">{step.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Dashboard Preview ────────────────────────────── */}
      <section className="py-16 sm:py-24 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Your stores at a glance
            </h2>
            <p className="mt-3 text-lg text-gray-600 max-w-2xl mx-auto">
              Real-time scores, trends, and action items across every location.
            </p>
          </div>

          {/* Desktop dashboard screenshot */}
          <div className="hidden sm:block">
            <img
              src="https://images-media.nyc3.cdn.digitaloceanspaces.com/storescore-files/Screenshot%202026-02-19%20at%209.53.04%E2%80%AFPM.png"
              alt="StoreScore Reports & Analytics — Quick Insights, KPI cards, goal gauge, regional breakdown, score trends, and section analysis"
              loading="lazy"
              className="rounded-2xl shadow-2xl ring-1 ring-gray-900/10 w-full"
            />
            <p className="text-xs text-gray-400 text-center mt-3">Real analytics from a 14-store hardware retailer — 50 evaluations, 87% avg score</p>
          </div>
          {/* Mobile dashboard screenshot */}
          <div className="sm:hidden mx-auto max-w-sm">
            <img
              src="https://images-media.nyc3.cdn.digitaloceanspaces.com/storescore-files/Screenshot%202026-02-19%20at%209.51.56%E2%80%AFPM.png"
              alt="StoreScore dashboard on mobile — Quick Insights, 87% score, goal gauge, regional bars"
              loading="lazy"
              className="rounded-2xl shadow-2xl ring-1 ring-gray-900/10 w-full"
            />
            <p className="text-xs text-gray-400 text-center mt-3">Real dashboard from a 14-store hardware retailer</p>
          </div>
        </div>
      </section>

      {/* ─── Capabilities Grid ────────────────────────────── */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Everything you need
            </h2>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
            {capabilities.map((cap) => (
              <div key={cap.title} className="flex gap-4 p-4 rounded-xl hover:bg-gray-50 transition-colors">
                <div className="w-11 h-11 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center flex-shrink-0">
                  {cap.icon}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{cap.title}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{cap.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-8">
            <Link
              to="/features"
              className="inline-flex items-center gap-2 text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors"
            >
              See all features
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Testimonials ─────────────────────────────────── */}
      <section className="py-16 sm:py-20 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              What operators are saying
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="relative p-6 rounded-2xl bg-white border border-gray-200"
              >
                <svg className="absolute top-5 left-5 w-7 h-7 text-primary-100" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179z" />
                </svg>
                <p className="mt-6 text-gray-700 leading-relaxed text-[15px]">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="mt-5 pt-5 border-t border-gray-100">
                  <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                  <p className="text-sm text-gray-500">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Industries ───────────────────────────────────── */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Built for multi-location businesses
            </h2>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {industries.map((industry) => (
              <div
                key={industry.name}
                className="p-5 rounded-xl border border-gray-200 hover:border-primary-200 hover:shadow-md transition-all text-center"
              >
                <h3 className="text-sm font-semibold text-gray-900 mb-1">{industry.name}</h3>
                <p className="text-xs text-primary-600">{industry.examples}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ──────────────────────────────────────────── */}
      <section className="py-16 sm:py-20 bg-primary-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to raise the bar?
          </h2>
          <p className="text-lg text-primary-100 mb-8 max-w-xl mx-auto">
            Join multi-location businesses using StoreScore to drive consistent quality across every store.
          </p>

          <EmailCaptureForm variant="dark" />

          <div className="mt-8 flex items-center justify-center gap-6 text-sm text-primary-200">
            <Link to="/features" className="hover:text-white transition-colors underline underline-offset-2">
              See all features
            </Link>
            <Link to="/tour" className="hover:text-white transition-colors underline underline-offset-2">
              Product tour
            </Link>
            <Link to="/pricing" className="hover:text-white transition-colors underline underline-offset-2">
              View pricing
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
