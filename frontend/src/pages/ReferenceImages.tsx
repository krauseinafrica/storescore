import { useEffect, useState, useCallback, useRef } from 'react';
import { getOrgId } from '../utils/org';
import { useAuth } from '../hooks/useAuth';
import { getTemplates, getTemplate, uploadReferenceImage, deleteReferenceImage, updateReferenceImageDescription } from '../api/walks';
import type { ScoringTemplate, Criterion, Section, CriterionReferenceImage } from '../types';

export function ReferenceImagesContent() {
  return <ReferenceImagesInner />;
}

export default function ReferenceImages() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 pb-24">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Reference Images</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload an ideal reference photo for each criterion. The AI will compare store photos against these references when scoring.
        </p>
      </div>
      <ReferenceImagesInner />
    </div>
  );
}

/** Generate a suggested description based on criterion name/description. */
function generateReferenceDescription(criterionName: string, criterionDescription?: string): string {
  const name = criterionName.toLowerCase();
  const parts: string[] = [];

  if (criterionDescription) {
    // Use the criterion description as the base suggestion
    parts.push(`This reference image shows the ideal standard for "${criterionName}".`);
    parts.push(criterionDescription);
  } else {
    parts.push(`This reference image shows the ideal standard for "${criterionName}".`);

    // Add generic guidance
    if (name.includes('display') || name.includes('merchandis')) {
      parts.push('Products are neatly arranged, fully stocked, and all labels are visible.');
    } else if (name.includes('clean') || name.includes('sanit')) {
      parts.push('All surfaces are clean, free of debris, and properly sanitized.');
    } else if (name.includes('sign') || name.includes('label') || name.includes('price')) {
      parts.push('All signage is current, properly placed, and clearly readable.');
    } else if (name.includes('safety') || name.includes('hazard')) {
      parts.push('All safety equipment is in place and the area is free of hazards.');
    } else if (name.includes('stock') || name.includes('inventory') || name.includes('shelf')) {
      parts.push('Shelves are fully stocked with proper facing and no gaps.');
    }
  }

  return parts.join(' ');
}

function ReferenceImagesInner() {
  const orgId = getOrgId();
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');

  const [templates, setTemplates] = useState<ScoringTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ScoringTemplate | null>(null);
  const [loading, setLoading] = useState(true);

  // Expanded sections
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // Upload state per criterion
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<Record<string, 'saving' | 'saved' | 'error'>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const loadTemplates = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = await getTemplates(orgId);
      const activeTemplates = data.filter((t) => t.is_active);
      setTemplates(activeTemplates);
      if (activeTemplates.length > 0) {
        const detail = await getTemplate(orgId, activeTemplates[0].id);
        setSelectedTemplate(detail);
      }
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Auto-expand all sections & init descriptions from existing reference images
  useEffect(() => {
    if (selectedTemplate?.sections) {
      setExpandedSections(new Set(selectedTemplate.sections.map((s) => s.id)));
      const descs: Record<string, string> = {};
      for (const section of selectedTemplate.sections) {
        for (const criterion of section.criteria) {
          const ref = criterion.reference_images?.[0];
          if (ref) {
            descs[criterion.id] = ref.description || '';
          } else {
            // Auto-populate a suggested description for criteria without one
            descs[criterion.id] = generateReferenceDescription(criterion.name, criterion.description);
          }
        }
      }
      setDescriptions(descs);
    }
  }, [selectedTemplate]);

  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach(clearTimeout);
    };
  }, []);

  const handleSelectTemplate = async (templateId: string) => {
    if (!orgId) return;
    setLoading(true);
    try {
      const detail = await getTemplate(orgId, templateId);
      setSelectedTemplate(detail);
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const getReferenceImage = (criterion: Criterion): CriterionReferenceImage | null => {
    return criterion.reference_images?.[0] || null;
  };

  /** Debounced auto-save for description updates (only for criteria with existing images). */
  const handleDescriptionChange = (criterion: Criterion, value: string) => {
    setDescriptions((prev) => ({ ...prev, [criterion.id]: value }));

    const ref = getReferenceImage(criterion);
    if (!ref || !orgId) return;

    // Clear existing timer
    if (debounceTimers.current[criterion.id]) {
      clearTimeout(debounceTimers.current[criterion.id]);
    }

    setSaveStatus((prev) => ({ ...prev, [criterion.id]: 'saving' }));

    debounceTimers.current[criterion.id] = setTimeout(async () => {
      try {
        await updateReferenceImageDescription(orgId, criterion.id, ref.id, value);
        setSaveStatus((prev) => ({ ...prev, [criterion.id]: 'saved' }));
        // Clear "Saved" after 2 seconds
        setTimeout(() => {
          setSaveStatus((prev) => {
            if (prev[criterion.id] === 'saved') {
              const next = { ...prev };
              delete next[criterion.id];
              return next;
            }
            return prev;
          });
        }, 2000);
      } catch {
        setSaveStatus((prev) => ({ ...prev, [criterion.id]: 'error' }));
      }
    }, 1500);
  };

  const handleUpload = async (criterion: Criterion, file: File) => {
    if (!orgId) return;
    setUploading((prev) => ({ ...prev, [criterion.id]: true }));
    try {
      const desc = descriptions[criterion.id] || '';
      await uploadReferenceImage(orgId, criterion.id, file, desc);
      // Reload the template to get updated reference images
      if (selectedTemplate) {
        const detail = await getTemplate(orgId, selectedTemplate.id);
        setSelectedTemplate(detail);
      }
      setToast({ message: `Reference image uploaded for "${criterion.name}"`, type: 'success' });
    } catch {
      setToast({ message: 'Failed to upload reference image.', type: 'error' });
    } finally {
      setUploading((prev) => ({ ...prev, [criterion.id]: false }));
    }
  };

  const handleDelete = async (criterion: Criterion) => {
    if (!orgId) return;
    const ref = getReferenceImage(criterion);
    if (!ref) return;
    if (!confirm('Remove this reference image?')) return;

    setUploading((prev) => ({ ...prev, [criterion.id]: true }));
    try {
      await deleteReferenceImage(orgId, criterion.id, ref.id);
      if (selectedTemplate) {
        const detail = await getTemplate(orgId, selectedTemplate.id);
        setSelectedTemplate(detail);
      }
      setToast({ message: `Reference image removed for "${criterion.name}"`, type: 'success' });
    } catch {
      setToast({ message: 'Failed to delete reference image.', type: 'error' });
    } finally {
      setUploading((prev) => ({ ...prev, [criterion.id]: false }));
    }
  };

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  if (!isAdmin) {
    return (
      <div className="py-6 text-center text-gray-500">
        Only admins can manage reference images.
      </div>
    );
  }

  return (
    <>
      {/* Template selector */}
      <div className="mb-6 bg-white rounded-xl ring-1 ring-gray-900/5 p-4">
        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Select Template</label>
        <select
          className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3.5 py-2.5 text-gray-900 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:bg-white focus:outline-none text-sm font-medium"
          value={selectedTemplate?.id || ''}
          onChange={(e) => handleSelectTemplate(e.target.value)}
          disabled={loading}
        >
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : selectedTemplate ? (
        <div className="space-y-4">
          {selectedTemplate.sections.map((section: Section) => (
            <div key={section.id} className="bg-white rounded-xl ring-1 ring-gray-900/5 overflow-hidden">
              {/* Section header */}
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <h2 className="text-sm font-semibold text-gray-900">{section.name}</h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">
                    {section.criteria.filter((c) => getReferenceImage(c)).length}/{section.criteria.length} with references
                  </span>
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${expandedSections.has(section.id) ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Criteria */}
              {expandedSections.has(section.id) && (
                <div className="border-t border-gray-100 divide-y divide-gray-100">
                  {section.criteria.map((criterion: Criterion) => {
                    const ref = getReferenceImage(criterion);
                    const isUploading = uploading[criterion.id] || false;
                    const status = saveStatus[criterion.id];

                    return (
                      <div key={criterion.id} className="px-4 py-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="text-sm font-medium text-gray-900">{criterion.name}</h3>
                            {criterion.description && (
                              <p className="text-xs text-gray-500 mt-0.5">{criterion.description}</p>
                            )}
                          </div>
                          {ref && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700">
                              Has reference
                            </span>
                          )}
                        </div>

                        <div className="flex gap-4 items-start">
                          {/* Image slot */}
                          <div className="w-48 flex-shrink-0">
                            {ref ? (
                              <div className="relative group">
                                <img
                                  src={ref.image}
                                  alt={`Reference for ${criterion.name}`}
                                  className="w-48 h-32 object-cover rounded-lg ring-1 ring-gray-200"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => fileInputRefs.current[criterion.id]?.click()}
                                    className="px-2 py-1 bg-white rounded text-xs font-medium text-gray-700 hover:bg-gray-100"
                                    disabled={isUploading}
                                  >
                                    Replace
                                  </button>
                                  <button
                                    onClick={() => handleDelete(criterion)}
                                    className="px-2 py-1 bg-red-500 rounded text-xs font-medium text-white hover:bg-red-600"
                                    disabled={isUploading}
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => fileInputRefs.current[criterion.id]?.click()}
                                disabled={isUploading}
                                className="w-48 h-32 rounded-lg border-2 border-dashed border-gray-300 hover:border-primary-400 flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-primary-500 transition-colors"
                              >
                                {isUploading ? (
                                  <div className="w-5 h-5 border-2 border-gray-300 border-t-primary-600 rounded-full animate-spin" />
                                ) : (
                                  <>
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                    <span className="text-xs font-medium">Upload ideal photo</span>
                                  </>
                                )}
                              </button>
                            )}
                            <input
                              ref={(el) => { fileInputRefs.current[criterion.id] = el; }}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleUpload(criterion, file);
                                e.target.value = '';
                              }}
                            />
                          </div>

                          {/* Description field */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-xs font-medium text-gray-600">
                                Description — what makes this ideal?
                              </label>
                              {status && (
                                <span className={`text-[10px] font-medium ${
                                  status === 'saving' ? 'text-gray-400' :
                                  status === 'saved' ? 'text-emerald-500' :
                                  'text-red-500'
                                }`}>
                                  {status === 'saving' ? 'Saving...' :
                                   status === 'saved' ? 'Saved' :
                                   'Save failed'}
                                </span>
                              )}
                            </div>
                            <textarea
                              className="w-full rounded-lg border-gray-300 shadow-sm text-sm focus:border-primary-500 focus:ring-primary-500"
                              rows={3}
                              placeholder="e.g., Knives are neatly arranged by size, all price tags visible, display is fully stocked with no empty slots..."
                              value={descriptions[criterion.id] || ''}
                              onChange={(e) => handleDescriptionChange(criterion, e.target.value)}
                            />
                            {!ref && (
                              <p className="text-[10px] text-gray-400 mt-1">
                                Description will be saved when you upload an image.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-gray-500 py-12">No active templates found.</p>
      )}

      {/* Toast notification */}
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.message}
        </div>
      )}
    </>
  );
}
