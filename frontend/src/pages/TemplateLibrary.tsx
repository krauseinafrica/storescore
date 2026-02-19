import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getOrgId } from '../utils/org';
import {
  getIndustryTemplates,
  getIndustryTemplate,
  installIndustryTemplate,
  getOrgProfile,
  getTemplates,
  duplicateTemplate,
  deleteTemplate,
} from '../api/walks';
import type {
  IndustryTemplateListItem,
  IndustryTemplateDetail,
} from '../api/walks';
import type { ScoringTemplate } from '../types';

const INDUSTRY_COLORS: Record<string, string> = {
  hardware: 'bg-orange-50 text-orange-700 ring-orange-600/10',
  grocery: 'bg-green-50 text-green-700 ring-green-600/10',
  restaurant: 'bg-red-50 text-red-700 ring-red-600/10',
  retail: 'bg-blue-50 text-blue-700 ring-blue-600/10',
  pharmacy: 'bg-purple-50 text-purple-700 ring-purple-600/10',
  convenience: 'bg-amber-50 text-amber-700 ring-amber-600/10',
  hospitality: 'bg-pink-50 text-pink-700 ring-pink-600/10',
  automotive: 'bg-slate-50 text-slate-700 ring-slate-600/10',
  general: 'bg-gray-50 text-gray-700 ring-gray-600/10',
};

function getIndustryColor(industry: string): string {
  return INDUSTRY_COLORS[industry.toLowerCase()] || INDUSTRY_COLORS.general;
}

// Legacy combined export (used by old standalone page route)
export function TemplateLibraryContent() {
  return <TemplateLibraryInner />;
}

// Separate content exports for the consolidated Templates page
export function BrowseLibraryContent() {
  return <BrowseLibraryInner />;
}

export function YourTemplatesContent() {
  return <YourTemplatesInner />;
}

export default function TemplateLibrary() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 pb-24">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Template Library</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Browse and install evaluation templates, or manage your organization's templates
        </p>
      </div>
      <TemplateLibraryInner />
    </div>
  );
}

// ── Your Templates (standalone content) ──────────────────────────

function YourTemplatesInner() {
  const { hasRole } = useAuth();
  const orgId = getOrgId();
  const isAdmin = hasRole('admin');

  const [orgTemplates, setOrgTemplates] = useState<ScoringTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const loadOrgTemplates = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = await getTemplates(orgId);
      setOrgTemplates(data);
    } catch {
      setToast({ message: 'Failed to load your templates.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadOrgTemplates();
  }, [loadOrgTemplates]);

  const handleDuplicate = async (template: ScoringTemplate) => {
    if (!orgId || duplicating) return;
    setDuplicating(template.id);
    try {
      const newTemplate = await duplicateTemplate(orgId, template.id);
      setToast({ message: `Template duplicated as "${newTemplate.name}"`, type: 'success' });
      loadOrgTemplates();
    } catch {
      setToast({ message: 'Failed to duplicate template. Please try again.', type: 'error' });
    } finally {
      setDuplicating(null);
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!orgId || deleting) return;
    setDeleting(true);
    try {
      await deleteTemplate(orgId, templateId);
      setOrgTemplates((prev) => prev.filter((t) => t.id !== templateId));
      setToast({ message: 'Template deleted.', type: 'success' });
      setConfirmDeleteId(null);
    } catch {
      setToast({ message: 'Failed to delete template. Please try again.', type: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      {orgTemplates.filter((t) => t.is_active).length === 0 ? (
        <div className="text-center py-16">
          <svg className="mx-auto w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <p className="mt-3 text-sm text-gray-500">No templates yet. Install one from the Template Library tab.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orgTemplates.filter((t) => t.is_active).map((tmpl) => (
            <div key={tmpl.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900 truncate">{tmpl.name}</h3>
                    {tmpl.source_template_name && (
                      <span className="text-[10px] text-gray-400">Duplicated from {tmpl.source_template_name}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {tmpl.section_count ?? tmpl.sections?.length ?? 0} sections
                  </p>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleDuplicate(tmpl)}
                      disabled={duplicating === tmpl.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      {duplicating === tmpl.id ? (
                        <div className="w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                      Duplicate
                    </button>
                    {confirmDeleteId !== tmpl.id && (
                      <button
                        onClick={() => setConfirmDeleteId(tmpl.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
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
              {confirmDeleteId === tmpl.id && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-2">
                    Existing evaluations will be preserved but this template will no longer be available for new walks.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      disabled={deleting}
                      className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDelete(tmpl.id)}
                      disabled={deleting}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      {deleting ? (
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : null}
                      Confirm Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] animate-fade-in">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
            toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
          }`}>
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </>
  );
}

// ── Browse Library (standalone content) ──────────────────────────

function BrowseLibraryInner() {
  const { hasRole } = useAuth();
  const orgId = getOrgId();
  const isAdmin = hasRole('admin');

  const [templates, setTemplates] = useState<IndustryTemplateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeIndustry, setActiveIndustry] = useState('all');

  // Detail modal state
  const [selectedTemplate, setSelectedTemplate] = useState<IndustryTemplateDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  // Install state
  const [installing, setInstalling] = useState(false);
  const [confirmInstall, setConfirmInstall] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Expanded sections in detail view
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());

  const loadTemplates = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError('');
    try {
      const [data, profile] = await Promise.all([
        getIndustryTemplates(orgId),
        getOrgProfile(orgId).catch(() => null),
      ]);
      setTemplates(data);
      if (profile?.industry && data.some((t) => t.industry === profile.industry)) {
        setActiveIndustry(profile.industry);
      }
    } catch {
      setError('Failed to load template library. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const industries = ['all', ...Array.from(new Set(templates.map((t) => t.industry)))];

  const filteredTemplates =
    activeIndustry === 'all'
      ? templates
      : templates.filter((t) => t.industry === activeIndustry);

  const openDetail = async (template: IndustryTemplateListItem) => {
    if (!orgId) return;
    setDetailOpen(true);
    setDetailLoading(true);
    setSelectedTemplate(null);
    setConfirmInstall(false);
    setExpandedSections(new Set());
    try {
      const detail = await getIndustryTemplate(orgId, template.id);
      setSelectedTemplate(detail);
    } catch {
      setError('Failed to load template details.');
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setSelectedTemplate(null);
    setConfirmInstall(false);
  };

  const handleInstall = async () => {
    if (!orgId || !selectedTemplate || installing) return;
    setInstalling(true);
    try {
      await installIndustryTemplate(orgId, selectedTemplate.id);
      setToast({ message: `"${selectedTemplate.name}" installed successfully!`, type: 'success' });
      closeDetail();
      loadTemplates();
    } catch {
      setToast({ message: 'Failed to install template. Please try again.', type: 'error' });
    } finally {
      setInstalling(false);
    }
  };

  const toggleSection = (index: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Industry filter pills */}
      <div className="mb-6 flex flex-wrap gap-2">
        {industries.map((industry) => {
          const isActive = activeIndustry === industry;
          const displayName =
            industry === 'all'
              ? 'All'
              : templates.find((t) => t.industry === industry)?.industry_display || industry;
          const count =
            industry === 'all'
              ? templates.length
              : templates.filter((t) => t.industry === industry).length;

          return (
            <button
              key={industry}
              onClick={() => setActiveIndustry(industry)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {displayName}
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-500'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Template grid */}
      {filteredTemplates.length === 0 ? (
        <div className="text-center py-16">
          <svg
            className="mx-auto w-12 h-12 text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          <p className="mt-3 text-sm text-gray-500">No templates found for this industry.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTemplates.map((template) => (
            <button
              key={template.id}
              onClick={() => openDetail(template)}
              className="text-left bg-white rounded-lg shadow-sm border border-gray-200 p-5 hover:shadow-md hover:border-gray-300 transition-all group"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="text-sm font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                  {template.name}
                </h3>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {template.is_featured && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/10">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      Featured
                    </span>
                  )}
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 ring-inset ${getIndustryColor(
                      template.industry
                    )}`}
                  >
                    {template.industry_display}
                  </span>
                </div>
              </div>

              <p className="text-sm text-gray-500 line-clamp-2 mb-4">
                {template.description || 'No description available.'}
              </p>

              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  {template.section_count} sections
                </span>
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  {template.criterion_count} criteria
                </span>
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {template.install_count} installs
                </span>
                <span className="ml-auto text-[10px] text-gray-300">v{template.version}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {detailOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-black/50 transition-opacity"
            onClick={closeDetail}
          />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full max-w-3xl bg-white rounded-xl shadow-xl max-h-[90vh] flex flex-col">
              <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
                <div className="flex-1 min-w-0">
                  {detailLoading ? (
                    <div className="h-5 w-48 bg-gray-200 rounded animate-pulse" />
                  ) : selectedTemplate ? (
                    <>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg font-bold text-gray-900">
                          {selectedTemplate.name}
                        </h2>
                        {selectedTemplate.is_featured && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/10">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            Featured
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 ring-inset ${getIndustryColor(
                            selectedTemplate.industry
                          )}`}
                        >
                          {selectedTemplate.industry_display}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-500">
                        {selectedTemplate.description}
                      </p>
                      <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
                        <span>{selectedTemplate.section_count} sections</span>
                        <span>{selectedTemplate.criterion_count} criteria</span>
                        <span>{selectedTemplate.install_count} installs</span>
                        <span>Version {selectedTemplate.version}</span>
                      </div>
                    </>
                  ) : null}
                </div>
                <button
                  onClick={closeDetail}
                  className="ml-4 p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4">
                {detailLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                  </div>
                ) : selectedTemplate?.structure?.sections ? (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Template Structure</h3>
                    {selectedTemplate.structure.sections
                      .sort((a, b) => a.order - b.order)
                      .map((section, sectionIndex) => {
                        const isExpanded = expandedSections.has(sectionIndex);
                        return (
                          <div
                            key={sectionIndex}
                            className="bg-gray-50 rounded-lg ring-1 ring-gray-900/5 overflow-hidden"
                          >
                            <button
                              onClick={() => toggleSection(sectionIndex)}
                              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-100 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <svg
                                  className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                <span className="text-sm font-semibold text-gray-900">{section.name}</span>
                                {section.weight && (
                                  <span className="text-[10px] text-gray-400 bg-white px-1.5 py-0.5 rounded">
                                    Weight: {section.weight}
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-gray-400">{section.criteria.length} criteria</span>
                            </button>

                            {isExpanded && (
                              <div className="border-t border-gray-200/50 divide-y divide-gray-100">
                                {section.criteria
                                  .sort((a, b) => a.order - b.order)
                                  .map((criterion, criterionIndex) => (
                                    <div key={criterionIndex} className="px-4 py-3 pl-10">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-medium text-gray-800">{criterion.name}</p>
                                          {criterion.description && (
                                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{criterion.description}</p>
                                          )}
                                          {criterion.scoring_guidance && (
                                            <p className="text-xs text-gray-400 mt-0.5 italic">{criterion.scoring_guidance}</p>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                          <span className="text-[10px] font-medium text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded">
                                            {criterion.max_points} pts
                                          </span>
                                          {criterion.drivers.length > 0 && (
                                            <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                                              {criterion.drivers.length} driver{criterion.drivers.length !== 1 ? 's' : ''}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-8">
                    No structure data available for this template.
                  </p>
                )}
              </div>

              {isAdmin && selectedTemplate && (
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-xl">
                  {confirmInstall ? (
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-gray-600">
                        Install <strong>{selectedTemplate.name}</strong> into your organization? This will create a new scoring template.
                      </p>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => setConfirmInstall(false)}
                          disabled={installing}
                          className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleInstall}
                          disabled={installing}
                          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                        >
                          {installing ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              Installing...
                            </>
                          ) : (
                            'Confirm Install'
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end">
                      <button
                        onClick={() => setConfirmInstall(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Install Template
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] animate-fade-in">
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
              toast.type === 'success'
                ? 'bg-emerald-600 text-white'
                : 'bg-red-600 text-white'
            }`}
          >
            {toast.type === 'success' ? (
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            <span>{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-2 text-white/80 hover:text-white"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Legacy combined component (Browse Library + Your Templates with internal tabs) ──

function TemplateLibraryInner() {
  const [activeTab, setActiveTab] = useState<'library' | 'my-templates'>('library');

  return (
    <>
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex gap-6">
          <button
            onClick={() => setActiveTab('library')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'library'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Browse Library
          </button>
          <button
            onClick={() => setActiveTab('my-templates')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'my-templates'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Your Templates
          </button>
        </nav>
      </div>

      {activeTab === 'my-templates' && <YourTemplatesInner />}
      {activeTab === 'library' && <BrowseLibraryInner />}
    </>
  );
}
