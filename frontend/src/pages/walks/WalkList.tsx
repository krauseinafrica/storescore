import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import InfoButton from '../../components/InfoButton';
import { getWalks, getStores, getRegions, deleteWalk } from '../../api/walks';
import type { Walk, Store, Region } from '../../types';
import { getOrgId } from '../../utils/org';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function StatusBadge({ status }: { status: Walk['status'] }) {
  const config: Record<Walk['status'], { label: string; classes: string }> = {
    scheduled: {
      label: 'Scheduled',
      classes: 'bg-blue-100 text-blue-700',
    },
    in_progress: {
      label: 'In Progress',
      classes: 'bg-amber-100 text-amber-700',
    },
    completed: {
      label: 'Completed',
      classes: 'bg-green-100 text-green-700',
    },
  };

  const { label, classes } = config[status] || config.scheduled;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${classes}`}
    >
      {label}
    </span>
  );
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null || score === undefined) return null;

  let colorClass = 'text-red-600';
  if (score >= 80) colorClass = 'text-green-600';
  else if (score >= 60) colorClass = 'text-amber-600';

  return (
    <span className={`text-lg font-bold ${colorClass}`}>
      {Math.round(score)}%
    </span>
  );
}

export default function WalkList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [walks, setWalks] = useState<Walk[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filters
  const [storeFilter, setStoreFilter] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [evaluatorFilter, setEvaluatorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [verificationFilter, setVerificationFilter] = useState('');

  useEffect(() => {
    const orgId = getOrgId();
    if (!orgId) {
      setError('No organization found. Please log in again.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function fetchData() {
      try {
        const [walksData, storesData, regionsData] = await Promise.all([
          getWalks(orgId),
          getStores(orgId).catch(() => []),
          getRegions(orgId).catch(() => []),
        ]);
        if (!cancelled) {
          setWalks(walksData);
          setStores(storesData);
          setRegions(regionsData);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(
            err.response?.data?.detail ||
              'Failed to load walks. Please try again.'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  // Build lookup: store_id -> region_id
  const storeRegionMap = useMemo(() => {
    const map: Record<string, string> = {};
    stores.forEach((s) => {
      if (s.region) map[s.id] = s.region;
    });
    return map;
  }, [stores]);

  // Extract unique evaluators from walks
  const evaluators = useMemo(() => {
    const map = new Map<string, string>();
    walks.forEach((w) => {
      if (w.conducted_by && w.conducted_by_name) {
        map.set(w.conducted_by, w.conducted_by_name);
      }
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [walks]);

  // Filter walks
  const filteredWalks = useMemo(() => {
    return walks.filter((w) => {
      if (storeFilter && w.store !== storeFilter) return false;
      if (regionFilter) {
        const walkRegion = storeRegionMap[w.store];
        if (walkRegion !== regionFilter) return false;
      }
      if (evaluatorFilter && w.conducted_by !== evaluatorFilter) return false;
      if (statusFilter && w.status !== statusFilter) return false;
      if (verificationFilter) {
        if (verificationFilter === 'gps' && !w.location_verified) return false;
        if (verificationFilter === 'qr' && !w.qr_verified) return false;
        if (verificationFilter === 'unverified' && (w.location_verified || w.qr_verified)) return false;
      }
      return true;
    });
  }, [walks, storeFilter, regionFilter, evaluatorFilter, statusFilter, verificationFilter, storeRegionMap]);

  // Group walks: in_progress first, then scheduled, then completed
  const groupedWalks = useMemo(() => {
    const inProgress = filteredWalks.filter((w) => w.status === 'in_progress');
    const scheduled = filteredWalks.filter((w) => w.status === 'scheduled');
    const completed = filteredWalks.filter((w) => w.status === 'completed');
    return [...inProgress, ...scheduled, ...completed];
  }, [filteredWalks]);

  async function handleDelete(walkId: string, storeName: string) {
    if (!confirm(`Delete the walk for ${storeName}? This cannot be undone.`)) return;
    const orgId = getOrgId();
    setDeletingId(walkId);
    try {
      await deleteWalk(orgId, walkId);
      setWalks((prev) => prev.filter((w) => w.id !== walkId));
    } catch {
      setError('Failed to delete walk.');
    } finally {
      setDeletingId(null);
    }
  }

  const hasActiveFilters = storeFilter || regionFilter || evaluatorFilter || statusFilter || verificationFilter;

  // Stores filtered by selected region for the store dropdown
  const filteredStoresForDropdown = regionFilter
    ? stores.filter((s) => s.region === regionFilter)
    : stores;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading walks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">Store Walks <InfoButton contextKey="walks-overview" /></h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {loading ? 'Loading...' : `${groupedWalks.length} walk${groupedWalks.length !== 1 ? 's' : ''}`}
            {hasActiveFilters ? ' (filtered)' : ''}
          </p>
        </div>
        <Link
          to="/walks/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="hidden sm:inline">New Walk</span>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {regions.length > 0 && (
          <select
            value={regionFilter}
            onChange={(e) => {
              setRegionFilter(e.target.value);
              // Clear store filter if it doesn't belong to the selected region
              if (e.target.value && storeFilter) {
                const storeRegion = storeRegionMap[storeFilter];
                if (storeRegion !== e.target.value) setStoreFilter('');
              }
            }}
            className="rounded-lg border-gray-300 bg-white text-sm py-2 pl-3 pr-8 shadow-sm ring-1 ring-gray-900/5 focus:border-primary-500 focus:ring-primary-500"
          >
            <option value="">All Regions</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        )}

        <select
          value={storeFilter}
          onChange={(e) => setStoreFilter(e.target.value)}
          className="rounded-lg border-gray-300 bg-white text-sm py-2 pl-3 pr-8 shadow-sm ring-1 ring-gray-900/5 focus:border-primary-500 focus:ring-primary-500"
        >
          <option value="">All Stores</option>
          {filteredStoresForDropdown
            .filter((s) => s.is_active)
            .map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
        </select>

        {evaluators.length > 1 && (
          <select
            value={evaluatorFilter}
            onChange={(e) => setEvaluatorFilter(e.target.value)}
            className="rounded-lg border-gray-300 bg-white text-sm py-2 pl-3 pr-8 shadow-sm ring-1 ring-gray-900/5 focus:border-primary-500 focus:ring-primary-500"
          >
            <option value="">All Evaluators</option>
            {evaluators.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        )}

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border-gray-300 bg-white text-sm py-2 pl-3 pr-8 shadow-sm ring-1 ring-gray-900/5 focus:border-primary-500 focus:ring-primary-500"
        >
          <option value="">All Status</option>
          <option value="in_progress">In Progress</option>
          <option value="scheduled">Scheduled</option>
          <option value="completed">Completed</option>
        </select>

        <select
          value={verificationFilter}
          onChange={(e) => setVerificationFilter(e.target.value)}
          className="rounded-lg border-gray-300 bg-white text-sm py-2 pl-3 pr-8 shadow-sm ring-1 ring-gray-900/5 focus:border-primary-500 focus:ring-primary-500"
        >
          <option value="">All Verification</option>
          <option value="gps">GPS Verified</option>
          <option value="qr">QR Verified</option>
          <option value="unverified">Unverified</option>
        </select>

        {hasActiveFilters && (
          <button
            onClick={() => {
              setStoreFilter('');
              setRegionFilter('');
              setEvaluatorFilter('');
              setStatusFilter('');
              setVerificationFilter('');
            }}
            className="text-xs text-primary-600 hover:text-primary-700 font-medium px-2 py-2"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!error && groupedWalks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-gray-900">
            {hasActiveFilters ? 'No walks match your filters' : 'No walks yet'}
          </h3>
          <p className="mt-1 text-sm text-gray-500 max-w-xs">
            {hasActiveFilters
              ? 'Try adjusting your filters to see more results.'
              : 'Start your first store walk to evaluate store quality and generate actionable insights.'}
          </p>
          {!hasActiveFilters && (
            <Link
              to="/walks/new"
              className="mt-6 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors shadow-sm"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Start New Walk
            </Link>
          )}
        </div>
      )}

      {/* Walk list */}
      {groupedWalks.length > 0 && (
        <div className="space-y-3">
          {groupedWalks.map((walk) => {
            const linkTo =
              walk.status === 'completed'
                ? `/walks/${walk.id}`
                : walk.status === 'in_progress'
                  ? `/walks/${walk.id}/conduct`
                  : `/walks/${walk.id}`;

            return (
              <div
                key={walk.id}
                className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4 hover:shadow-md transition-shadow"
              >
                <Link to={linkTo} className="block active:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">
                        {walk.store_name}
                      </h3>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {walk.template_name}
                        {walk.conducted_by_name && (
                          <span className="text-gray-400"> &middot; {walk.conducted_by_name}</span>
                        )}
                      </p>
                      <div className="mt-2 flex items-center gap-3">
                        <span className="text-xs text-gray-400">
                          {formatDate(walk.scheduled_date)}
                        </span>
                        <StatusBadge status={walk.status} />
                        {walk.location_verified && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700" title={walk.location_distance_meters != null ? `${Math.round(walk.location_distance_meters)}m from store` : 'GPS verified'}>
                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                            GPS
                          </span>
                        )}
                        {walk.qr_verified && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700">
                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
                            QR
                          </span>
                        )}
                        {walk.status === 'completed' && !walk.location_verified && !walk.qr_verified && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">
                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01" /></svg>
                            Unverified
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0 ml-4 flex items-center">
                      {walk.status === 'completed' && walk.total_score !== null ? (
                        <ScoreBadge score={walk.total_score} />
                      ) : null}
                    </div>
                  </div>
                </Link>

                {/* Action buttons for non-completed walks */}
                {walk.status !== 'completed' && (
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
                    <Link
                      to={walk.status === 'in_progress' ? `/walks/${walk.id}/conduct` : `/walks/${walk.id}/conduct`}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary-50 text-primary-700 text-xs font-semibold hover:bg-primary-100 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {walk.status === 'in_progress' ? 'Continue' : 'Start'}
                    </Link>
                    <button
                      onClick={() => handleDelete(walk.id, walk.store_name)}
                      disabled={deletingId === walk.id}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-red-600 text-xs font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      {deletingId === walk.id ? (
                        <div className="w-3.5 h-3.5 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" />
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                      Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Action Button */}
      <Link
        to="/walks/new"
        className="fixed bottom-6 right-6 z-30 flex items-center justify-center w-14 h-14 rounded-full bg-primary-600 text-white shadow-lg hover:bg-primary-700 active:scale-95 transition-all"
        aria-label="Start new walk"
      >
        <svg
          className="w-7 h-7"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M12 4v16m8-8H4"
          />
        </svg>
      </Link>
    </div>
  );
}
