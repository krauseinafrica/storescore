import { useEffect, useState, useRef } from 'react';
import { getSOPDocuments, createSOPDocument, deleteSOPDocument, analyzeSOPDocument } from '../api/walks';
import InfoButton from '../components/InfoButton';
import { getOrgId } from '../utils/org';
import type { SOPDocument } from '../types';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const FILE_TYPE_BADGES: Record<string, { label: string; classes: string }> = {
  pdf: { label: 'PDF', classes: 'bg-red-50 text-red-700 ring-red-600/20' },
  docx: { label: 'DOCX', classes: 'bg-blue-50 text-blue-700 ring-blue-600/20' },
  txt: { label: 'TXT', classes: 'bg-gray-50 text-gray-600 ring-gray-500/20' },
};

export function SOPDocumentsContent() {
  return <SOPDocumentsInner />;
}

export default function SOPDocuments() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 pb-24">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">SOP Documents <InfoButton contextKey="sop-documents-overview" /></h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Upload and manage Standard Operating Procedure documents.
        </p>
      </div>
      <SOPDocumentsInner />
    </div>
  );
}

function SOPDocumentsInner() {
  const orgId = getOrgId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [documents, setDocuments] = useState<SOPDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Upload form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Messages
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;

    async function fetchDocuments() {
      try {
        const data = await getSOPDocuments(orgId);
        if (!cancelled) setDocuments(data);
      } catch {
        if (!cancelled) setErrorMsg('Failed to load SOP documents.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchDocuments();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const clearMessages = () => {
    setSuccessMsg('');
    setErrorMsg('');
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || uploading) return;

    if (!title.trim()) {
      setErrorMsg('Title is required.');
      return;
    }
    if (!selectedFile) {
      setErrorMsg('Please select a file to upload.');
      return;
    }

    clearMessages();
    setUploading(true);

    try {
      const newDoc = await createSOPDocument(orgId, title.trim(), description.trim(), selectedFile);
      setDocuments((prev) => [newDoc, ...prev]);
      setTitle('');
      setDescription('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setSuccessMsg('Document uploaded successfully.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch {
      setErrorMsg('Failed to upload document. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleAnalyze = async (docId: string) => {
    if (!orgId || analyzingId) return;
    clearMessages();
    setAnalyzingId(docId);

    try {
      await analyzeSOPDocument(orgId, docId);
      // Refresh the documents list to get updated link_count
      const updated = await getSOPDocuments(orgId);
      setDocuments(updated);
      setSuccessMsg('AI analysis started. Criterion links will appear shortly.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch {
      setErrorMsg('Failed to analyze document. Please try again.');
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!orgId || deletingId) return;
    clearMessages();
    setDeletingId(docId);

    try {
      await deleteSOPDocument(orgId, docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      setConfirmDeleteId(null);
      setSuccessMsg('Document deleted.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch {
      setErrorMsg('Failed to delete document.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      {/* Messages */}
      {successMsg && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {/* Upload Section */}
      <div className="rounded-xl bg-white shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Upload New Document</h2>
        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500"
              placeholder="e.g. Store Opening Procedures"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500"
              placeholder="Brief description of this document..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">File *</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 cursor-pointer"
            />
            <p className="mt-1 text-xs text-gray-400">Accepted formats: PDF, DOCX, TXT</p>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={uploading}
              className="bg-primary-600 text-white hover:bg-primary-700 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Uploading...
                </span>
              ) : (
                'Upload Document'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Documents List */}
      {loading ? (
        /* Loading Skeleton */
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl bg-white shadow-sm border border-gray-200 p-5 animate-pulse"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-2/3 mb-3" />
                  <div className="flex gap-4">
                    <div className="h-3 bg-gray-100 rounded w-16" />
                    <div className="h-3 bg-gray-100 rounded w-20" />
                    <div className="h-3 bg-gray-100 rounded w-24" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="h-8 w-16 bg-gray-100 rounded-lg" />
                  <div className="h-8 w-16 bg-gray-100 rounded-lg" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : documents.length === 0 ? (
        /* Empty State */
        <div className="rounded-xl bg-white shadow-sm border border-gray-200 p-12 text-center">
          <svg
            className="w-12 h-12 text-gray-300 mx-auto mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-sm text-gray-500 mb-1">No SOP documents yet.</p>
          <p className="text-xs text-gray-400">
            Upload your first document using the form above.
          </p>
        </div>
      ) : (
        /* Documents */
        <div className="space-y-4">
          {documents.map((doc) => {
            const badge = FILE_TYPE_BADGES[doc.file_type] || FILE_TYPE_BADGES.txt;
            const isAnalyzing = analyzingId === doc.id;
            const isDeleting = deletingId === doc.id;
            const isConfirmingDelete = confirmDeleteId === doc.id;

            return (
              <div
                key={doc.id}
                className="rounded-xl bg-white shadow-sm border border-gray-200 p-5 transition-shadow hover:shadow-md"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">
                        {doc.title}
                      </h3>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium ring-1 ring-inset ${badge.classes}`}
                      >
                        {badge.label}
                      </span>
                    </div>

                    {doc.description && (
                      <p className="text-sm text-gray-500 mb-2 line-clamp-2">
                        {doc.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
                      <span>{formatFileSize(doc.file_size_bytes)}</span>
                      <span>Uploaded by {doc.uploaded_by_name}</span>
                      <span>{formatDate(doc.created_at)}</span>
                      {doc.link_count != null && doc.link_count > 0 && (
                        <span className="inline-flex items-center gap-1 text-primary-600">
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                            />
                          </svg>
                          {doc.link_count} linked criteria
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleAnalyze(doc.id)}
                      disabled={isAnalyzing || !!analyzingId}
                      className="bg-primary-600 text-white hover:bg-primary-700 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isAnalyzing ? (
                        <span className="flex items-center gap-1.5">
                          <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Analyzing...
                        </span>
                      ) : (
                        'Analyze'
                      )}
                    </button>

                    {isConfirmingDelete ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleDelete(doc.id)}
                          disabled={isDeleting}
                          className="text-red-600 hover:text-red-700 text-sm font-medium transition-colors disabled:opacity-50"
                        >
                          {isDeleting ? 'Deleting...' : 'Confirm'}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-gray-400 hover:text-gray-600 text-sm font-medium transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(doc.id)}
                        className="text-red-600 hover:text-red-700 text-sm font-medium transition-colors"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
