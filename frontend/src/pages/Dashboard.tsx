import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getStores, getWalks, getTemplates } from '../api/walks';
import { getOrgId } from '../utils/org';
import type { Walk, Store, ScoringTemplate } from '../types';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function getScoreColor(pct: number): string {
  if (pct >= 80) return 'text-green-600';
  if (pct >= 60) return 'text-amber-600';
  return 'text-red-600';
}

export default function Dashboard() {
  const { user } = useAuth();
  const orgId = getOrgId();

  const [stores, setStores] = useState<Store[]>([]);
  const [walks, setWalks] = useState<Walk[]>([]);
  const [templates, setTemplates] = useState<ScoringTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchAll() {
      try {
        const [storeData, walkData, templateData] = await Promise.all([
          getStores(orgId).catch(() => [] as Store[]),
          getWalks(orgId).catch(() => [] as Walk[]),
          getTemplates(orgId).catch(() => [] as ScoringTemplate[]),
        ]);

        if (!cancelled) {
          setStores(storeData);
          setWalks(walkData);
          setTemplates(templateData);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAll();
    return () => { cancelled = true; };
  }, [orgId]);

  const activeStores = stores.filter((s) => s.is_active);
  const inProgressWalks = walks.filter((w) => w.status === 'in_progress');
  const completedWalks = walks
    .filter((w) => w.status === 'completed')
    .sort((a, b) => new Date(b.completed_date || b.updated_at).getTime() - new Date(a.completed_date || a.updated_at).getTime());
  const recentWalks = completedWalks.slice(0, 5);
  const activeTemplates = templates.filter((t) => t.is_active);

  // Average score across completed walks
  const scoredWalks = completedWalks.filter((w) => w.total_score !== null);
  const avgScore = scoredWalks.length > 0
    ? scoredWalks.reduce((sum, w) => sum + (w.total_score ?? 0), 0) / scoredWalks.length
    : null;

  const statCards = [
    {
      title: 'Stores',
      value: loading ? '--' : String(activeStores.length),
      description: 'Active registered stores',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      color: 'bg-primary-600',
    },
    {
      title: 'In Progress',
      value: loading ? '--' : String(inProgressWalks.length),
      description: 'Walks currently in progress',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
      color: 'bg-amber-500',
    },
    {
      title: 'Completed',
      value: loading ? '--' : String(completedWalks.length),
      description: 'Total completed walks',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'bg-green-500',
    },
    {
      title: 'Avg Score',
      value: loading ? '--' : avgScore !== null ? `${Math.round(avgScore)}%` : 'N/A',
      description: activeTemplates.length > 0 ? `Using ${activeTemplates.length} template${activeTemplates.length !== 1 ? 's' : ''}` : 'No templates configured',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      color: 'bg-violet-500',
    },
  ];

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 pb-24">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">
          Welcome back, {user?.first_name || 'User'}
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Here's your store evaluation overview.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statCards.map((card) => (
          <div
            key={card.title}
            className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4"
          >
            <div className="flex items-center gap-3">
              <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${card.color} text-white flex-shrink-0`}>
                {card.icon}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500 truncate">{card.title}</p>
                <p className="text-xl font-bold text-gray-900">{card.value}</p>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-gray-400 truncate">{card.description}</p>
          </div>
        ))}
      </div>

      {/* Continue in-progress walks */}
      {inProgressWalks.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Continue Where You Left Off</h2>
          <div className="space-y-2">
            {inProgressWalks.map((walk) => (
              <Link
                key={walk.id}
                to={`/walks/${walk.id}/conduct`}
                className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl p-4 hover:bg-amber-100 transition-colors active:bg-amber-100"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 truncate">{walk.store_name}</p>
                  <p className="text-xs text-amber-700 mt-0.5">{walk.template_name}</p>
                </div>
                <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                  <span className="text-xs font-medium text-amber-600">Continue</span>
                  <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent completed walks */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Recent Walks</h2>
          {completedWalks.length > 5 && (
            <Link to="/walks" className="text-xs font-medium text-primary-600 hover:text-primary-700">
              View all
            </Link>
          )}
        </div>

        {recentWalks.length > 0 ? (
          <div className="space-y-2">
            {recentWalks.map((walk) => (
              <Link
                key={walk.id}
                to={`/walks/${walk.id}`}
                className="flex items-center justify-between bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4 hover:shadow-md transition-shadow active:bg-gray-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 truncate">{walk.store_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDate(walk.scheduled_date)}
                  </p>
                </div>
                {walk.total_score !== null && (
                  <span className={`text-lg font-bold ml-3 flex-shrink-0 ${getScoreColor(walk.total_score)}`}>
                    {Math.round(walk.total_score)}%
                  </span>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-6 text-center">
            <svg className="w-10 h-10 text-gray-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="mt-2 text-sm text-gray-500">No completed walks yet</p>
            <Link
              to="/walks/new"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              Start your first walk
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        )}
      </div>

      {/* Quick action: Start Walk */}
      <div className="mt-6">
        <Link
          to="/walks/new"
          className="flex items-center justify-center gap-2 w-full rounded-xl bg-primary-600 px-4 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-primary-700 active:bg-primary-800 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Start New Walk
        </Link>
      </div>
    </div>
  );
}
