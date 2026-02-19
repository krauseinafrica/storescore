import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getOrgId } from '../utils/org';
import {
  getDepartments,
  deleteDepartment,
  getDepartmentTypes,
  installDepartmentType,
  getStores,
  updateStore,
  createDepartmentWalk,
  getOrgProfile,
} from '../api/walks';
import type { Department, DepartmentType, Store } from '../types';

const CATEGORY_COLORS: Record<string, string> = {
  standard: 'bg-blue-50 text-blue-700',
  branded: 'bg-purple-50 text-purple-700',
  specialty: 'bg-amber-50 text-amber-700',
};

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category.toLowerCase()] || CATEGORY_COLORS.standard;
}

export default function Departments() {
  const { user, hasRole } = useAuth();
  const orgId = getOrgId();
  const isAdmin = hasRole('admin');
  const navigate = useNavigate();

  // Tab state
  const [activeTab, setActiveTab] = useState<'your-departments' | 'library'>('your-departments');

  // Your Departments state
  const [departments, setDepartments] = useState<Department[]>([]);
  const [deptLoading, setDeptLoading] = useState(true);
  const [deptError, setDeptError] = useState('');

  // Department Library state
  const [departmentTypes, setDepartmentTypes] = useState<DepartmentType[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState('');
  const [activeIndustry, setActiveIndustry] = useState('all');

  // Stores state
  const [stores, setStores] = useState<Store[]>([]);

  // Start Evaluation modal state
  const [evalDepartment, setEvalDepartment] = useState<Department | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [startingEval, setStartingEval] = useState(false);

  // Action states
  const [installing, setInstalling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Manage Stores modal state
  const [manageStoresDept, setManageStoresDept] = useState<Department | null>(null);
  const [storeAssignments, setStoreAssignments] = useState<Record<string, boolean>>({});
  const [savingStores, setSavingStores] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Load org departments
  const loadDepartments = useCallback(async () => {
    if (!orgId) return;
    setDeptLoading(true);
    setDeptError('');
    try {
      const data = await getDepartments(orgId);
      setDepartments(data);
    } catch {
      setDeptError('Failed to load departments. Please try again.');
    } finally {
      setDeptLoading(false);
    }
  }, [orgId]);

  // Load stores
  const loadStores = useCallback(async () => {
    if (!orgId) return;
    try {
      const data = await getStores(orgId);
      setStores(data);
    } catch {
      // Stores loading failure is non-critical; eval button just won't have stores
    }
  }, [orgId]);

  useEffect(() => {
    loadDepartments();
    loadStores();
  }, [loadDepartments, loadStores]);

  // Load department types library
  const loadDepartmentTypes = useCallback(async () => {
    if (!orgId) return;
    setLibraryLoading(true);
    setLibraryError('');
    try {
      const [data, profile] = await Promise.all([
        getDepartmentTypes(orgId),
        getOrgProfile(orgId).catch(() => null),
      ]);
      setDepartmentTypes(data);
      if (profile?.industry && data.some((dt) => dt.industry === profile.industry)) {
        setActiveIndustry(profile.industry);
      }
    } catch {
      setLibraryError('Failed to load department library. Please try again.');
    } finally {
      setLibraryLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (activeTab === 'library') {
      loadDepartmentTypes();
    }
  }, [activeTab, loadDepartmentTypes]);

  // Install a department type
  const handleInstall = async (dt: DepartmentType) => {
    if (!orgId || installing) return;
    setInstalling(dt.id);
    try {
      await installDepartmentType(orgId, dt.id);
      setToast({ message: `"${dt.name}" has been installed successfully!`, type: 'success' });
      // Update install count locally
      setDepartmentTypes((prev) =>
        prev.map((item) =>
          item.id === dt.id ? { ...item, install_count: item.install_count + 1 } : item
        )
      );
      // Reload org departments so the new one appears
      loadDepartments();
    } catch {
      setToast({ message: 'Failed to install department. Please try again.', type: 'error' });
    } finally {
      setInstalling(null);
    }
  };

  // Delete a department
  const handleDelete = async (dept: Department) => {
    if (!orgId || deleting) return;
    setDeleting(dept.id);
    try {
      await deleteDepartment(orgId, dept.id);
      setDepartments((prev) => prev.filter((d) => d.id !== dept.id));
      setToast({ message: `"${dept.name}" has been deleted.`, type: 'success' });
    } catch {
      setToast({ message: 'Failed to delete department. Please try again.', type: 'error' });
    } finally {
      setDeleting(null);
      setConfirmDeleteId(null);
    }
  };

  // Open Manage Stores modal
  const handleOpenManageStores = (dept: Department) => {
    setManageStoresDept(dept);
    const assignments: Record<string, boolean> = {};
    for (const store of stores) {
      assignments[store.id] = store.department_ids?.includes(dept.id) || false;
    }
    setStoreAssignments(assignments);
  };

  // Save store assignments
  const handleSaveStoreAssignments = async () => {
    if (!orgId || !manageStoresDept) return;
    setSavingStores(true);
    try {
      const deptId = manageStoresDept.id;
      for (const store of stores) {
        const wasAssigned = store.department_ids?.includes(deptId) || false;
        const isNowAssigned = storeAssignments[store.id] || false;
        if (wasAssigned !== isNowAssigned) {
          const newDeptIds = isNowAssigned
            ? [...(store.department_ids || []), deptId]
            : (store.department_ids || []).filter((id) => id !== deptId);
          await updateStore(orgId, store.id, { department_ids: newDeptIds });
        }
      }
      setToast({ message: `Store assignments updated for "${manageStoresDept.name}"`, type: 'success' });
      setManageStoresDept(null);
      // Reload stores and departments to get updated counts
      loadStores();
      loadDepartments();
    } catch {
      setToast({ message: 'Failed to update store assignments.', type: 'error' });
    } finally {
      setSavingStores(false);
    }
  };

  // Get stores that have a specific department assigned
  const getStoresForDepartment = (deptId: string): Store[] => {
    return stores.filter(
      (store) => store.is_active && store.department_ids?.includes(deptId)
    );
  };

  // Start evaluation: open modal
  const handleOpenEvalModal = (dept: Department) => {
    setEvalDepartment(dept);
    setSelectedStoreId('');
    setStartingEval(false);
  };

  // Start evaluation: confirm
  const handleStartEvaluation = async () => {
    if (!orgId || !evalDepartment || !selectedStoreId || !user) return;
    setStartingEval(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const walk = await createDepartmentWalk(orgId, {
        store: selectedStoreId,
        department: evalDepartment.id,
        conducted_by: user.id,
        scheduled_date: today,
        status: 'in_progress',
      });
      setEvalDepartment(null);
      navigate(`/department-eval/${walk.id}`);
    } catch {
      setToast({ message: 'Failed to start evaluation. Please try again.', type: 'error' });
      setStartingEval(false);
    }
  };

  // Initial loading state
  if (deptLoading && activeTab === 'your-departments') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading departments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 pb-24">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Department Management</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Manage your organization's departments or install new ones from the library
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex gap-6">
          <button
            onClick={() => setActiveTab('your-departments')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'your-departments'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Your Departments
          </button>
          <button
            onClick={() => setActiveTab('library')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'library'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Department Library
          </button>
        </nav>
      </div>

      {/* ==================== Your Departments Tab ==================== */}
      {activeTab === 'your-departments' && (
        <div>
          {/* Error */}
          {deptError && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-700">{deptError}</p>
            </div>
          )}

          {departments.length === 0 ? (
            <div className="text-center py-16">
              <svg className="mx-auto w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6a1.125 1.125 0 01-1.125-1.125v-3.75zM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-8.25zM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-2.25z"
                />
              </svg>
              <p className="mt-3 text-sm text-gray-500">
                No departments yet. Install one from the Department Library tab.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {departments.map((dept) => (
                <div
                  key={dept.id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">
                          {dept.name}
                        </h3>
                        {!dept.is_active && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                            Inactive
                          </span>
                        )}
                        {dept.department_type_name && (
                          <span className="text-[10px] text-gray-400 hidden sm:inline">
                            from {dept.department_type_name}
                          </span>
                        )}
                      </div>
                      {dept.description && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                          {dept.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                            />
                          </svg>
                          {dept.section_count ?? 0} sections
                        </span>
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          {dept.store_count ?? 0} stores
                        </span>
                      </div>
                    </div>

                    {/* Eval button — always visible on the right */}
                    {dept.is_active && (
                      <button
                        onClick={() => handleOpenEvalModal(dept)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors flex-shrink-0"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                          />
                        </svg>
                        <span className="hidden sm:inline">Start Evaluation</span>
                        <span className="sm:hidden">Evaluate</span>
                      </button>
                    )}
                  </div>

                  {/* Admin actions — below on their own row */}
                  {isAdmin && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 flex-wrap">
                      {dept.is_active && (
                        <button
                          onClick={() => handleOpenManageStores(dept)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          Manage Stores
                        </button>
                      )}

                      {confirmDeleteId === dept.id ? (
                        <>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            disabled={deleting === dept.id}
                            className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleDelete(dept)}
                            disabled={deleting === dept.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                          >
                            {deleting === dept.id ? (
                              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : null}
                            Confirm Delete
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(dept.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
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
        </div>
      )}

      {/* ==================== Department Library Tab ==================== */}
      {activeTab === 'library' && (
        <div>
          {/* Error */}
          {libraryError && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-700">{libraryError}</p>
            </div>
          )}

          {libraryLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
            </div>
          ) : departmentTypes.length === 0 ? (
            <div className="text-center py-16">
              <svg className="mx-auto w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6a1.125 1.125 0 01-1.125-1.125v-3.75zM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-8.25zM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-2.25z"
                />
              </svg>
              <p className="mt-3 text-sm text-gray-500">
                No department types available in the library.
              </p>
            </div>
          ) : (
            <>
              {/* Industry filter pills */}
              {(() => {
                const industries = ['all', ...Array.from(new Set(departmentTypes.map((dt) => dt.industry)))];
                const filteredTypes =
                  activeIndustry === 'all'
                    ? departmentTypes
                    : departmentTypes.filter((dt) => dt.industry === activeIndustry);

                return (
                  <>
                    <div className="mb-6 flex flex-wrap gap-2">
                      {industries.map((industry) => {
                        const isActive = activeIndustry === industry;
                        const displayName =
                          industry === 'all'
                            ? 'All'
                            : departmentTypes.find((dt) => dt.industry === industry)?.industry_display || industry;
                        const count =
                          industry === 'all'
                            ? departmentTypes.length
                            : departmentTypes.filter((dt) => dt.industry === industry).length;

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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredTypes.map((dt) => (
                <div
                  key={dt.id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 hover:shadow-md hover:border-gray-300 transition-all"
                >
                  {/* Top row: name + badges */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="text-sm font-semibold text-gray-900">
                      {dt.name}
                    </h3>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${getCategoryColor(
                          dt.category
                        )}`}
                      >
                        {dt.category_display}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-gray-500 line-clamp-2 mb-4">
                    {dt.description || 'No description available.'}
                  </p>

                  {/* Stats row */}
                  <div className="flex items-center gap-4 text-xs text-gray-400 mb-4">
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"
                        />
                      </svg>
                      {dt.industry_display}
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                        />
                      </svg>
                      {dt.section_count} sections
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                      {dt.install_count} installs
                    </span>
                  </div>

                  {/* Install button */}
                  {isAdmin && (
                    <button
                      onClick={() => handleInstall(dt)}
                      disabled={installing === dt.id}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors shadow-sm disabled:opacity-50 w-full justify-center"
                    >
                      {installing === dt.id ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Installing...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                            />
                          </svg>
                          Install
                        </>
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
                  </>
                );
              })()}
            </>
          )}
        </div>
      )}

      {/* ==================== Start Evaluation Modal ==================== */}
      {evalDepartment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !startingEval && setEvalDepartment(null)}
          />
          {/* Modal */}
          <div className="relative bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              Start Evaluation
            </h2>
            <p className="text-sm text-gray-500 mb-5">
              Select a store to evaluate <span className="font-medium text-gray-700">{evalDepartment.name}</span>
            </p>

            {(() => {
              const eligibleStores = getStoresForDepartment(evalDepartment.id);

              if (eligibleStores.length === 0) {
                return (
                  <div className="text-center py-6">
                    <svg className="mx-auto w-10 h-10 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                      />
                    </svg>
                    <p className="text-sm text-gray-500">
                      No stores have this department assigned.
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Assign this department to a store first.
                    </p>
                  </div>
                );
              }

              return (
                <div>
                  <label htmlFor="eval-store-select" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Store
                  </label>
                  <select
                    id="eval-store-select"
                    value={selectedStoreId}
                    onChange={(e) => setSelectedStoreId(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  >
                    <option value="">Select a store...</option>
                    {eligibleStores.map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.name}{store.store_number ? ` (#${store.store_number})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })()}

            {/* Modal actions */}
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setEvalDepartment(null)}
                disabled={startingEval}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleStartEvaluation}
                disabled={!selectedStoreId || startingEval}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors shadow-sm disabled:opacity-50"
              >
                {startingEval ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Start
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== Manage Stores Modal ==================== */}
      {manageStoresDept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !savingStores && setManageStoresDept(null)}
          />
          <div className="relative bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              Manage Stores
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Select which stores have <span className="font-medium text-gray-700">{manageStoresDept.name}</span> available for evaluation.
            </p>

            {stores.filter((s) => s.is_active).length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">No active stores found.</p>
            ) : (
              <>
                {/* Select all / none */}
                <div className="flex items-center gap-3 mb-3 pb-3 border-b border-gray-100">
                  <button
                    onClick={() => {
                      const all: Record<string, boolean> = {};
                      stores.filter((s) => s.is_active).forEach((s) => { all[s.id] = true; });
                      setStoreAssignments((prev) => ({ ...prev, ...all }));
                    }}
                    className="text-xs font-medium text-primary-600 hover:text-primary-700"
                  >
                    Select all
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={() => {
                      const none: Record<string, boolean> = {};
                      stores.filter((s) => s.is_active).forEach((s) => { none[s.id] = false; });
                      setStoreAssignments((prev) => ({ ...prev, ...none }));
                    }}
                    className="text-xs font-medium text-gray-500 hover:text-gray-700"
                  >
                    Select none
                  </button>
                  <span className="ml-auto text-xs text-gray-400">
                    {Object.values(storeAssignments).filter(Boolean).length} selected
                  </span>
                </div>

                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {stores.filter((s) => s.is_active).map((store) => (
                    <label key={store.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={storeAssignments[store.id] || false}
                        onChange={(e) =>
                          setStoreAssignments((prev) => ({ ...prev, [store.id]: e.target.checked }))
                        }
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="text-sm text-gray-900">{store.name}</span>
                        {store.store_number && (
                          <span className="text-xs text-gray-400 ml-1.5">#{store.store_number}</span>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </>
            )}

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setManageStoresDept(null)}
                disabled={savingStores}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveStoreAssignments}
                disabled={savingStores}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors shadow-sm disabled:opacity-50"
              >
                {savingStores ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Assignments'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notification */}
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
    </div>
  );
}
