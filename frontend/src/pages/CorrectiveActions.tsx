import { useEffect, useState } from 'react';
import { getCorrectiveActions, updateCorrectiveAction } from '../api/walks';
import InfoButton from '../components/InfoButton';
import { getOrgId } from '../utils/org';
import type { CorrectiveAction, CorrectiveActionStatus, EscalationLevel } from '../types';

const STATUS_TABS: { key: CorrectiveActionStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'resolved', label: 'Resolved' },
];

const ESCALATION_PILLS: { key: EscalationLevel | 'all'; label: string }[] = [
  { key: 'all', label: 'All Levels' },
  { key: 'critical', label: 'Critical' },
  { key: 'escalated', label: 'Escalated' },
  { key: 'reminder', label: 'Reminder' },
];

const ESCALATION_STYLES: Record<EscalationLevel, string> = {
  critical: 'bg-red-100 text-red-700',
  escalated: 'bg-orange-100 text-orange-700',
  reminder: 'bg-amber-100 text-amber-700',
};

const STATUS_STYLES: Record<CorrectiveActionStatus, string> = {
  open: 'bg-blue-100 text-blue-700',
  resolved: 'bg-green-100 text-green-700',
};

const ACTION_TYPE_LABELS: Record<string, string> = {
  overdue_evaluation: 'Overdue Evaluation',
  unacknowledged_walk: 'Unacknowledged Walk',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function CorrectiveActions() {
  const orgId = getOrgId();
  const [items, setItems] = useState<CorrectiveAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<CorrectiveActionStatus | 'all'>('all');
  const [escalationFilter, setEscalationFilter] = useState<EscalationLevel | 'all'>('all');
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    async function load() {
      try {
        const params: Record<string, string> = {};
        if (activeTab !== 'all') params.status = activeTab;
        if (escalationFilter !== 'all') params.escalation_level = escalationFilter;
        const data = await getCorrectiveActions(orgId, params);
        if (!cancelled) setItems(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    setLoading(true);
    load();
    return () => { cancelled = true; };
  }, [orgId, activeTab, escalationFilter]);

  const openCount = items.filter(i => i.status === 'open').length;

  async function handleResolve(id: string) {
    if (!orgId) return;
    setResolvingId(id);
    try {
      const updated = await updateCorrectiveAction(orgId, id, { status: 'resolved' });
      setItems(prev => prev.map(item => item.id === id ? updated : item));
    } finally {
      setResolvingId(null);
    }
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 pb-24">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">Corrective Actions <InfoButton contextKey="corrective-actions-overview" /></h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Track escalated issues from overdue evaluations and unacknowledged walk follow-ups.
          {!loading && openCount > 0 && (
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
              {openCount} open
            </span>
          )}
        </p>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 mb-3 overflow-x-auto pb-1">
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

      {/* Escalation level pills */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {ESCALATION_PILLS.map(pill => (
          <button
            key={pill.key}
            onClick={() => setEscalationFilter(pill.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              escalationFilter === pill.key
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-gray-200 rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-8 text-center">
          <svg className="w-12 h-12 text-gray-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="mt-3 text-sm text-gray-500">
            {activeTab === 'all' && escalationFilter === 'all'
              ? 'No corrective actions found.'
              : 'No corrective actions match the selected filters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div
              key={item.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${ESCALATION_STYLES[item.escalation_level]}`}>
                      {item.escalation_level}
                    </span>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-600">
                      {ACTION_TYPE_LABELS[item.action_type] ?? item.action_type}
                    </span>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${STATUS_STYLES[item.status]}`}>
                      {item.status}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900 mt-1.5">{item.store_name}</h3>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    {item.responsible_user_name && (
                      <span>Responsible: {item.responsible_user_name}</span>
                    )}
                    <span className="text-red-500 font-medium">{item.days_overdue} day{item.days_overdue !== 1 ? 's' : ''} overdue</span>
                  </div>
                  {item.walk_date && (
                    <p className="text-xs text-gray-400 mt-1">
                      Walk date: {formatDate(item.walk_date)}
                    </p>
                  )}
                </div>
                {item.status === 'open' && (
                  <button
                    onClick={() => handleResolve(item.id)}
                    disabled={resolvingId === item.id}
                    className="ml-3 flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {resolvingId === item.id ? 'Resolving...' : 'Resolve'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
