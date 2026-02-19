import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import InfoButton from '../../components/InfoButton';
import {
  getWalk,
  getTemplate,
  submitScores,
  saveSectionNote,
  uploadWalkPhoto,
  getOrgSettings,
  analyzePhoto,
  startWalk,
  deleteWalk,
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

interface LocalDrivers {
  [criterionId: string]: string[];
}

interface LocalNotes {
  [sectionId: string]: string;
}

interface LocalPhoto {
  file: File;
  preview: string;
  caption: string;
  criterionId?: string | null;
}

interface LocalPhotos {
  [sectionId: string]: LocalPhoto[];
}

interface FailedPhoto {
  file: File;
  preview: string;
  caption: string;
  criterionId?: string | null;
  sectionId: string;
  retryCount: number;
}

interface UploadedPhotos {
  [sectionId: string]: WalkPhoto[];
}

export default function ConductWalk() {
  const { walkId } = useParams<{ walkId: string }>();
  const navigate = useNavigate();
  const orgId = getOrgId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedScoresRef = useRef<string>('');
  const pendingPhotoCriterionRef = useRef<string | null>(null);

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
  const [localDrivers, setLocalDrivers] = useState<LocalDrivers>({});
  const [localNotes, setLocalNotes] = useState<LocalNotes>({});
  const [localPhotos, setLocalPhotos] = useState<LocalPhotos>({});
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhotos>({});
  const [failedPhotos, setFailedPhotos] = useState<FailedPhoto[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  // Geolocation state
  const [locationStatus, setLocationStatus] = useState<
    'pending' | 'capturing' | 'verified' | 'too_far' | 'no_store_coords' | 'denied' | 'error'
  >('pending');
  const [locationDistance, setLocationDistance] = useState<number | null>(null);

  // Reference image expansion state
  const [expandedRefs, setExpandedRefs] = useState<Set<string>>(new Set());

  // Cancel/delete confirmation
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelDeleting, setCancelDeleting] = useState(false);

  // Caption modal state
  const [captionModalPhoto, setCaptionModalPhoto] = useState<{
    file: File;
    preview: string;
    criterionId: string | null;
    sectionId: string;
  } | null>(null);
  const [captionText, setCaptionText] = useState('');
  const [aiPhotoEnabled, setAiPhotoEnabled] = useState(false);
  const [analyzingPhoto, setAnalyzingPhoto] = useState(false);

  // Photo detail modal (view caption/analysis)
  const [viewingPhoto, setViewingPhoto] = useState<{
    image: string;
    caption: string;
    is_fresh?: boolean;
    exif_date?: string | null;
  } | null>(null);

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

        const [templateData, orgSettings] = await Promise.all([
          walkData.template ? getTemplate(orgId, walkData.template) : Promise.resolve(null),
          getOrgSettings(orgId).catch(() => null),
        ]);
        if (cancelled) return;
        if (templateData) setTemplate(templateData);
        if (orgSettings?.ai_photo_analysis) {
          setAiPhotoEnabled(true);
        }

        // Pre-populate scores and drivers from walk data
        if (walkData.scores && walkData.scores.length > 0) {
          const scoreMap: LocalScores = {};
          const driverMap: LocalDrivers = {};
          walkData.scores.forEach((s: Score) => {
            scoreMap[s.criterion] = s.points;
            if (s.driver_ids && s.driver_ids.length > 0) {
              driverMap[s.criterion] = s.driver_ids;
            } else if (s.driver) {
              // Legacy single driver fallback
              driverMap[s.criterion] = [s.driver];
            }
          });
          setLocalScores(scoreMap);
          setLocalDrivers(driverMap);
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

  // Capture GPS and start walk when data is loaded
  useEffect(() => {
    if (!walk || !orgId || !walkId) return;
    // Only capture location for scheduled walks that haven't started yet
    if (walk.status !== 'scheduled') {
      if (walk.location_verified) {
        setLocationStatus('verified');
        setLocationDistance(walk.location_distance_meters);
      } else if (walk.start_latitude != null) {
        setLocationStatus('too_far');
        setLocationDistance(walk.location_distance_meters);
      }
      return;
    }

    if (!navigator.geolocation) {
      setLocationStatus('error');
      return;
    }

    setLocationStatus('capturing');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const updated = await startWalk(
            orgId,
            walkId!,
            position.coords.latitude,
            position.coords.longitude,
          );
          setWalk(updated);
          if (updated.location_verified) {
            setLocationStatus('verified');
          } else if (updated.location_distance_meters != null) {
            setLocationStatus('too_far');
          } else {
            setLocationStatus('no_store_coords');
          }
          setLocationDistance(updated.location_distance_meters);
        } catch {
          // Still start the walk even if GPS call fails
          setLocationStatus('error');
        }
      },
      (err) => {
        console.warn('Geolocation denied or failed:', err.message);
        setLocationStatus('denied');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }, [walk?.status, orgId, walkId]); // eslint-disable-line react-hooks/exhaustive-deps

  const sections: Section[] = template?.sections || [];
  const section = sections[currentSection];
  const totalSections = sections.length;
  const isLastSection = currentSection === totalSections - 1;

  // Check if a section has all criteria scored
  const isSectionComplete = useCallback(
    (sec: Section): boolean => {
      if (!sec.criteria || sec.criteria.length === 0) return false;
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
    // Clear drivers if score is above 3
    if (points > 3) {
      setLocalDrivers((prev) => ({ ...prev, [criterionId]: [] }));
    }
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
  function handlePhotoClick(criterionId?: string | null) {
    pendingPhotoCriterionRef.current = criterionId || null;
    fileInputRef.current?.click();
  }

  function handlePhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    if (!section || !e.target.files?.length) return;

    const file = e.target.files[0];
    const preview = URL.createObjectURL(file);
    const criterionId = pendingPhotoCriterionRef.current;

    // Show caption modal before adding the photo
    setCaptionModalPhoto({
      file,
      preview,
      criterionId,
      sectionId: section.id,
    });
    setCaptionText('');

    // Reset the input so the same file can be re-selected
    e.target.value = '';
  }

  function handleCaptionConfirm() {
    if (!captionModalPhoto || !walk) return;
    const { file, preview, criterionId, sectionId } = captionModalPhoto;
    const caption = captionText.trim();

    // Add to local state immediately for preview
    const localPhoto: LocalPhoto = { file, preview, caption, criterionId };
    setLocalPhotos((prev) => ({
      ...prev,
      [sectionId]: [...(prev[sectionId] || []), localPhoto],
    }));

    setCaptionModalPhoto(null);
    setCaptionText('');

    // Start uploading immediately in the background (don't wait for section save)
    uploadSinglePhoto(walk.id, sectionId, localPhoto).then((result) => {
      if (result.success && result.uploaded) {
        // Move from local to uploaded
        setUploadedPhotos((prev) => ({
          ...prev,
          [sectionId]: [...(prev[sectionId] || []), result.uploaded!],
        }));
        // Remove from local photos
        setLocalPhotos((prev) => {
          const updated = { ...prev };
          const photos = updated[sectionId] || [];
          const idx = photos.findIndex((p) => p.file === file && p.preview === preview);
          if (idx >= 0) {
            URL.revokeObjectURL(photos[idx].preview);
            const remaining = [...photos];
            remaining.splice(idx, 1);
            if (remaining.length === 0) {
              delete updated[sectionId];
            } else {
              updated[sectionId] = remaining;
            }
          }
          return updated;
        });
      }
      // If failed, uploadSinglePhoto already adds to failedPhotos
    });
  }

  async function handleAnalyzePhoto() {
    if (!captionModalPhoto) return;
    setAnalyzingPhoto(true);
    try {
      // Find criterion and section names for context
      const sec = sections.find((s) => s.id === captionModalPhoto.sectionId);
      const crit = sec?.criteria.find((c) => c.id === captionModalPhoto.criterionId);
      const result = await analyzePhoto(
        orgId,
        captionModalPhoto.file,
        crit?.name,
        sec?.name,
        captionText.trim() || undefined,
        captionModalPhoto.criterionId || undefined
      );
      setCaptionText(result.analysis);

      // Auto-fill the score if AI suggested one and the criterion exists
      if (result.suggested_score && captionModalPhoto.criterionId) {
        handleScore(captionModalPhoto.criterionId, result.suggested_score);
      }
    } catch {
      // Silently fail - user can still type manually
    } finally {
      setAnalyzingPhoto(false);
    }
  }

  function handleCaptionCancel() {
    if (captionModalPhoto) {
      URL.revokeObjectURL(captionModalPhoto.preview);
    }
    setCaptionModalPhoto(null);
    setCaptionText('');
  }

  function handleRemoveLocalPhoto(sectionId: string, index: number) {
    setLocalPhotos((prev) => {
      const photos = [...(prev[sectionId] || [])];
      URL.revokeObjectURL(photos[index].preview);
      photos.splice(index, 1);
      return { ...prev, [sectionId]: photos };
    });
  }

  // Upload a single photo with retry logic
  async function uploadSinglePhoto(
    walkId: string,
    sectionId: string,
    photo: LocalPhoto,
    retryCount = 0
  ): Promise<{ success: boolean; uploaded?: WalkPhoto }> {
    const MAX_RETRIES = 2;
    try {
      const uploaded = await uploadWalkPhoto(
        orgId,
        walkId,
        sectionId,
        photo.file,
        photo.caption,
        photo.criterionId
      );
      return { success: true, uploaded };
    } catch (err) {
      if (retryCount < MAX_RETRIES) {
        // Wait briefly then retry
        await new Promise((r) => setTimeout(r, 1000 * (retryCount + 1)));
        return uploadSinglePhoto(walkId, sectionId, photo, retryCount + 1);
      }
      // Track as failed for manual retry
      setFailedPhotos((prev) => [
        ...prev,
        { ...photo, sectionId, retryCount: MAX_RETRIES },
      ]);
      return { success: false };
    }
  }

  // Upload all pending photos from ALL sections (not just current)
  async function uploadAllPendingPhotos(): Promise<{
    uploaded: number;
    failed: number;
  }> {
    if (!walk) return { uploaded: 0, failed: 0 };
    setUploadingPhotos(true);

    let uploadedCount = 0;
    let failedCount = 0;
    const sectionsToProcess = Object.entries(localPhotos);

    for (const [sectionId, photos] of sectionsToProcess) {
      const successfulIndices: number[] = [];

      for (let i = 0; i < photos.length; i++) {
        const result = await uploadSinglePhoto(walk.id, sectionId, photos[i]);
        if (result.success && result.uploaded) {
          uploadedCount++;
          successfulIndices.push(i);
          setUploadedPhotos((prev) => ({
            ...prev,
            [sectionId]: [...(prev[sectionId] || []), result.uploaded!],
          }));
        } else {
          failedCount++;
        }
      }

      // Remove successfully uploaded photos from local state
      if (successfulIndices.length > 0) {
        setLocalPhotos((prev) => {
          const updated = { ...prev };
          const remaining = (updated[sectionId] || []).filter(
            (_, idx) => !successfulIndices.includes(idx)
          );
          remaining.forEach(() => {}); // keep references
          // Revoke URLs for uploaded ones
          successfulIndices.forEach((idx) => {
            if (updated[sectionId]?.[idx]) {
              URL.revokeObjectURL(updated[sectionId][idx].preview);
            }
          });
          if (remaining.length === 0) {
            delete updated[sectionId];
          } else {
            updated[sectionId] = remaining;
          }
          return updated;
        });
      }
    }

    // Also retry any previously failed photos
    const currentFailed = [...failedPhotos];
    if (currentFailed.length > 0) {
      setFailedPhotos([]);
      for (const fp of currentFailed) {
        const result = await uploadSinglePhoto(walk.id, fp.sectionId, fp);
        if (result.success && result.uploaded) {
          uploadedCount++;
          setUploadedPhotos((prev) => ({
            ...prev,
            [fp.sectionId]: [...(prev[fp.sectionId] || []), result.uploaded!],
          }));
        } else {
          failedCount++;
        }
      }
    }

    setUploadingPhotos(false);
    return { uploaded: uploadedCount, failed: failedCount };
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
          ...(localDrivers[c.id]?.length ? { driver_ids: localDrivers[c.id] } : {}),
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

      // Upload photos for this section with retry logic
      const pendingPhotos = localPhotos[section.id] || [];
      const successfulIndices: number[] = [];

      for (let i = 0; i < pendingPhotos.length; i++) {
        const result = await uploadSinglePhoto(
          walk.id,
          section.id,
          pendingPhotos[i]
        );
        if (result.success && result.uploaded) {
          successfulIndices.push(i);
          setUploadedPhotos((prev) => ({
            ...prev,
            [section.id]: [...(prev[section.id] || []), result.uploaded!],
          }));
        }
      }

      // Only clear successfully uploaded photos
      if (successfulIndices.length > 0) {
        setLocalPhotos((prev) => {
          const updated = { ...prev };
          const remaining = (updated[section.id] || []).filter(
            (_, idx) => !successfulIndices.includes(idx)
          );
          successfulIndices.forEach((idx) => {
            if (updated[section.id]?.[idx]) {
              URL.revokeObjectURL(updated[section.id][idx].preview);
            }
          });
          if (remaining.length === 0) {
            delete updated[section.id];
          } else {
            updated[section.id] = remaining;
          }
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

  function scrollToTop() {
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleNext() {
    await saveCurrentSection();

    if (isLastSection) {
      // Before navigating to review, upload ALL pending photos from ALL sections
      const totalPending = Object.values(localPhotos).reduce(
        (sum, photos) => sum + photos.length,
        0
      ) + failedPhotos.length;

      if (totalPending > 0) {
        setSaveMessage(`Uploading ${totalPending} photo${totalPending !== 1 ? 's' : ''}...`);
        const result = await uploadAllPendingPhotos();
        if (result.failed > 0) {
          setSaveMessage(
            `${result.failed} photo${result.failed !== 1 ? 's' : ''} failed to upload. Tap "Retry" or continue to review.`
          );
          // Don't auto-navigate — let user see the error and decide
          return;
        }
      }

      navigate(`/walks/${walkId}/review`);
    } else {
      setCurrentSection((prev) => Math.min(prev + 1, totalSections - 1));
      scrollToTop();
    }
  }

  async function handlePrevious() {
    await saveCurrentSection();
    setCurrentSection((prev) => Math.max(prev - 1, 0));
    scrollToTop();
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
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                await saveCurrentSection();
                navigate('/evaluations');
              }}
              className="px-2.5 py-1 text-xs font-medium text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Exit
            </button>
            <button
              onClick={() => setShowCancelConfirm(true)}
              className="p-1 text-gray-400 hover:text-red-500 transition-colors"
              title="Discard evaluation"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
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
                  scrollToTop();
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
        <div className={`px-4 py-1.5 text-xs font-medium text-center ${
          saveMessage.includes('failed') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
        }`}>
          {saveMessage}
        </div>
      )}

      {/* Location verification banner */}
      {locationStatus !== 'pending' && (
        <div className={`px-4 py-1.5 text-xs font-medium flex items-center gap-2 ${
          locationStatus === 'verified'
            ? 'bg-green-50 text-green-700'
            : locationStatus === 'capturing'
              ? 'bg-blue-50 text-blue-700'
              : locationStatus === 'too_far'
                ? 'bg-amber-50 text-amber-700'
                : 'bg-gray-50 text-gray-500'
        }`}>
          {locationStatus === 'capturing' && (
            <>
              <div className="w-3 h-3 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
              Verifying location...
            </>
          )}
          {locationStatus === 'verified' && (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Location verified{locationDistance != null ? ` (${locationDistance}m from store)` : ''}
            </>
          )}
          {locationStatus === 'too_far' && (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Not at store location{locationDistance != null ? ` (${locationDistance}m away)` : ''}
            </>
          )}
          {locationStatus === 'denied' && (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              Location access denied
            </>
          )}
          {locationStatus === 'no_store_coords' && 'Store coordinates not configured'}
          {locationStatus === 'error' && 'Could not capture location'}
        </div>
      )}

      {/* Failed photos banner */}
      {failedPhotos.length > 0 && (
        <div className="px-4 py-2.5 bg-red-50 border-b border-red-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs text-red-700 font-medium">
                {failedPhotos.length} photo{failedPhotos.length !== 1 ? 's' : ''} failed to upload
              </span>
            </div>
            <button
              onClick={async () => {
                const result = await uploadAllPendingPhotos();
                if (result.failed === 0) {
                  setSaveMessage('All photos uploaded successfully!');
                  setTimeout(() => setSaveMessage(''), 3000);
                }
              }}
              disabled={uploadingPhotos}
              className="px-3 py-1 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50"
            >
              {uploadingPhotos ? 'Retrying...' : 'Retry'}
            </button>
          </div>
        </div>
      )}

      {/* Photo uploading indicator */}
      {uploadingPhotos && (
        <div className="px-4 py-1.5 bg-blue-50 text-blue-700 text-xs font-medium text-center flex items-center justify-center gap-2">
          <div className="w-3 h-3 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
          Uploading photos...
        </div>
      )}

      {/* Section content */}
      <div ref={contentRef} className="flex-1 px-4 py-4 overflow-y-auto">
        {/* Section header */}
        <div className="mb-5">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">{section.name} <InfoButton contextKey="walks-scoring" /></h2>
          {section.criteria.length > 0 && (
            <p className="text-sm text-gray-500 mt-0.5">
              {sectionScoredCount(section)} of {section.criteria.length} criteria
              scored
            </p>
          )}
        </div>

        {/* Criteria list */}
        {section.criteria.length > 0 ? (
          <div className="space-y-5">
            {section.criteria.map((criterion: Criterion) => {
              const currentScore = localScores[criterion.id];
              // Photos for this criterion
              const criterionUploadedPhotos = (uploadedPhotos[section.id] || []).filter(
                (p) => p.criterion === criterion.id
              );
              const criterionLocalPhotos = (localPhotos[section.id] || []).filter(
                (p) => p.criterionId === criterion.id
              );
              const criterionPhotoCount = criterionUploadedPhotos.length + criterionLocalPhotos.length;

              return (
                <div
                  key={criterion.id}
                  className="bg-white rounded-xl ring-1 ring-gray-900/5 p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-gray-900">
                        {criterion.name}
                      </h3>
                      {criterion.description && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {criterion.description}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handlePhotoClick(criterion.id)}
                      className="flex-shrink-0 ml-2 p-2 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 active:bg-primary-100 transition-colors relative"
                      title="Add photo"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {criterionPhotoCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary-600 text-white text-[10px] font-bold flex items-center justify-center">
                          {criterionPhotoCount}
                        </span>
                      )}
                    </button>
                  </div>

                  {/* SOP badge */}
                  {criterion.sop_links && criterion.sop_links.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1">
                      {criterion.sop_links.map((link) => (
                        <span
                          key={link.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                          title={link.relevant_excerpt || link.sop_title}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          {link.sop_title}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Reference image badge */}
                  {criterion.reference_images && criterion.reference_images.length > 0 && (
                    <div className="mb-2">
                      <button
                        onClick={() => setExpandedRefs((prev) => {
                          const next = new Set(prev);
                          if (next.has(criterion.id)) next.delete(criterion.id);
                          else next.add(criterion.id);
                          return next;
                        })}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100 transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Reference photo
                        <svg className={`w-3 h-3 transition-transform ${expandedRefs.has(criterion.id) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {expandedRefs.has(criterion.id) && (
                        <div className="mt-2 flex gap-3 overflow-x-auto pb-1">
                          {criterion.reference_images.map((ref) => (
                            <div key={ref.id} className="flex-shrink-0 w-40">
                              <img
                                src={ref.image}
                                alt="Ideal reference"
                                className="w-40 h-28 object-cover rounded-lg ring-1 ring-emerald-200"
                              />
                              <p className="text-[10px] text-emerald-700 font-medium mt-1">Ideal (5/5)</p>
                              {ref.description && (
                                <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">{ref.description}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

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

                  {/* Driver multi-select for low scores */}
                  {currentScore !== undefined && currentScore <= 3 && criterion.drivers && criterion.drivers.length > 0 && (
                    <div className="mt-2">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <p className="text-xs font-medium text-gray-500">Root causes (optional, select all that apply)</p>
                        <InfoButton contextKey="drivers-overview" />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {criterion.drivers.filter(d => d.is_active).map((driver) => {
                          const selected = (localDrivers[criterion.id] || []).includes(driver.id);
                          return (
                            <button
                              key={driver.id}
                              type="button"
                              onClick={() => {
                                setLocalDrivers((prev) => {
                                  const current = prev[criterion.id] || [];
                                  const next = selected
                                    ? current.filter((id) => id !== driver.id)
                                    : [...current, driver.id];
                                  return { ...prev, [criterion.id]: next };
                                });
                                setIsDirty(true);
                                scheduleAutoSave();
                              }}
                              className={`inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                selected
                                  ? 'bg-primary-100 text-primary-800 ring-1 ring-primary-300'
                                  : 'bg-gray-50 text-gray-600 ring-1 ring-gray-200 hover:bg-gray-100'
                              }`}
                            >
                              {selected && (
                                <svg className="w-3 h-3 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                              {driver.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Inline criterion photos */}
                  {(criterionUploadedPhotos.length > 0 || criterionLocalPhotos.length > 0) && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {criterionUploadedPhotos.map((photo) => (
                          <button
                            key={photo.id}
                            className="flex-shrink-0 text-left"
                            onClick={() => setViewingPhoto({ image: photo.image, caption: photo.caption || '', is_fresh: (photo as any).is_fresh, exif_date: (photo as any).exif_date })}
                          >
                            <div className="relative w-16 h-16 rounded-lg overflow-hidden ring-1 ring-gray-200">
                              <img src={photo.image} alt={photo.caption || ''} className="w-full h-full object-cover" />
                              {(photo as any).is_fresh === false && (
                                <div className="absolute top-0 left-0 right-0 bg-yellow-500 text-white text-[8px] text-center py-0.5 font-bold">Old photo</div>
                              )}
                            </div>
                            {photo.caption && (
                              <p className="text-[10px] text-gray-500 mt-0.5 w-16 truncate">{photo.caption}</p>
                            )}
                          </button>
                        ))}
                        {criterionLocalPhotos.map((photo, idx) => {
                          const globalIdx = (localPhotos[section.id] || []).indexOf(photo);
                          return (
                            <div key={`local-${idx}`} className="flex-shrink-0 relative">
                              <button
                                className="text-left"
                                onClick={() => setViewingPhoto({ image: photo.preview, caption: photo.caption || '' })}
                              >
                                <div className="w-16 h-16 rounded-lg overflow-hidden ring-1 ring-gray-200">
                                  <img src={photo.preview} alt="Pending" className="w-full h-full object-cover" />
                                </div>
                              </button>
                              <button
                                onClick={() => handleRemoveLocalPhoto(section.id, globalIdx)}
                                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center shadow"
                              >
                                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                              {photo.caption && (
                                <p className="text-[10px] text-gray-500 mt-0.5 w-16 truncate">{photo.caption}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}

        {/* Section Notes */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {section.criteria.length === 0
              ? 'Additional Detailed Notes'
              : 'Section Notes'}
          </label>
          {section.criteria.length === 0 && (
            <p className="text-xs text-gray-400 mb-2">
              Use this space to capture any overall observations, action items, or additional context about this store walk.
            </p>
          )}
          <textarea
            value={localNotes[section.id] || ''}
            onChange={(e) => handleNoteChange(section.id, e.target.value)}
            placeholder={
              section.criteria.length === 0
                ? 'Add overall observations, action items, or additional context...'
                : 'Add notes for this section...'
            }
            rows={section.criteria.length === 0 ? 6 : 3}
            className="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none transition-colors resize-none"
          />
        </div>

        {/* Photo upload section */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              Photos <InfoButton contextKey="walks-photos" />
              {sectionPhotoCount > 0 && (
                <span className="ml-1.5 text-xs text-gray-400">
                  ({sectionPhotoCount})
                </span>
              )}
            </label>
            <button
              onClick={() => handlePhotoClick()}
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

      {/* Caption modal */}
      {captionModalPhoto && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
          <div className="bg-white w-full sm:max-w-md sm:rounded-xl rounded-t-xl p-4 sm:p-6 shadow-xl">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Add Photo</h3>
            <div className="w-full h-48 rounded-lg overflow-hidden mb-3">
              <img
                src={captionModalPhoto.preview}
                alt="Preview"
                className="w-full h-full object-cover"
              />
            </div>

            {/* AI Analyze button (premium) */}
            {aiPhotoEnabled && (
              <button
                onClick={handleAnalyzePhoto}
                disabled={analyzingPhoto}
                className="w-full mb-2 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 disabled:opacity-50 transition-colors"
              >
                {analyzingPhoto ? (
                  <>
                    <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
                    Analyzing photo...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    Analyze with AI
                  </>
                )}
              </button>
            )}

            <textarea
              value={captionText}
              onChange={(e) => setCaptionText(e.target.value)}
              placeholder={aiPhotoEnabled ? 'Add a caption or tap "Analyze with AI" for auto-analysis...' : 'Add a caption or note about this photo...'}
              rows={captionText.length > 100 ? 6 : 3}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none resize-y"
              autoFocus
            />
            <div className="flex gap-3 mt-3">
              <button
                onClick={handleCaptionCancel}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCaptionConfirm}
                disabled={analyzingPhoto}
                className="flex-1 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
              >
                Add Photo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo detail modal */}
      {viewingPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setViewingPhoto(null)}
        >
          <div
            className="bg-white max-w-md w-full rounded-xl overflow-hidden shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={viewingPhoto.image}
              alt=""
              className="w-full max-h-[50vh] object-contain bg-gray-100"
            />
            {viewingPhoto.caption && (
              <div className="p-4">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{viewingPhoto.caption}</p>
              </div>
            )}
            <div className="px-4 pb-4">
              <button
                onClick={() => setViewingPhoto(null)}
                className="w-full rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Cancel/Delete confirmation modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowCancelConfirm(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Discard Evaluation?</h3>
                  <p className="text-sm text-gray-500 mt-0.5">This cannot be undone.</p>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                This will permanently delete this evaluation and all scores, notes, and photos associated with it.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowCancelConfirm(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Keep Working
              </button>
              <button
                onClick={async () => {
                  if (!walkId) return;
                  setCancelDeleting(true);
                  try {
                    await deleteWalk(orgId, walkId);
                    navigate('/evaluations');
                  } catch {
                    setError('Failed to delete evaluation.');
                    setShowCancelConfirm(false);
                  } finally {
                    setCancelDeleting(false);
                  }
                }}
                disabled={cancelDeleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {cancelDeleting ? 'Deleting...' : 'Discard'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
