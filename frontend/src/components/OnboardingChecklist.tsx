import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getQuickStartProgress } from '../api/onboarding';
import type { QuickStartProgress } from '../api/onboarding';
import { getOrgId } from '../utils/org';
import { useAuth } from '../hooks/useAuth';

const DISMISS_KEY = 'onboarding_checklist_dismissed';
const COLLAPSE_KEY = 'onboarding_checklist_collapsed';

interface ChecklistItem {
  key: string;
  label: string;
  hint: string;
  link: string;
  done: (qs: QuickStartProgress) => boolean;
}

const ITEMS: ChecklistItem[] = [
  { key: 'stores', label: 'Add a store', hint: 'Add your first store location', link: '/stores', done: (qs) => qs.stores > 0 },
  { key: 'departments', label: 'Add departments', hint: 'Create departments like Produce, Deli, Cashiers', link: '/departments', done: (qs) => qs.departments > 0 },
  { key: 'dept_applied', label: 'Apply departments to stores', hint: 'Assign departments to your store(s)', link: '/departments', done: (qs) => qs.departments_applied > 0 },
  { key: 'team', label: 'Invite a team member', hint: 'Add a manager or evaluator to your org', link: '/team', done: (qs) => qs.team_members >= 2 },
  { key: 'templates', label: 'Set up a scoring template', hint: 'Create or install an evaluation template', link: '/templates', done: (qs) => qs.templates > 0 },
  { key: 'goals', label: 'Set a score goal', hint: 'Set a target score in Settings > Goals', link: '/settings', done: (qs) => qs.org_configured },
  { key: 'walks', label: 'Complete your first store walk', hint: 'Conduct an evaluation at a store', link: '/evaluations', done: (qs) => qs.walks > 0 },
];

export default function OnboardingChecklist() {
  const orgId = getOrgId();
  const { currentMembership } = useAuth();
  const [qs, setQs] = useState<QuickStartProgress | null>(null);
  const dismissKey = `${DISMISS_KEY}_${orgId}`;
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === 'true');
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(dismissKey) === 'true');
  const [loading, setLoading] = useState(true);

  // Only show for admin and owner roles
  const isAdminOrOwner = currentMembership?.role === 'admin' || currentMembership?.role === 'owner';


  const load = useCallback(async () => {
    if (!orgId) return;
    try {
      const data = await getQuickStartProgress(orgId);
      setQs(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  // Load on mount and when returning to window (auto-refresh progress)
  useEffect(() => {
    load();
    const handleFocus = () => load();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [load]);

  // Also poll every 30s to catch changes while user stays on the page
  useEffect(() => {
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  // If dismissed but not all items are done, un-dismiss (shouldn't stay hidden while incomplete)
  const computedCompleted = qs ? ITEMS.filter((item) => item.done(qs)).length : 0;
  const computedAllDone = qs ? computedCompleted === ITEMS.length : false;
  useEffect(() => {
    if (dismissed && qs && !computedAllDone) {
      localStorage.removeItem(dismissKey);
      setDismissed(false);
    }
  }, [dismissed, qs, computedAllDone, dismissKey]);

  // Auto-dismiss when 100% complete
  useEffect(() => {
    if (computedAllDone && !dismissed) {
      localStorage.setItem(dismissKey, 'true');
      setDismissed(true);
    }
  }, [computedAllDone, dismissed, dismissKey]);

  if (!isAdminOrOwner || dismissed || loading || !qs || !orgId) return null;

  const completed = computedCompleted;
  const total = ITEMS.length;
  const allDone = computedAllDone;

  const pct = Math.round((completed / total) * 100);

  const handleDismiss = () => {
    localStorage.setItem(dismissKey, 'true');
    setDismissed(true);
  };

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(COLLAPSE_KEY, String(next));
  };

  // Collapsed state — just show a small pill
  if (collapsed) {
    return (
      <button
        onClick={toggleCollapse}
        className="fixed bottom-4 right-4 sm:right-6 z-40 flex items-center gap-2 px-3 py-2 bg-white rounded-full shadow-lg ring-1 ring-gray-900/10 hover:shadow-xl transition-all group"
      >
        <div className="relative w-6 h-6">
          <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
            <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M8 12l2.5 2.5L16 9" className={allDone ? '' : 'hidden'} />
          </svg>
          {!allDone && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary-600 text-[10px] font-bold text-white">
              {total - completed}
            </span>
          )}
        </div>
        <span className="text-xs font-medium text-gray-700 group-hover:text-gray-900">
          Setup {pct}%
        </span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 sm:right-6 z-40 w-[320px] sm:w-[340px] bg-white rounded-2xl shadow-2xl ring-1 ring-gray-900/10 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-primary-600">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <span className="text-sm font-semibold text-white">Setup Checklist</span>
          <span className="ml-1 text-xs text-white/70">{completed}/{total}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleCollapse}
            className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            title="Minimize"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {allDone && (
            <button
              onClick={handleDismiss}
              className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              title="Dismiss"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-gray-500">
            {allDone ? 'All set! You\'re ready to go.' : 'Complete these steps to get started'}
          </span>
          <span className="text-xs font-semibold text-primary-600">{pct}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div
            className="bg-primary-600 h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Checklist items */}
      <div className="px-2 pb-3 max-h-[320px] overflow-y-auto">
        {ITEMS.map((item) => {
          const done = item.done(qs);
          return (
            <Link
              key={item.key}
              to={item.link}
              className={`flex items-center gap-3 px-2 py-2 rounded-lg transition-colors group ${
                done ? 'opacity-60' : 'hover:bg-gray-50'
              }`}
            >
              {done ? (
                <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0 group-hover:border-primary-400 transition-colors" />
              )}
              <div className="min-w-0 flex-1">
                <span className={`text-sm block ${done ? 'text-gray-400 line-through' : 'text-gray-700 group-hover:text-primary-600'}`}>
                  {item.label}
                </span>
                {!done && (
                  <span className="text-[11px] text-gray-400 block mt-0.5">{item.hint}</span>
                )}
              </div>
              {!done && (
                <svg className="w-4 h-4 text-gray-300 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </Link>
          );
        })}
      </div>

      {/* Footer link to full Getting Started */}
      <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/50">
        <Link
          to="/getting-started"
          className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
        >
          View full walkthrough
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
