import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getWalk, getTemplate } from '../../api/walks';
import type { Walk, ScoringTemplate, Section, Score, WalkPhoto } from '../../types';
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

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

interface SectionDetail {
  section: Section;
  earned: number;
  max: number;
  percentage: number;
  scoredCount: number;
  totalCriteria: number;
  notes: string;
  photos: WalkPhoto[];
  criterionScores: Record<string, number>;
}

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

function getScoreDotColor(score: number, max: number): string {
  const pct = max > 0 ? (score / max) * 100 : 0;
  if (pct >= 80) return 'bg-green-500';
  if (pct >= 60) return 'bg-amber-500';
  if (pct >= 40) return 'bg-yellow-500';
  if (pct >= 20) return 'bg-orange-500';
  return 'bg-red-500';
}

export default function WalkDetail() {
  const { walkId } = useParams<{ walkId: string }>();
  const orgId = getOrgId();

  const [walk, setWalk] = useState<Walk | null>(null);
  const [template, setTemplate] = useState<ScoringTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set()
  );
  const [lightboxPhoto, setLightboxPhoto] = useState<WalkPhoto | null>(null);

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
              'Failed to load walk details. Please try again.'
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

  const buildSectionDetails = useCallback((): SectionDetail[] => {
    if (!template || !walk) return [];

    const scoreMap: Record<string, Score> = {};
    (walk.scores || []).forEach((s) => {
      scoreMap[s.criterion] = s;
    });

    const noteMap: Record<string, string> = {};
    (walk.section_notes || []).forEach((n) => {
      noteMap[n.section] = n.notes;
    });

    const photoMap: Record<string, WalkPhoto[]> = {};
    (walk.photos || []).forEach((p) => {
      if (p.section) {
        if (!photoMap[p.section]) photoMap[p.section] = [];
        photoMap[p.section].push(p);
      }
    });

    return template.sections.map((sec) => {
      let earned = 0;
      let max = 0;
      let scoredCount = 0;
      const criterionScores: Record<string, number> = {};

      sec.criteria.forEach((c) => {
        max += c.max_points;
        const score = scoreMap[c.id];
        if (score) {
          earned += score.points;
          scoredCount++;
          criterionScores[c.id] = score.points;
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
        photos: photoMap[sec.id] || [],
        criterionScores,
      };
    });
  }, [template, walk]);

  const sectionDetails = buildSectionDetails();

  function toggleSection(sectionId: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }

  // Overall
  const overallScore = walk?.total_score ?? null;
  const totalEarned = sectionDetails.reduce((sum, s) => sum + s.earned, 0);
  const totalMax = sectionDetails.reduce((sum, s) => sum + s.max, 0);
  const overallPercentage =
    overallScore !== null
      ? overallScore
      : totalMax > 0
        ? (totalEarned / totalMax) * 100
        : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading walk details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 sm:px-6 py-6">
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
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
            <div>
              <p className="text-sm text-red-700">{error}</p>
              <Link
                to="/walks"
                className="mt-2 inline-block text-sm font-medium text-red-600 hover:text-red-800"
              >
                Back to walks
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!walk) return null;

  return (
    <div className="px-4 sm:px-6 py-6 pb-8 max-w-lg mx-auto">
      {/* Photo lightbox */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxPhoto(null)}
        >
          <button
            className="absolute top-4 right-4 text-white p-2"
            onClick={() => setLightboxPhoto(null)}
            aria-label="Close"
          >
            <svg
              className="w-6 h-6"
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
          </button>
          <img
            src={lightboxPhoto.image}
            alt={lightboxPhoto.caption || 'Walk photo'}
            className="max-w-full max-h-full object-contain rounded-lg"
          />
          {lightboxPhoto.caption && (
            <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 px-4 py-2 rounded-lg">
              {lightboxPhoto.caption}
            </p>
          )}
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <Link
          to="/walks"
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
          Back to Walks
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {walk.store_name}
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">
              {walk.template_name}
            </p>
          </div>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              walk.status === 'completed'
                ? 'bg-green-100 text-green-700'
                : walk.status === 'in_progress'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-blue-100 text-blue-700'
            }`}
          >
            {walk.status === 'completed'
              ? 'Completed'
              : walk.status === 'in_progress'
                ? 'In Progress'
                : 'Scheduled'}
          </span>
        </div>
      </div>

      {/* Walk metadata */}
      <div className="bg-white rounded-xl ring-1 ring-gray-900/5 p-4 shadow-sm mb-6">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-400 text-xs">Date</p>
            <p className="font-medium text-gray-900">
              {formatDate(walk.scheduled_date)}
            </p>
          </div>
          <div>
            <p className="text-gray-400 text-xs">Evaluator</p>
            <p className="font-medium text-gray-900">
              {walk.conducted_by_detail
                ? `${walk.conducted_by_detail.first_name} ${walk.conducted_by_detail.last_name}`
                : walk.conducted_by_name || 'Unknown'}
            </p>
          </div>
          {walk.completed_date && (
            <div className="col-span-2">
              <p className="text-gray-400 text-xs">Completed</p>
              <p className="font-medium text-gray-900">
                {formatDateTime(walk.completed_date)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Overall Score */}
      <div className="text-center mb-6">
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
      </div>

      {/* AI Summary */}
      {walk.ai_summary && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
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
            <h3 className="text-sm font-semibold text-blue-900">AI Summary</h3>
          </div>
          <p className="text-sm text-blue-800 whitespace-pre-wrap leading-relaxed">
            {walk.ai_summary}
          </p>
        </div>
      )}

      {/* Section details */}
      <div className="space-y-3 mb-6">
        <h2 className="text-base font-semibold text-gray-900">
          Section Scores
        </h2>

        {sectionDetails.map((detail) => {
          const {
            section: sec,
            earned,
            max,
            percentage,
            totalCriteria,
            notes,
            photos,
            criterionScores,
          } = detail;
          const isExpanded = expandedSections.has(sec.id);
          const hasNoCriteria = totalCriteria === 0;

          return (
            <div
              key={sec.id}
              className="bg-white rounded-xl ring-1 ring-gray-900/5 shadow-sm overflow-hidden"
            >
              {/* Section header (clickable) */}
              <button
                onClick={() => toggleSection(sec.id)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {sec.name}
                  </h3>
                  {!hasNoCriteria && (
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                      <div
                        className={`h-1.5 rounded-full transition-all ${getBarColor(
                          percentage
                        )}`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                  {!hasNoCriteria && (
                    <span
                      className={`text-lg font-bold ${getScoreColor(
                        percentage
                      )}`}
                    >
                      {Math.round(percentage)}%
                    </span>
                  )}
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-100">
                  {/* Criteria scores */}
                  {sec.criteria.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {sec.criteria.map((criterion) => {
                        const score = criterionScores[criterion.id];
                        const scored = score !== undefined;
                        return (
                          <div
                            key={criterion.id}
                            className="flex items-center justify-between py-1.5"
                          >
                            <span className="text-sm text-gray-700 flex-1 min-w-0 truncate">
                              {criterion.name}
                            </span>
                            <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                              {scored && (
                                <div
                                  className={`w-2.5 h-2.5 rounded-full ${getScoreDotColor(
                                    score,
                                    criterion.max_points
                                  )}`}
                                />
                              )}
                              <span
                                className={`text-sm font-medium ${
                                  scored ? 'text-gray-900' : 'text-gray-300'
                                }`}
                              >
                                {scored ? score : '-'}/{criterion.max_points}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      {!hasNoCriteria && (
                        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                          <span className="text-sm font-semibold text-gray-900">
                            Section Total
                          </span>
                          <span
                            className={`text-sm font-bold ${getScoreColor(
                              percentage
                            )}`}
                          >
                            {earned}/{max}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Section notes */}
                  {notes && (
                    <div className="mt-3 bg-gray-50 rounded-lg p-3">
                      <h4 className="text-xs font-semibold text-gray-500 mb-1">
                        Notes
                      </h4>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {notes}
                      </p>
                    </div>
                  )}

                  {/* Section photos */}
                  {photos.length > 0 && (
                    <div className="mt-3">
                      <h4 className="text-xs font-semibold text-gray-500 mb-2">
                        Photos ({photos.length})
                      </h4>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {photos.map((photo) => (
                          <button
                            key={photo.id}
                            onClick={() => setLightboxPhoto(photo)}
                            className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden ring-1 ring-gray-200 hover:ring-primary-500 transition-all"
                          >
                            <img
                              src={photo.image}
                              alt={photo.caption || 'Walk photo'}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Walk notes */}
      {walk.notes && (
        <div className="bg-gray-50 rounded-xl p-4 mb-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">
            Walk Notes
          </h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">
            {walk.notes}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Link
          to="/walks"
          className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Back to Walks
        </Link>
        {walk.status === 'in_progress' && (
          <Link
            to={`/walks/${walk.id}/conduct`}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-700 transition-colors"
          >
            Continue Walk
          </Link>
        )}
      </div>
    </div>
  );
}
