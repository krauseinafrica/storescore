import { useEffect, useState } from 'react';
import { getCorrectiveActions, updateCorrectiveAction, getStores, createCorrectiveAction } from '../api/walks';
import { getMembers } from '../api/members';
import { useAuth } from '../hooks/useAuth';
import InfoButton from '../components/InfoButton';
import { getOrgId } from '../utils/org';
import type { CorrectiveAction, CorrectiveActionStatus, EscalationLevel, Store, OrgMember } from '../types';

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

const ACTION_TYPE_OPTIONS: { key: string; label: string }[] = [
  { key: 'all', label: 'All Types' },
  { key: 'overdue_evaluation', label: 'Overdue Eval' },
  { key: 'unacknowledged_walk', label: 'Unacknowledged Walk' },
  { key: 'manual', label: 'Manual' },
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
  manual: 'Manual',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function CorrectiveActionsContent() {
  const orgId = getOrgId();
  const { hasRole } = useAuth();
  const canCreate = hasRole('manager');

  const [items, setItems] = useState<CorrectiveAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<CorrectiveActionStatus | 'all'>('all');
  const [escalationFilter, setEscalationFilter] = useState<EscalationLevel | 'all'>('all');
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // Filter state
  const [stores, setStores] = useState<Store[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [storeFilter, setStoreFilter] = useState('all');
  const [actionTypeFilter, setActionTypeFilter] = useState('all');

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formStore, setFormStore] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formEscalation, setFormEscalation] = useState<EscalationLevel>('reminder');
  const [formResponsibleUser, setFormResponsibleUser] = useState('');

  // Load stores + members once
  useEffect(() => {
    if (!orgId) return;
    getStores(orgId).then(setStores).catch(() => {});
    getMembers(orgId).then(setMembers).catch(() => {});
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    async function load() {
      try {
        const params: Record<string, string> = {};
        if (activeTab !== 'all') params.status = activeTab;
        if (escalationFilter !== 'all') params.escalation_level = escalationFilter;
        if (storeFilter !== 'all') params.store = storeFilter;
        if (actionTypeFilter !== 'all') params.action_type = actionTypeFilter;
        const data = await getCorrectiveActions(orgId, params);
        if (!cancelled) setItems(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    setLoading(true);
    load();
    return () => { cancelled = true; };
  }, [orgId, activeTab, escalationFilter, storeFilter, actionTypeFilter]);

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

  async function handleCreate() {
    if (!orgId || !formStore || !formNotes.trim()) return;
    setCreating(true);
    try {
      const data: Parameters<typeof createCorrectiveAction>[1] = {
        store: formStore,
        notes: formNotes.trim(),
        escalation_level: formEscalation,
      };
      if (formResponsibleUser) data.responsible_user = formResponsibleUser;
      const created = await createCorrectiveAction(orgId, data);
      setItems(prev => [created, ...prev]);
      setShowAddModal(false);
      setFormStore('');
      setFormNotes('');
      setFormEscalation('reminder');
      setFormResponsibleUser('');
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      {/* Header with Add button */}
      {canCreate && (
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-600 text-white hover:bg-primary-700 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Corrective Action
          </button>
        </div>
      )}

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
      <div className="flex gap-1 mb-3 overflow-x-auto pb-1">
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

      {/* Filter row */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={storeFilter}
          onChange={e => setStoreFilter(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg border border-gray-300 text-xs bg-white focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
        >
          <option value="all">All Stores</option>
          {stores.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <div className="flex gap-1 overflow-x-auto">
          {ACTION_TYPE_OPTIONS.map(at => (
            <button
              key={at.key}
              onClick={() => setActionTypeFilter(at.key)}
              className={`px-2.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                actionTypeFilter === at.key
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {at.label}
            </button>
          ))}
        </div>
      </div>

      {/* Add Corrective Action Modal */}
      {showAddModal && (
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">New Corrective Action</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Store *</label>
              <select
                value={formStore}
                onChange={e => setFormStore(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Select a store...</option>
                {stores.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Notes *</label>
              <textarea
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Describe the corrective action..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Escalation Level</label>
                <select
                  value={formEscalation}
                  onChange={e => setFormEscalation(e.target.value as EscalationLevel)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="reminder">Reminder</option>
                  <option value="escalated">Escalated</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Responsible User</label>
                <select
                  value={formResponsibleUser}
                  onChange={e => setFormResponsibleUser(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">Unassigned</option>
                  {members.map(m => (
                    <option key={m.user.id} value={m.user.id}>{m.user.first_name} {m.user.last_name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !formStore || !formNotes.trim()}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                    {item.is_manual && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-violet-100 text-violet-700">
                        Manual
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900 mt-1.5">{item.store_name}</h3>
                  {item.is_manual && item.notes && (
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">{item.notes}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    {item.responsible_user_name && (
                      <span>Responsible: {item.responsible_user_name}</span>
                    )}
                    {item.days_overdue > 0 && (
                      <span className="text-red-500 font-medium">{item.days_overdue} day{item.days_overdue !== 1 ? 's' : ''} overdue</span>
                    )}
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
    </>
  );
}

export default function CorrectiveActions() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 pb-24">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">Corrective Actions <InfoButton contextKey="corrective-actions-overview" /></h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Track escalated issues from overdue evaluations and unacknowledged walk follow-ups.
        </p>
      </div>
      <CorrectiveActionsContent />
    </div>
  );
}
