import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getActionItems } from '../api/walks';
import InfoButton from '../components/InfoButton';
import { getOrgId } from '../utils/org';
import type { ActionItem, ActionItemStatus } from '../types';

const STATUS_TABS: { key: ActionItemStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'dismissed', label: 'Dismissed' },
];

const PRIORITY_STYLES: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-gray-100 text-gray-600',
};

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  resolved: 'bg-green-100 text-green-700',
  dismissed: 'bg-gray-100 text-gray-500',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isOverdue(item: ActionItem): boolean {
  if (!item.due_date || item.status === 'resolved' || item.status === 'dismissed') return false;
  return new Date(item.due_date) < new Date();
}

export default function ActionItems() {
  const orgId = getOrgId();
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActionItemStatus | 'all'>('all');

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    async function load() {
      try {
        const params: Record<string, string> = {};
        if (activeTab !== 'all') params.status = activeTab;
        const data = await getActionItems(orgId, params);
        if (!cancelled) setItems(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    setLoading(true);
    load();
    return () => { cancelled = true; };
  }, [orgId, activeTab]);

  const openCount = items.filter(i => i.status === 'open' || i.status === 'in_progress').length;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 pb-24">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">Action Items <InfoButton contextKey="action-items-overview" /></h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Track and resolve corrective actions from store walks.
          {!loading && openCount > 0 && (
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
              {openCount} open
            </span>
          )}
        </p>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.key
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-gray-200 rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-8 text-center">
          <svg className="w-12 h-12 text-gray-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="mt-3 text-sm text-gray-500">
            {activeTab === 'all' ? 'No action items yet.' : `No ${activeTab.replace('_', ' ')} action items.`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <Link
              key={item.id}
              to={`/action-items/${item.id}`}
              className={`block bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4 hover:shadow-md transition-shadow active:bg-gray-50 ${
                isOverdue(item) ? 'border-l-4 border-red-400' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-gray-900 truncate">{item.criterion_name}</h3>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${PRIORITY_STYLES[item.priority]}`}>
                      {item.priority}
                    </span>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${STATUS_STYLES[item.status]}`}>
                      {item.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {item.store_name} &middot; Walk: {formatDate(item.walk_date)}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    {item.assigned_to_name && (
                      <span>Assigned: {item.assigned_to_name}</span>
                    )}
                    {item.due_date && (
                      <span className={isOverdue(item) ? 'text-red-500 font-medium' : ''}>
                        Due: {formatDate(item.due_date)}
                        {isOverdue(item) && ' (overdue)'}
                      </span>
                    )}
                    {item.response_count !== undefined && item.response_count > 0 && (
                      <span>{item.response_count} response{item.response_count !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>
                <svg className="w-4 h-4 text-gray-400 ml-2 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
