import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getActionItem, updateActionItem, submitActionItemResponse, verifyActionItemPhoto, resolveActionItemWithPhoto, signOffActionItem, pushBackActionItem } from '../api/walks';
import { getOrgId } from '../utils/org';
import { useAuth } from '../hooks/useAuth';
import type { ActionItemDetail as ActionItemDetailType, ActionItemEvent } from '../types';

const PRIORITY_STYLES: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-gray-100 text-gray-600',
};

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  resolved: 'bg-green-100 text-green-700',
  pending_review: 'bg-violet-100 text-violet-700',
  approved: 'bg-green-100 text-green-700',
  dismissed: 'bg-gray-100 text-gray-500',
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  pending_review: 'Pending Review',
  approved: 'Approved',
  dismissed: 'Dismissed',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function formatResolutionTime(days: number): string {
  if (days < 0.04) return '< 1 hour';
  if (days < 1) return `${Math.round(days * 24)} hours`;
  if (days < 2) return '1 day';
  return `${Math.round(days)} days`;
}

const EVENT_ICONS: Record<string, { icon: string; color: string }> = {
  created: { icon: 'M12 6v6m0 0v6m0-6h6m-6 0H6', color: 'bg-blue-500' },
  assigned: { icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', color: 'bg-gray-400' },
  status_changed: { icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15', color: 'bg-blue-400' },
  response_added: { icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z', color: 'bg-gray-400' },
  photo_uploaded: { icon: 'M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z', color: 'bg-indigo-400' },
  ai_verified: { icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', color: 'bg-purple-400' },
  submitted_for_review: { icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'bg-violet-500' },
  approved: { icon: 'M5 13l4 4L19 7', color: 'bg-green-500' },
  rejected: { icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z', color: 'bg-red-500' },
};

function TimelineEvent({ event }: { event: ActionItemEvent }) {
  const config = EVENT_ICONS[event.event_type] || { icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', color: 'bg-gray-400' };
  const label = event.event_type === 'submitted_for_review' ? 'Submitted for Review'
    : event.event_type === 'status_changed' ? `Status: ${STATUS_LABELS[event.new_status] || event.new_status}`
    : event.event_type === 'rejected' ? 'Pushed Back'
    : STATUS_LABELS[event.event_type] || event.event_type.replace('_', ' ');

  return (
    <div className="relative flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`w-7 h-7 rounded-full ${config.color} flex items-center justify-center flex-shrink-0`}>
          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={config.icon} />
          </svg>
        </div>
        <div className="w-px flex-1 bg-gray-200 mt-1" />
      </div>
      <div className="pb-4 min-w-0">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium text-gray-900 capitalize">{label}</span>
          <span className="text-gray-400">&middot;</span>
          <span className="text-gray-400">{formatDateTime(event.created_at)}</span>
        </div>
        {event.actor_name && (
          <p className="text-xs text-gray-500 mt-0.5">by {event.actor_name}</p>
        )}
        {event.notes && (
          <p className="text-sm text-gray-700 mt-1 bg-gray-50 rounded-lg px-3 py-2">{event.notes}</p>
        )}
      </div>
    </div>
  );
}

export default function ActionItemDetail() {
  const { actionItemId } = useParams<{ actionItemId: string }>();
  const orgId = getOrgId();
  const { currentMembership, user } = useAuth();

  const [item, setItem] = useState<ActionItemDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [responseNotes, setResponseNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [error, setError] = useState('');
  const [showResolveFlow, setShowResolveFlow] = useState(false);
  const [resolveNotes, setResolveNotes] = useState('');
  const [resolveFile, setResolveFile] = useState<File | null>(null);
  const [resolvePreview, setResolvePreview] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [signOffNotes, setSignOffNotes] = useState('');
  const [pushBackNotes, setPushBackNotes] = useState('');
  const [showPushBack, setShowPushBack] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const resolveFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!orgId || !actionItemId) return;
    let cancelled = false;
    async function load() {
      try {
        const data = await getActionItem(orgId, actionItemId!);
        if (!cancelled) setItem(data);
      } catch {
        if (!cancelled) setError('Failed to load action item.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [orgId, actionItemId]);

  const handleStatusChange = async (newStatus: string) => {
    if (!item) return;
    setStatusUpdating(true);
    try {
      const updated = await updateActionItem(orgId, item.id, { status: newStatus });
      setItem(updated);
    } catch {
      setError('Failed to update status.');
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleSubmitResponse = async () => {
    if (!item || !responseNotes.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await submitActionItemResponse(orgId, item.id, responseNotes.trim());
      const updated = await getActionItem(orgId, item.id);
      setItem(updated);
      setResponseNotes('');
    } catch {
      setError('Failed to submit response.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !item) return;
    setVerifying(true);
    setVerifyResult(null);
    setError('');
    try {
      const result = await verifyActionItemPhoto(orgId, item.id, file);
      setVerifyResult(result.ai_analysis);
      const updated = await getActionItem(orgId, item.id);
      setItem(updated);
    } catch {
      setError('Failed to verify photo.');
    } finally {
      setVerifying(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleResolveFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setResolveFile(file);
      setResolvePreview(URL.createObjectURL(file));
    }
  };

  const handleResolveWithPhoto = async () => {
    if (!item || !resolveFile) return;
    setResolving(true);
    setError('');
    try {
      await resolveActionItemWithPhoto(orgId, item.id, resolveFile, resolveNotes.trim() || undefined);
      const updated = await getActionItem(orgId, item.id);
      setItem(updated);
      setShowResolveFlow(false);
      setResolveFile(null);
      setResolvePreview(null);
      setResolveNotes('');
    } catch {
      setError('Failed to resolve action item.');
    } finally {
      setResolving(false);
    }
  };

  const handleSignOff = async () => {
    if (!item) return;
    setReviewSubmitting(true);
    setError('');
    try {
      await signOffActionItem(orgId, item.id, signOffNotes.trim() || undefined);
      const updated = await getActionItem(orgId, item.id);
      setItem(updated);
      setSignOffNotes('');
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
        : undefined;
      setError(msg || 'Failed to sign off.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handlePushBack = async () => {
    if (!item || !pushBackNotes.trim()) return;
    setReviewSubmitting(true);
    setError('');
    try {
      await pushBackActionItem(orgId, item.id, pushBackNotes.trim());
      const updated = await getActionItem(orgId, item.id);
      setItem(updated);
      setPushBackNotes('');
      setShowPushBack(false);
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
        : undefined;
      setError(msg || 'Failed to push back.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-32" />
          <div className="h-40 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-6 text-center">
        <p className="text-sm text-gray-500">{error || 'Action item not found.'}</p>
        <Link to="/action-items" className="mt-3 inline-block text-sm font-medium text-primary-600">Back to Action Items</Link>
      </div>
    );
  }

  const isResolvable = !['resolved', 'pending_review', 'approved', 'dismissed'].includes(item.status);
  const canReview = item.status === 'pending_review'
    && currentMembership
    && ['regional_manager', 'admin', 'owner'].includes(currentMembership.role)
    && user?.id !== item.resolved_by;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 pb-24 max-w-3xl mx-auto">
      {/* Back link */}
      <Link to="/follow-ups" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Follow-Ups
      </Link>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-5 mb-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">{item.criterion_name}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{item.store_name}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${PRIORITY_STYLES[item.priority]}`}>
              {item.priority}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_STYLES[item.status]}`}>
              {STATUS_LABELS[item.status] || item.status.replace('_', ' ')}
            </span>
          </div>
        </div>

        {item.description && (
          <p className="mt-3 text-sm text-gray-700">{item.description}</p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          {item.score_points != null && item.criterion_max_points != null && (
            <div>
              <span className="text-gray-400">Score</span>
              <p className="font-medium text-gray-900">{item.score_points} / {item.criterion_max_points}</p>
            </div>
          )}
          {item.walk_date && (
            <div>
              <span className="text-gray-400">Walk Date</span>
              <p className="font-medium text-gray-900">{formatDate(item.walk_date)}</p>
            </div>
          )}
          {item.assigned_to_name && (
            <div>
              <span className="text-gray-400">Assigned To</span>
              <p className="font-medium text-gray-900">{item.assigned_to_name}</p>
            </div>
          )}
          {item.due_date && (
            <div>
              <span className="text-gray-400">Due Date</span>
              <p className={`font-medium ${new Date(item.due_date) < new Date() && isResolvable ? 'text-red-600' : 'text-gray-900'}`}>
                {formatDate(item.due_date)}
              </p>
            </div>
          )}
          <div>
            <span className="text-gray-400">Created By</span>
            <p className="font-medium text-gray-900">{item.created_by_name}</p>
          </div>
          {item.resolved_at && (
            <div>
              <span className="text-gray-400">Resolved At</span>
              <p className="font-medium text-gray-900">{formatDateTime(item.resolved_at)}</p>
            </div>
          )}
          {item.resolution_days != null && (
            <div>
              <span className="text-gray-400">Resolution Time</span>
              <p className="font-medium text-gray-900">{formatResolutionTime(item.resolution_days)}</p>
            </div>
          )}
          {item.reviewed_at && (
            <div>
              <span className="text-gray-400">Reviewed By</span>
              <p className="font-medium text-gray-900">{item.reviewed_by_name} &middot; {formatDateTime(item.reviewed_at)}</p>
            </div>
          )}
        </div>

        {/* Status action buttons */}
        {isResolvable && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex flex-wrap gap-2">
              {item.status === 'open' && (
                <button
                  onClick={() => handleStatusChange('in_progress')}
                  disabled={statusUpdating}
                  className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                >
                  Mark In Progress
                </button>
              )}
              <button
                onClick={() => setShowResolveFlow(true)}
                disabled={statusUpdating}
                className="rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Resolve with Photo
              </button>
              <button
                onClick={() => handleStatusChange('dismissed')}
                disabled={statusUpdating}
                className="rounded-lg bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
              >
                Dismiss
              </button>
            </div>

            {/* Resolve with photo flow */}
            {showResolveFlow && (
              <div className="mt-4 p-4 rounded-lg bg-green-50 border border-green-200">
                <h3 className="text-sm font-semibold text-green-900 mb-2">Upload Completion Photo</h3>
                <p className="text-xs text-green-700 mb-3">
                  Upload a photo showing the issue has been resolved. This will be sent to your regional manager for sign-off.
                </p>

                <input
                  ref={resolveFileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleResolveFileChange}
                  className="hidden"
                />

                {resolvePreview ? (
                  <div className="mb-3">
                    <img src={resolvePreview} alt="Completion preview" className="rounded-lg max-h-48 w-auto" />
                    <button
                      onClick={() => { setResolveFile(null); setResolvePreview(null); }}
                      className="mt-1 text-xs text-red-600 hover:text-red-700"
                    >
                      Remove photo
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => resolveFileRef.current?.click()}
                    className="mb-3 inline-flex items-center gap-1.5 rounded-lg border-2 border-dashed border-green-300 bg-white px-4 py-3 text-sm font-medium text-green-700 hover:bg-green-50 transition-colors w-full justify-center"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Take or Upload Photo
                  </button>
                )}

                <textarea
                  value={resolveNotes}
                  onChange={(e) => setResolveNotes(e.target.value)}
                  placeholder="Optional notes about the fix applied..."
                  rows={2}
                  className="block w-full rounded-lg border border-green-300 px-3 py-2 text-gray-900 shadow-sm focus:border-green-500 focus:ring-2 focus:ring-green-500/20 focus:outline-none text-sm mb-3"
                />

                <div className="flex gap-2">
                  <button
                    onClick={handleResolveWithPhoto}
                    disabled={!resolveFile || resolving}
                    className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-700 disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2"
                  >
                    {resolving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      'Submit for Review'
                    )}
                  </button>
                  <button
                    onClick={() => { setShowResolveFlow(false); setResolveFile(null); setResolvePreview(null); setResolveNotes(''); }}
                    className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reviewer Section — shown when item is pending review and user can review */}
      {canReview && (
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-violet-200 p-5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Review & Sign Off</h2>
              <p className="text-xs text-gray-500">
                {item.resolved_by_name ? `Resolved by ${item.resolved_by_name}` : 'Resolution submitted'}{item.resolved_at ? ` on ${formatDateTime(item.resolved_at)}` : ''}
              </p>
            </div>
          </div>

          {/* Show completion photos */}
          {item.responses.length > 0 && (() => {
            const lastResponse = item.responses[item.responses.length - 1];
            return lastResponse.photos.length > 0 ? (
              <div className="mb-4">
                <p className="text-xs font-medium text-gray-500 mb-2">Completion Photo</p>
                <div className="flex gap-3">
                  {item.original_photo_url && (
                    <div>
                      <p className="text-[10px] text-gray-400 mb-1">Before</p>
                      <img src={item.original_photo_url} alt="Original" className="rounded-lg h-40 w-auto ring-1 ring-gray-200" />
                    </div>
                  )}
                  {lastResponse.photos.map(p => (
                    <div key={p.id}>
                      <p className="text-[10px] text-gray-400 mb-1">After</p>
                      <img src={p.image} alt="Completion" className="rounded-lg h-40 w-auto ring-1 ring-gray-200" />
                    </div>
                  ))}
                </div>
                {lastResponse.notes && (
                  <p className="text-sm text-gray-700 mt-2 bg-gray-50 rounded-lg px-3 py-2">{lastResponse.notes}</p>
                )}
              </div>
            ) : null;
          })()}

          <textarea
            value={signOffNotes}
            onChange={(e) => setSignOffNotes(e.target.value)}
            placeholder="Optional review notes..."
            rows={2}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 focus:outline-none text-sm mb-3"
          />

          <div className="flex gap-2">
            <button
              onClick={handleSignOff}
              disabled={reviewSubmitting}
              className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-700 disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2"
            >
              {reviewSubmitting && !showPushBack ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Approving...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Approve & Sign Off
                </>
              )}
            </button>
            <button
              onClick={() => setShowPushBack(!showPushBack)}
              disabled={reviewSubmitting}
              className="rounded-lg bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 border border-amber-200 hover:bg-amber-100 disabled:opacity-50 transition-colors"
            >
              Push Back
            </button>
          </div>

          {showPushBack && (
            <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <p className="text-xs font-medium text-amber-800 mb-2">Provide feedback on what needs to be addressed:</p>
              <textarea
                value={pushBackNotes}
                onChange={(e) => setPushBackNotes(e.target.value)}
                placeholder="Describe what still needs attention..."
                rows={3}
                className="block w-full rounded-lg border border-amber-300 px-3 py-2 text-gray-900 shadow-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none text-sm mb-2"
              />
              <div className="flex gap-2">
                <button
                  onClick={handlePushBack}
                  disabled={!pushBackNotes.trim() || reviewSubmitting}
                  className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2"
                >
                  {reviewSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send Push-Back'
                  )}
                </button>
                <button
                  onClick={() => { setShowPushBack(false); setPushBackNotes(''); }}
                  className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Approved banner */}
      {item.status === 'approved' && item.reviewed_by_name && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-green-800">
              Approved by {item.reviewed_by_name}
            </p>
            <p className="text-xs text-green-600 mt-0.5">{item.reviewed_at ? formatDateTime(item.reviewed_at) : ''}</p>
            {item.review_notes && <p className="text-sm text-green-700 mt-1">{item.review_notes}</p>}
          </div>
        </div>
      )}

      {/* Pending review banner (for non-reviewers) */}
      {item.status === 'pending_review' && !canReview && (
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 mb-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-violet-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-violet-800">Awaiting Review</p>
            <p className="text-xs text-violet-600 mt-0.5">
              This item has been submitted for review and is awaiting sign-off from a manager.
            </p>
          </div>
        </div>
      )}

      {/* Original Photo */}
      {item.original_photo_url && (
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Original Photo</h2>
          <img src={item.original_photo_url} alt="Original" className="rounded-lg max-h-64 w-auto" />
        </div>
      )}

      {/* AI Photo Verification */}
      {isResolvable && (
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Verify with Photo</h2>
          <p className="text-xs text-gray-500 mb-3">Upload a photo to have AI verify if the issue has been resolved.</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleVerifyPhoto}
            className="hidden"
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={verifying}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-50 px-3 py-2 text-sm font-medium text-primary-700 hover:bg-primary-100 disabled:opacity-50"
          >
            {verifying ? (
              <>
                <div className="w-4 h-4 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Upload Verification Photo
              </>
            )}
          </button>
          {verifyResult && (
            <div className="mt-3 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
              <p className="font-medium text-xs text-blue-600 mb-1">AI Analysis</p>
              {verifyResult}
            </div>
          )}
        </div>
      )}

      {/* Submit Response */}
      {isResolvable && (
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Submit Response</h2>
          <textarea
            value={responseNotes}
            onChange={e => setResponseNotes(e.target.value)}
            placeholder="Describe the corrective action taken..."
            rows={3}
            className="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-gray-900 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none sm:text-sm"
          />
          <div className="flex justify-end mt-3">
            <button
              onClick={handleSubmitResponse}
              disabled={submitting || !responseNotes.trim()}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Submitting...' : 'Submit Response'}
            </button>
          </div>
        </div>
      )}

      {/* Response History */}
      {item.responses && item.responses.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Response History</h2>
          <div className="space-y-4">
            {item.responses.map(resp => (
              <div key={resp.id} className="border-l-2 border-gray-200 pl-3">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="font-medium text-gray-700">{resp.submitted_by_name}</span>
                  <span>&middot;</span>
                  <span>{formatDateTime(resp.created_at)}</span>
                </div>
                <p className="text-sm text-gray-700 mt-1">{resp.notes}</p>
                {resp.photos && resp.photos.length > 0 && (
                  <div className="flex gap-2 mt-2 overflow-x-auto">
                    {resp.photos.map(photo => (
                      <div key={photo.id} className="flex-shrink-0">
                        <img src={photo.image} alt={photo.caption || 'Response photo'} className="rounded-lg h-24 w-auto" />
                        {photo.ai_analysis && (
                          <p className="text-[10px] text-gray-400 mt-1 max-w-[120px] truncate">{photo.ai_analysis}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      {item.events && item.events.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Timeline</h2>
          <div>
            {item.events.map((event, i) => (
              <div key={event.id} className={i === item.events.length - 1 ? '[&_.w-px]:hidden' : ''}>
                <TimelineEvent event={event} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
