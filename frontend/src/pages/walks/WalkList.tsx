import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getWalks } from '../../api/walks';
import type { Walk } from '../../types';
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
  const [walks, setWalks] = useState<Walk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const orgId = getOrgId();
    if (!orgId) {
      setError('No organization found. Please log in again.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function fetchWalks() {
      try {
        const data = await getWalks(orgId);
        if (!cancelled) {
          setWalks(data);
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

    fetchWalks();
    return () => {
      cancelled = true;
    };
  }, []);

  // Group walks: in_progress first, then scheduled, then completed
  const inProgress = walks.filter((w) => w.status === 'in_progress');
  const scheduled = walks.filter((w) => w.status === 'scheduled');
  const completed = walks.filter((w) => w.status === 'completed');
  const groupedWalks = [...inProgress, ...scheduled, ...completed];

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
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Store Walks</h1>
        <p className="mt-1 text-sm text-gray-500">
          Your store evaluation history
        </p>
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
            No walks yet
          </h3>
          <p className="mt-1 text-sm text-gray-500 max-w-xs">
            Start your first store walk to evaluate store quality and generate
            actionable insights.
          </p>
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
              <Link
                key={walk.id}
                to={linkTo}
                className="block bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4 hover:shadow-md transition-shadow active:bg-gray-50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 truncate">
                      {walk.store_name}
                    </h3>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {walk.template_name}
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      <span className="text-xs text-gray-400">
                        {formatDate(walk.scheduled_date)}
                      </span>
                      <StatusBadge status={walk.status} />
                    </div>
                  </div>
                  <div className="flex-shrink-0 ml-4 flex items-center">
                    {walk.status === 'completed' && walk.total_score !== null ? (
                      <ScoreBadge score={walk.total_score} />
                    ) : walk.status === 'in_progress' ? (
                      <div className="flex items-center gap-1 text-amber-600">
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
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </div>
                    ) : (
                      <svg
                        className="w-5 h-5 text-gray-300"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    )}
                  </div>
                </div>
                {walk.status === 'in_progress' && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-amber-600 font-medium">
                      Tap to continue this walk
                    </p>
                  </div>
                )}
              </Link>
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
