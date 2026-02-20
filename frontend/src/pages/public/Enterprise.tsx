import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import SEO from '../../components/SEO';

const CDN = 'https://images-media.nyc3.cdn.digitaloceanspaces.com/storescore-files';

const painPoints = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
    title: 'No visibility across locations',
    description: 'Your best stores run differently than your worst — but you can\'t see what\'s different without being there.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    title: 'Paper checklists don\'t scale',
    description: 'Walk results sit in spreadsheets or binders. No trending, no accountability, no data-driven decisions.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: 'Regional managers stretched thin',
    description: 'With 10+ stores to cover, RMs can\'t evaluate every location every week. Issues slip through the cracks.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    title: 'Can\'t connect quality to sales',
    description: 'You know clean, well-stocked stores sell more — but you can\'t prove it or measure the ROI of your quality program.',
  },
];

const capabilities = [
  {
    title: 'AI Photo Analysis',
    description: 'Regional managers snap a photo of any department. AI scores it instantly, identifies issues, and generates prioritized action items — no template setup required.',
    image: `${CDN}/AI%20Analysis.png`,
    imageAlt: 'AI analysis of store department with findings and action items',
  },
  {
    title: 'GPS-Verified Evaluations',
    description: 'Structured store walks with weighted scoring. GPS and QR code verification prove evaluators are physically on-site. Results sync in real time.',
    image: `${CDN}/Screenshot%202026-02-19%20at%209.53.04%E2%80%AFPM.png`,
    imageAlt: 'StoreScore analytics dashboard with scores, trends, and regional breakdown',
  },
  {
    title: 'Benchmarking & Rankings',
    description: 'Compare every store against the org average. Leaderboards, streaks, and challenges drive friendly competition. Regional managers see exactly where to focus.',
    image: `${CDN}/Screenshot%202026-02-19%20at%209.51.56%E2%80%AFPM.png`,
    imageAlt: 'Store rankings and leaderboard showing performance across locations',
  },
];

const stats = [
  { value: '85%', label: 'Average quality score improvement in first 90 days' },
  { value: '3x', label: 'Faster evaluation completion vs. paper-based audits' },
  { value: '< 5 min', label: 'Quick Assessment — snap, analyze, assign action items' },
  { value: '100%', label: 'Action item visibility and accountability' },
];

const integrations = [
  'Epicor Eagle', 'Mango Report', 'Toast', 'Square',
  'Deputy', '7shifts', 'HotSchedules', 'Lightspeed',
];

interface EnterpriseFormData {
  first_name: string;
  last_name: string;
  email: string;
  company_name: string;
  phone: string;
  store_count: string;
  industry: string;
  message: string;
}

const initialForm: EnterpriseFormData = {
  first_name: '',
  last_name: '',
  email: '',
  company_name: '',
  phone: '',
  store_count: '',
  industry: '',
  message: '',
};

const storeCountOptions = [
  { value: '', label: 'How many locations?' },
  { value: '5-10', label: '5 - 10 locations' },
  { value: '11-25', label: '11 - 25 locations' },
  { value: '26-50', label: '26 - 50 locations' },
  { value: '51-100', label: '51 - 100 locations' },
  { value: '100+', label: '100+ locations' },
];

const industryOptions = [
  { value: '', label: 'Select your industry' },
  { value: 'hardware', label: 'Hardware & Home Improvement' },
  { value: 'grocery', label: 'Grocery & Convenience' },
  { value: 'franchise', label: 'Franchise Operations' },
  { value: 'specialty', label: 'Specialty Retail' },
  { value: 'restaurant', label: 'Restaurant / QSR' },
  { value: 'other', label: 'Other' },
];

function EnterpriseForm() {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState<Partial<Record<keyof EnterpriseFormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState('');

  const validate = () => {
    const e: Partial<Record<keyof EnterpriseFormData, string>> = {};
    if (!form.first_name.trim()) e.first_name = 'Required';
    if (!form.last_name.trim()) e.last_name = 'Required';
    if (!form.email.trim()) e.email = 'Required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleChange = (ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = ev.target;
    setForm((p) => ({ ...p, [name]: value }));
    if (errors[name as keyof EnterpriseFormData]) setErrors((p) => ({ ...p, [name]: undefined }));
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setServerError('');
    try {
      const payload: Record<string, unknown> = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim().toLowerCase(),
        source: 'enterprise_page',
      };
      if (form.company_name.trim()) payload.company_name = form.company_name.trim();
      if (form.phone.trim()) payload.phone = form.phone.trim();
      if (form.store_count) {
        const mapping: Record<string, number> = { '5-10': 10, '11-25': 25, '26-50': 50, '51-100': 100, '100+': 500 };
        payload.store_count = mapping[form.store_count] || null;
      }
      const parts = [];
      if (form.industry) parts.push(`Industry: ${industryOptions.find(o => o.value === form.industry)?.label || form.industry}`);
      if (form.message.trim()) parts.push(form.message.trim());
      if (parts.length) payload.message = parts.join('\n');

      await api.post('/auth/leads/', payload);
      setSubmitted(true);
    } catch {
      setServerError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center py-8">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">We'll be in touch</h3>
        <p className="text-sm text-gray-600">
          Check your email for demo access. Our team will reach out within one business day to schedule a personalized platform walkthrough.
        </p>
      </div>
    );
  }

  const inputCls = (field: keyof EnterpriseFormData) =>
    `w-full px-3.5 py-2.5 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${errors[field] ? 'border-red-300 bg-red-50' : 'border-gray-300'}`;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {serverError && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm text-red-700">{serverError}</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">First name *</label>
          <input name="first_name" value={form.first_name} onChange={handleChange} className={inputCls('first_name')} placeholder="Jane" />
          {errors.first_name && <p className="mt-1 text-xs text-red-600">{errors.first_name}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Last name *</label>
          <input name="last_name" value={form.last_name} onChange={handleChange} className={inputCls('last_name')} placeholder="Smith" />
          {errors.last_name && <p className="mt-1 text-xs text-red-600">{errors.last_name}</p>}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Work email *</label>
        <input name="email" type="email" value={form.email} onChange={handleChange} className={inputCls('email')} placeholder="jane@company.com" />
        {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
        <input name="company_name" value={form.company_name} onChange={handleChange} className={inputCls('company_name')} placeholder="Northwest Ace Hardware" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Locations</label>
          <select name="store_count" value={form.store_count} onChange={handleChange} className={`${inputCls('store_count')} bg-white`}>
            {storeCountOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
          <select name="industry" value={form.industry} onChange={handleChange} className={`${inputCls('industry')} bg-white`}>
            {industryOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">What are you looking to solve?</label>
        <textarea name="message" value={form.message} onChange={handleChange} rows={3} className={`${inputCls('message')} resize-none`} placeholder="e.g. We need visibility into store conditions across 15 locations..." />
      </div>
      <button type="submit" disabled={submitting} className="w-full py-3 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-60">
        {submitting ? 'Submitting...' : 'Book a Platform Walkthrough'}
      </button>
      <p className="text-xs text-gray-400 text-center">30-day free trial included. No credit card required.</p>
    </form>
  );
}

export default function Enterprise() {
  return (
    <div>
      <SEO
        title="Enterprise Store Quality Management | StoreScore — For 10+ Location Operators"
        description="StoreScore Enterprise: AI-powered store evaluations, benchmarking, and analytics for multi-location retailers and franchise groups. GPS-verified walks, photo analysis, and real-time action items across all your stores."
        path="/enterprise"
      />

      {/* ─── Hero ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-gray-900 to-gray-800">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(212,0,41,0.15),transparent_50%)]" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-600/20 border border-primary-500/30 mb-6">
                <span className="w-2 h-2 rounded-full bg-primary-400 animate-pulse" />
                <span className="text-xs font-medium text-primary-300">For operators with 10+ locations</span>
              </div>

              <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight leading-tight">
                Regional visibility<br />
                <span className="text-primary-400">at every location</span>
              </h1>
              <p className="mt-6 text-lg text-gray-300 leading-relaxed max-w-xl">
                StoreScore gives operations leaders a real-time view of store quality across every location.
                AI-powered photo analysis, GPS-verified evaluations, and automated action items — so regional
                managers can focus on the stores that need them most.
              </p>

              <div className="mt-8 flex flex-wrap gap-4">
                {stats.map(s => (
                  <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 min-w-[140px]">
                    <div className="text-2xl font-bold text-white">{s.value}</div>
                    <div className="text-xs text-gray-400 mt-0.5 leading-snug">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Form */}
            <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Schedule a walkthrough</h2>
              <p className="text-sm text-gray-500 mb-6">See how StoreScore works for your operation.</p>
              <EnterpriseForm />
            </div>
          </div>
        </div>
      </section>

      {/* ─── Pain Points ──────────────────────────────────── */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              The challenges of managing multiple locations
            </h2>
            <p className="mt-3 text-lg text-gray-600 max-w-2xl mx-auto">
              As you grow from 5 to 50+ stores, the gap between your best and worst locations widens.
              StoreScore closes that gap.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {painPoints.map(p => (
              <div key={p.title} className="flex gap-4 p-6 rounded-xl border border-gray-200 hover:border-primary-200 hover:shadow-md transition-all">
                <div className="w-11 h-11 rounded-lg bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0">
                  {p.icon}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">{p.title}</h3>
                  <p className="text-sm text-gray-600 mt-1 leading-relaxed">{p.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Solution Showcase ────────────────────────────── */}
      <section className="py-16 sm:py-24 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              How StoreScore works at scale
            </h2>
          </div>

          <div className="space-y-16 sm:space-y-24">
            {capabilities.map((cap, i) => (
              <div key={cap.title} className={`grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center ${i % 2 === 1 ? 'lg:[direction:rtl]' : ''}`}>
                <div className={i % 2 === 1 ? 'lg:[direction:ltr]' : ''}>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-50 text-primary-600 text-xs font-semibold mb-4">
                    Step {i + 1}
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">{cap.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{cap.description}</p>
                </div>
                <div className={i % 2 === 1 ? 'lg:[direction:ltr]' : ''}>
                  <img
                    src={cap.image}
                    alt={cap.imageAlt}
                    loading="lazy"
                    className="rounded-2xl shadow-lg ring-1 ring-gray-900/10 w-full"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── ROI Section ──────────────────────────────────── */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
                The ROI of consistent quality
              </h2>
              <p className="mt-4 text-lg text-gray-600 leading-relaxed">
                Clean, well-stocked, well-staffed stores convert more foot traffic into sales.
                StoreScore proves it with data — connecting store quality scores to real business outcomes.
              </p>

              <div className="mt-8 space-y-4">
                {[
                  { title: 'Quality \u2194 Sales', desc: 'Do higher-scoring stores generate more revenue? Track the correlation.' },
                  { title: 'Staffing \u2194 Quality', desc: 'What\'s the minimum staff hours needed to maintain target quality scores?' },
                  { title: 'Quality Per Staff Hour', desc: 'The ultimate efficiency metric: quality score per staff hour per dollar of revenue.' },
                ].map(item => (
                  <div key={item.title} className="flex gap-3 items-start">
                    <svg className="w-5 h-5 text-primary-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <span className="font-semibold text-gray-900">{item.title}</span>
                      <span className="text-gray-600"> — {item.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 text-white">
              <h3 className="text-xl font-bold mb-6">Enterprise plan includes</h3>
              <ul className="space-y-3">
                {[
                  'Unlimited stores and evaluations',
                  'AI photo analysis and scoring',
                  'Quick Assessments (snap-and-analyze)',
                  'GPS and QR code verification',
                  'Advanced reporting and analytics',
                  'Benchmarking and leaderboards',
                  'Action items with review workflow',
                  'Team management and role-based access',
                  'Data integrations (CSV, API, POS)',
                  'Priority support and onboarding',
                ].map(feature => (
                  <li key={feature} className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-gray-200">{feature}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8 pt-6 border-t border-white/10">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">$79</span>
                  <span className="text-gray-400">/ store / month</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">Volume discounts available for 10+ stores. Annual billing saves 16%.</p>
                <Link
                  to="/pricing"
                  className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary-400 hover:text-primary-300 transition-colors"
                >
                  View all plans
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Integrations ─────────────────────────────────── */}
      <section className="py-16 sm:py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
            Works with your existing tools
          </h2>
          <p className="text-lg text-gray-600 mb-10 max-w-2xl mx-auto">
            StoreScore provides the qualitative "why" behind your quantitative data.
            Import sales, staffing, and operations data to complete the picture.
          </p>

          <div className="flex flex-wrap justify-center gap-3">
            {integrations.map(name => (
              <div key={name} className="px-5 py-2.5 rounded-full bg-white border border-gray-200 text-sm font-medium text-gray-700 shadow-sm">
                {name}
              </div>
            ))}
            <div className="px-5 py-2.5 rounded-full bg-primary-50 border border-primary-200 text-sm font-medium text-primary-700">
              + CSV Import
            </div>
            <div className="px-5 py-2.5 rounded-full bg-primary-50 border border-primary-200 text-sm font-medium text-primary-700">
              + Manual Entry
            </div>
          </div>
        </div>
      </section>

      {/* ─── Comparison to alternatives ───────────────────── */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Why operators choose StoreScore
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-4 pr-4 font-medium text-gray-500 w-1/3"></th>
                  <th className="text-center py-4 px-4 font-semibold text-primary-600">StoreScore</th>
                  <th className="text-center py-4 px-4 font-medium text-gray-500">Paper / Spreadsheets</th>
                  <th className="text-center py-4 px-4 font-medium text-gray-500">Generic Audit Tools</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  { feature: 'AI photo analysis', ss: true, paper: false, generic: false },
                  { feature: 'GPS-verified evaluations', ss: true, paper: false, generic: 'partial' },
                  { feature: 'Auto-generated action items', ss: true, paper: false, generic: false },
                  { feature: 'Real-time analytics & trends', ss: true, paper: false, generic: 'partial' },
                  { feature: 'Store leaderboards & gamification', ss: true, paper: false, generic: false },
                  { feature: 'Quality-to-sales correlation', ss: true, paper: false, generic: false },
                  { feature: 'Review sign-off workflow', ss: true, paper: false, generic: 'partial' },
                  { feature: 'Setup time', ss: '< 1 hour', paper: 'N/A', generic: '1-2 weeks' },
                  { feature: 'Per-store cost', ss: '$79/mo', paper: '$0 + time', generic: '$150-300/mo' },
                ].map(row => (
                  <tr key={row.feature}>
                    <td className="py-3 pr-4 font-medium text-gray-900">{row.feature}</td>
                    <td className="py-3 px-4 text-center">
                      {row.ss === true ? (
                        <svg className="w-5 h-5 text-green-600 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                      ) : <span className="text-sm font-medium text-primary-600">{row.ss}</span>}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {row.paper === false ? (
                        <svg className="w-5 h-5 text-gray-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      ) : <span className="text-sm text-gray-500">{row.paper}</span>}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {row.generic === false ? (
                        <svg className="w-5 h-5 text-gray-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      ) : row.generic === 'partial' ? (
                        <svg className="w-5 h-5 text-yellow-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                      ) : <span className="text-sm text-gray-500">{row.generic}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 text-center">
            <Link to="/compare" className="text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors">
              See detailed competitor comparisons &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* ─── CTA ──────────────────────────────────────────── */}
      <section className="py-16 sm:py-20 bg-primary-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to see every store clearly?
          </h2>
          <p className="text-lg text-primary-100 mb-8 max-w-xl mx-auto">
            Join multi-location operators using StoreScore to drive consistent quality and accountability across every store.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#top"
              onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="inline-flex items-center px-8 py-3 text-sm font-semibold text-primary-600 bg-white rounded-lg hover:bg-primary-50 transition-colors shadow-lg"
            >
              Book a Walkthrough
            </a>
            <Link
              to="/tour"
              className="inline-flex items-center px-8 py-3 text-sm font-semibold text-white border-2 border-white/30 rounded-lg hover:bg-white/10 transition-colors"
            >
              Take the Product Tour
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
