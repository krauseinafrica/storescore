import { useEffect, useState, useCallback } from 'react';
import { getOrgId } from '../utils/org';
import { useAuth } from '../hooks/useAuth';
import { getTemplates, getTemplate, getDrivers, createDriver, updateDriver, deleteDriver } from '../api/walks';
import type { ScoringTemplate, Driver, Criterion, Section } from '../types';

export function DriverManagementContent() {
  return <DriverManagementInner />;
}

export default function DriverManagement() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 pb-24">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Scoring Drivers</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Manage root cause drivers shown when evaluators score 3 or below. Drivers help identify why areas need improvement.
        </p>
      </div>
      <DriverManagementInner />
    </div>
  );
}

function DriverManagementInner() {
  const orgId = getOrgId();
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');

  const [templates, setTemplates] = useState<ScoringTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ScoringTemplate | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [driversLoading, setDriversLoading] = useState(false);

  // Add/edit state
  const [addingToCriterion, setAddingToCriterion] = useState<string | null>(null);
  const [newDriverName, setNewDriverName] = useState('');
  const [editingDriver, setEditingDriver] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Expanded sections
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const loadTemplates = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = await getTemplates(orgId);
      const activeTemplates = data.filter((t) => t.is_active);
      setTemplates(activeTemplates);
      if (activeTemplates.length > 0) {
        // Fetch the full detail (with sections) for the first active template
        const firstActive = activeTemplates[0];
        const detail = await getTemplate(orgId, firstActive.id);
        setSelectedTemplate(detail);
      }
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  const loadDrivers = useCallback(async () => {
    if (!orgId) return;
    setDriversLoading(true);
    try {
      const data = await getDrivers(orgId);
      setDrivers(data);
    } finally {
      setDriversLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadTemplates();
    loadDrivers();
  }, [loadTemplates, loadDrivers]);

  // Auto-expand all sections on template load
  useEffect(() => {
    if (selectedTemplate?.sections) {
      setExpandedSections(new Set(selectedTemplate.sections.map((s) => s.id)));
    }
  }, [selectedTemplate]);

  const getDriversForCriterion = (criterionId: string) =>
    drivers.filter((d) => d.criterion === criterionId).sort((a, b) => a.order - b.order);

  const handleAddDriver = async (criterionId: string) => {
    if (!orgId || !newDriverName.trim() || saving) return;
    setSaving(true);
    setError('');
    try {
      const maxOrder = Math.max(0, ...getDriversForCriterion(criterionId).map((d) => d.order));
      const driver = await createDriver(orgId, {
        criterion: criterionId,
        name: newDriverName.trim(),
        order: maxOrder + 1,
      });
      setDrivers((prev) => [...prev, driver]);
      setNewDriverName('');
      setAddingToCriterion(null);
    } catch {
      setError('Failed to create driver');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateDriver = async (driverId: string) => {
    if (!orgId || !editName.trim() || saving) return;
    setSaving(true);
    setError('');
    try {
      const updated = await updateDriver(orgId, driverId, { name: editName.trim() });
      setDrivers((prev) => prev.map((d) => (d.id === driverId ? { ...d, ...updated } : d)));
      setEditingDriver(null);
    } catch {
      setError('Failed to update driver');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (driver: Driver) => {
    if (!orgId || saving) return;
    try {
      const updated = await updateDriver(orgId, driver.id, { is_active: !driver.is_active });
      setDrivers((prev) => prev.map((d) => (d.id === driver.id ? { ...d, ...updated } : d)));
    } catch {
      setError('Failed to update driver');
    }
  };

  const handleDeleteDriver = async (driverId: string) => {
    if (!orgId || saving) return;
    setSaving(true);
    try {
      await deleteDriver(orgId, driverId);
      setDrivers((prev) => prev.filter((d) => d.id !== driverId));
    } catch {
      setError('Failed to delete driver');
    } finally {
      setSaving(false);
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

  if (!isAdmin) {
    return (
      <div className="py-12 text-center">
        <h1 className="text-xl font-bold text-gray-900">Access Denied</h1>
        <p className="text-sm text-gray-500 mt-2">Admin access is required to manage scoring drivers.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
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

      {/* Template selector (if multiple) */}
      {templates.length > 1 && (
        <div className="mb-6 bg-white rounded-xl ring-1 ring-gray-900/5 p-4">
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Select Template</label>
          <select
            value={selectedTemplate?.id || ''}
            onChange={async (e) => {
              const templateId = e.target.value;
              if (!orgId || !templateId) return;
              try {
                const detail = await getTemplate(orgId, templateId);
                setSelectedTemplate(detail);
              } catch {
                setSelectedTemplate(templates.find((t) => t.id === templateId) || null);
              }
            }}
            className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3.5 py-2.5 text-gray-900 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:bg-white focus:outline-none text-sm font-medium"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Stats bar */}
      <div className="mb-6 flex items-center gap-4 text-sm text-gray-500">
        <span>{drivers.length} total drivers</span>
        <span>{drivers.filter((d) => d.is_active).length} active</span>
        <span>{selectedTemplate?.sections?.length || 0} sections</span>
      </div>

      {/* Sections + Criteria + Drivers */}
      {driversLoading ? (
        <div className="text-center py-12 text-gray-400">Loading drivers...</div>
      ) : !selectedTemplate?.sections ? (
        <div className="text-center py-12 text-gray-400">No template selected or template has no sections.</div>
      ) : (
        <div className="space-y-4">
          {selectedTemplate.sections
            .filter((s: Section) => s.criteria && s.criteria.length > 0)
            .map((section: Section) => {
              const isExpanded = expandedSections.has(section.id);
              const sectionDriverCount = section.criteria.reduce(
                (sum: number, c: Criterion) => sum + getDriversForCriterion(c.id).length,
                0
              );

              return (
                <div
                  key={section.id}
                  className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 overflow-hidden"
                >
                  {/* Section header */}
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <svg
                        className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <h2 className="text-sm font-semibold text-gray-900">{section.name}</h2>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>{section.criteria.length} criteria</span>
                      <span>{sectionDriverCount} drivers</span>
                    </div>
                  </button>

                  {/* Criteria list */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 divide-y divide-gray-50">
                      {section.criteria.map((criterion: Criterion) => {
                        const criterionDrivers = getDriversForCriterion(criterion.id);

                        return (
                          <div key={criterion.id} className="px-5 py-4">
                            {/* Criterion name */}
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-sm font-medium text-gray-800">{criterion.name}</h3>
                              <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded">
                                {criterionDrivers.length} driver{criterionDrivers.length !== 1 ? 's' : ''}
                              </span>
                            </div>

                            {/* Drivers list */}
                            {criterionDrivers.length > 0 ? (
                              <div className="space-y-1.5 mb-2">
                                {criterionDrivers.map((driver) => (
                                  <div
                                    key={driver.id}
                                    className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${
                                      driver.is_active ? 'bg-gray-50' : 'bg-gray-50/50 opacity-50'
                                    }`}
                                  >
                                    {editingDriver === driver.id ? (
                                      <>
                                        <input
                                          type="text"
                                          value={editName}
                                          onChange={(e) => setEditName(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleUpdateDriver(driver.id);
                                            if (e.key === 'Escape') setEditingDriver(null);
                                          }}
                                          className="flex-1 rounded border-gray-300 text-sm py-1 px-2 focus:border-primary-500 focus:ring-primary-500"
                                          autoFocus
                                        />
                                        <button
                                          onClick={() => handleUpdateDriver(driver.id)}
                                          className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                                        >
                                          Save
                                        </button>
                                        <button
                                          onClick={() => setEditingDriver(null)}
                                          className="text-xs text-gray-400 hover:text-gray-600"
                                        >
                                          Cancel
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <span className="flex-1 text-gray-700">{driver.name}</span>
                                        <button
                                          onClick={() => handleToggleActive(driver)}
                                          className={`p-1 rounded transition-colors ${
                                            driver.is_active
                                              ? 'text-green-500 hover:text-green-600'
                                              : 'text-gray-300 hover:text-gray-500'
                                          }`}
                                          title={driver.is_active ? 'Active — click to disable' : 'Inactive — click to enable'}
                                        >
                                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                            {driver.is_active ? (
                                              <path
                                                fillRule="evenodd"
                                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                                clipRule="evenodd"
                                              />
                                            ) : (
                                              <path
                                                fillRule="evenodd"
                                                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                                clipRule="evenodd"
                                              />
                                            )}
                                          </svg>
                                        </button>
                                        <button
                                          onClick={() => {
                                            setEditingDriver(driver.id);
                                            setEditName(driver.name);
                                          }}
                                          className="text-gray-400 hover:text-gray-600 p-1"
                                          title="Edit"
                                        >
                                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                          </svg>
                                        </button>
                                        <button
                                          onClick={() => handleDeleteDriver(driver.id)}
                                          className="text-gray-400 hover:text-red-500 p-1"
                                          title="Delete"
                                        >
                                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                          </svg>
                                        </button>
                                      </>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-400 italic mb-2">No drivers configured</p>
                            )}

                            {/* Add driver */}
                            {addingToCriterion === criterion.id ? (
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={newDriverName}
                                  onChange={(e) => setNewDriverName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleAddDriver(criterion.id);
                                    if (e.key === 'Escape') {
                                      setAddingToCriterion(null);
                                      setNewDriverName('');
                                    }
                                  }}
                                  placeholder="e.g. Staffing / Labor Shortage"
                                  className="flex-1 rounded-lg border-gray-300 text-sm py-1.5 px-3 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleAddDriver(criterion.id)}
                                  disabled={saving || !newDriverName.trim()}
                                  className="px-3 py-1.5 text-xs font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
                                >
                                  Add
                                </button>
                                <button
                                  onClick={() => {
                                    setAddingToCriterion(null);
                                    setNewDriverName('');
                                  }}
                                  className="text-xs text-gray-400 hover:text-gray-600 px-2"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setAddingToCriterion(criterion.id);
                                  setNewDriverName('');
                                }}
                                className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Add Driver
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </>
  );
}
