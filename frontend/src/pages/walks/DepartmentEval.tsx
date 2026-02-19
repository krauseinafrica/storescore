import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getOrgId } from '../../utils/org';
import {
  getWalk,
  uploadWalkPhoto,
  analyzePhoto,
  submitScores,
  completeWalk,
} from '../../api/walks';
import type { Walk, Section, Criterion } from '../../types';

// Score color mapping: 1=red, 2=orange, 3=yellow, 4=lime, 5=green
const SCORE_COLORS: Record<number, { bg: string; text: string; border: string }> = {
  1: { bg: 'bg-red-500', text: 'text-red-700', border: 'border-red-300' },
  2: { bg: 'bg-orange-500', text: 'text-orange-700', border: 'border-orange-300' },
  3: { bg: 'bg-yellow-500', text: 'text-yellow-700', border: 'border-yellow-300' },
  4: { bg: 'bg-lime-500', text: 'text-lime-700', border: 'border-lime-300' },
  5: { bg: 'bg-green-500', text: 'text-green-700', border: 'border-green-300' },
};

const SCORE_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Average',
  4: 'Good',
  5: 'Excellent',
};

interface CriterionState {
  photoUrl: string | null;
  photoFile: File | null;
  uploading: boolean;
  analyzing: boolean;
  aiAnalysis: string | null;
  aiScore: number | null;
  scored: boolean;
  error: string | null;
}

export default function DepartmentEval() {
  const { walkId } = useParams<{ walkId: string }>();
  const navigate = useNavigate();
  const orgId = getOrgId();

  const [walk, setWalk] = useState<Walk | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [completing, setCompleting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Per-criterion state keyed by criterionId
  const [criterionStates, setCriterionStates] = useState<Record<string, CriterionState>>({});

  // File input refs keyed by criterionId
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Load walk data
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

        // Initialize criterion states from existing data
        const initialStates: Record<string, CriterionState> = {};
        const sections = walkData.department_sections || [];

        for (const section of sections) {
          for (const criterion of section.criteria) {
            // Check if there's already a photo for this criterion
            const existingPhoto = walkData.photos?.find(
              (p) => p.criterion === criterion.id
            );
            // Check if there's already a score for this criterion
            const existingScore = walkData.scores?.find(
              (s) => s.criterion === criterion.id
            );

            initialStates[criterion.id] = {
              photoUrl: existingPhoto?.image || null,
              photoFile: null,
              uploading: false,
              analyzing: false,
              aiAnalysis: existingPhoto?.caption || null,
              aiScore: existingScore?.points || null,
              scored: !!existingScore,
              error: null,
            };
          }
        }

        setCriterionStates(initialStates);
      } catch (err: any) {
        if (!cancelled) {
          setError(
            err.response?.data?.detail ||
              'Failed to load evaluation data. Please try again.'
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

  // Update a single criterion's state
  const updateCriterionState = useCallback(
    (criterionId: string, updates: Partial<CriterionState>) => {
      setCriterionStates((prev) => ({
        ...prev,
        [criterionId]: { ...prev[criterionId], ...updates },
      }));
    },
    []
  );

  // Handle photo selection and full upload+analyze+score flow
  async function handlePhotoSelected(
    e: React.ChangeEvent<HTMLInputElement>,
    criterion: Criterion,
    section: Section
  ) {
    if (!e.target.files?.length || !walk) return;
    const file = e.target.files[0];
    const preview = URL.createObjectURL(file);

    // Reset input so same file can be re-selected
    e.target.value = '';

    // Show preview immediately
    updateCriterionState(criterion.id, {
      photoFile: file,
      photoUrl: preview,
      uploading: true,
      analyzing: false,
      aiAnalysis: null,
      aiScore: null,
      scored: false,
      error: null,
    });

    try {
      // Step 1: Upload the photo
      await uploadWalkPhoto(
        orgId,
        walk.id,
        section.id,
        file,
        '', // caption will be set by AI analysis
        criterion.id
      );

      updateCriterionState(criterion.id, { uploading: false, analyzing: true });

      // Step 2: Analyze the photo with AI
      const analysis = await analyzePhoto(
        orgId,
        file,
        criterion.name,
        section.name,
        '',
        criterion.id
      );

      const suggestedScore = analysis.suggested_score || 3;

      updateCriterionState(criterion.id, {
        analyzing: false,
        aiAnalysis: analysis.analysis,
        aiScore: suggestedScore,
      });

      // Step 3: Submit the AI score
      await submitScores(orgId, walk.id, {
        scores: [{ criterion: criterion.id, points: suggestedScore }],
      });

      updateCriterionState(criterion.id, { scored: true });
      setToast({
        message: `"${criterion.name}" scored ${suggestedScore}/5 by AI`,
        type: 'success',
      });
    } catch (err: any) {
      const detail =
        err.response?.data?.detail || 'Failed to process photo. Please try again.';
      updateCriterionState(criterion.id, {
        uploading: false,
        analyzing: false,
        error: detail,
      });
      setToast({ message: detail, type: 'error' });
    }
  }

  // Calculate progress
  const sections: Section[] = walk?.department_sections || [];
  const totalCriteria = sections.reduce(
    (sum, sec) => sum + (sec.criteria?.length || 0),
    0
  );
  const scoredCriteria = Object.values(criterionStates).filter((s) => s.scored).length;
  const allScored = totalCriteria > 0 && scoredCriteria === totalCriteria;
  const progressPercent = totalCriteria > 0 ? (scoredCriteria / totalCriteria) * 100 : 0;

  // Complete evaluation handler
  async function handleComplete() {
    if (!walk || !allScored) return;
    setCompleting(true);

    try {
      await completeWalk(orgId, walk.id);
      setToast({ message: 'Evaluation completed successfully!', type: 'success' });
      setTimeout(() => navigate('/walks'), 1500);
    } catch (err: any) {
      const detail =
        err.response?.data?.detail || 'Failed to complete evaluation. Please try again.';
      setToast({ message: detail, type: 'error' });
      setCompleting(false);
    }
  }

  // Render score badge
  function renderScoreBadge(score: number) {
    const colors = SCORE_COLORS[score] || SCORE_COLORS[3];
    return (
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-white font-bold text-sm ${colors.bg}`}
        >
          {score}
        </span>
        <span className={`text-sm font-medium ${colors.text}`}>
          {SCORE_LABELS[score] || 'Unknown'}
        </span>
      </div>
    );
  }

  // --- Loading state ---
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading evaluation...</p>
        </div>
      </div>
    );
  }

  // --- Error state ---
  if (error) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-6xl mx-auto">
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

  // --- No walk or no sections ---
  if (!walk || sections.length === 0) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-6xl mx-auto">
        <p className="text-sm text-gray-500">
          No department sections found for this evaluation.
        </p>
        <Link to="/walks" className="text-sm text-primary-600 hover:underline mt-2 inline-block">
          Back to walks
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 pb-24 max-w-6xl mx-auto">
      {/* Toast notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-in fade-in slide-in-from-top-2">
          <div
            className={`rounded-lg px-4 py-3 shadow-lg text-sm font-medium flex items-center gap-2 ${
              toast.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {toast.type === 'success' ? (
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            {toast.message}
            <button
              onClick={() => setToast(null)}
              className="ml-2 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <Link
          to="/walks"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to walks
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {walk.department_name || 'Department'} Evaluation
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {walk.store_name} &middot;{' '}
              {new Date(walk.scheduled_date).toLocaleDateString()}
            </p>
          </div>

          {/* Status badge */}
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
              walk.status === 'completed'
                ? 'bg-green-100 text-green-700'
                : walk.status === 'in_progress'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-700'
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

      {/* Progress bar */}
      <div className="mb-8 bg-white rounded-xl ring-1 ring-gray-900/5 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Overall Progress</span>
          <span className="text-sm font-semibold text-gray-900">
            {scoredCriteria} of {totalCriteria} criteria scored
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${
              allScored ? 'bg-green-500' : 'bg-primary-600'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        {allScored && (
          <p className="text-xs text-green-600 font-medium mt-2">
            All criteria have been scored. You can now complete the evaluation.
          </p>
        )}
      </div>

      {/* Department sections */}
      <div className="space-y-8">
        {sections.map((section: Section) => (
          <div key={section.id}>
            {/* Section header */}
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-lg font-bold text-gray-900">{section.name}</h2>
              <span className="text-xs text-gray-400 font-medium">
                {section.criteria.filter((c) => criterionStates[c.id]?.scored).length}/
                {section.criteria.length} scored
              </span>
            </div>

            {/* Criteria cards */}
            <div className="space-y-4">
              {section.criteria.map((criterion: Criterion) => {
                const state = criterionStates[criterion.id] || {
                  photoUrl: null,
                  photoFile: null,
                  uploading: false,
                  analyzing: false,
                  aiAnalysis: null,
                  aiScore: null,
                  scored: false,
                  error: null,
                };

                const isProcessing = state.uploading || state.analyzing;

                return (
                  <div
                    key={criterion.id}
                    className={`bg-white rounded-xl ring-1 shadow-sm p-4 sm:p-5 transition-colors ${
                      state.scored
                        ? 'ring-green-200 bg-green-50/30'
                        : state.error
                          ? 'ring-red-200'
                          : 'ring-gray-900/5'
                    }`}
                  >
                    {/* Criterion header */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-gray-900">
                            {criterion.name}
                          </h3>
                          {state.scored && (
                            <svg
                              className="w-4 h-4 text-green-500 flex-shrink-0"
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
                          )}
                        </div>
                        {criterion.description && (
                          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                            {criterion.description}
                          </p>
                        )}
                        {criterion.scoring_guidance && (
                          <p className="text-xs text-blue-600 mt-1 italic">
                            Guidance: {criterion.scoring_guidance}
                          </p>
                        )}
                      </div>

                      {/* Score badge (if scored) */}
                      {state.aiScore !== null && state.scored && (
                        <div className="flex-shrink-0">
                          {renderScoreBadge(state.aiScore)}
                        </div>
                      )}
                    </div>

                    {/* Photo area */}
                    <div className="mt-3">
                      {/* Hidden file input */}
                      <input
                        ref={(el) => {
                          fileInputRefs.current[criterion.id] = el;
                        }}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => handlePhotoSelected(e, criterion, section)}
                      />

                      {state.photoUrl ? (
                        // Photo uploaded - show image and results
                        <div className="space-y-3">
                          <div className="relative rounded-lg overflow-hidden bg-gray-100">
                            <img
                              src={state.photoUrl}
                              alt={`Photo for ${criterion.name}`}
                              className="w-full h-48 sm:h-56 object-cover"
                            />

                            {/* Processing overlay */}
                            {isProcessing && (
                              <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-3">
                                <div className="w-8 h-8 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                                <span className="text-white text-sm font-medium">
                                  {state.uploading
                                    ? 'Uploading photo...'
                                    : 'AI analyzing photo...'}
                                </span>
                              </div>
                            )}

                            {/* Re-upload button (when not processing) */}
                            {!isProcessing && (
                              <button
                                onClick={() =>
                                  fileInputRefs.current[criterion.id]?.click()
                                }
                                className="absolute top-2 right-2 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/90 text-gray-700 text-xs font-medium hover:bg-white shadow-sm transition-colors"
                              >
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
                                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                  />
                                </svg>
                                Re-upload
                              </button>
                            )}
                          </div>

                          {/* AI Analysis result */}
                          {state.aiAnalysis && !isProcessing && (
                            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                              <div className="flex items-start gap-2">
                                <svg
                                  className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0"
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
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-blue-800 mb-1">
                                    AI Analysis
                                  </p>
                                  <p className="text-xs text-blue-700 leading-relaxed whitespace-pre-wrap">
                                    {state.aiAnalysis}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* AI Score display (read-only) */}
                          {state.aiScore !== null && state.scored && !isProcessing && (
                            <div
                              className={`flex items-center gap-3 rounded-lg p-3 border ${
                                SCORE_COLORS[state.aiScore]?.border || 'border-gray-200'
                              } bg-white`}
                            >
                              <span
                                className={`inline-flex items-center justify-center w-10 h-10 rounded-full text-white font-bold text-base ${
                                  SCORE_COLORS[state.aiScore]?.bg || 'bg-gray-500'
                                }`}
                              >
                                {state.aiScore}
                              </span>
                              <div>
                                <p className="text-sm font-semibold text-gray-900">
                                  AI Score: {state.aiScore}/{criterion.max_points || 5}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {SCORE_LABELS[state.aiScore] || 'Unknown'} &middot;
                                  Scored automatically by AI
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        // No photo yet - show upload area
                        <button
                          onClick={() =>
                            fileInputRefs.current[criterion.id]?.click()
                          }
                          disabled={isProcessing}
                          className="w-full border-2 border-dashed border-gray-300 rounded-lg py-8 px-4 flex flex-col items-center gap-2 text-gray-400 hover:border-primary-400 hover:text-primary-500 hover:bg-primary-50/30 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <svg
                            className="w-8 h-8"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                          <span className="text-sm font-medium">
                            Upload Photo for Evaluation
                          </span>
                          <span className="text-xs">
                            AI will analyze and score automatically
                          </span>
                        </button>
                      )}

                      {/* Error message */}
                      {state.error && (
                        <div className="mt-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 flex items-start gap-2">
                          <svg
                            className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0"
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
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-red-700">{state.error}</p>
                            <button
                              onClick={() =>
                                fileInputRefs.current[criterion.id]?.click()
                              }
                              className="text-xs font-medium text-red-600 hover:text-red-800 mt-1"
                            >
                              Try again
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Complete Evaluation button */}
      {walk.status !== 'completed' && (
        <div className="mt-10 border-t border-gray-200 pt-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-sm text-gray-600">
                {allScored
                  ? 'All criteria have been evaluated. Ready to submit.'
                  : `${totalCriteria - scoredCriteria} criteria remaining. Upload photos for all criteria to complete.`}
              </p>
            </div>
            <button
              onClick={handleComplete}
              disabled={!allScored || completing}
              className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-colors w-full sm:w-auto ${
                allScored && !completing
                  ? 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800 shadow-sm'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {completing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Completing...
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
                  Complete Evaluation
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Already completed message */}
      {walk.status === 'completed' && (
        <div className="mt-10 rounded-xl bg-green-50 border border-green-200 p-5 text-center">
          <svg
            className="w-10 h-10 text-green-500 mx-auto mb-3"
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
          <h3 className="text-lg font-semibold text-green-800">Evaluation Complete</h3>
          <p className="text-sm text-green-700 mt-1">
            This department evaluation was completed on{' '}
            {walk.completed_date
              ? new Date(walk.completed_date).toLocaleDateString()
              : 'N/A'}
            .
          </p>
          {walk.total_score !== null && (
            <p className="text-sm font-medium text-green-800 mt-2">
              Total Score: {walk.total_score}%
            </p>
          )}
        </div>
      )}
    </div>
  );
}
