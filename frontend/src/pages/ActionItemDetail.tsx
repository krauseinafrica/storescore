import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getActionItem, updateActionItem, submitActionItemResponse, verifyActionItemPhoto } from '../api/walks';
import { getOrgId } from '../utils/org';
import type { ActionItemDetail as ActionItemDetailType } from '../types';

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
  dismissed: 'bg-gray-100 text-gray-500',
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

export default function ActionItemDetail() {
  const { actionItemId } = useParams<{ actionItemId: string }>();
  const orgId = getOrgId();

  const [item, setItem] = useState<ActionItemDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [responseNotes, setResponseNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

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
      // Reload to get updated responses
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
      // Reload to get updated photos
      const updated = await getActionItem(orgId, item.id);
      setItem(updated);
    } catch {
      setError('Failed to verify photo.');
    } finally {
      setVerifying(false);
      if (fileRef.current) fileRef.current.value = '';
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

  const isResolvable = item.status !== 'resolved' && item.status !== 'dismissed';

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 pb-24 max-w-3xl mx-auto">
      {/* Back link */}
      <Link to="/action-items" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Action Items
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
              {item.status.replace('_', ' ')}
            </span>
          </div>
        </div>

        {item.description && (
          <p className="mt-3 text-sm text-gray-700">{item.description}</p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-gray-400">Score</span>
            <p className="font-medium text-gray-900">{item.score_points} / {item.criterion_max_points}</p>
          </div>
          <div>
            <span className="text-gray-400">Walk Date</span>
            <p className="font-medium text-gray-900">{formatDate(item.walk_date)}</p>
          </div>
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
        </div>

        {/* Status action buttons */}
        {isResolvable && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-2">
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
              onClick={() => handleStatusChange('resolved')}
              disabled={statusUpdating}
              className="rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
            >
              Mark Resolved
            </button>
            <button
              onClick={() => handleStatusChange('dismissed')}
              disabled={statusUpdating}
              className="rounded-lg bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

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
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-5">
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
    </div>
  );
}
