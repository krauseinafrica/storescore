import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  getAssessments,
  getAssessment,
  getAssessmentTemplates,
  createAssessment,
  submitAssessment,
  reviewAssessment,
  deleteAssessment,
  uploadAssessmentSubmission,
  updateAssessmentSubmission,
  createAssessmentActionItems,
  getStores,
} from '../api/walks';
import { getOrgId } from '../utils/org';
import type {
  SelfAssessment,
  SelfAssessmentTemplate,
  AssessmentSubmission,
  Store,
  SelfAssessmentStatus,
} from '../types';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-blue-100 text-blue-700',
  submitted: 'bg-amber-100 text-amber-700',
  reviewed: 'bg-green-100 text-green-700',
};

const RATING_STYLES: Record<string, string> = {
  good: 'bg-green-100 text-green-700',
  fair: 'bg-amber-100 text-amber-700',
  poor: 'bg-red-100 text-red-700',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function SelfAssessmentsContent() {
  const { user, hasRole } = useAuth();
  const orgId = getOrgId();
  const isManager = hasRole('store_manager');
  const isAdmin = hasRole('admin');
  const [searchParams, setSearchParams] = useSearchParams();

  const [assessments, setAssessments] = useState<SelfAssessment[]>([]);
  const [templates, setTemplates] = useState<SelfAssessmentTemplate[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<SelfAssessmentStatus | 'all'>('all');

  // Detail view — driven by URL search param ?assessment=<id>
  const selectedId = searchParams.get('assessment');
  const [detail, setDetail] = useState<SelfAssessment | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createTemplate, setCreateTemplate] = useState('');
  const [createStore, setCreateStore] = useState('');
  const [createDueDate, setCreateDueDate] = useState('');
  const [creating, setCreating] = useState(false);

  // Submission flow
  const [uploadingPromptId, setUploadingPromptId] = useState<string | null>(null);
  const [submissionCaption, setSubmissionCaption] = useState('');
  const [submissionRating, setSubmissionRating] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Edit existing submission
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [editRating, setEditRating] = useState('');
  const [editCaption, setEditCaption] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Review — per-submission reviewer overrides
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [reviewEdits, setReviewEdits] = useState<Record<string, { rating: string; notes: string }>>({});

  // Action item approval
  const [selectedActions, setSelectedActions] = useState<Set<string>>(new Set());
  const [createdActions, setCreatedActions] = useState<Set<string>>(new Set());
  const [actionEdits, setActionEdits] = useState<Record<string, { description: string; priority: string }>>({});
  const [creatingActions, setCreatingActions] = useState(false);
  const [createdActionCount, setCreatedActionCount] = useState(0);

  // Delete (detail panel)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Delete from list card
  const [listDeleteId, setListDeleteId] = useState<string | null>(null);
  const [listDeleting, setListDeleting] = useState(false);

  const [error, setError] = useState('');

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    async function load() {
      try {
        const params: Record<string, string> = {};
        if (activeTab !== 'all') params.status = activeTab;
        const [a, t, s] = await Promise.all([
          getAssessments(orgId, params),
          getAssessmentTemplates(orgId).catch(() => [] as SelfAssessmentTemplate[]),
          getStores(orgId).catch(() => [] as Store[]),
        ]);
        if (!cancelled) {
          setAssessments(a);
          setTemplates(t);
          setStores(s);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    setLoading(true);
    load();
    return () => { cancelled = true; };
  }, [orgId, activeTab]);

  // Load detail when URL has ?assessment=<id>
  useEffect(() => {
    if (selectedId && orgId && !detail) {
      loadDetail(selectedId);
    }
  }, [selectedId, orgId]);

  const loadDetail = async (id: string) => {
    setDetailLoading(true);
    setError('');
    try {
      const data = await getAssessment(orgId, id);
      setDetail(data);
    } catch {
      setError('Failed to load assessment.');
    } finally {
      setDetailLoading(false);
    }
  };

  const openDetail = (id: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('assessment', id);
      return next;
    });
    setDetail(null);
    setCreatedActions(new Set());
    setCreatedActionCount(0);
    setSelectedActions(new Set());
  };

  const closeDetail = () => {
    setDetail(null);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('assessment');
      return next;
    });
  };

  const handleCreate = async () => {
    if (!createTemplate || !createStore || !createDueDate) return;
    setCreating(true);
    setError('');
    try {
      const created = await createAssessment(orgId, {
        template: createTemplate,
        store: createStore,
        submitted_by: user?.id || '',
        due_date: createDueDate,
      });
      setAssessments(prev => [created, ...prev]);
      setShowCreate(false);
      setCreateTemplate('');
      setCreateStore('');
      setCreateDueDate('');
      openDetail(created.id);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create assessment.');
    } finally {
      setCreating(false);
    }
  };

  const [uploading, setUploading] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setPendingPreview(URL.createObjectURL(file));
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSaveSubmission = async () => {
    if (!pendingFile || !detail || !uploadingPromptId) return;
    setError('');
    setUploading(true);
    try {
      await uploadAssessmentSubmission(
        orgId,
        detail.id,
        uploadingPromptId,
        pendingFile,
        submissionCaption || undefined,
        submissionRating || undefined,
      );
      const updated = await getAssessment(orgId, detail.id);
      setDetail(updated);
      setUploadingPromptId(null);
      setSubmissionCaption('');
      setSubmissionRating('');
      setPendingFile(null);
      setPendingPreview(null);
    } catch {
      setError('Failed to upload submission.');
    } finally {
      setUploading(false);
    }
  };

  const startEditSub = (sub: AssessmentSubmission) => {
    setEditingSubId(sub.id);
    setEditRating(sub.self_rating || '');
    setEditCaption(sub.caption || '');
  };

  const handleSaveEdit = async () => {
    if (!detail || !editingSubId) return;
    setSavingEdit(true);
    setError('');
    try {
      await updateAssessmentSubmission(orgId, detail.id, editingSubId, {
        self_rating: editRating,
        caption: editCaption,
      });
      const updated = await getAssessment(orgId, detail.id);
      setDetail(updated);
      setEditingSubId(null);
    } catch {
      setError('Failed to update submission.');
    } finally {
      setSavingEdit(false);
    }
  };

  const [aiProcessing, setAiProcessing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-poll for AI results when viewing a submitted assessment without analysis
  useEffect(() => {
    if (!detail || !orgId) return;
    if (detail.status !== 'submitted') return;
    const hasAi = detail.submissions?.some(s => s.ai_analysis);
    if (hasAi || aiProcessing) return;

    // Start polling — this handles page refresh after submit
    setAiProcessing(true);
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const refreshed = await getAssessment(orgId, detail.id);
        const hasAiNow = refreshed.submissions?.some((s: AssessmentSubmission) => s.ai_analysis);
        if (hasAiNow || attempts >= 10) {
          if (pollRef.current) clearInterval(pollRef.current);
          setDetail(refreshed);
          setAiProcessing(false);
        }
      } catch {
        if (pollRef.current) clearInterval(pollRef.current);
        setAiProcessing(false);
      }
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [detail?.id, detail?.status]);

  const handleSubmit = async () => {
    if (!detail) return;
    setSubmitting(true);
    setError('');
    try {
      const updated = await submitAssessment(orgId, detail.id);
      setDetail(updated);
      setAssessments(prev => prev.map(a => a.id === detail.id ? { ...a, status: 'submitted' as SelfAssessmentStatus } : a));
      // The useEffect above will detect submitted + no AI and start polling automatically
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to submit assessment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReview = async () => {
    if (!detail) return;
    setReviewing(true);
    setError('');
    try {
      // Build per-submission review data
      const submissions = (detail.submissions || []).map(sub => {
        const edits = reviewEdits[sub.id];
        return {
          id: sub.id,
          ...(edits?.rating ? { reviewer_rating: edits.rating } : {}),
          ...(edits?.notes ? { reviewer_notes: edits.notes } : {}),
        };
      }).filter(s => s.reviewer_rating || s.reviewer_notes);

      await reviewAssessment(orgId, detail.id, submissions);
      // Reload to get updated data
      const refreshed = await getAssessment(orgId, detail.id);
      setDetail(refreshed);
      setAssessments(prev => prev.map(a => a.id === detail.id ? { ...a, status: 'reviewed' as SelfAssessmentStatus } : a));
      setReviewNotes('');
      setReviewEdits({});
    } catch {
      setError('Failed to review assessment.');
    } finally {
      setReviewing(false);
    }
  };

  const toggleAction = (key: string) => {
    setSelectedActions(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleApproveActions = async () => {
    if (!detail || selectedActions.size === 0) return;
    setCreatingActions(true);
    setError('');
    try {
      // Collect all selected action items, using edited values where available
      const items: Array<{ description: string; priority: string }> = [];
      for (const sub of (detail.submissions || [])) {
        if (!sub.ai_analysis) continue;
        try {
          const parsed = JSON.parse(sub.ai_analysis);
          (parsed.action_items || []).forEach((ai: { priority: string; action: string }, i: number) => {
            const key = `${sub.id}-${i}`;
            if (selectedActions.has(key)) {
              const edit = actionEdits[key];
              items.push({
                description: edit?.description ?? ai.action,
                priority: (edit?.priority ?? ai.priority)?.toLowerCase() || 'medium',
              });
            }
          });
        } catch { /* skip non-JSON */ }
      }
      if (items.length > 0) {
        const result = await createAssessmentActionItems(orgId, detail.id, items);
        setCreatedActionCount(prev => prev + result.count);
        setCreatedActions(prev => new Set([...prev, ...selectedActions]));
        setSelectedActions(new Set());
        // Refresh detail to get updated action_items_count
        const updated = await getAssessment(orgId, detail.id);
        setDetail(updated);
      }
    } catch {
      setError('Failed to create action items.');
    } finally {
      setCreatingActions(false);
    }
  };

  const handleDelete = async () => {
    if (!detail) return;
    setDeleting(true);
    setError('');
    try {
      await deleteAssessment(orgId, detail.id);
      setAssessments(prev => prev.filter(a => a.id !== detail.id));
      closeDetail();
      setShowDeleteConfirm(false);
    } catch {
      setError('Failed to delete assessment.');
    } finally {
      setDeleting(false);
    }
  };

  // Detail view
  if (selectedId) {
    if (detailLoading) {
      return (
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-32" />
          <div className="h-40 bg-gray-200 rounded" />
        </div>
      );
    }

    if (!detail) {
      return (
        <div className="text-center">
          <p className="text-sm text-gray-500">{error || 'Assessment not found.'}</p>
          <button onClick={closeDetail} className="mt-3 text-sm font-medium text-primary-600">Back</button>
        </div>
      );
    }

    const prompts = detail.prompts || [];
    const submissions = detail.submissions || [];
    const submissionsByPrompt = new Map<string, AssessmentSubmission>();
    submissions.forEach(s => submissionsByPrompt.set(s.prompt, s));

    return (
      <div className="max-w-3xl mx-auto">
        <button onClick={closeDetail} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Assessments
        </button>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {/* Assessment header */}
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-5 mb-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-900">{detail.template_name}</h1>
              <p className="text-sm text-gray-500 mt-0.5">{detail.store_name}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_STYLES[detail.status]}`}>
                {detail.status}
              </span>
              {isAdmin && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Delete assessment"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-gray-400">Submitted By</span>
              <p className="font-medium text-gray-900">{detail.submitted_by_name}</p>
            </div>
            <div>
              <span className="text-gray-400">Due Date</span>
              <p className="font-medium text-gray-900">{formatDate(detail.due_date)}</p>
            </div>
            {detail.submitted_at && (
              <div>
                <span className="text-gray-400">Submitted At</span>
                <p className="font-medium text-gray-900">{formatDate(detail.submitted_at)}</p>
              </div>
            )}
            {detail.reviewed_by_name && (
              <div>
                <span className="text-gray-400">Reviewed By</span>
                <p className="font-medium text-gray-900">{detail.reviewed_by_name}</p>
              </div>
            )}
          </div>
          {detail.reviewer_notes && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-400">Reviewer Notes</p>
              <p className="text-sm text-gray-700 mt-1">{detail.reviewer_notes}</p>
            </div>
          )}
        </div>

        {/* Prompt cards */}
        <div className="space-y-3">
          {prompts.map(prompt => {
            const sub = submissionsByPrompt.get(prompt.id);
            return (
              <div key={prompt.id} className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{prompt.name}</h3>
                    {prompt.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{prompt.description}</p>
                    )}
                  </div>
                  {sub ? (
                    <span className="text-[10px] font-semibold text-green-600">Uploaded</span>
                  ) : (
                    <span className="text-[10px] font-semibold text-gray-400">Pending</span>
                  )}
                </div>

                {sub ? (
                  <div className="mt-3">
                    {sub.is_video ? (
                      <video
                        src={sub.image}
                        controls
                        className="rounded-lg max-h-48 w-auto"
                        preload="metadata"
                      />
                    ) : (
                      <img src={sub.image} alt={sub.caption || prompt.name} className="rounded-lg max-h-48 w-auto" />
                    )}

                    {editingSubId === sub.id ? (
                      /* Inline edit mode */
                      <div className="mt-3 space-y-2">
                        {prompt.rating_type === 'three_scale' && (
                          <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">Self Rating</label>
                            <div className="flex gap-2">
                              {['good', 'fair', 'poor'].map(r => (
                                <button
                                  key={r}
                                  onClick={() => setEditRating(r)}
                                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                                    editRating === r ? RATING_STYLES[r] : 'bg-gray-100 text-gray-500'
                                  }`}
                                >
                                  {r.charAt(0).toUpperCase() + r.slice(1)}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        <input
                          value={editCaption}
                          onChange={e => setEditCaption(e.target.value)}
                          placeholder="Caption..."
                          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleSaveEdit}
                            disabled={savingEdit}
                            className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                          >
                            {savingEdit ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={() => setEditingSubId(null)}
                            className="text-xs text-gray-500 hover:text-gray-700"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Read-only display */
                      <>
                        {sub.caption && <p className="text-xs text-gray-500 mt-1">{sub.caption}</p>}
                        <div className="flex items-center gap-3 mt-2">
                          {sub.self_rating ? (
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${RATING_STYLES[sub.self_rating]}`}>
                              Self: {sub.self_rating}
                            </span>
                          ) : prompt.rating_type === 'three_scale' ? (
                            <span className="text-[10px] text-gray-400 italic">No self-rating</span>
                          ) : null}
                          {sub.ai_rating && (
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${RATING_STYLES[sub.ai_rating]}`}>
                              AI: {sub.ai_rating}
                            </span>
                          )}
                          {detail.status === 'pending' && (
                            <button
                              onClick={() => startEditSub(sub)}
                              className="text-[10px] text-primary-600 hover:text-primary-700 font-medium"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                        {detail.status === 'pending' && (
                          <button
                            onClick={() => { setUploadingPromptId(prompt.id); }}
                            className="mt-2 text-[10px] text-gray-400 hover:text-gray-600"
                          >
                            Re-upload photo
                          </button>
                        )}
                      </>
                    )}

                    {aiProcessing && !sub.ai_analysis && (
                      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-blue-500">
                        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                        Awaiting AI analysis
                      </div>
                    )}
                  </div>
                ) : detail.status === 'pending' ? (
                  <div className="mt-3">
                    {uploadingPromptId === prompt.id ? (
                      <div className="space-y-2">
                        <input
                          ref={fileRef}
                          type="file"
                          accept="image/*,video/mp4,video/quicktime"
                          onChange={handleFileSelect}
                          className="hidden"
                        />

                        {/* File preview or picker */}
                        {pendingPreview ? (
                          <div className="mb-1">
                            {pendingFile?.type.startsWith('video/') ? (
                              <video src={pendingPreview} controls className="rounded-lg max-h-48 w-auto" preload="metadata" />
                            ) : (
                              <img src={pendingPreview} alt="Preview" className="rounded-lg max-h-48 w-auto" />
                            )}
                            <button
                              onClick={() => { setPendingFile(null); setPendingPreview(null); }}
                              className="mt-1 text-xs text-red-600 hover:text-red-700"
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => fileRef.current?.click()}
                            className="inline-flex items-center gap-1.5 rounded-lg border-2 border-dashed border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors w-full justify-center"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Select Photo or Video
                          </button>
                        )}

                        {/* Rating */}
                        {prompt.rating_type === 'three_scale' && (
                          <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">Self Rating</label>
                            <div className="flex gap-2">
                              {['good', 'fair', 'poor'].map(r => (
                                <button
                                  key={r}
                                  onClick={() => setSubmissionRating(r)}
                                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                                    submissionRating === r ? RATING_STYLES[r] : 'bg-gray-100 text-gray-500'
                                  }`}
                                >
                                  {r.charAt(0).toUpperCase() + r.slice(1)}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Caption */}
                        <input
                          value={submissionCaption}
                          onChange={e => setSubmissionCaption(e.target.value)}
                          placeholder="Optional caption..."
                          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
                        />

                        {/* Action buttons */}
                        {uploading && uploadingPromptId === prompt.id ? (
                          <div className="flex items-center gap-3 py-2">
                            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                              <svg className="animate-spin h-4 w-4 text-primary-600" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-gray-700">Uploading...</p>
                              <div className="mt-1 h-1.5 w-32 bg-gray-200 rounded-full overflow-hidden">
                                <div className="h-full bg-primary-500 rounded-full animate-pulse" style={{ width: '70%' }} />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={handleSaveSubmission}
                              disabled={!pendingFile}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => { setUploadingPromptId(null); setSubmissionCaption(''); setSubmissionRating(''); setPendingFile(null); setPendingPreview(null); }}
                              className="text-xs text-gray-500 hover:text-gray-700"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => setUploadingPromptId(prompt.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add Photo
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Submit button */}
        {detail.status === 'pending' && submissions.length > 0 && (
          <div className="mt-4">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  Submitting...
                </>
              ) : (
                <>Submit Assessment ({submissions.length}/{prompts.length} photos)</>
              )}
            </button>
          </div>
        )}

        {/* AI Summary + Review section */}
        {(detail.status === 'submitted' || detail.status === 'reviewed') && (
          <>
            {/* AI findings summary */}
            {submissions.some(s => s.ai_analysis) && (
              <div className="mt-4 space-y-4">
                {submissions.filter(s => s.ai_analysis).map(s => {
                  const promptName = prompts.find(p => p.id === s.prompt)?.name || s.prompt_name;
                  let parsed: { summary?: string; findings?: string[]; action_items?: { priority: string; action: string }[] } | null = null;
                  try { parsed = JSON.parse(s.ai_analysis); } catch { /* legacy plain text */ }

                  return (
                    <div key={s.id} className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 overflow-hidden">
                      {/* Header */}
                      <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611l-.772.13a17.935 17.935 0 01-6.363 0l-.772-.13c-1.717-.293-2.3-2.379-1.067-3.61L12.6 15.3" />
                          </svg>
                          <span className="text-sm font-semibold text-gray-900">AI Analysis — {promptName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {s.self_rating && (
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${RATING_STYLES[s.self_rating]}`}>
                              Self: {s.self_rating}
                            </span>
                          )}
                          {s.ai_rating && (
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${RATING_STYLES[s.ai_rating]}`}>
                              AI: {s.ai_rating}
                            </span>
                          )}
                          {s.self_rating && s.ai_rating && s.self_rating !== s.ai_rating && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-[10px] font-semibold text-amber-600">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                              </svg>
                              Mismatch
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="p-5 space-y-4">
                        {/* Reviewer rating override (shown if set, or editable for admins) */}
                        {(s.reviewer_rating || (isAdmin && (detail.status === 'submitted' || detail.status === 'reviewed'))) && (
                          <div className="rounded-lg bg-violet-50 border border-violet-200 p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <svg className="w-4 h-4 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                              <span className="text-xs font-semibold text-violet-700">Reviewer Override</span>
                              {s.reviewed_by_name && (
                                <span className="text-[10px] text-violet-500">by {s.reviewed_by_name}</span>
                              )}
                            </div>
                            {isAdmin && (detail.status === 'submitted' || detail.status === 'reviewed') ? (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <label className="text-xs text-violet-600 font-medium">Rating:</label>
                                  <select
                                    value={reviewEdits[s.id]?.rating ?? s.reviewer_rating ?? ''}
                                    onChange={e => setReviewEdits(prev => ({
                                      ...prev,
                                      [s.id]: { ...(prev[s.id] || { rating: '', notes: '' }), rating: e.target.value }
                                    }))}
                                    className="text-xs rounded border-violet-300 py-0.5 px-1.5 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20"
                                  >
                                    <option value="">Same as AI</option>
                                    <option value="good">GOOD</option>
                                    <option value="fair">FAIR</option>
                                    <option value="poor">POOR</option>
                                  </select>
                                  {(reviewEdits[s.id]?.rating || s.reviewer_rating) && (
                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${RATING_STYLES[(reviewEdits[s.id]?.rating || s.reviewer_rating) as keyof typeof RATING_STYLES] || ''}`}>
                                      {(reviewEdits[s.id]?.rating || s.reviewer_rating || '').toUpperCase()}
                                    </span>
                                  )}
                                </div>
                                <textarea
                                  value={reviewEdits[s.id]?.notes ?? s.reviewer_notes ?? ''}
                                  onChange={e => setReviewEdits(prev => ({
                                    ...prev,
                                    [s.id]: { ...(prev[s.id] || { rating: '', notes: '' }), notes: e.target.value }
                                  }))}
                                  placeholder="Add commentary — agree/disagree with AI, additional observations..."
                                  rows={2}
                                  className="block w-full rounded-lg border border-violet-200 px-2.5 py-1.5 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20 focus:outline-none bg-white"
                                />
                              </div>
                            ) : s.reviewer_rating ? (
                              <div>
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${RATING_STYLES[s.reviewer_rating]}`}>
                                  Reviewer: {s.reviewer_rating.toUpperCase()}
                                </span>
                                {s.reviewer_notes && (
                                  <p className="text-sm text-violet-700 mt-1">{s.reviewer_notes}</p>
                                )}
                              </div>
                            ) : null}
                          </div>
                        )}

                        {parsed ? (
                          <>
                            {/* Summary */}
                            {parsed.summary && (
                              <p className="text-sm text-gray-700 leading-relaxed">{parsed.summary}</p>
                            )}

                            {/* Findings */}
                            {parsed.findings && parsed.findings.length > 0 && (
                              <div>
                                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Key Findings</h4>
                                <ul className="space-y-1.5">
                                  {parsed.findings.map((f, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                                      {f}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Action Items with approval checkboxes + inline editing */}
                            {parsed.action_items && parsed.action_items.length > 0 && (
                              <div>
                                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                  Suggested Action Items
                                  {detail.status === 'submitted' && (
                                    <span className="ml-2 text-gray-400 normal-case tracking-normal font-normal">— select and edit before creating</span>
                                  )}
                                </h4>
                                <div className="space-y-2">
                                  {parsed.action_items.map((item: { priority: string; action: string }, i: number) => {
                                    const prioStyles: Record<string, string> = {
                                      HIGH: 'bg-red-100 text-red-700',
                                      MEDIUM: 'bg-amber-100 text-amber-700',
                                      LOW: 'bg-gray-100 text-gray-600',
                                    };
                                    const actionKey = `${s.id}-${i}`;
                                    const isCreated = createdActions.has(actionKey);
                                    const isSelected = selectedActions.has(actionKey);
                                    const edit = actionEdits[actionKey];
                                    const currentPrio = (edit?.priority ?? item.priority)?.toUpperCase() || 'LOW';
                                    const currentDesc = edit?.description ?? item.action;
                                    const canEdit = detail.status === 'submitted' && !isCreated;
                                    return (
                                      <div key={i} className={`rounded-lg transition-colors ${isCreated ? 'bg-green-50 ring-1 ring-green-200' : isSelected ? 'bg-primary-50 ring-1 ring-primary-200' : 'hover:bg-gray-50'}`}>
                                        <div className="flex items-start gap-2.5 p-2 cursor-pointer" onClick={() => canEdit && toggleAction(actionKey)}>
                                          {detail.status === 'submitted' && (
                                            <input
                                              type="checkbox"
                                              checked={isCreated || isSelected}
                                              disabled={isCreated}
                                              onChange={() => canEdit && toggleAction(actionKey)}
                                              onClick={e => e.stopPropagation()}
                                              className={`mt-0.5 h-4 w-4 rounded border-gray-300 focus:ring-primary-500 ${isCreated ? 'text-green-600' : 'text-primary-600'}`}
                                            />
                                          )}
                                          {isCreated ? (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold flex-shrink-0 mt-0.5 bg-green-100 text-green-700">
                                              CREATED
                                            </span>
                                          ) : canEdit && isSelected ? (
                                            <select
                                              value={currentPrio}
                                              onClick={e => e.stopPropagation()}
                                              onChange={e => setActionEdits(prev => ({ ...prev, [actionKey]: { description: currentDesc, priority: e.target.value } }))}
                                              className={`text-[10px] font-semibold rounded px-1.5 py-0.5 border-0 ${prioStyles[currentPrio] || prioStyles.LOW}`}
                                            >
                                              <option value="HIGH">HIGH</option>
                                              <option value="MEDIUM">MEDIUM</option>
                                              <option value="LOW">LOW</option>
                                            </select>
                                          ) : (
                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold flex-shrink-0 mt-0.5 ${prioStyles[currentPrio] || prioStyles.LOW}`}>
                                              {currentPrio}
                                            </span>
                                          )}
                                          {!isSelected || !canEdit ? (
                                            <span className="text-sm text-gray-700">{currentDesc}</span>
                                          ) : null}
                                        </div>
                                        {canEdit && isSelected && (
                                          <div className="px-2 pb-2 pl-9">
                                            <textarea
                                              value={currentDesc}
                                              onClick={e => e.stopPropagation()}
                                              onChange={e => setActionEdits(prev => ({ ...prev, [actionKey]: { description: e.target.value, priority: currentPrio } }))}
                                              rows={2}
                                              className="block w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-700 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20 focus:outline-none"
                                            />
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          /* Legacy plain-text fallback */
                          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{s.ai_analysis}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Approve action items button */}
            {detail.status === 'submitted' && selectedActions.size > 0 && (
              <div className="mt-4 bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4 flex items-center justify-between">
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">{selectedActions.size}</span> action item{selectedActions.size !== 1 ? 's' : ''} selected
                </p>
                <button
                  onClick={handleApproveActions}
                  disabled={creatingActions}
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {creatingActions ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      Creating...
                    </>
                  ) : (
                    <>Create Action Items</>
                  )}
                </button>
              </div>
            )}

            {/* Success message after creating action items */}
            {createdActionCount > 0 && (
              <div className="mt-4 rounded-xl bg-green-50 border border-green-200 p-4 flex items-center gap-3">
                <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-green-800">{createdActionCount} action item{createdActionCount !== 1 ? 's' : ''} created</p>
                  <p className="text-xs text-green-600 mt-0.5">Assigned to the store manager. View them on the <a href="/follow-ups#action-items" className="underline font-medium">Follow-ups page</a>.</p>
                </div>
              </div>
            )}

            {aiProcessing && !submissions.some(s => s.ai_analysis) && (
              <div className="mt-4 bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-5">
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <svg className="animate-spin h-4 w-4 text-blue-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-700">AI is analyzing submitted photos...</p>
                    <p className="text-xs text-gray-400 mt-0.5">This usually takes 5-15 seconds.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Review controls for admins */}
            {(detail.status === 'submitted' || detail.status === 'reviewed') && isAdmin && (
              <div className="mt-4 bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-2">
                  {detail.status === 'reviewed' ? 'Update Review' : 'Review Assessment'}
                </h2>
                <p className="text-xs text-gray-500 mb-3">
                  Override AI ratings and add commentary per submission above, then finalize here.
                </p>
                <div className="flex justify-end">
                  <button
                    onClick={handleReview}
                    disabled={reviewing}
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    {reviewing ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                        Saving...
                      </>
                    ) : detail.status === 'reviewed' ? 'Update Review' : 'Mark as Reviewed'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Delete confirmation modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowDeleteConfirm(false)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
              <div className="px-6 py-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">Delete Assessment</h3>
                    <p className="text-sm text-gray-500 mt-0.5">This cannot be undone.</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600">
                  Delete <strong>{detail.template_name}</strong> for {detail.store_name}?
                  Any linked action items will be preserved and marked as "assessment removed."
                </p>
              </div>
              <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
                <button onClick={() => setShowDeleteConfirm(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // List view
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          Photo-based store assessments with AI evaluation.
        </p>
        {(isAdmin || isManager) && (
          <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">New Assessment</span>
          </button>
        )}
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {(['all', 'pending', 'submitted', 'reviewed'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === tab
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab === 'all' ? 'All' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-gray-200 rounded-xl" />
          ))}
        </div>
      ) : assessments.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-8 text-center">
          <svg className="w-12 h-12 text-gray-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          </svg>
          <p className="mt-3 text-sm text-gray-500">No self-assessments yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {assessments.map(a => (
            <div
              key={a.id}
              className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4 hover:shadow-md transition-shadow"
            >
              <button
                onClick={() => openDetail(a.id)}
                className="block w-full text-left"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">{a.template_name}</h3>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${STATUS_STYLES[a.status]}`}>
                        {a.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {a.store_name} &middot; By: {a.submitted_by_name}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Due: {formatDate(a.due_date)}
                      {a.submission_count !== undefined && ` \u00B7 ${a.submission_count} photo${a.submission_count !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <svg className="w-4 h-4 text-gray-400 ml-2 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
              {a.status === 'pending' && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => openDetail(a.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Continue
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => setListDeleteId(a.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">New Self-Assessment</h2>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Template</label>
                <select value={createTemplate} onChange={e => setCreateTemplate(e.target.value)} className="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-gray-900 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none sm:text-sm">
                  <option value="">Select template...</option>
                  {templates.filter(t => t.is_active).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Store</label>
                <select value={createStore} onChange={e => setCreateStore(e.target.value)} className="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-gray-900 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none sm:text-sm">
                  <option value="">Select store...</option>
                  {stores.filter(s => s.is_active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                <input type="date" value={createDueDate} onChange={e => setCreateDueDate(e.target.value)} className="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-gray-900 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none sm:text-sm" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowCreate(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={handleCreate} disabled={creating || !createTemplate || !createStore || !createDueDate} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50 transition-colors">
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List-level delete confirmation */}
      {listDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setListDeleteId(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Delete Assessment</h3>
                  <p className="text-sm text-gray-500 mt-0.5">This cannot be undone.</p>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                Delete <strong>{assessments.find(a => a.id === listDeleteId)?.template_name}</strong> for {assessments.find(a => a.id === listDeleteId)?.store_name}?
              </p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setListDeleteId(null)} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
              <button
                onClick={async () => {
                  setListDeleting(true);
                  try {
                    await deleteAssessment(orgId, listDeleteId);
                    setAssessments(prev => prev.filter(a => a.id !== listDeleteId));
                    setListDeleteId(null);
                  } catch {
                    setError('Failed to delete assessment.');
                  } finally {
                    setListDeleting(false);
                  }
                }}
                disabled={listDeleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {listDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function SelfAssessments() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 pb-24">
      <SelfAssessmentsContent />
    </div>
  );
}
