import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSubscription } from '../hooks/useSubscription';
import FeatureGate from '../components/FeatureGate';
import InfoButton from '../components/InfoButton';
import {
  getOrgSettings,
  updateOrgSettings,
  getOrgProfile,
  updateOrgProfile,
  getGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  getStores,
  getRegions,
} from '../api/walks';
import type { GoalData, OrgSettingsData, OrgProfileData } from '../api/walks';
import type { Store, Region } from '../types';
import { getOrgId } from '../utils/org';

const INDUSTRY_OPTIONS = [
  { value: 'hardware', label: 'Hardware / Home Improvement' },
  { value: 'grocery', label: 'Grocery' },
  { value: 'convenience', label: 'Convenience Store' },
  { value: 'restaurant', label: 'Restaurant / QSR' },
  { value: 'retail', label: 'General Retail' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'automotive', label: 'Automotive' },
  { value: 'fitness', label: 'Fitness / Gym' },
  { value: 'hospitality', label: 'Hospitality / Hotel' },
  { value: 'other', label: 'Other' },
];

// ---------- Goal Form Modal ----------

interface GoalFormProps {
  goal: GoalData | null;
  stores: Store[];
  regions: Region[];
  onSave: (data: Omit<GoalData, 'id' | 'created_at' | 'region_name' | 'store_name'>) => Promise<void>;
  onClose: () => void;
}

function GoalFormModal({ goal, stores, regions, onSave, onClose }: GoalFormProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: goal?.name || '',
    goal_type: goal?.goal_type || 'score_target' as 'score_target' | 'walk_frequency',
    scope: goal?.scope || 'organization' as 'organization' | 'region' | 'store',
    region: goal?.region || '',
    store: goal?.store || '',
    target_value: goal?.target_value?.toString() || '',
    is_active: goal?.is_active ?? true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Goal name is required'); return; }
    if (!form.target_value) { setError('Target value is required'); return; }

    setSaving(true);
    setError('');
    try {
      await onSave({
        name: form.name.trim(),
        goal_type: form.goal_type,
        scope: form.scope,
        region: form.scope === 'region' ? form.region || null : null,
        store: form.scope === 'store' ? form.store || null : null,
        target_value: parseFloat(form.target_value),
        is_active: form.is_active,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save goal');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{goal ? 'Edit Goal' : 'New Goal'}</h2>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Goal Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500"
              placeholder="e.g. Minimum Walk Score"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
              <select
                value={form.goal_type}
                onChange={(e) => setForm({ ...form, goal_type: e.target.value as 'score_target' | 'walk_frequency' })}
                className="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500"
              >
                <option value="score_target">Score Target (%)</option>
                <option value="walk_frequency">Walk Frequency (per month)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {form.goal_type === 'score_target' ? 'Target Score (%)' : 'Walks / Month'} *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max={form.goal_type === 'score_target' ? '100' : '100'}
                value={form.target_value}
                onChange={(e) => setForm({ ...form, target_value: e.target.value })}
                className="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500"
                placeholder={form.goal_type === 'score_target' ? '85' : '4'}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Scope</label>
            <div className="flex gap-2">
              {(['organization', 'region', 'store'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setForm({ ...form, scope: s, region: '', store: '' })}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    form.scope === s
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {s === 'organization' ? 'All Stores' : s === 'region' ? 'Region' : 'Specific Store'}
                </button>
              ))}
            </div>
          </div>

          {form.scope === 'region' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
              <select
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
                className="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500"
              >
                <option value="">Select region...</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          )}

          {form.scope === 'store' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Store</label>
              <select
                value={form.store}
                onChange={(e) => setForm({ ...form, store: e.target.value })}
                className="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500"
              >
                <option value="">Select store...</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="goal-active"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="goal-active" className="text-sm text-gray-700">Active</label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">
              {saving ? 'Saving...' : goal ? 'Update Goal' : 'Create Goal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------- Main Settings Page ----------

type Tab = 'organization' | 'goals' | 'settings' | 'billing';

export default function Settings() {
  const { hasRole } = useAuth();
  const { hasFeature } = useSubscription();
  const navigate = useNavigate();
  const location = useLocation();
  const orgId = getOrgId();
  const isAdmin = hasRole('admin');

  const hasGamification = hasFeature('gamification_basic') || hasFeature('gamification_advanced');

  const VALID_TABS = new Set<Tab>(['organization', 'goals', 'settings', 'billing']);
  const hashTab = location.hash.replace('#', '') as Tab;
  const initialTab = VALID_TABS.has(hashTab) && hashTab !== 'billing' ? hashTab : 'organization';
  const [tab, setTab] = useState<Tab>(initialTab);

  useEffect(() => {
    const t = location.hash.replace('#', '') as Tab;
    if (VALID_TABS.has(t) && t !== 'billing' && t !== tab) {
      setTab(t);
    }
  }, [location.hash]);
  const [loading, setLoading] = useState(true);

  // Org profile state
  const [orgProfile, setOrgProfile] = useState<OrgProfileData | null>(null);
  const [orgForm, setOrgForm] = useState<Partial<OrgProfileData>>({});
  const [orgSaving, setOrgSaving] = useState(false);
  const [orgSuccess, setOrgSuccess] = useState('');
  const [orgError, setOrgError] = useState('');

  // Settings state
  const [settings, setSettings] = useState<OrgSettingsData | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Goals state
  const [goals, setGoals] = useState<GoalData[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [editingGoal, setEditingGoal] = useState<GoalData | null | 'new'>(null);

  const loadData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [settingsData, profileData, goalsData, storesData, regionsData] = await Promise.all([
        getOrgSettings(orgId).catch(() => null),
        getOrgProfile(orgId).catch(() => null),
        getGoals(orgId).catch(() => []),
        getStores(orgId).catch(() => []),
        getRegions(orgId).catch(() => []),
      ]);
      setSettings(settingsData);
      if (profileData) {
        setOrgProfile(profileData);
        setOrgForm(profileData);
      }
      setGoals(goalsData);
      setStores(storesData);
      setRegions(regionsData);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveOrgProfile = async () => {
    if (!orgId || orgSaving) return;
    setOrgSaving(true);
    setOrgError('');
    setOrgSuccess('');
    try {
      const updated = await updateOrgProfile(orgId, orgForm);
      setOrgProfile(updated);
      setOrgForm(updated);
      setOrgSuccess('Organization profile updated.');
      setTimeout(() => setOrgSuccess(''), 4000);
    } catch {
      setOrgError('Failed to update organization profile.');
    } finally {
      setOrgSaving(false);
    }
  };

  const handleToggleBenchmarking = async () => {
    if (!settings || !orgId) return;
    setSettingsSaving(true);
    try {
      const updated = await updateOrgSettings(orgId, {
        allow_benchmarking: !settings.allow_benchmarking,
      });
      setSettings(updated);
    } catch {
      // ignore
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleDeadlineChange = async (field: string, value: number) => {
    if (!orgId) return;
    setSettingsSaving(true);
    try {
      const updated = await updateOrgSettings(orgId, { [field]: value });
      setSettings(updated);
    } catch {
      // ignore
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleToggleGamification = async () => {
    if (!settings || !orgId) return;
    setSettingsSaving(true);
    try {
      const updated = await updateOrgSettings(orgId, {
        gamification_enabled: !settings.gamification_enabled,
      });
      setSettings(updated);
    } catch {
      // ignore
    } finally {
      setSettingsSaving(false);
    }
  };

  const handlePeriodChange = async (days: number) => {
    if (!orgId) return;
    setSettingsSaving(true);
    try {
      const updated = await updateOrgSettings(orgId, {
        benchmarking_period_days: days,
      });
      setSettings(updated);
    } catch {
      // ignore
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleSaveGoal = async (data: Omit<GoalData, 'id' | 'created_at' | 'region_name' | 'store_name'>) => {
    if (!orgId) return;
    if (editingGoal && editingGoal !== 'new' && editingGoal.id) {
      const updated = await updateGoal(orgId, editingGoal.id, data);
      setGoals((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
    } else {
      const created = await createGoal(orgId, data);
      setGoals((prev) => [created, ...prev]);
    }
    setEditingGoal(null);
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!orgId) return;
    await deleteGoal(orgId, goalId);
    setGoals((prev) => prev.filter((g) => g.id !== goalId));
  };

  const handleToggleGoal = async (goal: GoalData) => {
    if (!orgId || !goal.id) return;
    const updated = await updateGoal(orgId, goal.id, { is_active: !goal.is_active });
    setGoals((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
  };

  if (!isAdmin) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-12 text-center">
        <h1 className="text-xl font-bold text-gray-900">Access Denied</h1>
        <p className="text-sm text-gray-500 mt-2">Admin access is required to manage settings.</p>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 pb-24">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Organization Settings</h1>
        <p className="mt-0.5 text-sm text-gray-500">Manage goals, benchmarking, and franchise-wide settings</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 max-w-md">
        {([
          { key: 'organization' as Tab, label: 'Organization' },
          { key: 'goals' as Tab, label: 'Goals' },
          { key: 'settings' as Tab, label: 'Settings' },
          { key: 'billing' as Tab, label: 'Billing' },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => {
              if (t.key === 'billing') {
                navigate('/billing');
              } else {
                setTab(t.key);
                navigate(`/settings#${t.key}`, { replace: true });
              }
            }}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : tab === 'organization' ? (
        /* ---------- Organization Tab ---------- */
        <div className="space-y-6">
          {orgSuccess && (
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
              {orgSuccess}
            </div>
          )}
          {orgError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {orgError}
            </div>
          )}

          <div className="bg-white rounded-xl ring-1 ring-gray-900/5 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Organization Profile</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name</label>
                  <input
                    type="text"
                    value={orgForm.name || ''}
                    onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                    className="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Industry Type</label>
                  <select
                    value={orgForm.industry || 'retail'}
                    onChange={(e) => setOrgForm({ ...orgForm, industry: e.target.value })}
                    className="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  >
                    {INDUSTRY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={orgForm.phone || ''}
                  onChange={(e) => setOrgForm({ ...orgForm, phone: e.target.value })}
                  className="w-full sm:max-w-xs rounded-lg border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl ring-1 ring-gray-900/5 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Corporate Office Address</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                <input
                  type="text"
                  value={orgForm.address || ''}
                  onChange={(e) => setOrgForm({ ...orgForm, address: e.target.value })}
                  className="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  placeholder="123 Main St"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    value={orgForm.city || ''}
                    onChange={(e) => setOrgForm({ ...orgForm, city: e.target.value })}
                    className="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                  <input
                    type="text"
                    value={orgForm.state || ''}
                    onChange={(e) => setOrgForm({ ...orgForm, state: e.target.value })}
                    className="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    placeholder="VA"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
                  <input
                    type="text"
                    value={orgForm.zip_code || ''}
                    onChange={(e) => setOrgForm({ ...orgForm, zip_code: e.target.value })}
                    className="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    placeholder="24060"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSaveOrgProfile}
              disabled={orgSaving}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {orgSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      ) : tab === 'goals' ? (
        /* ---------- Goals Tab ---------- */
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">Performance Goals <InfoButton contextKey="settings-goals" /></h2>
            <button
              onClick={() => setEditingGoal('new')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Goal
            </button>
          </div>

          {goals.length === 0 ? (
            <div className="bg-white rounded-xl ring-1 ring-gray-900/5 p-8 text-center">
              <svg className="w-12 h-12 text-gray-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <p className="mt-3 text-sm text-gray-500">No goals set yet</p>
              <p className="text-xs text-gray-400 mt-1">Set score targets or walk frequency goals for your stores.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {goals.map((goal) => (
                <div
                  key={goal.id}
                  className={`bg-white rounded-xl ring-1 ring-gray-900/5 p-4 shadow-sm ${
                    !goal.is_active ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-900">{goal.name}</h3>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          goal.goal_type === 'score_target'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-green-50 text-green-700'
                        }`}>
                          {goal.goal_type === 'score_target' ? 'Score' : 'Frequency'}
                        </span>
                        {!goal.is_active && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-gray-100 text-gray-500">
                            Inactive
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span>
                          Target: <strong className="text-gray-700">
                            {goal.goal_type === 'score_target'
                              ? `${goal.target_value}%`
                              : `${goal.target_value} walks/mo`}
                          </strong>
                        </span>
                        <span>
                          Scope: {goal.scope === 'organization'
                            ? 'All stores'
                            : goal.scope === 'region'
                              ? goal.region_name || 'Region'
                              : goal.store_name || 'Store'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                      <button
                        onClick={() => handleToggleGoal(goal)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          goal.is_active
                            ? 'text-green-600 hover:bg-green-50'
                            : 'text-gray-400 hover:bg-gray-50'
                        }`}
                        title={goal.is_active ? 'Deactivate' : 'Activate'}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={
                            goal.is_active
                              ? 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
                              : 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z'
                          } />
                        </svg>
                      </button>
                      <button
                        onClick={() => setEditingGoal(goal)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => goal.id && handleDeleteGoal(goal.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ---------- Settings Tab ---------- */
        <div className="space-y-6">
          {/* Location Verification */}
          <div className="bg-white rounded-xl ring-1 ring-gray-900/5 p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Location Verification
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Control whether evaluators must be physically at the store to start a walk.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              {/* Enforcement Mode */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">
                  Enforcement Mode
                </label>
                <div className="flex gap-2">
                  {[
                    { value: 'advisory', label: 'Advisory', desc: 'Warn but allow' },
                    { value: 'strict', label: 'Strict', desc: 'Block if too far' },
                  ].map((mode) => (
                    <button
                      key={mode.value}
                      onClick={async () => {
                        if (settingsSaving) return;
                        setSettingsSaving(true);
                        try {
                          const updated = await updateOrgSettings(orgId, { location_enforcement: mode.value } as any);
                          setSettings(updated);
                        } catch { /* ignore */ }
                        setSettingsSaving(false);
                      }}
                      disabled={settingsSaving}
                      className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium border-2 transition-all ${
                        (settings as any)?.location_enforcement === mode.value
                          ? 'border-primary-600 bg-primary-50 text-primary-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-semibold">{mode.label}</div>
                      <div className="text-xs font-normal mt-0.5 text-gray-400">{mode.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Verification Radius */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">
                  Verification Radius: {(settings as any)?.verification_radius_meters || 500}m
                </label>
                <input
                  type="range"
                  min={50}
                  max={5000}
                  step={50}
                  value={(settings as any)?.verification_radius_meters || 500}
                  onChange={async (e) => {
                    const val = Number(e.target.value);
                    setSettings((prev: any) => prev ? { ...prev, verification_radius_meters: val } : prev);
                  }}
                  onMouseUp={async (e) => {
                    const val = Number((e.target as HTMLInputElement).value);
                    setSettingsSaving(true);
                    try {
                      await updateOrgSettings(orgId, { verification_radius_meters: val } as any);
                    } catch { /* ignore */ }
                    setSettingsSaving(false);
                  }}
                  onTouchEnd={async (e) => {
                    const val = Number((e.target as HTMLInputElement).value);
                    setSettingsSaving(true);
                    try {
                      await updateOrgSettings(orgId, { verification_radius_meters: val } as any);
                    } catch { /* ignore */ }
                    setSettingsSaving(false);
                  }}
                  className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-primary-600"
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                  <span>50m</span>
                  <span>500m</span>
                  <span>2500m</span>
                  <span>5000m</span>
                </div>
              </div>

              {(settings as any)?.location_enforcement === 'strict' && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                  <p className="text-xs text-amber-800">
                    <strong>Strict mode enabled:</strong> Evaluators will be blocked from starting walks if they are more than {(settings as any)?.verification_radius_meters || 500}m from the store. They must enable location services in their browser.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Benchmarking */}
          <div className="bg-white rounded-xl ring-1 ring-gray-900/5 p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">Anonymized Benchmarking <InfoButton contextKey="settings-benchmarking" /></h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  When enabled, store managers can see how their store ranks against other stores
                  in the franchise without seeing specific store names or scores.
                </p>
              </div>
              <button
                onClick={handleToggleBenchmarking}
                disabled={settingsSaving}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ml-4 ${
                  settings?.allow_benchmarking ? 'bg-primary-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                    settings?.allow_benchmarking ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {settings?.allow_benchmarking && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <label className="block text-xs font-medium text-gray-600 mb-2">
                  Benchmarking Period
                </label>
                <div className="flex gap-2">
                  {[
                    { value: 30, label: '30 days' },
                    { value: 60, label: '60 days' },
                    { value: 90, label: '90 days' },
                    { value: 180, label: '6 months' },
                    { value: 365, label: '1 year' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handlePeriodChange(opt.value)}
                      disabled={settingsSaving}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        settings.benchmarking_period_days === opt.value
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Gamification */}
          {hasGamification ? (
            <div className="bg-white rounded-xl ring-1 ring-gray-900/5 p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Gamification</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Enable leaderboards, challenges, and achievement badges to drive engagement
                    and friendly competition across your stores.
                  </p>
                </div>
                <button
                  onClick={handleToggleGamification}
                  disabled={settingsSaving}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ml-4 ${
                    settings?.gamification_enabled ? 'bg-primary-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                      settings?.gamification_enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {settings?.gamification_enabled && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <label className="block text-xs font-medium text-gray-600 mb-2">
                    Visible to Roles
                  </label>
                  <p className="text-[10px] text-gray-400 mb-2">
                    Select which roles can see leaderboards, challenges, and achievements. Leave empty for all roles.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {([
                      { value: 'owner', label: 'Owner' },
                      { value: 'admin', label: 'Admin' },
                      { value: 'regional_manager', label: 'Regional Mgr' },
                      { value: 'store_manager', label: 'Store Mgr' },
                      { value: 'manager', label: 'Manager' },
                      { value: 'evaluator', label: 'Evaluator' },
                      { value: 'member', label: 'Member' },
                    ]).map((role) => {
                      const currentRoles = settings?.gamification_visible_roles || [];
                      const isSelected = currentRoles.includes(role.value);
                      return (
                        <button
                          key={role.value}
                          type="button"
                          disabled={settingsSaving}
                          onClick={async () => {
                            if (!orgId) return;
                            const newRoles = isSelected
                              ? currentRoles.filter((r: string) => r !== role.value)
                              : [...currentRoles, role.value];
                            setSettingsSaving(true);
                            try {
                              const updated = await updateOrgSettings(orgId, {
                                gamification_visible_roles: newRoles,
                              });
                              setSettings(updated);
                            } catch {
                              // ignore
                            } finally {
                              setSettingsSaving(false);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            isSelected
                              ? 'bg-primary-600 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {role.label}
                        </button>
                      );
                    })}
                  </div>
                  {(settings?.gamification_visible_roles?.length ?? 0) === 0 && (
                    <p className="text-[10px] text-gray-400 mt-2 italic">All roles can see gamification (default).</p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <FeatureGate feature="gamification_basic" requiredPlan="Pro">
              <div />
            </FeatureGate>
          )}

          {/* Action Item Deadlines */}
          <div className="bg-white rounded-xl ring-1 ring-gray-900/5 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              Action Item Deadlines
              <InfoButton contextKey="settings-deadlines" />
            </h3>
            <p className="text-xs text-gray-500 mt-0.5 mb-4">
              Set default deadline durations (in days) for action items based on priority level.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {([
                { field: 'action_item_deadline_critical', label: 'Critical', color: 'text-red-600', bg: 'bg-red-50' },
                { field: 'action_item_deadline_high', label: 'High', color: 'text-orange-600', bg: 'bg-orange-50' },
                { field: 'action_item_deadline_medium', label: 'Medium', color: 'text-amber-600', bg: 'bg-amber-50' },
                { field: 'action_item_deadline_low', label: 'Low', color: 'text-blue-600', bg: 'bg-blue-50' },
              ] as const).map((item) => (
                <div key={item.field} className={`${item.bg} rounded-lg p-3`}>
                  <label className={`block text-xs font-semibold ${item.color} mb-1.5`}>
                    {item.label}
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={settings?.[item.field as keyof OrgSettingsData] as number ?? ''}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (val > 0 && val <= 365) handleDeadlineChange(item.field, val);
                      }}
                      disabled={settingsSaving}
                      className="w-16 rounded-lg border-gray-300 text-sm text-center shadow-sm focus:border-primary-500 focus:ring-primary-500 disabled:opacity-50"
                    />
                    <span className="text-xs text-gray-500">days</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Goal Form Modal */}
      {editingGoal && (
        <GoalFormModal
          goal={editingGoal === 'new' ? null : editingGoal}
          stores={stores}
          regions={regions}
          onSave={handleSaveGoal}
          onClose={() => setEditingGoal(null)}
        />
      )}
    </div>
  );
}
