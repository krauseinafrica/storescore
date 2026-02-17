import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import InfoButton from '../components/InfoButton';
import {
  getAssessments,
  getAssessment,
  getAssessmentTemplates,
  createAssessment,
  submitAssessment,
  reviewAssessment,
  uploadAssessmentSubmission,
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

export default function SelfAssessments() {
  const { user, hasRole } = useAuth();
  const orgId = getOrgId();
  const isManager = hasRole('store_manager');
  const isAdmin = hasRole('admin');

  const [assessments, setAssessments] = useState<SelfAssessment[]>([]);
  const [templates, setTemplates] = useState<SelfAssessmentTemplate[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<SelfAssessmentStatus | 'all'>('all');

  // Detail view
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
  const fileRef = useRef<HTMLInputElement>(null);

  // Review
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewing, setReviewing] = useState(false);

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

  const loadDetail = async (id: string) => {
    setSelectedId(id);
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
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create assessment.');
    } finally {
      setCreating(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !detail || !uploadingPromptId) return;
    setError('');
    try {
      await uploadAssessmentSubmission(
        orgId,
        detail.id,
        uploadingPromptId,
        file,
        submissionCaption || undefined,
        submissionRating || undefined,
      );
      // Reload detail
      const updated = await getAssessment(orgId, detail.id);
      setDetail(updated);
      setUploadingPromptId(null);
      setSubmissionCaption('');
      setSubmissionRating('');
    } catch {
      setError('Failed to upload submission.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!detail) return;
    setError('');
    try {
      const updated = await submitAssessment(orgId, detail.id);
      setDetail(updated);
      setAssessments(prev => prev.map(a => a.id === detail.id ? { ...a, status: 'submitted' as SelfAssessmentStatus } : a));
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to submit assessment.');
    }
  };

  const handleReview = async () => {
    if (!detail) return;
    setReviewing(true);
    setError('');
    try {
      const updated = await reviewAssessment(orgId, detail.id, reviewNotes);
      setDetail(updated);
      setAssessments(prev => prev.map(a => a.id === detail.id ? { ...a, status: 'reviewed' as SelfAssessmentStatus } : a));
      setReviewNotes('');
    } catch {
      setError('Failed to review assessment.');
    } finally {
      setReviewing(false);
    }
  };

  // Detail view
  if (selectedId) {
    if (detailLoading) {
      return (
        <div className="px-4 sm:px-6 lg:px-8 py-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 rounded w-32" />
            <div className="h-40 bg-gray-200 rounded" />
          </div>
        </div>
      );
    }

    if (!detail) {
      return (
        <div className="px-4 sm:px-6 lg:px-8 py-6 text-center">
          <p className="text-sm text-gray-500">{error || 'Assessment not found.'}</p>
          <button onClick={() => setSelectedId(null)} className="mt-3 text-sm font-medium text-primary-600">Back</button>
        </div>
      );
    }

    const prompts = detail.prompts || [];
    const submissions = detail.submissions || [];
    const submissionsByPrompt = new Map<string, AssessmentSubmission>();
    submissions.forEach(s => submissionsByPrompt.set(s.prompt, s));

    return (
      <div className="px-4 sm:px-6 lg:px-8 py-6 pb-24 max-w-3xl mx-auto">
        <button onClick={() => { setSelectedId(null); setDetail(null); }} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
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
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_STYLES[detail.status]}`}>
              {detail.status}
            </span>
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
                    <img src={sub.image} alt={sub.caption || prompt.name} className="rounded-lg max-h-48 w-auto" />
                    {sub.caption && <p className="text-xs text-gray-500 mt-1">{sub.caption}</p>}
                    <div className="flex gap-3 mt-2">
                      {sub.self_rating && (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${RATING_STYLES[sub.self_rating]}`}>
                          Self: {sub.self_rating}
                        </span>
                      )}
                      {sub.ai_rating && (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${RATING_STYLES[sub.ai_rating]}`}>
                          AI: {sub.ai_rating}
                        </span>
                      )}
                    </div>
                    {sub.ai_analysis && (
                      <div className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">
                        {sub.ai_analysis}
                      </div>
                    )}
                  </div>
                ) : detail.status === 'pending' ? (
                  <div className="mt-3">
                    {uploadingPromptId === prompt.id ? (
                      <div className="space-y-2">
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
                        <input
                          value={submissionCaption}
                          onChange={e => setSubmissionCaption(e.target.value)}
                          placeholder="Optional caption..."
                          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
                        />
                        <input
                          ref={fileRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => fileRef.current?.click()}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Take/Upload Photo
                          </button>
                          <button
                            onClick={() => { setUploadingPromptId(null); setSubmissionCaption(''); setSubmissionRating(''); }}
                            className="text-xs text-gray-500 hover:text-gray-700"
                          >
                            Cancel
                          </button>
                        </div>
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
              className="w-full rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors"
            >
              Submit Assessment ({submissions.length}/{prompts.length} photos)
            </button>
          </div>
        )}

        {/* Review section for admins/regional managers */}
        {detail.status === 'submitted' && isAdmin && (
          <div className="mt-4 bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Review Assessment</h2>
            <textarea
              value={reviewNotes}
              onChange={e => setReviewNotes(e.target.value)}
              placeholder="Optional reviewer notes..."
              rows={3}
              className="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
            />
            <div className="flex justify-end mt-3">
              <button
                onClick={handleReview}
                disabled={reviewing}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {reviewing ? 'Reviewing...' : 'Mark as Reviewed'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // List view
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 pb-24">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">Self-Assessments <InfoButton contextKey="self-assessments-overview" /></h1>
          <p className="text-sm text-gray-500 mt-0.5">Photo-based store assessments with AI evaluation.</p>
        </div>
        {(isAdmin || isManager) && (
          <button onClick={() => setShowCreate(true)} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors">
            New Assessment
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
            <button
              key={a.id}
              onClick={() => loadDetail(a.id)}
              className="block w-full text-left bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4 hover:shadow-md transition-shadow active:bg-gray-50"
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
                    {a.submission_count !== undefined && ` &middot; ${a.submission_count} photo${a.submission_count !== 1 ? 's' : ''}`}
                  </p>
                </div>
                <svg className="w-4 h-4 text-gray-400 ml-2 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
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
    </div>
  );
}
