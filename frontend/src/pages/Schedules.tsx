import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import InfoButton from '../components/InfoButton';
import { getSchedules, createSchedule, updateSchedule, deleteSchedule, getTemplates, getRegions, getStores } from '../api/walks';
import type { EvaluationScheduleData } from '../api/walks';
import { getOrgId } from '../utils/org';
import type { EvaluationSchedule, ScoringTemplate, Region, Store } from '../types';

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  biweekly: 'Biweekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
};

const SCOPE_LABELS: Record<string, string> = {
  organization: 'All Stores',
  region: 'Region',
  store: 'Single Store',
};

const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function SchedulesContent() {
  const { hasRole } = useAuth();
  const orgId = getOrgId();
  const isAdmin = hasRole('admin');

  const [schedules, setSchedules] = useState<EvaluationSchedule[]>([]);
  const [templates, setTemplates] = useState<ScoringTemplate[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [formName, setFormName] = useState('');
  const [formTemplate, setFormTemplate] = useState('');
  const [formFrequency, setFormFrequency] = useState('monthly');
  const [formDayOfMonth, setFormDayOfMonth] = useState<number>(1);
  const [formDayOfWeek, setFormDayOfWeek] = useState<number>(0);
  const [formScope, setFormScope] = useState('organization');
  const [formRegion, setFormRegion] = useState('');
  const [formStore, setFormStore] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formNextRunDate, setFormNextRunDate] = useState('');
  const [formReminderDays, setFormReminderDays] = useState(3);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    async function load() {
      try {
        const [s, t, r, st] = await Promise.all([
          getSchedules(orgId),
          getTemplates(orgId),
          getRegions(orgId).catch(() => [] as Region[]),
          getStores(orgId).catch(() => [] as Store[]),
        ]);
        if (!cancelled) {
          setSchedules(s);
          setTemplates(t);
          setRegions(r);
          setStores(st);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [orgId]);

  const resetForm = () => {
    setFormName('');
    setFormTemplate(templates[0]?.id || '');
    setFormFrequency('monthly');
    setFormDayOfMonth(1);
    setFormDayOfWeek(0);
    setFormScope('organization');
    setFormRegion('');
    setFormStore('');
    setFormIsActive(true);
    setFormNextRunDate(new Date().toISOString().split('T')[0]);
    setFormReminderDays(3);
    setEditingId(null);
    setError('');
  };

  const openCreate = () => {
    resetForm();
    setFormTemplate(templates[0]?.id || '');
    setShowModal(true);
  };

  const openEdit = (s: EvaluationSchedule) => {
    setEditingId(s.id);
    setFormName(s.name);
    setFormTemplate(s.template);
    setFormFrequency(s.frequency);
    setFormDayOfMonth(s.day_of_month ?? 1);
    setFormDayOfWeek(s.day_of_week ?? 0);
    setFormScope(s.scope);
    setFormRegion(s.region || '');
    setFormStore(s.store || '');
    setFormIsActive(s.is_active);
    setFormNextRunDate(s.next_run_date);
    setFormReminderDays(s.reminder_days_before);
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formTemplate || !formNextRunDate) {
      setError('Please fill in all required fields.');
      return;
    }
    setSaving(true);
    setError('');
    const data: EvaluationScheduleData = {
      name: formName.trim(),
      template: formTemplate,
      frequency: formFrequency,
      day_of_month: ['monthly', 'quarterly'].includes(formFrequency) ? formDayOfMonth : null,
      day_of_week: ['weekly', 'biweekly'].includes(formFrequency) ? formDayOfWeek : null,
      scope: formScope,
      region: formScope === 'region' ? formRegion : null,
      store: formScope === 'store' ? formStore : null,
      is_active: formIsActive,
      next_run_date: formNextRunDate,
      reminder_days_before: formReminderDays,
    };
    try {
      if (editingId) {
        const updated = await updateSchedule(orgId, editingId, data);
        setSchedules(prev => prev.map(s => s.id === editingId ? updated : s));
      } else {
        const created = await createSchedule(orgId, data);
        setSchedules(prev => [...prev, created]);
      }
      setShowModal(false);
      resetForm();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save schedule.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (s: EvaluationSchedule) => {
    try {
      const updated = await updateSchedule(orgId, s.id, { is_active: !s.is_active });
      setSchedules(prev => prev.map(x => x.id === s.id ? updated : x));
    } catch { /* ignore */ }
  };

  const handleDelete = async (s: EvaluationSchedule) => {
    if (!confirm('Delete this schedule? This cannot be undone.')) return;
    try {
      await deleteSchedule(orgId, s.id);
      setSchedules(prev => prev.filter(x => x.id !== s.id));
    } catch { /* ignore */ }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="h-40 bg-gray-200 rounded" />
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-gray-500 mt-0.5">Auto-schedule recurring store walks with reminders.</p>
        </div>
        {isAdmin && (
          <button onClick={openCreate} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors">
            New Schedule
          </button>
        )}
      </div>

      {schedules.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-8 text-center">
          <svg className="w-12 h-12 text-gray-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="mt-3 text-sm text-gray-500">No schedules configured yet.</p>
          {isAdmin && (
            <button onClick={openCreate} className="mt-3 text-sm font-medium text-primary-600 hover:text-primary-700">
              Create your first schedule
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {schedules.map(s => (
            <div key={s.id} className={`bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4 ${!s.is_active ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900 truncate">{s.name}</h3>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {s.is_active ? 'Active' : 'Paused'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {FREQUENCY_LABELS[s.frequency]} &middot; {s.template_name} &middot; {SCOPE_LABELS[s.scope]}
                    {s.region_name && ` (${s.region_name})`}
                    {s.store_name && ` (${s.store_name})`}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Next run: <strong className="text-gray-600">{formatDate(s.next_run_date)}</strong>
                    {s.last_run_date && <> &middot; Last run: {formatDate(s.last_run_date)}</>}
                  </p>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                    <button onClick={() => handleToggleActive(s)} className="text-xs text-gray-500 hover:text-gray-700">
                      {s.is_active ? 'Pause' : 'Resume'}
                    </button>
                    <button onClick={() => openEdit(s)} className="text-xs text-primary-600 hover:text-primary-700">Edit</button>
                    <button onClick={() => handleDelete(s)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingId ? 'Edit Schedule' : 'New Schedule'}
              </h2>
            </div>
            <div className="px-6 py-4 space-y-4">
              {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Schedule Name</label>
                <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Monthly Store Walks" className="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-gray-900 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none sm:text-sm" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Template</label>
                <select value={formTemplate} onChange={e => setFormTemplate(e.target.value)} className="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-gray-900 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none sm:text-sm">
                  <option value="">Select template...</option>
                  {templates.filter(t => t.is_active).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                  <select value={formFrequency} onChange={e => setFormFrequency(e.target.value)} className="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-gray-900 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none sm:text-sm">
                    {Object.entries(FREQUENCY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                {['weekly', 'biweekly'].includes(formFrequency) ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Day of Week</label>
                    <select value={formDayOfWeek} onChange={e => setFormDayOfWeek(Number(e.target.value))} className="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-gray-900 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none sm:text-sm">
                      {DAY_LABELS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Day of Month</label>
                    <input type="number" min={1} max={28} value={formDayOfMonth} onChange={e => setFormDayOfMonth(Number(e.target.value))} className="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-gray-900 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none sm:text-sm" />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Scope</label>
                <select value={formScope} onChange={e => setFormScope(e.target.value)} className="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-gray-900 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none sm:text-sm">
                  {Object.entries(SCOPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>

              {formScope === 'region' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
                  <select value={formRegion} onChange={e => setFormRegion(e.target.value)} className="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-gray-900 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none sm:text-sm">
                    <option value="">Select region...</option>
                    {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
              )}

              {formScope === 'store' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Store</label>
                  <select value={formStore} onChange={e => setFormStore(e.target.value)} className="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-gray-900 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none sm:text-sm">
                    <option value="">Select store...</option>
                    {stores.filter(s => s.is_active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Run Date</label>
                  <input type="date" value={formNextRunDate} onChange={e => setFormNextRunDate(e.target.value)} className="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-gray-900 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none sm:text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Remind (days before)</label>
                  <input type="number" min={0} max={14} value={formReminderDays} onChange={e => setFormReminderDays(Number(e.target.value))} className="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-gray-900 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none sm:text-sm" />
                </div>
              </div>

              <label className="flex items-center gap-2">
                <input type="checkbox" checked={formIsActive} onChange={e => setFormIsActive(e.target.checked)} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                <span className="text-sm text-gray-700">Active</span>
              </label>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50 transition-colors">
                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function Schedules() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 pb-24">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">Evaluation Schedules <InfoButton contextKey="schedules-overview" /></h1>
      </div>
      <SchedulesContent />
    </div>
  );
}
