import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getSOPDocument, updateSOPLink, deleteSOPLink, analyzeSOPDocument } from '../api/walks';
import { getOrgId } from '../utils/org';
import type { SOPDocument, SOPCriterionLink } from '../types';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const FILE_TYPE_STYLES: Record<string, string> = {
  pdf: 'bg-red-100 text-red-700',
  docx: 'bg-blue-100 text-blue-700',
  doc: 'bg-blue-100 text-blue-700',
  txt: 'bg-gray-100 text-gray-600',
};

export default function SOPDocumentDetail() {
  const { sopId } = useParams<{ sopId: string }>();
  const orgId = getOrgId();

  const [doc, setDoc] = useState<SOPDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId || !sopId) return;
    let cancelled = false;
    async function load() {
      try {
        const data = await getSOPDocument(orgId, sopId!);
        if (!cancelled) setDoc(data);
      } catch {
        if (!cancelled) setError('Failed to load SOP document.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [orgId, sopId]);

  const handleAnalyze = async () => {
    if (!doc) return;
    setAnalyzing(true);
    setError('');
    try {
      await analyzeSOPDocument(orgId, doc.id);
      // Reload to get updated criterion links
      const updated = await getSOPDocument(orgId, doc.id);
      setDoc(updated);
    } catch {
      setError('Failed to run AI analysis.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleConfirm = async (link: SOPCriterionLink) => {
    if (!doc) return;
    setConfirmingId(link.id);
    setError('');
    try {
      const updatedLink = await updateSOPLink(orgId, link.id, { is_confirmed: true });
      setDoc(prev => {
        if (!prev || !prev.criterion_links) return prev;
        return {
          ...prev,
          criterion_links: prev.criterion_links.map(l =>
            l.id === updatedLink.id ? updatedLink : l
          ),
        };
      });
    } catch {
      setError('Failed to confirm link.');
    } finally {
      setConfirmingId(null);
    }
  };

  const handleRemove = async (link: SOPCriterionLink) => {
    if (!doc) return;
    setRemovingId(link.id);
    setError('');
    try {
      await deleteSOPLink(orgId, link.id);
      setDoc(prev => {
        if (!prev || !prev.criterion_links) return prev;
        return {
          ...prev,
          criterion_links: prev.criterion_links.filter(l => l.id !== link.id),
        };
      });
    } catch {
      setError('Failed to remove link.');
    } finally {
      setRemovingId(null);
    }
  };

  if (loading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-32" />
          <div className="h-8 bg-gray-200 rounded w-64" />
          <div className="h-32 bg-gray-200 rounded" />
          <div className="h-48 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-6 text-center">
        <p className="text-sm text-gray-500">{error || 'SOP document not found.'}</p>
        <Link to="/sop-documents" className="mt-3 inline-block text-sm font-medium text-primary-600">Back to SOP Documents</Link>
      </div>
    );
  }

  const links = doc.criterion_links ?? [];
  const fileTypeBadge = FILE_TYPE_STYLES[doc.file_type] ?? 'bg-gray-100 text-gray-600';

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 pb-24 max-w-3xl mx-auto">
      {/* Back link */}
      <Link to="/sop-documents" className="text-sm text-primary-600 hover:text-primary-700 mb-4 inline-block">
        &larr; Back to SOP Documents
      </Link>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Header */}
      <div className="rounded-xl bg-white shadow-sm border border-gray-200 p-5 mb-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{doc.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${fileTypeBadge}`}>
                {doc.file_type}
              </span>
              <span className="text-sm text-gray-500">
                Uploaded by {doc.uploaded_by_name} on {formatDate(doc.created_at)}
              </span>
            </div>
          </div>
        </div>

        {doc.description && (
          <div className="mt-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-1">Description</h2>
            <p className="text-sm text-gray-600">{doc.description}</p>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-gray-100">
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-50 px-3 py-2 text-sm font-medium text-primary-700 hover:bg-primary-100 disabled:opacity-50 transition-colors"
          >
            {analyzing ? (
              <>
                <div className="w-4 h-4 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Run AI Analysis
              </>
            )}
          </button>
        </div>
      </div>

      {/* Criterion Links */}
      <div className="rounded-xl bg-white shadow-sm border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Criterion Links</h2>

        {links.length === 0 ? (
          <div className="text-center py-8">
            <svg className="mx-auto h-10 w-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <p className="mt-2 text-sm text-gray-500">No criterion links yet.</p>
            <p className="text-xs text-gray-400 mt-1">Run AI Analysis to automatically discover links between this document and scoring criteria.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {links.map(link => (
              <div key={link.id} className="border border-gray-100 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900">{link.criterion_name}</span>
                      {link.ai_confidence !== null && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700">
                          {Math.round(link.ai_confidence * 100)}% confidence
                        </span>
                      )}
                      {link.is_confirmed && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700">
                          Confirmed
                        </span>
                      )}
                    </div>
                    {link.ai_reasoning && (
                      <p className="text-xs text-gray-500 mt-1">{link.ai_reasoning}</p>
                    )}
                    {link.relevant_excerpt && (
                      <blockquote className="mt-2 border-l-2 border-gray-200 pl-3 text-xs text-gray-500 italic">
                        {link.relevant_excerpt}
                      </blockquote>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {link.is_ai_suggested && !link.is_confirmed && (
                      <button
                        onClick={() => handleConfirm(link)}
                        disabled={confirmingId === link.id}
                        className="rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50 transition-colors"
                      >
                        {confirmingId === link.id ? 'Confirming...' : 'Confirm'}
                      </button>
                    )}
                    <button
                      onClick={() => handleRemove(link)}
                      disabled={removingId === link.id}
                      className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
                    >
                      {removingId === link.id ? 'Removing...' : 'Remove'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
