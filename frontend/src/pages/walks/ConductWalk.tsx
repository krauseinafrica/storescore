import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  getWalk,
  getTemplate,
  submitScores,
  saveSectionNote,
  uploadWalkPhoto,
} from '../../api/walks';
import type {
  Walk,
  ScoringTemplate,
  Section,
  Criterion,
  Score,
  WalkPhoto,
} from '../../types';
import { getOrgId } from '../../utils/org';

// Map 1-5 score to Tailwind color classes
const SCORE_COLORS: Record<
  number,
  { bg: string; bgSelected: string; ring: string; text: string }
> = {
  1: {
    bg: 'bg-red-100',
    bgSelected: 'bg-red-500',
    ring: 'ring-red-500',
    text: 'text-red-700',
  },
  2: {
    bg: 'bg-orange-100',
    bgSelected: 'bg-orange-500',
    ring: 'ring-orange-500',
    text: 'text-orange-700',
  },
  3: {
    bg: 'bg-yellow-100',
    bgSelected: 'bg-yellow-500',
    ring: 'ring-yellow-500',
    text: 'text-yellow-700',
  },
  4: {
    bg: 'bg-lime-100',
    bgSelected: 'bg-lime-500',
    ring: 'ring-lime-500',
    text: 'text-lime-700',
  },
  5: {
    bg: 'bg-green-100',
    bgSelected: 'bg-green-500',
    ring: 'ring-green-500',
    text: 'text-green-700',
  },
};

const SCORE_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Avg',
  4: 'Good',
  5: 'Great',
};

interface LocalScores {
  [criterionId: string]: number;
}

interface LocalNotes {
  [sectionId: string]: string;
}

interface LocalPhotos {
  [sectionId: string]: Array<{ file: File; preview: string; caption: string }>;
}

interface UploadedPhotos {
  [sectionId: string]: WalkPhoto[];
}

export default function ConductWalk() {
  const { walkId } = useParams<{ walkId: string }>();
  const navigate = useNavigate();
  const orgId = getOrgId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedScoresRef = useRef<string>('');

  const [walk, setWalk] = useState<Walk | null>(null);
  const [template, setTemplate] = useState<ScoringTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  // Current section index (0-based)
  const [currentSection, setCurrentSection] = useState(0);

  // Local state for scores, notes, and photos
  const [localScores, setLocalScores] = useState<LocalScores>({});
  const [localNotes, setLocalNotes] = useState<LocalNotes>({});
  const [localPhotos, setLocalPhotos] = useState<LocalPhotos>({});
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhotos>({});

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Cleanup auto-save timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, []);

  // Fetch walk and template data
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

        // Pre-populate scores from walk data
        if (walkData.scores && walkData.scores.length > 0) {
          const scoreMap: LocalScores = {};
          walkData.scores.forEach((s: Score) => {
            scoreMap[s.criterion] = s.points;
          });
          setLocalScores(scoreMap);
        }

        // Pre-populate section notes from walk data
        if (walkData.section_notes && walkData.section_notes.length > 0) {
          const noteMap: LocalNotes = {};
          walkData.section_notes.forEach((n) => {
            noteMap[n.section] = n.notes;
          });
          setLocalNotes(noteMap);
        }

        // Pre-populate photos from walk data
        if (walkData.photos && walkData.photos.length > 0) {
          const photoMap: UploadedPhotos = {};
          walkData.photos.forEach((p) => {
            if (p.section) {
              if (!photoMap[p.section]) photoMap[p.section] = [];
              photoMap[p.section].push(p);
            }
          });
          setUploadedPhotos(photoMap);
        }
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

  const sections: Section[] = template?.sections || [];
  const section = sections[currentSection];
  const totalSections = sections.length;
  const isLastSection = currentSection === totalSections - 1;

  // Check if a section has all criteria scored
  const isSectionComplete = useCallback(
    (sec: Section): boolean => {
      if (!sec.criteria || sec.criteria.length === 0) return true;
      return sec.criteria.every((c) => localScores[c.id] !== undefined);
    },
    [localScores]
  );

  // Count scored criteria in section
  const sectionScoredCount = useCallback(
    (sec: Section): number => {
      if (!sec.criteria) return 0;
      return sec.criteria.filter((c) => localScores[c.id] !== undefined).length;
    },
    [localScores]
  );

  // Set a score for a criterion
  function handleScore(criterionId: string, points: number) {
    setLocalScores((prev) => ({ ...prev, [criterionId]: points }));
    setIsDirty(true);
    scheduleAutoSave();
  }

  // Update notes for a section
  function handleNoteChange(sectionId: string, value: string) {
    setLocalNotes((prev) => ({ ...prev, [sectionId]: value }));
    setIsDirty(true);
    scheduleAutoSave();
  }

  // Auto-save after 5 seconds of inactivity
  function scheduleAutoSave() {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = setTimeout(() => {
      saveCurrentSection().then(() => setIsDirty(false));
    }, 5000);
  }

  // Photo selection
  function handlePhotoClick() {
    fileInputRef.current?.click();
  }

  function handlePhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    if (!section || !e.target.files?.length) return;

    const file = e.target.files[0];
    const preview = URL.createObjectURL(file);

    setLocalPhotos((prev) => ({
      ...prev,
      [section.id]: [
        ...(prev[section.id] || []),
        { file, preview, caption: '' },
      ],
    }));

    // Reset the input so the same file can be re-selected
    e.target.value = '';
  }

  function handleRemoveLocalPhoto(sectionId: string, index: number) {
    setLocalPhotos((prev) => {
      const photos = [...(prev[sectionId] || [])];
      URL.revokeObjectURL(photos[index].preview);
      photos.splice(index, 1);
      return { ...prev, [sectionId]: photos };
    });
  }

  // Save current section's scores and notes
  async function saveCurrentSection(): Promise<boolean> {
    if (!section || !walk) return true;

    setSaving(true);
    setSaveMessage('');

    try {
      // Collect scores for this section's criteria
      const sectionScores = section.criteria
        .filter((c) => localScores[c.id] !== undefined)
        .map((c) => ({
          criterion: c.id,
          points: localScores[c.id],
        }));

      // Submit scores if any
      if (sectionScores.length > 0) {
        await submitScores(orgId, walk.id, { scores: sectionScores });
      }

      // Save section notes if any
      const noteText = localNotes[section.id];
      if (noteText !== undefined && noteText.trim() !== '') {
        await saveSectionNote(orgId, walk.id, section.id, noteText);
      }

      // Upload any local photos
      const pendingPhotos = localPhotos[section.id] || [];
      for (const photo of pendingPhotos) {
        const uploaded = await uploadWalkPhoto(
          orgId,
          walk.id,
          section.id,
          photo.file,
          photo.caption
        );
        setUploadedPhotos((prev) => ({
          ...prev,
          [section.id]: [...(prev[section.id] || []), uploaded],
        }));
      }

      // Clear local photos for this section (they're now uploaded)
      if (pendingPhotos.length > 0) {
        setLocalPhotos((prev) => {
          const updated = { ...prev };
          // Revoke object URLs
          (updated[section.id] || []).forEach((p) =>
            URL.revokeObjectURL(p.preview)
          );
          delete updated[section.id];
          return updated;
        });
      }

      setIsDirty(false);
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      setSaveMessage('Saved');
      setTimeout(() => setSaveMessage(''), 2000);
      return true;
    } catch (err: any) {
      const detail =
        err.response?.data?.detail ||
        'Failed to save. Your progress is preserved locally.';
      setSaveMessage(detail);
      // Do not block navigation on save failure -- local state is retained
      return true;
    } finally {
      setSaving(false);
    }
  }

  async function handleNext() {
    await saveCurrentSection();
    if (isLastSection) {
      navigate(`/walks/${walkId}/review`);
    } else {
      setCurrentSection((prev) => Math.min(prev + 1, totalSections - 1));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  async function handlePrevious() {
    await saveCurrentSection();
    setCurrentSection((prev) => Math.max(prev - 1, 0));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading walk...</p>
        </div>
      </div>
    );
  }

  // Error state
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

  if (!section || !walk || !template) {
    return (
      <div className="px-4 sm:px-6 py-6">
        <p className="text-sm text-gray-500">No sections found in template.</p>
        <Link to="/walks" className="text-sm text-primary-600 hover:underline">
          Back to walks
        </Link>
      </div>
    );
  }

  const sectionPhotoCount =
    (localPhotos[section.id]?.length || 0) +
    (uploadedPhotos[section.id]?.length || 0);

  return (
    <div className="flex flex-col min-h-[calc(100vh-56px)]">
      {/* Hidden file input for photo capture */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePhotoSelected}
      />

      {/* Top bar with progress */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <Link
            to="/walks"
            className="p-1 -ml-1 text-gray-400 hover:text-gray-600"
            aria-label="Back to walks"
          >
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
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </Link>
          <div className="text-center flex-1">
            <p className="text-xs text-gray-500 font-medium truncate">
              {walk.store_name}
            </p>
            <p className="text-sm font-semibold text-gray-900">
              Section {currentSection + 1} of {totalSections}
            </p>
          </div>
          <div className="w-5" /> {/* Spacer for centering */}
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-primary-600 h-2 rounded-full transition-all duration-300"
            style={{
              width: `${((currentSection + 1) / totalSections) * 100}%`,
            }}
          />
        </div>

        {/* Section pills */}
        <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1 scrollbar-hide">
          {sections.map((sec, idx) => {
            const isActive = idx === currentSection;
            const isComplete = isSectionComplete(sec);
            return (
              <button
                key={sec.id}
                onClick={async () => {
                  await saveCurrentSection();
                  setCurrentSection(idx);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors touch-manipulation ${
                  isActive
                    ? 'bg-primary-600 text-white'
                    : isComplete
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                }`}
              >
                {isComplete && !isActive && (
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
                {idx + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* Save indicator */}
      {saveMessage && (
        <div className="px-4 py-1.5 bg-green-50 text-green-700 text-xs font-medium text-center">
          {saveMessage}
        </div>
      )}

      {/* Section content */}
      <div className="flex-1 px-4 py-4 overflow-y-auto">
        {/* Section header */}
        <div className="mb-5">
          <h2 className="text-lg font-bold text-gray-900">{section.name}</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {sectionScoredCount(section)} of {section.criteria.length} criteria
            scored
          </p>
        </div>

        {/* Criteria list */}
        {section.criteria.length > 0 ? (
          <div className="space-y-5">
            {section.criteria.map((criterion: Criterion) => {
              const currentScore = localScores[criterion.id];
              return (
                <div
                  key={criterion.id}
                  className="bg-white rounded-xl ring-1 ring-gray-900/5 p-4 shadow-sm"
                >
                  <div className="mb-3">
                    <h3 className="text-sm font-semibold text-gray-900">
                      {criterion.name}
                    </h3>
                    {criterion.description && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {criterion.description}
                      </p>
                    )}
                  </div>

                  {/* Score buttons - 56px min height for touch targets */}
                  <div className="flex gap-1.5 sm:gap-2">
                    {[1, 2, 3, 4, 5].map((value) => {
                      const isSelected = currentScore === value;
                      const colors = SCORE_COLORS[value];
                      return (
                        <button
                          key={value}
                          onClick={() => handleScore(criterion.id, value)}
                          className={`flex-1 flex flex-col items-center justify-center rounded-xl py-3 min-h-[56px] transition-all duration-150 font-semibold select-none touch-manipulation ${
                            isSelected
                              ? `${colors.bgSelected} text-white ring-2 ${colors.ring} ring-offset-1 shadow-md scale-[1.06]`
                              : `${colors.bg} ${colors.text} hover:opacity-80 active:scale-95`
                          }`}
                          aria-label={`Score ${value}: ${SCORE_LABELS[value]}`}
                        >
                          <span className="text-lg leading-none">
                            {value}
                          </span>
                          <span className="text-[10px] mt-0.5 leading-none opacity-80">
                            {SCORE_LABELS[value]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-gray-50 rounded-xl p-6 text-center">
            <p className="text-sm text-gray-500">
              No scored criteria in this section.
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Use the notes and photo features below to capture observations.
            </p>
          </div>
        )}

        {/* Section Notes */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Section Notes
          </label>
          <textarea
            value={localNotes[section.id] || ''}
            onChange={(e) => handleNoteChange(section.id, e.target.value)}
            placeholder="Add notes for this section..."
            rows={3}
            className="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none transition-colors resize-none"
          />
        </div>

        {/* Photo upload section */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Photos
              {sectionPhotoCount > 0 && (
                <span className="ml-1.5 text-xs text-gray-400">
                  ({sectionPhotoCount})
                </span>
              )}
            </label>
            <button
              onClick={handlePhotoClick}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 active:bg-gray-300 transition-colors"
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
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              Add Photo
            </button>
          </div>

          {/* Uploaded photos (from server) */}
          {(uploadedPhotos[section.id] || []).length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {uploadedPhotos[section.id].map((photo) => (
                <div
                  key={photo.id}
                  className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden ring-1 ring-gray-200"
                >
                  <img
                    src={photo.image}
                    alt={photo.caption || 'Walk photo'}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Pending local photos (not yet uploaded) */}
          {(localPhotos[section.id] || []).length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 mt-2">
              {localPhotos[section.id].map((photo, idx) => (
                <div key={idx} className="flex-shrink-0 relative">
                  <div className="w-20 h-20 rounded-lg overflow-hidden ring-1 ring-gray-200">
                    <img
                      src={photo.preview}
                      alt="Pending upload"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <button
                    onClick={() => handleRemoveLocalPhoto(section.id, idx)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow"
                    aria-label="Remove photo"
                  >
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-amber-500 text-white text-[9px] text-center py-0.5 rounded-b-lg">
                    Pending
                  </div>
                </div>
              ))}
            </div>
          )}

          {sectionPhotoCount === 0 && (
            <p className="text-xs text-gray-400">
              No photos added yet. Tap "Add Photo" to capture evidence.
            </p>
          )}
        </div>
      </div>

      {/* Bottom navigation */}
      <div className="sticky bottom-0 z-20 bg-white border-t border-gray-200 px-4 py-3 flex gap-3">
        {currentSection > 0 ? (
          <button
            onClick={handlePrevious}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-3.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 transition-colors touch-manipulation"
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
            Previous
          </button>
        ) : (
          <div className="flex-1" />
        )}

        <button
          onClick={handleNext}
          disabled={saving}
          className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-semibold transition-colors disabled:opacity-50 touch-manipulation ${
            isLastSection
              ? 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800'
              : 'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800'
          }`}
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Saving...
            </>
          ) : isLastSection ? (
            <>
              Review Walk
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
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </>
          ) : (
            <>
              Next
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
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
