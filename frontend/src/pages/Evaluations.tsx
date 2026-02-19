import { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import TabBar from '../components/TabBar';
import InfoButton from '../components/InfoButton';
import { WalksListContent } from './walks/WalkList';
import { SelfAssessmentsContent } from './SelfAssessments';
import { SchedulesContent } from './Schedules';
import { getDepartmentWalks } from '../api/walks';
import { getOrgId } from '../utils/org';
import type { Walk } from '../types';

// ---------- Department Evaluations Tab Content ----------

function DepartmentEvalsContent() {
  const orgId = getOrgId();
  const [walks, setWalks] = useState<Walk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    async function load() {
      try {
        const data = await getDepartmentWalks(orgId);
        if (!cancelled) setWalks(data);
      } catch {
        if (!cancelled) setError('Failed to load department evaluations.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [orgId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading department evaluations...</p>
        </div>
      </div>
    );
  }

  const inProgress = walks.filter(w => w.status === 'in_progress');
  const scheduled = walks.filter(w => w.status === 'scheduled');
  const completed = walks.filter(w => w.status === 'completed');
  const grouped = [...inProgress, ...scheduled, ...completed];

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          {grouped.length} evaluation{grouped.length !== 1 ? 's' : ''}
        </p>
        <Link
          to="/departments"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="hidden sm:inline">New Evaluation</span>
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">{error}</div>
      )}

      {grouped.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-gray-900">No department evaluations yet</h3>
          <p className="mt-1 text-sm text-gray-500 max-w-xs">
            Go to the Departments page to start your first department evaluation.
          </p>
          <Link
            to="/departments"
            className="mt-4 text-sm font-medium text-primary-600 hover:text-primary-700"
          >
            Go to Departments &rarr;
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map((walk) => {
            const linkTo = walk.status === 'completed'
              ? `/walks/${walk.id}`
              : `/department-eval/${walk.id}`;

            return (
              <Link
                key={walk.id}
                to={linkTo}
                className="block bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 truncate">
                      {walk.department_name || 'Department Evaluation'}
                    </h3>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {walk.store_name}
                      {walk.conducted_by_name && (
                        <span className="text-gray-400"> &middot; {walk.conducted_by_name}</span>
                      )}
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      <span className="text-xs text-gray-400">
                        {new Date(walk.scheduled_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        walk.status === 'in_progress' ? 'bg-amber-100 text-amber-700' :
                        walk.status === 'completed' ? 'bg-green-100 text-green-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {walk.status === 'in_progress' ? 'In Progress' : walk.status === 'completed' ? 'Completed' : 'Scheduled'}
                      </span>
                    </div>
                  </div>
                  {walk.status === 'completed' && walk.total_score !== null && (
                    <span className={`text-lg font-bold ${walk.total_score >= 80 ? 'text-green-600' : walk.total_score >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                      {Math.round(walk.total_score)}%
                    </span>
                  )}
                </div>
                {walk.status === 'in_progress' && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Continue Evaluation
                    </span>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

// ---------- Main Evaluations Page ----------

export default function Evaluations() {
  const { hasRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = hasRole('admin');

  const TABS = [
    { key: 'walks', label: 'Store Walks' },
    { key: 'department', label: 'Department Evals' },
    { key: 'assessments', label: 'Assessments' },
    ...(isAdmin ? [{ key: 'schedules', label: 'Schedules' }] : []),
  ];

  const hashTab = location.hash.replace('#', '');
  const validKeys = new Set(TABS.map(t => t.key));
  // If ?assessment= param is present, auto-switch to assessments tab
  const searchParams = new URLSearchParams(location.search);
  const hasAssessmentParam = searchParams.has('assessment');
  const initialTab = hasAssessmentParam ? 'assessments' : (validKeys.has(hashTab) ? hashTab : 'walks');
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    const tab = location.hash.replace('#', '');
    if (validKeys.has(tab) && tab !== activeTab) {
      setActiveTab(tab);
    }
    // Also check for ?assessment= param
    const params = new URLSearchParams(location.search);
    if (params.has('assessment') && activeTab !== 'assessments') {
      setActiveTab('assessments');
    }
  }, [location.hash, location.search]);

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    navigate(`/evaluations#${key}`, { replace: true });
  };

  // Configure links per tab (admin only)
  const configLinks: Record<string, { label: string; path: string }> = {
    walks: { label: 'Configure templates', path: '/templates' },
    department: { label: 'Manage departments', path: '/departments' },
    assessments: { label: 'Assessment templates', path: '/templates#assessments' },
    schedules: { label: 'Configure templates', path: '/templates' },
  };

  const configLink = configLinks[activeTab];

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 pb-24">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          Evaluations <InfoButton contextKey="evaluations-overview" />
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">
          All your store evaluations in one place
        </p>
      </div>

      <TabBar tabs={TABS} activeTab={activeTab} onChange={handleTabChange} />

      {isAdmin && configLink && (
        <div className="flex justify-end mb-4 -mt-2">
          <Link
            to={configLink.path}
            className="text-xs text-gray-400 hover:text-primary-600 transition-colors"
          >
            {configLink.label} &rarr;
          </Link>
        </div>
      )}

      {activeTab === 'walks' && <WalksListContent />}
      {activeTab === 'department' && <DepartmentEvalsContent />}
      {activeTab === 'assessments' && <SelfAssessmentsContent />}
      {activeTab === 'schedules' && <SchedulesContent />}
    </div>
  );
}
