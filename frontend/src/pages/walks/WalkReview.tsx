import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getWalk, getTemplate, completeWalk } from '../../api/walks';
import type { Walk, ScoringTemplate, Section, Score } from '../../types';
import { getOrgId } from '../../utils/org';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface SectionSummary {
  section: Section;
  earned: number;
  max: number;
  percentage: number;
  scoredCount: number;
  totalCriteria: number;
  notes: string;
  photoCount: number;
}

export default function WalkReview() {
  const { walkId } = useParams<{ walkId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const orgId = getOrgId();

  const [walk, setWalk] = useState<Walk | null>(null);
  const [template, setTemplate] = useState<ScoringTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [completedWalk, setCompletedWalk] = useState<Walk | null>(null);

  // Notification options
  const [emailMe, setEmailMe] = useState(true);
  const [emailEvaluator, setEmailEvaluator] = useState(true);
  const [additionalEmails, setAdditionalEmails] = useState('');

  useEffect(() => {
    if (!orgId || !walkId) {
      setError('Missing organization or walk information.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchData() {
      try {
        const walkData = await getWalk(orgId, walkId!);
        if (cancelled) return;
        setWalk(walkData);

        const templateData = await getTemplate(orgId, walkData.template);
        if (cancelled) return;
        setTemplate(templateData);
      } catch (err: any) {
        if (!cancelled) {
          setError(
            err.response?.data?.detail ||
              'Failed to load walk data. Please try again.'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [orgId, walkId]);

  // Build section summaries
  const buildSectionSummaries = useCallback((): SectionSummary[] => {
    if (!template || !walk) return [];

    const scoreMap: Record<string, Score> = {};
    (walk.scores || []).forEach((s) => {
      scoreMap[s.criterion] = s;
    });

    const noteMap: Record<string, string> = {};
    (walk.section_notes || []).forEach((n) => {
      noteMap[n.section] = n.notes;
    });

    const photoCountMap: Record<string, number> = {};
    (walk.photos || []).forEach((p) => {
      if (p.section) {
        photoCountMap[p.section] = (photoCountMap[p.section] || 0) + 1;
      }
    });

    return template.sections.map((sec) => {
      let earned = 0;
      let max = 0;
      let scoredCount = 0;

      sec.criteria.forEach((c) => {
        max += c.max_points;
        const score = scoreMap[c.id];
        if (score) {
          earned += score.points;
          scoredCount++;
        }
      });

      const percentage = max > 0 ? (earned / max) * 100 : 0;

      return {
        section: sec,
        earned,
        max,
        percentage,
        scoredCount,
        totalCriteria: sec.criteria.length,
        notes: noteMap[sec.id] || '',
        photoCount: photoCountMap[sec.id] || 0,
      };
    });
  }, [template, walk]);

  const sectionSummaries = buildSectionSummaries();

  // Overall score
  const overallScore = walk?.total_score ?? null;
  const totalEarned = sectionSummaries.reduce((sum, s) => sum + s.earned, 0);
  const totalMax = sectionSummaries.reduce((sum, s) => sum + s.max, 0);
  const overallPercentage =
    overallScore !== null
      ? overallScore
      : totalMax > 0
        ? (totalEarned / totalMax) * 100
        : 0;

  const totalPhotos = (walk?.photos || []).length;

  function getScoreColor(pct: number): string {
    if (pct >= 80) return 'text-green-600';
    if (pct >= 60) return 'text-amber-600';
    return 'text-red-600';
  }

  function getScoreBgColor(pct: number): string {
    if (pct >= 80) return 'bg-green-50 ring-green-200';
    if (pct >= 60) return 'bg-amber-50 ring-amber-200';
    return 'bg-red-50 ring-red-200';
  }

  function getBarColor(pct: number): string {
    if (pct >= 80) return 'bg-green-500';
    if (pct >= 60) return 'bg-amber-500';
    return 'bg-red-500';
  }

  async function handleComplete() {
    if (!walk) return;

    setCompleting(true);
    setError('');

    try {
      // Parse additional emails
      const extraEmails = additionalEmails
        .split(',')
        .map((e) => e.trim())
        .filter((e) => e.length > 0 && e.includes('@'));

      const result = await completeWalk(orgId, walk.id, {
        notify_manager: emailMe,
        notify_evaluator: emailEvaluator,
        additional_emails: extraEmails.length > 0 ? extraEmails : undefined,
      });

      setCompletedWalk(result);
      setCompleted(true);
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
          'Failed to complete walk. Please try again.'
      );
    } finally {
      setCompleting(false);
    }
  }

  // Loading
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading review...</p>
        </div>
      </div>
    );
  }

  // Completed success screen
  if (completed && completedWalk) {
    return (
      <div className="px-4 sm:px-6 py-8 max-w-lg mx-auto text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-2">
          Walk Completed!
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          {completedWalk.store_name} - {formatDate(completedWalk.scheduled_date)}
        </p>

        {/* Score */}
        <div className="mb-6">
          <div
            className={`inline-flex items-center justify-center w-24 h-24 rounded-full ring-4 ${getScoreBgColor(
              completedWalk.total_score ?? 0
            )}`}
          >
            <span
              className={`text-3xl font-bold ${getScoreColor(
                completedWalk.total_score ?? 0
              )}`}
            >
              {completedWalk.total_score !== null
                ? Math.round(completedWalk.total_score)
                : '--'}
              %
            </span>
          </div>
        </div>

        {/* AI Summary -- may arrive later via async processing */}
        {completedWalk.ai_summary ? (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-left">
            <div className="flex items-center gap-2 mb-2">
              <svg
                className="w-5 h-5 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
              <h3 className="text-sm font-semibold text-blue-900">
                AI Summary
              </h3>
            </div>
            <p className="text-sm text-blue-800 whitespace-pre-wrap">
              {completedWalk.ai_summary}
            </p>
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6 text-left">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
              <p className="text-sm text-gray-500">
                AI summary is being generated. Check back in a moment, or view
                it in your email.
              </p>
            </div>
          </div>
        )}

        {/* Notification confirmation */}
        <p className="text-xs text-gray-400 mb-6">
          Results will be emailed to the selected recipients.
        </p>

        {/* Actions */}
        <div className="space-y-3">
          <Link
            to={`/walks/${completedWalk.id}`}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-700 transition-colors"
          >
            View Walk Details
          </Link>
          <Link
            to="/walks"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Back to Walk List
          </Link>
        </div>
      </div>
    );
  }

  // Review screen
  return (
    <div className="px-4 sm:px-6 py-6 pb-32 max-w-lg mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          to={`/walks/${walkId}/conduct`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Continue Editing
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Review Walk</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {walk?.store_name} -{' '}
          {walk?.scheduled_date ? formatDate(walk.scheduled_date) : ''}
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Overall Score */}
      <div className="mb-6 text-center">
        <div
          className={`inline-flex items-center justify-center w-28 h-28 rounded-full ring-4 ${getScoreBgColor(
            overallPercentage
          )}`}
        >
          <div>
            <span
              className={`text-4xl font-bold ${getScoreColor(
                overallPercentage
              )}`}
            >
              {Math.round(overallPercentage)}
            </span>
            <span
              className={`text-lg font-bold ${getScoreColor(
                overallPercentage
              )}`}
            >
              %
            </span>
          </div>
        </div>
        <p className="mt-2 text-sm text-gray-500">
          Overall Score ({totalEarned}/{totalMax} points)
        </p>
        {totalPhotos > 0 && (
          <p className="text-xs text-gray-400 mt-0.5">
            {totalPhotos} photo{totalPhotos !== 1 ? 's' : ''} captured
          </p>
        )}
      </div>

      {/* Section summaries */}
      <div className="space-y-3 mb-8">
        {sectionSummaries.map((summary) => {
          const { section: sec, earned, max, percentage, scoredCount, totalCriteria, notes, photoCount } = summary;
          const hasNoCriteria = totalCriteria === 0;

          return (
            <div
              key={sec.id}
              className="bg-white rounded-xl ring-1 ring-gray-900/5 p-4 shadow-sm"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {sec.name}
                  </h3>
                  {!hasNoCriteria && (
                    <p className="text-xs text-gray-400">
                      {scoredCount}/{totalCriteria} criteria scored
                    </p>
                  )}
                </div>
                {!hasNoCriteria && (
                  <div className="text-right flex-shrink-0 ml-3">
                    <span
                      className={`text-lg font-bold ${getScoreColor(
                        percentage
                      )}`}
                    >
                      {Math.round(percentage)}%
                    </span>
                    <p className="text-xs text-gray-400">
                      {earned}/{max}
                    </p>
                  </div>
                )}
              </div>

              {/* Progress bar */}
              {!hasNoCriteria && (
                <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
                  <div
                    className={`h-1.5 rounded-full transition-all ${getBarColor(
                      percentage
                    )}`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>
              )}

              {/* Notes indicator */}
              {notes && (
                <div className="mt-2 flex items-start gap-1.5">
                  <svg
                    className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                    />
                  </svg>
                  <p className="text-xs text-gray-500 line-clamp-2">{notes}</p>
                </div>
              )}

              {/* Photo count */}
              {photoCount > 0 && (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <svg
                    className="w-3.5 h-3.5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  <p className="text-xs text-gray-500">
                    {photoCount} photo{photoCount !== 1 ? 's' : ''}
                  </p>
                </div>
              )}

              {/* Warning if incomplete */}
              {!hasNoCriteria && scoredCount < totalCriteria && (
                <div className="mt-2 flex items-center gap-1.5 text-amber-600">
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.832c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                  <p className="text-xs font-medium">
                    {totalCriteria - scoredCount} criteria not scored
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Notification options */}
      <div className="bg-white rounded-xl ring-1 ring-gray-900/5 p-4 shadow-sm mb-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">
          Email Results
        </h3>
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={emailMe}
              onChange={(e) => setEmailMe(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <div>
              <span className="text-sm text-gray-700">Email me results</span>
              <p className="text-xs text-gray-400">{user?.email}</p>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={emailEvaluator}
              onChange={(e) => setEmailEvaluator(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">
              Email evaluator
            </span>
          </label>

          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Additional recipients
            </label>
            <input
              type="text"
              value={additionalEmails}
              onChange={(e) => setAdditionalEmails(e.target.value)}
              placeholder="email1@example.com, email2@example.com"
              className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none transition-colors"
            />
            <p className="text-xs text-gray-400 mt-1">
              Separate multiple emails with commas
            </p>
          </div>
        </div>
      </div>

      {/* Complete Walk button - sticky instead of fixed to stay within layout */}
      <div className="sticky bottom-0 z-20 bg-white border-t border-gray-200 px-4 py-3 -mx-4 sm:-mx-6">
        <button
          onClick={handleComplete}
          disabled={completing}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {completing ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Completing Walk...
            </>
          ) : (
            <>
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Complete Walk
            </>
          )}
        </button>
      </div>
    </div>
  );
}
