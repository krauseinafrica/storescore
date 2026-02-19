import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { captureEmail } from '../../api/integrations';
import SEO from '../../components/SEO';

/* ─── UTM helper ──────────────────────────────────────────────── */

const UTM = '?utm_source=product-tour&utm_medium=web&utm_campaign=tour-cta';
const utm = (path: string, content?: string) =>
  `${path}${UTM}${content ? `&utm_content=${content}` : ''}`;

/* ─── Section definitions ─────────────────────────────────────── */

const SECTIONS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'templates', label: 'Templates' },
  { id: 'conduct', label: 'Conduct a Walk' },
  { id: 'ai-summary', label: 'AI Summary' },
  { id: 'photos', label: 'Photos' },
  { id: 'action-items', label: 'Action Items' },
  { id: 'reports', label: 'Reports' },
  { id: 'team', label: 'Team & Scheduling' },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

/* ─── useActiveSection hook ───────────────────────────────────── */

function useActiveSection(sectionIds: readonly string[]) {
  const [active, setActive] = useState<string>(sectionIds[0]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id);
          }
        }
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: 0 },
    );

    for (const id of sectionIds) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [sectionIds]);

  return active;
}

/* ─── Hash scroll on mount ────────────────────────────────────── */

function useHashScroll() {
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const timer = setTimeout(() => {
      const el = document.getElementById(hash);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    return () => clearTimeout(timer);
  }, []);
}

/* ─── SectionNav ──────────────────────────────────────────────── */

function SectionNav({ active }: { active: string }) {
  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.history.replaceState(null, '', `#${id}`);
    }
  }, []);

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden lg:block fixed left-[max(1rem,calc((100vw-80rem)/2))] top-1/2 -translate-y-1/2 z-40 w-48">
        <div className="bg-white/80 backdrop-blur rounded-xl shadow-sm ring-1 ring-gray-900/5 p-3 space-y-0.5">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                active === s.id
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Mobile pill bar */}
      <div className="lg:hidden sticky top-16 z-40 bg-white/80 backdrop-blur border-b border-gray-100">
        <div className="flex gap-2 px-4 py-2.5 overflow-x-auto no-scrollbar">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                active === s.id
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

/* ─── BrowserChrome ───────────────────────────────────────────── */

function BrowserChrome({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl sm:rounded-2xl shadow-2xl ring-1 ring-gray-900/10 overflow-hidden bg-white">
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-100 border-b border-gray-200">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 ml-4">
          <div className="max-w-sm mx-auto bg-white rounded-md px-3 py-1 text-xs text-gray-400 border border-gray-200">
            {url}
          </div>
        </div>
      </div>
      <div className="p-4 sm:p-6 bg-gray-50">{children}</div>
    </div>
  );
}

/* ─── MobileFrame ─────────────────────────────────────────────── */

function MobileFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-[280px] sm:w-[320px]">
      <div className="rounded-[2rem] bg-gray-900 p-3 shadow-2xl ring-1 ring-gray-800">
        {/* Notch */}
        <div className="flex justify-center mb-2">
          <div className="w-20 h-5 bg-gray-900 rounded-b-xl relative -mt-1">
            <div className="absolute inset-x-4 top-1 h-2 bg-gray-800 rounded-full" />
          </div>
        </div>
        {/* Screen */}
        <div className="bg-white rounded-2xl overflow-hidden">
          {/* Status bar */}
          <div className="flex items-center justify-between px-4 py-1.5 bg-gray-50 text-[10px] text-gray-500">
            <span className="font-medium">9:41</span>
            <div className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z" />
              </svg>
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z" />
              </svg>
            </div>
          </div>
          {/* Content */}
          <div className="p-3">{children}</div>
        </div>
        {/* Home indicator */}
        <div className="flex justify-center mt-2">
          <div className="w-28 h-1 bg-gray-600 rounded-full" />
        </div>
      </div>
    </div>
  );
}

/* ─── Section wrapper ─────────────────────────────────────────── */

function TourSection({
  id,
  number,
  title,
  description,
  children,
}: {
  id: string;
  number: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-bold text-primary-600 bg-primary-50 px-2.5 py-1 rounded-full">
              {number}
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">{title}</h2>
          <p className="mt-3 text-base sm:text-lg text-gray-600 leading-relaxed max-w-2xl">
            {description}
          </p>
        </div>
        {children}
      </div>
    </section>
  );
}

/* ─── EmailCaptureForm ────────────────────────────────────────── */

function EmailCaptureForm() {
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
      await captureEmail({ email: email.trim(), first_name: firstName.trim() || undefined, source: 'product-tour' });
      setSubmitted(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center py-4">
        <div className="flex items-center justify-center gap-2 mb-2">
          <svg className="w-5 h-5 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-lg font-semibold text-white">You're in!</p>
        </div>
        <p className="text-sm text-primary-100">
          Check your inbox — we'll send you everything you need to get started.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-lg mx-auto">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="First name"
          className="flex-shrink-0 sm:w-36 rounded-lg border bg-white/10 border-white/20 text-white placeholder:text-white/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Work email"
          className="flex-1 rounded-lg border bg-white/10 border-white/20 text-white placeholder:text-white/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <button
          type="submit"
          disabled={submitting}
          className="flex-shrink-0 px-6 py-3 text-sm font-semibold rounded-lg bg-white text-primary-600 hover:bg-primary-50 transition-colors disabled:opacity-50"
        >
          {submitting ? 'Sending...' : 'Get Started Free'}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
      <p className="mt-2 text-xs text-white/50">Free to start. No credit card required.</p>
    </form>
  );
}

/* ─── Section 1: Dashboard ────────────────────────────────────── */

function DashboardMockup() {
  return (
    <BrowserChrome url="app.storescore.app/dashboard">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Dashboard</h3>
          <p className="text-[11px] text-gray-400">Acme Hardware — 28 locations</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="text-[11px] bg-white border border-gray-200 rounded-lg px-2 py-1 text-gray-600">
            <option>Last 30 Days</option>
          </select>
          <div className="h-7 px-3 bg-primary-600 rounded-lg text-[11px] font-semibold text-white flex items-center">
            New Walk
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Overall Score', value: '87.2%', color: 'text-green-600', bg: 'bg-green-500', w: '87%' },
          { label: 'Stores Evaluated', value: '24/28', color: 'text-blue-600', bg: 'bg-blue-500', w: '86%' },
          { label: 'Open Actions', value: '12', color: 'text-amber-600', bg: 'bg-amber-500', w: '40%' },
          { label: 'Score Trend', value: '+2.4%', color: 'text-emerald-600', bg: 'bg-emerald-500', w: '65%' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-lg p-3 ring-1 ring-gray-900/5">
            <div className="text-[10px] text-gray-400 font-medium">{kpi.label}</div>
            <div className={`text-lg font-bold ${kpi.color} mt-0.5`}>{kpi.value}</div>
            <div className="h-1 bg-gray-100 rounded-full mt-2">
              <div className={`h-1 ${kpi.bg} rounded-full`} style={{ width: kpi.w }} />
            </div>
          </div>
        ))}
      </div>

      {/* Chart + Recent walks */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2 bg-white rounded-lg p-3 ring-1 ring-gray-900/5">
          <div className="text-[11px] font-semibold text-gray-700 mb-3">Score Trend</div>
          <div className="flex items-end gap-1 h-24">
            {[40, 55, 48, 62, 58, 70, 65, 78, 72, 80, 85, 87].map((h, i) => (
              <div key={i} className="flex-1 bg-primary-100 rounded-t" style={{ height: `${h}%` }}>
                <div className="w-full bg-primary-500 rounded-t" style={{ height: `${Math.min(100, h + 10)}%` }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-1.5 text-[9px] text-gray-300">
            <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span>
            <span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span><span>Nov</span><span>Dec</span>
          </div>
        </div>

        <div className="bg-white rounded-lg p-3 ring-1 ring-gray-900/5">
          <div className="text-[11px] font-semibold text-gray-700 mb-3">Recent Walks</div>
          <div className="space-y-2">
            {[
              { store: 'Store #12 — Elm St', score: '92%', color: 'text-green-600' },
              { store: 'Store #05 — Oak Ave', score: '78%', color: 'text-amber-600' },
              { store: 'Store #18 — Pine Rd', score: '88%', color: 'text-green-600' },
              { store: 'Store #03 — Main St', score: '65%', color: 'text-amber-600' },
            ].map((w) => (
              <div key={w.store} className="flex items-center justify-between">
                <span className="text-[10px] text-gray-600 truncate mr-2">{w.store}</span>
                <span className={`text-[10px] font-bold ${w.color}`}>{w.score}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </BrowserChrome>
  );
}

/* ─── Section 2: Templates ────────────────────────────────────── */

function TemplateMockup() {
  return (
    <BrowserChrome url="app.storescore.app/templates">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Template Editor</h3>
          <p className="text-[11px] text-gray-400">Store Walk — Standard Evaluation</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-7 px-3 bg-white border border-gray-200 rounded-lg text-[11px] font-medium text-gray-600 flex items-center">
            Preview
          </div>
          <div className="h-7 px-3 bg-primary-600 rounded-lg text-[11px] font-semibold text-white flex items-center">
            Save Template
          </div>
        </div>
      </div>

      {/* Template sections */}
      <div className="space-y-3">
        {[
          {
            name: 'Store Appearance',
            weight: '25%',
            criteria: ['Exterior signage & lighting', 'Entrance cleanliness', 'Floor condition', 'Restroom standards'],
            color: 'bg-primary-500',
          },
          {
            name: 'Product Display',
            weight: '30%',
            criteria: ['Shelf organization', 'Price tag accuracy', 'Stock levels', 'End cap presentation', 'Promotional displays'],
            color: 'bg-violet-500',
          },
          {
            name: 'Customer Service',
            weight: '25%',
            criteria: ['Greeting within 30 seconds', 'Product knowledge', 'Checkout experience'],
            color: 'bg-sky-500',
          },
          {
            name: 'Safety & Compliance',
            weight: '20%',
            criteria: ['Emergency exits clear', 'Spill response kit', 'Fire extinguisher access'],
            color: 'bg-emerald-500',
          },
        ].map((section) => (
          <div key={section.name} className="bg-white rounded-lg ring-1 ring-gray-900/5 overflow-hidden">
            <div className="flex items-center gap-3 px-3 py-2.5 border-b border-gray-100">
              <div className={`w-2.5 h-2.5 rounded-full ${section.color}`} />
              <span className="text-xs font-semibold text-gray-900 flex-1">{section.name}</span>
              <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                Weight: {section.weight}
              </span>
              <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            <div className="px-3 py-2 space-y-1.5">
              {section.criteria.map((c, i) => (
                <div key={c} className="flex items-center gap-2 py-1">
                  <span className="text-[10px] text-gray-300 w-4">{i + 1}.</span>
                  <span className="text-[11px] text-gray-700 flex-1">{c}</span>
                  <span className="text-[9px] text-gray-300">1-5 scale</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </BrowserChrome>
  );
}

/* ─── Section 3: Conduct Walk (Mobile) ────────────────────────── */

function ConductWalkMockup() {
  const [selectedScore, setSelectedScore] = useState(4);

  const scores = [
    { value: 1, label: 'Poor', bg: 'bg-red-100', selected: 'bg-red-500', text: 'text-red-700', selText: 'text-white' },
    { value: 2, label: 'Fair', bg: 'bg-orange-100', selected: 'bg-orange-500', text: 'text-orange-700', selText: 'text-white' },
    { value: 3, label: 'Avg', bg: 'bg-yellow-100', selected: 'bg-yellow-500', text: 'text-yellow-700', selText: 'text-white' },
    { value: 4, label: 'Good', bg: 'bg-lime-100', selected: 'bg-lime-500', text: 'text-lime-700', selText: 'text-white' },
    { value: 5, label: 'Great', bg: 'bg-green-100', selected: 'bg-green-500', text: 'text-green-700', selText: 'text-white' },
  ];

  return (
    <MobileFrame>
      {/* Walk header */}
      <div className="border-b border-gray-100 pb-2 mb-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-gray-900">Store #12 — Elm St</div>
            <div className="text-[9px] text-gray-400">Store Walk — Standard Evaluation</div>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <span className="text-[9px] text-green-600 font-medium">GPS</span>
          </div>
        </div>
        {/* Progress */}
        <div className="mt-2">
          <div className="flex items-center justify-between text-[9px] text-gray-400 mb-1">
            <span>Section 1 of 4</span>
            <span>3/4 scored</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full">
            <div className="h-1.5 bg-primary-500 rounded-full" style={{ width: '25%' }} />
          </div>
        </div>
      </div>

      {/* Section name */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full bg-primary-500" />
        <span className="text-[10px] font-semibold text-gray-900">Store Appearance</span>
      </div>

      {/* Criterion */}
      <div className="mb-3">
        <div className="text-[10px] font-medium text-gray-700 mb-2">
          Exterior signage & lighting
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {scores.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setSelectedScore(s.value)}
              className={`flex flex-col items-center py-2 rounded-lg transition-all ${
                selectedScore === s.value
                  ? `${s.selected} ${s.selText} scale-[1.06] shadow-md`
                  : `${s.bg} ${s.text}`
              }`}
            >
              <span className="text-sm font-bold">{s.value}</span>
              <span className="text-[8px] font-medium">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* SOP reference badge */}
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium bg-blue-50 text-blue-700 ring-1 ring-blue-200">
          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          SOP: Signage Standards
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Ref image
        </span>
      </div>

      {/* Notes + Photo buttons */}
      <div className="flex gap-2">
        <div className="flex-1 bg-gray-50 rounded-lg border border-gray-200 px-2.5 py-2 text-[9px] text-gray-400">
          Add notes...
        </div>
        <button type="button" className="flex items-center gap-1 px-2.5 py-2 rounded-lg bg-gray-50 border border-gray-200 text-[9px] text-gray-500">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Photo
        </button>
      </div>
    </MobileFrame>
  );
}

/* ─── Section 4: AI Summary ───────────────────────────────────── */

function AISummaryMockup() {
  return (
    <BrowserChrome url="app.storescore.app/walks/247">
      {/* Walk header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-bold text-gray-900">Store #12 — Elm St</h3>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">
              Completed
            </span>
          </div>
          <p className="text-[11px] text-gray-400">Store Walk — Standard Evaluation &middot; Feb 14, 2026</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-green-600">92%</div>
          <div className="text-[10px] text-gray-400">Overall Score</div>
        </div>
      </div>

      {/* Score breakdown mini */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {[
          { name: 'Appearance', score: '95%', color: 'bg-green-500' },
          { name: 'Products', score: '88%', color: 'bg-green-500' },
          { name: 'Service', score: '92%', color: 'bg-green-500' },
          { name: 'Safety', score: '90%', color: 'bg-green-500' },
        ].map((s) => (
          <div key={s.name} className="text-center">
            <div className="text-[10px] text-gray-400 mb-1">{s.name}</div>
            <div className="h-1.5 bg-gray-100 rounded-full">
              <div className={`h-1.5 ${s.color} rounded-full`} style={{ width: s.score }} />
            </div>
            <div className="text-[10px] font-bold text-gray-700 mt-0.5">{s.score}</div>
          </div>
        ))}
      </div>

      {/* AI Summary card */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <span className="text-sm font-semibold text-blue-900">AI Summary</span>
        </div>
        <div className="space-y-2 text-[11px] text-blue-900/80 leading-relaxed">
          <p>
            <strong>Strong performance</strong> — Store #12 scored 92% overall, placing it in the top
            quartile across all 28 locations this period. Appearance and customer service are particular
            strengths.
          </p>
          <p>
            <strong>Area for improvement</strong> — Product display scoring (88%) was pulled down by
            end cap presentation and promotional display accuracy. Two action items have been auto-generated
            for follow-up.
          </p>
          <p>
            <strong>Trend note</strong> — This location has improved +4.2 points over the last 3 evaluations,
            the highest improvement rate in the Southeast region.
          </p>
        </div>
      </div>

      {/* Evaluator & signatures */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-[10px] font-bold">
            SM
          </div>
          <div>
            <div className="text-[10px] font-medium text-gray-700">Sarah Mitchell</div>
            <div className="text-[9px] text-gray-400">Regional Manager</div>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-green-600">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Digitally signed
        </div>
      </div>
    </BrowserChrome>
  );
}

/* ─── Section 5: Photo Documentation ─────────────────────────── */

function PhotosMockup() {
  return (
    <BrowserChrome url="app.storescore.app/walks/247#photos">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-gray-900">Photo Documentation</h3>
        <p className="text-[11px] text-gray-400">8 photos captured &middot; Store #12 — Elm St</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Front entrance', badge: 'GPS', badgeColor: 'bg-green-100 text-green-700', color: 'from-green-100 to-green-200' },
          { label: 'Aisle 3 display', badge: 'GPS', badgeColor: 'bg-green-100 text-green-700', color: 'from-blue-100 to-blue-200' },
          { label: 'End cap promo', badge: 'QR', badgeColor: 'bg-blue-100 text-blue-700', color: 'from-amber-100 to-amber-200' },
          { label: 'Checkout area', badge: 'GPS', badgeColor: 'bg-green-100 text-green-700', color: 'from-violet-100 to-violet-200' },
          { label: 'Stockroom entry', badge: 'GPS', badgeColor: 'bg-green-100 text-green-700', color: 'from-emerald-100 to-emerald-200' },
          { label: 'Restroom audit', badge: 'QR', badgeColor: 'bg-blue-100 text-blue-700', color: 'from-rose-100 to-rose-200' },
          { label: 'Safety equipment', badge: 'GPS', badgeColor: 'bg-green-100 text-green-700', color: 'from-sky-100 to-sky-200' },
          { label: 'Exterior signage', badge: 'GPS', badgeColor: 'bg-green-100 text-green-700', color: 'from-orange-100 to-orange-200' },
        ].map((photo) => (
          <div key={photo.label} className="relative group">
            <div className={`aspect-[4/3] rounded-lg bg-gradient-to-br ${photo.color} flex items-center justify-center`}>
              <svg className="w-8 h-8 text-gray-400/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            {/* Verification badge */}
            <div className={`absolute top-1.5 right-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-medium ${photo.badgeColor}`}>
              {photo.badge === 'GPS' ? (
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              ) : (
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
              )}
              {photo.badge}
            </div>
            {/* Caption */}
            <div className="mt-1">
              <span className="text-[10px] text-gray-600">{photo.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Verification summary */}
      <div className="mt-4 flex items-center gap-4 pt-3 border-t border-gray-200">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-[10px] text-gray-500">6 GPS Verified</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-[10px] text-gray-500">2 QR Verified</span>
        </div>
        <div className="ml-auto text-[10px] text-gray-400">
          All photos geotagged within 200m of store location
        </div>
      </div>
    </BrowserChrome>
  );
}

/* ─── Section 6: Action Items ─────────────────────────────────── */

function ActionItemsMockup() {
  return (
    <BrowserChrome url="app.storescore.app/follow-ups">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Action Items</h3>
          <p className="text-[11px] text-gray-400">12 open &middot; 3 overdue &middot; 45 resolved this month</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="text-[11px] bg-white border border-gray-200 rounded-lg px-2 py-1 text-gray-600">
            <option>All Stores</option>
          </select>
          <select className="text-[11px] bg-white border border-gray-200 rounded-lg px-2 py-1 text-gray-600">
            <option>All Priorities</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        {[
          {
            title: 'Replace burned-out exterior sign bulbs',
            store: 'Store #05 — Oak Ave',
            priority: 'CRITICAL',
            priColor: 'bg-red-100 text-red-700',
            due: 'Overdue (Feb 10)',
            dueColor: 'text-red-600',
            assignee: 'JR',
            status: 'In Progress',
            statusColor: 'bg-amber-100 text-amber-700',
          },
          {
            title: 'Reorganize end cap promotional displays',
            store: 'Store #12 — Elm St',
            priority: 'HIGH',
            priColor: 'bg-orange-100 text-orange-700',
            due: 'Due Feb 20',
            dueColor: 'text-gray-500',
            assignee: 'KT',
            status: 'Open',
            statusColor: 'bg-blue-100 text-blue-700',
          },
          {
            title: 'Restock safety kit in stockroom B',
            store: 'Store #18 — Pine Rd',
            priority: 'HIGH',
            priColor: 'bg-orange-100 text-orange-700',
            due: 'Due Feb 22',
            dueColor: 'text-gray-500',
            assignee: 'DM',
            status: 'Open',
            statusColor: 'bg-blue-100 text-blue-700',
          },
          {
            title: 'Update checkout area signage to Q1 promo',
            store: 'Store #03 — Main St',
            priority: 'MEDIUM',
            priColor: 'bg-amber-100 text-amber-700',
            due: 'Due Feb 28',
            dueColor: 'text-gray-500',
            assignee: 'LP',
            status: 'Open',
            statusColor: 'bg-blue-100 text-blue-700',
          },
          {
            title: 'Clean and re-seal break room flooring',
            store: 'Store #05 — Oak Ave',
            priority: 'MEDIUM',
            priColor: 'bg-amber-100 text-amber-700',
            due: 'Due Mar 1',
            dueColor: 'text-gray-500',
            assignee: 'JR',
            status: 'Open',
            statusColor: 'bg-blue-100 text-blue-700',
          },
        ].map((item) => (
          <div key={item.title} className="bg-white rounded-lg p-3 ring-1 ring-gray-900/5 flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-[9px] font-bold flex-shrink-0 mt-0.5">
              {item.assignee}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-semibold text-gray-900">{item.title}</span>
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold ${item.priColor}`}>
                  {item.priority}
                </span>
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium ${item.statusColor}`}>
                  {item.status}
                </span>
                <span className="text-[10px] text-gray-400">{item.store}</span>
              </div>
            </div>
            <span className={`text-[10px] font-medium ${item.dueColor} flex-shrink-0 whitespace-nowrap`}>
              {item.due}
            </span>
          </div>
        ))}
      </div>
    </BrowserChrome>
  );
}

/* ─── Section 7: Reports ──────────────────────────────────────── */

function ReportsMockup() {
  return (
    <BrowserChrome url="app.storescore.app/reports">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Reports & Analytics</h3>
          <p className="text-[11px] text-gray-400">Organization performance overview</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="text-[11px] bg-white border border-gray-200 rounded-lg px-2 py-1 text-gray-600">
            <option>Last 90 Days</option>
          </select>
          <select className="text-[11px] bg-white border border-gray-200 rounded-lg px-2 py-1 text-gray-600">
            <option>All Regions</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        {/* Trend chart */}
        <div className="bg-white rounded-lg p-3 ring-1 ring-gray-900/5">
          <div className="text-[11px] font-semibold text-gray-700 mb-3">Score Trend by Region</div>
          <div className="space-y-3">
            {/* Simplified line chart representation */}
            <svg viewBox="0 0 300 100" className="w-full h-20">
              {/* Grid lines */}
              <line x1="0" y1="25" x2="300" y2="25" stroke="#f3f4f6" strokeWidth="0.5" />
              <line x1="0" y1="50" x2="300" y2="50" stroke="#f3f4f6" strokeWidth="0.5" />
              <line x1="0" y1="75" x2="300" y2="75" stroke="#f3f4f6" strokeWidth="0.5" />
              {/* Southeast region */}
              <polyline
                fill="none"
                stroke="#D40029"
                strokeWidth="2"
                points="0,60 50,55 100,48 150,42 200,35 250,28 300,22"
              />
              {/* Midwest region */}
              <polyline
                fill="none"
                stroke="#7c3aed"
                strokeWidth="2"
                points="0,50 50,52 100,45 150,48 200,40 250,38 300,32"
              />
              {/* Northeast region */}
              <polyline
                fill="none"
                stroke="#0ea5e9"
                strokeWidth="2"
                points="0,70 50,65 100,62 150,55 200,50 250,45 300,40"
              />
            </svg>
            <div className="flex items-center gap-4 text-[9px]">
              <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-primary-600 rounded" /> Southeast</span>
              <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-violet-500 rounded" /> Midwest</span>
              <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-sky-500 rounded" /> Northeast</span>
            </div>
          </div>
        </div>

        {/* Store rankings */}
        <div className="bg-white rounded-lg p-3 ring-1 ring-gray-900/5">
          <div className="text-[11px] font-semibold text-gray-700 mb-3">Store Rankings</div>
          <div className="space-y-2">
            {[
              { rank: 1, name: 'Store #12 — Elm St', score: '94.2%', trend: '+3.1', color: 'text-green-600' },
              { rank: 2, name: 'Store #07 — Cedar Ln', score: '91.8%', trend: '+1.4', color: 'text-green-600' },
              { rank: 3, name: 'Store #21 — Birch Dr', score: '89.5%', trend: '+2.8', color: 'text-green-600' },
              { rank: 4, name: 'Store #15 — Maple Ct', score: '87.1%', trend: '-0.5', color: 'text-red-600' },
              { rank: 5, name: 'Store #03 — Main St', score: '84.3%', trend: '+0.8', color: 'text-green-600' },
            ].map((store) => (
              <div key={store.rank} className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-gray-300 w-4">{store.rank}</span>
                <span className="text-[10px] text-gray-700 flex-1 truncate">{store.name}</span>
                <span className="text-[10px] font-bold text-gray-900">{store.score}</span>
                <span className={`text-[9px] font-medium ${store.color}`}>{store.trend}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Section performance */}
      <div className="bg-white rounded-lg p-3 ring-1 ring-gray-900/5">
        <div className="text-[11px] font-semibold text-gray-700 mb-3">Section Performance (Org Average)</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { name: 'Store Appearance', score: 91, color: 'bg-green-500' },
            { name: 'Product Display', score: 84, color: 'bg-green-500' },
            { name: 'Customer Service', score: 88, color: 'bg-green-500' },
            { name: 'Safety & Compliance', score: 79, color: 'bg-amber-500' },
          ].map((section) => (
            <div key={section.name} className="text-center">
              <div className="text-[10px] text-gray-500 mb-1">{section.name}</div>
              <div className="relative w-12 h-12 mx-auto">
                <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="14" fill="none" stroke="#f3f4f6" strokeWidth="3" />
                  <circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill="none"
                    stroke={section.score >= 80 ? '#22c55e' : '#f59e0b'}
                    strokeWidth="3"
                    strokeDasharray={`${section.score * 0.88} 88`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-gray-900">
                  {section.score}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </BrowserChrome>
  );
}

/* ─── Section 8: Team & Scheduling ────────────────────────────── */

function TeamMockup() {
  return (
    <BrowserChrome url="app.storescore.app/team">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Team Management</h3>
          <p className="text-[11px] text-gray-400">14 members across 3 regions</p>
        </div>
        <div className="h-7 px-3 bg-primary-600 rounded-lg text-[11px] font-semibold text-white flex items-center">
          Invite Member
        </div>
      </div>

      {/* Team table */}
      <div className="bg-white rounded-lg ring-1 ring-gray-900/5 overflow-hidden mb-4">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left text-[10px] font-semibold text-gray-500 px-3 py-2">Name</th>
              <th className="text-left text-[10px] font-semibold text-gray-500 px-3 py-2 hidden sm:table-cell">Email</th>
              <th className="text-left text-[10px] font-semibold text-gray-500 px-3 py-2">Role</th>
              <th className="text-left text-[10px] font-semibold text-gray-500 px-3 py-2 hidden sm:table-cell">Region</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {[
              { name: 'David Chen', email: 'david@acme.com', role: 'Owner', roleColor: 'bg-primary-50 text-primary-700 ring-primary-600/20', region: 'All' },
              { name: 'Sarah Mitchell', email: 'sarah@acme.com', role: 'Admin', roleColor: 'bg-violet-50 text-violet-700 ring-violet-600/20', region: 'All' },
              { name: 'James Rodriguez', email: 'james@acme.com', role: 'Regional Mgr', roleColor: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', region: 'Southeast' },
              { name: 'Kim Thompson', email: 'kim@acme.com', role: 'Regional Mgr', roleColor: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', region: 'Midwest' },
              { name: 'Lisa Park', email: 'lisa@acme.com', role: 'Store Mgr', roleColor: 'bg-sky-50 text-sky-700 ring-sky-600/20', region: 'Southeast' },
              { name: 'Mike Davis', email: 'mike@acme.com', role: 'Evaluator', roleColor: 'bg-gray-50 text-gray-600 ring-gray-500/20', region: 'Midwest' },
            ].map((member) => (
              <tr key={member.name}>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                      {member.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <span className="text-[11px] font-medium text-gray-900">{member.name}</span>
                  </div>
                </td>
                <td className="px-3 py-2 hidden sm:table-cell">
                  <span className="text-[10px] text-gray-500">{member.email}</span>
                </td>
                <td className="px-3 py-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-medium ring-1 ${member.roleColor}`}>
                    {member.role}
                  </span>
                </td>
                <td className="px-3 py-2 hidden sm:table-cell">
                  <span className="text-[10px] text-gray-500">{member.region}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Scheduling card */}
      <div className="bg-white rounded-lg p-3 ring-1 ring-gray-900/5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[11px] font-semibold text-gray-700">Recurring Schedules</div>
          <div className="h-6 px-2 bg-gray-100 rounded text-[10px] font-medium text-gray-600 flex items-center">
            + New Schedule
          </div>
        </div>
        <div className="space-y-2">
          {[
            { name: 'Monthly Store Walk', freq: 'Monthly', scope: 'All Stores', next: 'Mar 1, 2026', evaluator: 'Rotating' },
            { name: 'Weekly Safety Check', freq: 'Weekly', scope: 'Southeast Region', next: 'Feb 24, 2026', evaluator: 'James R.' },
            { name: 'Quarterly Deep Audit', freq: 'Quarterly', scope: 'All Stores', next: 'Apr 1, 2026', evaluator: 'Sarah M.' },
          ].map((sched) => (
            <div key={sched.name} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-gray-50">
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-medium text-gray-900">{sched.name}</div>
                <div className="text-[9px] text-gray-400">{sched.freq} &middot; {sched.scope} &middot; {sched.evaluator}</div>
              </div>
              <span className="text-[9px] text-gray-400 flex-shrink-0">Next: {sched.next}</span>
            </div>
          ))}
        </div>
      </div>
    </BrowserChrome>
  );
}

/* ─── Inline CTA ──────────────────────────────────────────────── */

function InlineCTA({ text, buttonLabel, buttonHref }: { text: string; buttonLabel: string; buttonHref: string }) {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-5 rounded-xl bg-gradient-to-r from-primary-50 to-primary-100/50 border border-primary-200/50">
        <p className="text-sm font-medium text-gray-800">{text}</p>
        <Link
          to={buttonHref}
          className="flex-shrink-0 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
        >
          {buttonLabel}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

/* ─── Main Tour Page ──────────────────────────────────────────── */

export default function Tour() {
  const sectionIds = SECTIONS.map((s) => s.id);
  const activeSection = useActiveSection(sectionIds);
  useHashScroll();

  return (
    <div>
      <SEO
        title="Product Tour | StoreScore — See the Store Audit Platform in Action"
        description="Take an interactive tour of StoreScore. See how retail teams run store walks, automate action items, and get AI-powered quality insights across all locations."
        path="/tour"
      />
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-12 sm:pb-16">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-50 border border-primary-100 text-primary-700 text-sm font-medium mb-6">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Product Tour
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 tracking-tight leading-tight">
              See how StoreScore works,{' '}
              <span className="text-primary-600">step by step</span>
            </h1>
            <p className="mt-5 text-base sm:text-lg text-gray-600 leading-relaxed max-w-2xl mx-auto">
              Walk through every major feature — from setting up templates to tracking
              analytics. This is the same experience your team will use every day.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => {
                  const el = document.getElementById('dashboard');
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
              >
                Start the tour
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </button>
              <Link
                to={utm('/signup?source=product-tour', 'hero')}
                className="inline-flex items-center px-6 py-3 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Request a Demo
              </Link>
            </div>
          </div>
        </div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary-100/30 rounded-full blur-3xl pointer-events-none" />
      </section>

      {/* Section nav */}
      <SectionNav active={activeSection} />

      {/* Tour sections */}
      <div className="lg:pl-56">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-24 sm:space-y-32">
          {/* 1. Dashboard */}
          <TourSection
            id="dashboard"
            number="01"
            title="Dashboard at a Glance"
            description="Log in and immediately see your organization's health — KPI cards, score trends, recent walks, and action item counts. Everything you need in one view."
          >
            <DashboardMockup />
          </TourSection>

          {/* 2. Templates */}
          <TourSection
            id="templates"
            number="02"
            title="Build Your Scoring Template"
            description="Create custom templates with weighted sections and criteria. Define exactly what your evaluators measure — from store appearance to safety compliance."
          >
            <TemplateMockup />
          </TourSection>

          {/* 3. Conduct Walk */}
          <TourSection
            id="conduct"
            number="03"
            title="Conduct a Store Walk"
            description="Evaluators walk your stores with a mobile-friendly interface. Tap to score on a 1-5 scale, capture photos with GPS verification, and reference SOPs in real time."
          >
            <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
              <div className="flex-shrink-0">
                <ConductWalkMockup />
              </div>
              <div className="flex-1 space-y-4 max-w-md">
                {[
                  { icon: '1-5', title: 'Tap-to-Score', desc: 'Color-coded 1-5 buttons designed for speed. Score an entire store walk in under 15 minutes.' },
                  { icon: 'GPS', title: 'GPS & QR Verification', desc: 'Every photo is geotagged. Optional QR scan confirms the evaluator is physically at the location.' },
                  { icon: 'SOP', title: 'SOP Reference', desc: 'Evaluators can tap to view the relevant SOP for any criterion — no switching apps or guessing.' },
                  { icon: 'AI', title: 'Scoring Drivers', desc: 'When a score is low, the evaluator selects root-cause drivers that feed AI analysis downstream.' },
                ].map((f) => (
                  <div key={f.title} className="flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                      {f.icon}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{f.title}</div>
                      <div className="text-xs text-gray-500 leading-relaxed">{f.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TourSection>

          {/* Inline CTA 1 — after conduct walk */}
          <InlineCTA
            text="Like what you see so far?"
            buttonLabel="Try it free"
            buttonHref={utm('/signup?source=product-tour', 'inline-after-conduct')}
          />

          {/* 4. AI Summary */}
          <TourSection
            id="ai-summary"
            number="04"
            title="AI-Powered Summary"
            description="The moment a walk is completed, AI generates an executive summary — highlighting strengths, flagging issues, and spotting trends across locations."
          >
            <AISummaryMockup />
          </TourSection>

          {/* 5. Photos */}
          <TourSection
            id="photos"
            number="05"
            title="Photo Documentation"
            description="Every photo is tagged with GPS coordinates or QR verification. No more wondering if a photo was taken at the right store — the proof is built in."
          >
            <PhotosMockup />
          </TourSection>

          {/* Inline CTA 2 — after photos */}
          <InlineCTA
            text="Ready to ditch the spreadsheets?"
            buttonLabel="Start free — no credit card"
            buttonHref={utm('/signup?source=product-tour', 'inline-after-photos')}
          />

          {/* 6. Action Items */}
          <TourSection
            id="action-items"
            number="06"
            title="Action Items & Follow-ups"
            description="Low scores automatically generate tracked action items with priority levels, due dates, and assigned owners. Nothing falls through the cracks."
          >
            <ActionItemsMockup />
          </TourSection>

          {/* 7. Reports */}
          <TourSection
            id="reports"
            number="07"
            title="Reports & Analytics"
            description="Drill into performance by region, store, section, or time period. Trend lines, rankings, and section breakdowns make it easy to spot what's working and what needs attention."
          >
            <ReportsMockup />
          </TourSection>

          {/* Inline CTA 3 — after reports */}
          <InlineCTA
            text="See how your stores stack up"
            buttonLabel="Get started free"
            buttonHref={utm('/signup?source=product-tour', 'inline-after-reports')}
          />

          {/* 8. Team & Scheduling */}
          <TourSection
            id="team"
            number="08"
            title="Team & Scheduling"
            description="Manage your team with role-based access, invite new members, and set up recurring evaluation schedules that auto-create walks on cadence."
          >
            <TeamMockup />
          </TourSection>
        </div>
      </div>

      {/* Final CTA */}
      <section className="py-20 sm:py-24 bg-primary-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to see it in action?
          </h2>
          <p className="text-lg text-primary-100 mb-10 max-w-2xl mx-auto">
            Start your free account today — no credit card required. Or request a
            personalized walkthrough with our team.
          </p>

          <EmailCaptureForm />

          <div className="mt-8 flex items-center justify-center gap-6 text-sm text-primary-200">
            <Link to={utm('/features', 'footer')} className="hover:text-white transition-colors underline underline-offset-2">
              See all features
            </Link>
            <Link to={utm('/pricing', 'footer')} className="hover:text-white transition-colors underline underline-offset-2">
              View pricing
            </Link>
            <Link to={utm('/signup?source=product-tour', 'footer')} className="hover:text-white transition-colors underline underline-offset-2">
              Request a demo
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
