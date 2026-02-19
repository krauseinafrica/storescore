import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getActionItems, getStores, createActionItem } from '../api/walks';
import { getMembers } from '../api/members';
import { useAuth } from '../hooks/useAuth';
import InfoButton from '../components/InfoButton';
import { getOrgId } from '../utils/org';
import type { ActionItem, ActionItemStatus, Store, OrgMember } from '../types';

const STATUS_TABS: { key: ActionItemStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'pending_review', label: 'Pending Review' },
  { key: 'approved', label: 'Approved' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'dismissed', label: 'Dismissed' },
];

const PRIORITY_OPTIONS = [
  { key: 'all', label: 'All Priorities' },
  { key: 'critical', label: 'Critical' },
  { key: 'high', label: 'High' },
  { key: 'medium', label: 'Medium' },
  { key: 'low', label: 'Low' },
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
  pending_review: 'bg-violet-100 text-violet-700',
  approved: 'bg-green-100 text-green-700',
  dismissed: 'bg-gray-100 text-gray-500',
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  pending_review: 'Pending Review',
  approved: 'Approved',
  dismissed: 'Dismissed',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isOverdue(item: ActionItem): boolean {
  if (!item.due_date || ['resolved', 'approved', 'pending_review', 'dismissed'].includes(item.status)) return false;
  return new Date(item.due_date) < new Date();
}

export function ActionItemsContent() {
  const orgId = getOrgId();
  const { hasRole, user } = useAuth();
  const canCreate = hasRole('manager');

  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActionItemStatus | 'all'>('all');

  // Filter state
  const [stores, setStores] = useState<Store[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [storeFilter, setStoreFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [assignedToFilter, setAssignedToFilter] = useState('all');

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formStore, setFormStore] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPriority, setFormPriority] = useState('medium');
  const [formAssignedTo, setFormAssignedTo] = useState('');
  const [formDueDate, setFormDueDate] = useState('');

  // Load stores + members once
  useEffect(() => {
    if (!orgId) return;
    getStores(orgId).then(setStores).catch(() => {});
    getMembers(orgId).then(setMembers).catch(() => {});
  }, [orgId]);

  // Load items when filters change
  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    async function load() {
      try {
        const params: Record<string, string> = {};
        if (activeTab !== 'all') params.status = activeTab;
        if (storeFilter !== 'all') params.store = storeFilter;
        if (priorityFilter !== 'all') params.priority = priorityFilter;
        if (assignedToFilter !== 'all') params.assigned_to = assignedToFilter;
        const data = await getActionItems(orgId, params);
        if (!cancelled) setItems(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    setLoading(true);
    load();
    return () => { cancelled = true; };
  }, [orgId, activeTab, storeFilter, priorityFilter, assignedToFilter]);

  async function handleCreate() {
    if (!orgId || !formStore || !formDescription.trim()) return;
    setCreating(true);
    try {
      const data: Parameters<typeof createActionItem>[1] = {
        store: formStore,
        description: formDescription.trim(),
        priority: formPriority,
      };
      if (formAssignedTo) data.assigned_to = formAssignedTo;
      if (formDueDate) data.due_date = formDueDate;
      const created = await createActionItem(orgId, data);
      setItems(prev => [created, ...prev]);
      setShowAddModal(false);
      setFormStore('');
      setFormDescription('');
      setFormPriority('medium');
      setFormAssignedTo('');
      setFormDueDate('');
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
            Add Action Item
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
          {PRIORITY_OPTIONS.map(p => (
            <button
              key={p.key}
              onClick={() => setPriorityFilter(p.key)}
              className={`px-2.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                priorityFilter === p.key
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <select
          value={assignedToFilter}
          onChange={e => setAssignedToFilter(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg border border-gray-300 text-xs bg-white focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
        >
          <option value="all">All Assignees</option>
          <option value="me">Assigned to Me</option>
          {members.map(m => (
            <option key={m.user.id} value={m.user.id}>{m.user.first_name} {m.user.last_name}</option>
          ))}
        </select>
      </div>

      {/* Add Action Item Modal */}
      {showAddModal && (
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">New Action Item</h3>
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
              <label className="block text-xs font-medium text-gray-700 mb-1">Description *</label>
              <textarea
                value={formDescription}
                onChange={e => setFormDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Describe the action item..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Priority</label>
                <select
                  value={formPriority}
                  onChange={e => setFormPriority(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Due Date</label>
                <input
                  type="date"
                  value={formDueDate}
                  onChange={e => setFormDueDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Assigned To</label>
              <select
                value={formAssignedTo}
                onChange={e => setFormAssignedTo(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Unassigned</option>
                {members.map(m => (
                  <option key={m.user.id} value={m.user.id}>{m.user.first_name} {m.user.last_name}</option>
                ))}
              </select>
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
                disabled={creating || !formStore || !formDescription.trim()}
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
                      {STATUS_LABELS[item.status] || item.status.replace('_', ' ')}
                    </span>
                    {item.is_manual && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-violet-100 text-violet-700">
                        Manual
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {item.store_name}
                    {item.walk_date && <> &middot; Walk: {formatDate(item.walk_date)}</>}
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
    </>
  );
}

export default function ActionItems() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 pb-24">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">Action Items <InfoButton contextKey="action-items-overview" /></h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Track and resolve corrective actions from store walks.
        </p>
      </div>
      <ActionItemsContent />
    </div>
  );
}
