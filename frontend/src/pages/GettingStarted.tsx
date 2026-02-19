import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getOnboardingLessons, completeLesson, uncompleteLesson, getQuickStartProgress } from '../api/onboarding';
import type { QuickStartProgress } from '../api/onboarding';
import { getStores } from '../api/walks';
import { getOrgId } from '../utils/org';
import TierBadge from '../components/TierBadge';
import type { OnboardingLesson } from '../types';

const TIER_RANK: Record<string, number> = { starter: 0, pro: 1, enterprise: 2 };

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export default function GettingStarted() {
  const { currentMembership } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const orgId = getOrgId();
  const [lessons, setLessons] = useState<OnboardingLesson[]>([]);
  const [hasStores, setHasStores] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [mobileListExpanded, setMobileListExpanded] = useState(true);
  const [quickStart, setQuickStart] = useState<QuickStartProgress | null>(null);

  const getLessonSlug = useCallback((lesson: OnboardingLesson) => {
    return lesson.section_content?.anchor || slugify(lesson.title);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [data, stores, qs] = await Promise.all([
          getOnboardingLessons(),
          orgId ? getStores(orgId).catch(() => []) : Promise.resolve([]),
          orgId ? getQuickStartProgress(orgId).catch(() => null) : Promise.resolve(null),
        ]);
        if (!cancelled) {
          setHasStores(stores.length > 0);
          setLessons(data);
          if (qs) setQuickStart(qs);
          if (data.length > 0) {
            const hash = location.hash.replace('#', '');
            // Try to restore from URL hash
            const fromHash = hash
              ? data.find((l) => (l.section_content?.anchor || slugify(l.title)) === hash)
              : null;
            const first = fromHash || data.find((l) => !l.is_completed) || data[0];
            setActiveId(first.id);
            if (fromHash) setMobileListExpanded(false);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [orgId]);

  // Determine user tier from membership (default starter)
  const userTier = currentMembership
    ? (localStorage.getItem('orgTier') || 'starter')
    : 'starter';
  const userTierRank = TIER_RANK[userTier] ?? 0;

  // Filter lessons by role
  const visibleLessons = useMemo(() => {
    return lessons.filter((lesson) => {
      if (lesson.roles) {
        const allowed = lesson.roles.split(',');
        if (!currentMembership || !allowed.includes(currentMembership.role)) {
          return false;
        }
      }
      return true;
    });
  }, [lessons, currentMembership]);

  function getLessonTitle(lesson: OnboardingLesson): string {
    if (lesson.title === 'Add Your First Store' && hasStores) return 'Add a Store';
    return lesson.title;
  }

  const activeLesson = visibleLessons.find((l) => l.id === activeId) || null;
  const activeIndex = activeLesson ? visibleLessons.indexOf(activeLesson) : -1;

  // Only count lessons the user's tier can access toward progress
  const accessibleLessons = visibleLessons.filter((l) => (TIER_RANK[l.feature_tier] ?? 0) <= userTierRank);
  const completedCount = accessibleLessons.filter((l) => l.is_completed).length;
  const totalCount = accessibleLessons.length;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const handleToggleComplete = useCallback(async () => {
    if (!activeLesson || toggling) return;
    setToggling(true);
    try {
      if (activeLesson.is_completed) {
        await uncompleteLesson(activeLesson.id);
      } else {
        await completeLesson(activeLesson.id);
      }
      setLessons((prev) =>
        prev.map((l) =>
          l.id === activeLesson.id
            ? { ...l, is_completed: !l.is_completed, completed_at: l.is_completed ? null : new Date().toISOString() }
            : l
        )
      );
    } finally {
      setToggling(false);
    }
  }, [activeLesson, toggling]);

  const selectLesson = (id: string) => {
    setActiveId(id);
    setMobileListExpanded(false);
    const lesson = visibleLessons.find((l) => l.id === id);
    if (lesson) {
      window.history.replaceState(null, '', `#${getLessonSlug(lesson)}`);
    }
  };

  const goTo = (dir: -1 | 1) => {
    const next = activeIndex + dir;
    if (next >= 0 && next < visibleLessons.length) {
      const lesson = visibleLessons[next];
      setActiveId(lesson.id);
      window.history.replaceState(null, '', `#${getLessonSlug(lesson)}`);
    }
  };

  // Resolve display content — prefer section content, fallback to lesson content
  const displayContent = activeLesson?.section_content?.content || activeLesson?.content || '';
  const isLocked = activeLesson ? (TIER_RANK[activeLesson.feature_tier] ?? 0) > userTierRank : false;

  if (loading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-4 bg-gray-200 rounded w-96" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            <div className="h-96 bg-gray-200 rounded" />
            <div className="lg:col-span-2 h-96 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 pb-24">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Getting Started</h1>
        <p className="mt-1 text-sm text-gray-500">
          A guided walkthrough of the features relevant to your role.
        </p>
      </div>

      {/* Progress bar */}
      <div className="mb-6 bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            {completedCount} of {totalCount} complete
          </span>
          <span className="text-sm font-semibold text-primary-600">{pct}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className="bg-primary-600 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Quick Start — Horizontal Steps */}
      {quickStart && (() => {
        const steps = [
          { key: 'stores', label: 'Add a store', num: '1', link: '/stores', done: quickStart.stores > 0 },
          { key: 'departments', label: 'Add departments', num: '2', link: '/departments', done: quickStart.departments > 0 },
          { key: 'dept_applied', label: 'Apply to stores', num: '3', link: '/departments', done: quickStart.departments_applied > 0 },
          { key: 'team_members', label: 'Invite team', num: '4', link: '/team', done: quickStart.team_members >= 2 },
          { key: 'templates', label: 'Scoring template', num: '5', link: '/templates', done: quickStart.templates > 0 },
          { key: 'goals', label: 'Set a goal', num: '6', link: '/settings', done: quickStart.org_configured },
          { key: 'walks', label: 'First walk', num: '7', link: '/evaluations', done: quickStart.walks > 0 },
          { key: 'ai_summaries', label: 'AI summary', num: '8', link: '/evaluations', done: quickStart.ai_summaries > 0 },
        ];
        const firstIncompleteIdx = steps.findIndex(s => !s.done);
        return (
          <div className="mb-6 bg-white rounded-lg border border-gray-200 px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Quick Start</h3>
              <span className="text-xs text-gray-400">{steps.filter(s => s.done).length}/{steps.length} complete</span>
            </div>
            <div
              className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1"
              ref={el => {
                if (el && firstIncompleteIdx > 0) {
                  const target = el.children[firstIncompleteIdx] as HTMLElement;
                  if (target) {
                    el.scrollTo({ left: target.offsetLeft - 16, behavior: 'smooth' });
                  }
                }
              }}
            >
              {steps.map((step, idx) => {
                const isCurrent = idx === firstIncompleteIdx;
                return (
                  <Link
                    key={step.key}
                    to={step.link}
                    onClick={() => sessionStorage.setItem('from_getting_started', '1')}
                    className={`flex-shrink-0 flex items-center gap-2.5 pl-2.5 pr-3.5 py-2 rounded-lg border transition-all ${
                      step.done
                        ? 'bg-green-50 border-green-200 opacity-70'
                        : isCurrent
                          ? 'bg-primary-50 border-primary-300 ring-2 ring-primary-200 shadow-sm'
                          : 'bg-gray-50 border-gray-200 hover:border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    {step.done ? (
                      <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[11px] font-bold flex-shrink-0 ${
                        isCurrent ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-500'
                      }`}>
                        {step.num}
                      </span>
                    )}
                    <span className={`text-xs font-medium whitespace-nowrap ${
                      step.done ? 'text-green-700 line-through' : isCurrent ? 'text-primary-700' : 'text-gray-600'
                    }`}>
                      {step.label}
                    </span>
                    {isCurrent && (
                      <svg className="w-3 h-3 text-primary-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })()}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left panel — lesson list (collapsible on mobile) */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {/* Mobile compact header — shows current step, tap to expand */}
          {activeLesson && (
            <button
              onClick={() => setMobileListExpanded((v) => !v)}
              className="lg:hidden w-full flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-primary-600 text-white text-xs font-bold">
                  {activeIndex + 1}
                </span>
                <span className="text-sm font-medium text-gray-900 truncate">{getLessonTitle(activeLesson)}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                <span className="text-xs text-gray-400">{activeIndex + 1}/{totalCount}</span>
                <svg className={`w-4 h-4 text-gray-400 transition-transform ${mobileListExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>
          )}

          {/* Lesson list — always visible on desktop, collapsible on mobile */}
          <div className={`${mobileListExpanded ? '' : 'hidden'} lg:block max-h-[calc(100vh-280px)] overflow-y-auto divide-y divide-gray-100`}>
            {visibleLessons.map((lesson) => {
              const tierLocked = (TIER_RANK[lesson.feature_tier] ?? 0) > userTierRank;
              const isActive = lesson.id === activeId;
              return (
                <button
                  key={lesson.id}
                  onClick={() => selectLesson(lesson.id)}
                  className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors ${
                    isActive
                      ? 'bg-primary-50 border-l-2 border-primary-600'
                      : 'hover:bg-gray-50 border-l-2 border-transparent'
                  } ${tierLocked ? 'opacity-50' : ''}`}
                >
                  {/* Checkbox icon */}
                  <div className="mt-0.5 flex-shrink-0">
                    {lesson.is_completed ? (
                      <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="9" strokeWidth={2} />
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium truncate ${isActive ? 'text-primary-700' : 'text-gray-900'}`}>
                        {getLessonTitle(lesson)}
                      </span>
                      <TierBadge tier={lesson.feature_tier as 'starter' | 'pro' | 'enterprise'} />
                    </div>
                    {lesson.summary && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{lesson.summary}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right panel — lesson content */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-6">
          {activeLesson ? (
            <>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-gray-900">{getLessonTitle(activeLesson)}</h2>
                    <TierBadge tier={activeLesson.feature_tier as 'starter' | 'pro' | 'enterprise'} />
                  </div>
                  {activeLesson.summary && (
                    <p className="mt-1 text-sm text-gray-500">{activeLesson.summary}</p>
                  )}
                </div>
              </div>

              {isLocked ? (
                <div className="rounded-lg bg-gray-50 border border-gray-200 p-8 text-center">
                  <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <p className="text-sm text-gray-500">
                    This lesson requires the <strong className="capitalize">{activeLesson.feature_tier}</strong> plan.
                  </p>
                </div>
              ) : (
                <>
                  {/* Current plan indicator */}
                  {activeLesson?.section_content?.anchor === 'tier-comparison' && (
                    <div className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary-50 border border-primary-200">
                      <span className="text-xs font-medium text-primary-700">Your plan:</span>
                      <span className="text-xs font-bold text-primary-800 capitalize">{userTier}</span>
                    </div>
                  )}

                  {/* Lesson content */}
                  <div
                    className="text-sm text-gray-700 mb-6 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ul]:mt-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1 [&_ol]:mt-2 [&_li]:pl-1 [&_a]:text-primary-600 [&_a]:underline [&_strong]:font-semibold [&_p]:mt-2 [&_p:first-child]:mt-0 [&_h3]:font-semibold [&_h3]:text-gray-900 [&_h3]:mt-4 [&_h3]:mb-1 [&_h4]:font-medium [&_h4]:text-gray-800 [&_h4]:mt-3 overflow-x-auto [&_table]:w-full [&_table]:mt-3 [&_table]:min-w-[480px] [&_table]:border [&_table]:border-gray-200 [&_table]:rounded-lg [&_table]:border-separate [&_table]:border-spacing-0 [&_th]:text-left [&_th]:py-2.5 [&_th]:px-3 [&_th]:bg-gray-50 [&_th]:text-xs [&_th]:font-semibold [&_th]:text-gray-600 [&_th]:border-b [&_th]:border-gray-200 [&_td]:py-2.5 [&_td]:px-3 [&_td]:text-sm [&_td]:border-b [&_td]:border-gray-100 [&_tr:last-child_td]:border-b-0"
                    dangerouslySetInnerHTML={{ __html: displayContent }}
                  />

                  {/* Action buttons */}
                  <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-gray-200">
                    {activeLesson.app_route && activeLesson.action_label && (
                      <button
                        onClick={() => navigate(activeLesson.app_route)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
                      >
                        {activeLesson.action_label}
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </button>
                    )}
                    {!activeLesson.is_completed && activeIndex < visibleLessons.length - 1 && (
                      <button
                        onClick={async () => {
                          await handleToggleComplete();
                          goTo(1);
                        }}
                        disabled={toggling}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
                      >
                        Complete & Next
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={handleToggleComplete}
                      disabled={toggling}
                      className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                        activeLesson.is_completed
                          ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {activeLesson.is_completed ? (
                        <>
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Completed
                        </>
                      ) : (
                        'Mark as Complete'
                      )}
                    </button>
                  </div>
                </>
              )}

              {/* Previous / Next navigation */}
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={() => goTo(-1)}
                  disabled={activeIndex <= 0}
                  className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Previous
                </button>
                <span className="text-xs text-gray-400">
                  {activeIndex + 1} of {totalCount}
                </span>
                <button
                  onClick={() => goTo(1)}
                  disabled={activeIndex >= visibleLessons.length - 1}
                  className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Next
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <p>Select a lesson to get started.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
