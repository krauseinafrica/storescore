import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  getPlatformStats,
  getPlatformOrgs,
  createPlatformOrg,
  getPlatformOrgDetail,
  updatePlatformOrg,
  activatePlatformOrg,
  importPlatformOrgStores,
  getEngagementStats,
  getLeadFunnel,
  getAICosts,
} from '../api/platform';
import type {
  PlatformStats,
  PlatformOrg,
  PlatformOrgDetail,
  StoreImportResult,
  EngagementStats,
  LeadFunnel,
  AICostData,
} from '../api/platform';
import { getLeads, updateLeadStatus } from '../api/integrations';
import { getTickets, updateTicketStatus, updateTicket } from '../api/support';
import type { SupportTicket } from '../api/support';
import type { Lead } from '../types';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell,
  AreaChart, Area,
} from 'recharts';
import { ChartContainer } from '../components/charts/ChartContainer';
import { ChartTooltipContent } from '../components/charts/ChartTooltip';
import ReactMarkdown from 'react-markdown';

// ---------- Create Org Modal ----------

interface CreateOrgModalProps {
  onClose: () => void;
  onCreated: (org: PlatformOrg) => void;
}

function CreateOrgModal({ onClose, onCreated }: CreateOrgModalProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    owner_email: '',
    owner_first_name: '',
    owner_last_name: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!form.name.trim()) { setError('Organization name is required'); return; }
    if (!form.owner_email.trim()) { setError('Owner email is required'); return; }

    setSaving(true);
    setError('');
    try {
      const org = await createPlatformOrg(form);
      onCreated(org);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create organization');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Onboard New Franchise</h2>
          <p className="text-sm text-gray-500 mt-0.5">Create a new organization and owner account</p>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Franchise Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500"
              placeholder="e.g. Northwest Region"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Owner Email *</label>
            <input
              type="email"
              value={form.owner_email}
              onChange={(e) => setForm({ ...form, owner_email: e.target.value })}
              className="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500"
              placeholder="owner@example.com"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input
                type="text"
                value={form.owner_first_name}
                onChange={(e) => setForm({ ...form, owner_first_name: e.target.value })}
                className="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input
                type="text"
                value={form.owner_last_name}
                onChange={(e) => setForm({ ...form, owner_last_name: e.target.value })}
                className="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">
              {saving ? 'Creating...' : 'Create Franchise'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------- Org Detail Panel ----------

interface OrgDetailPanelProps {
  orgId: string;
  initialActive: boolean;
  onClose: () => void;
  onMasquerade: (orgId: string, orgName: string) => void;
  onOrgUpdated: () => void;
}

function OrgDetailPanel({ orgId, initialActive, onClose, onMasquerade, onOrgUpdated }: OrgDetailPanelProps) {
  const [detail, setDetail] = useState<PlatformOrgDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [orgActive, setOrgActive] = useState(initialActive);
  const [togglingActive, setTogglingActive] = useState(false);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [showImportCSV, setShowImportCSV] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<StoreImportResult | null>(null);

  // Promo discount state
  const [promoName, setPromoName] = useState('');
  const [promoPercent, setPromoPercent] = useState('');
  const [savingPromo, setSavingPromo] = useState(false);
  const [promoToast, setPromoToast] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getPlatformOrgDetail(orgId)
      .then((d) => {
        setDetail(d);
        setOrgActive(d.organization.is_active);
        if (d.subscription) {
          setPromoName(d.subscription.promo_discount_name || '');
          setPromoPercent(d.subscription.promo_discount_percent ? String(d.subscription.promo_discount_percent) : '');
        }
      })
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [orgId]);

  const handleSaveName = async () => {
    if (!editName.trim() || !detail) return;
    setSavingName(true);
    try {
      await updatePlatformOrg(orgId, { name: editName.trim() });
      setDetail({
        ...detail,
        organization: { ...detail.organization, name: editName.trim() },
      });
      setEditingName(false);
      onOrgUpdated();
    } catch {
      // keep editing open on failure
    } finally {
      setSavingName(false);
    }
  };

  const handleToggleActive = async () => {
    if (orgActive && !showDeactivateConfirm) {
      setShowDeactivateConfirm(true);
      return;
    }
    setTogglingActive(true);
    setShowDeactivateConfirm(false);
    try {
      await activatePlatformOrg(orgId, orgActive ? 'deactivate' : 'activate');
      setOrgActive(!orgActive);
      onOrgUpdated();
    } catch {
      // ignore
    } finally {
      setTogglingActive(false);
    }
  };

  const handleImportCSV = async () => {
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);
    try {
      const result = await importPlatformOrgStores(orgId, importFile);
      setImportResult(result);
      if (result.created > 0) {
        // Reload detail to show new stores
        const d = await getPlatformOrgDetail(orgId);
        setDetail(d);
        onOrgUpdated();
      }
    } catch {
      setImportResult({ created: 0, errors: ['Upload failed. Please check the file format.'] });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {loading || !detail ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : (
          <>
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  {editingName ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="rounded-lg border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500 py-1 px-2"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveName();
                          if (e.key === 'Escape') setEditingName(false);
                        }}
                      />
                      <button
                        onClick={handleSaveName}
                        disabled={savingName}
                        className="px-2.5 py-1 text-xs font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
                      >
                        {savingName ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditingName(false)}
                        className="px-2.5 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-gray-900">{detail.organization.name}</h2>
                      <button
                        onClick={() => {
                          setEditName(detail.organization.name);
                          setEditingName(true);
                        }}
                        className="text-gray-400 hover:text-gray-600 p-0.5"
                        title="Edit org name"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${orgActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {orgActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={handleToggleActive}
                    disabled={togglingActive}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
                      orgActive
                        ? 'text-red-700 bg-red-50 hover:bg-red-100'
                        : 'text-green-700 bg-green-50 hover:bg-green-100'
                    }`}
                  >
                    {togglingActive ? 'Updating...' : orgActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => onMasquerade(detail.organization.id, detail.organization.name)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    View as Franchise
                  </button>
                  <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              {!editingName && <p className="text-xs text-gray-400 mt-0.5">/{detail.organization.slug}</p>}
            </div>

            {/* Deactivate Confirmation Modal */}
            {showDeactivateConfirm && (
              <div className="px-6 py-3 bg-red-50 border-b border-red-100">
                <p className="text-sm text-red-800 font-medium">Are you sure you want to deactivate this organization?</p>
                <p className="text-xs text-red-600 mt-1">This will restrict access for all members of this franchise.</p>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={handleToggleActive}
                    disabled={togglingActive}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {togglingActive ? 'Deactivating...' : 'Yes, Deactivate'}
                  </button>
                  <button
                    onClick={() => setShowDeactivateConfirm(false)}
                    className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white rounded-lg hover:bg-gray-50 border border-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Owner */}
            <div className="px-6 py-3 border-b border-gray-50">
              <p className="text-xs font-medium text-gray-500 mb-1">OWNER</p>
              <p className="text-sm text-gray-900">
                {detail.organization.owner.first_name} {detail.organization.owner.last_name} ({detail.organization.owner.email})
              </p>
            </div>

            {/* Subscription & Promo */}
            {detail.subscription && (
              <div className="px-6 py-3 border-b border-gray-50">
                <p className="text-xs font-medium text-gray-500 mb-2">SUBSCRIPTION</p>
                <div className="flex items-center gap-3 text-sm mb-3">
                  <span className="text-gray-900 font-medium">{detail.subscription.plan_name}</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">{detail.subscription.status}</span>
                  <span className="text-xs text-gray-400">{detail.subscription.store_count} stores</span>
                  {detail.subscription.effective_discount_percent > 0 && (
                    <span className="text-xs text-green-600 font-medium">
                      {detail.subscription.promo_discount_name || 'Volume'}: {detail.subscription.effective_discount_percent}% off
                    </span>
                  )}
                </div>

                <p className="text-xs font-medium text-gray-500 mb-2">PROMOTIONAL DISCOUNT</p>
                <div className="bg-gray-50 rounded-lg p-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Discount Name</label>
                      <input
                        type="text"
                        value={promoName}
                        onChange={(e) => setPromoName(e.target.value)}
                        placeholder='e.g. "Partner Rate"'
                        className="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500 py-1.5 px-2"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Percentage (0-100)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={promoPercent}
                        onChange={(e) => setPromoPercent(e.target.value)}
                        placeholder="0"
                        className="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500 py-1.5 px-2"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        const pct = parseInt(promoPercent, 10);
                        if (!promoName.trim() || isNaN(pct) || pct < 1 || pct > 100) {
                          setPromoToast('Enter a discount name and a percentage between 1-100.');
                          return;
                        }
                        setSavingPromo(true);
                        try {
                          await updatePlatformOrg(orgId, { promo_discount_name: promoName.trim(), promo_discount_percent: pct });
                          // Reload detail to refresh subscription data
                          const d = await getPlatformOrgDetail(orgId);
                          setDetail(d);
                          setPromoToast('Promotional discount applied.');
                          onOrgUpdated();
                        } catch {
                          setPromoToast('Failed to apply discount.');
                        } finally {
                          setSavingPromo(false);
                        }
                      }}
                      disabled={savingPromo}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
                    >
                      {savingPromo ? 'Applying...' : 'Apply Discount'}
                    </button>
                    {detail.subscription.promo_discount_percent > 0 && (
                      <button
                        onClick={async () => {
                          setSavingPromo(true);
                          try {
                            await updatePlatformOrg(orgId, { promo_discount_name: '', promo_discount_percent: 0 });
                            setPromoName('');
                            setPromoPercent('');
                            const d = await getPlatformOrgDetail(orgId);
                            setDetail(d);
                            setPromoToast('Promotional discount removed.');
                            onOrgUpdated();
                          } catch {
                            setPromoToast('Failed to remove discount.');
                          } finally {
                            setSavingPromo(false);
                          }
                        }}
                        disabled={savingPromo}
                        className="px-3 py-1.5 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
                      >
                        Remove Discount
                      </button>
                    )}
                  </div>
                  {promoToast && (
                    <p className="text-xs text-gray-600">{promoToast}</p>
                  )}
                </div>
              </div>
            )}

            {/* Members */}
            <div className="px-6 py-3 border-b border-gray-50">
              <p className="text-xs font-medium text-gray-500 mb-2">MEMBERS ({detail.members.length})</p>
              <div className="space-y-1.5">
                {detail.members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-900">{m.user.first_name} {m.user.last_name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{m.user.email}</span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">{m.role}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Regions */}
            {detail.regions.length > 0 && (
              <div className="px-6 py-3 border-b border-gray-50">
                <p className="text-xs font-medium text-gray-500 mb-2">REGIONS ({detail.regions.length})</p>
                <div className="flex flex-wrap gap-2">
                  {detail.regions.map((r) => (
                    <span key={r.id} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
                      {r.name} ({r.store_count} stores)
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Stores */}
            <div className="px-6 py-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-500">STORES ({detail.stores.length})</p>
                <button
                  onClick={() => { setShowImportCSV(!showImportCSV); setImportResult(null); setImportFile(null); }}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Import CSV
                </button>
              </div>

              {/* CSV Import UI */}
              {showImportCSV && (
                <div className="mb-3 bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <p className="text-xs text-gray-600 mb-2">
                    Upload a CSV with columns: Name, Store Number, Address, City, State, Zip, Region
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                      className="text-xs text-gray-500 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                    />
                    <button
                      onClick={handleImportCSV}
                      disabled={!importFile || importing}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 whitespace-nowrap"
                    >
                      {importing ? 'Importing...' : 'Upload'}
                    </button>
                  </div>
                  {importResult && (
                    <div className="mt-2">
                      {importResult.created > 0 && (
                        <p className="text-xs text-green-700">{importResult.created} stores imported successfully.</p>
                      )}
                      {importResult.errors.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {importResult.errors.map((err, i) => (
                            <p key={i} className="text-xs text-red-600">{err}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {detail.stores.length === 0 ? (
                <p className="text-sm text-gray-400">No stores yet.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {detail.stores.map((s) => (
                    <div key={s.id} className="border border-gray-100 rounded-lg px-3 py-2">
                      <p className="text-sm font-medium text-gray-900">{s.name}</p>
                      <p className="text-xs text-gray-400">
                        {s.store_number ? `#${s.store_number}` : ''}
                        {s.city ? ` - ${s.city}, ${s.state}` : ''}
                        {!s.is_active && ' (inactive)'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------- Lead Detail Modal ----------

const LEAD_STATUS_OPTIONS = ['new', 'contacted', 'demo_active', 'converted', 'closed'] as const;

const LEAD_STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  demo_active: 'bg-green-100 text-green-800',
  converted: 'bg-purple-100 text-purple-800',
  closed: 'bg-gray-100 text-gray-600',
};

interface LeadDetailModalProps {
  lead: Lead;
  onClose: () => void;
  onStatusChange: (id: string, status: string) => void;
}

function LeadDetailModal({ lead, onClose, onStatusChange }: LeadDetailModalProps) {
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const handleStatusChange = async (newStatus: string) => {
    setUpdatingStatus(true);
    try {
      await updateLeadStatus(lead.id, newStatus);
      onStatusChange(lead.id, newStatus);
    } catch {
      // ignore
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{lead.first_name} {lead.last_name}</h2>
            <p className="text-sm text-gray-500">{lead.company_name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">EMAIL</p>
              <p className="text-sm text-gray-900">{lead.email}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">PHONE</p>
              <p className="text-sm text-gray-900">{lead.phone || '--'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">STORE COUNT</p>
              <p className="text-sm text-gray-900">{lead.store_count ?? '--'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">SOURCE</p>
              <p className="text-sm text-gray-900">{lead.source || '--'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">DATE</p>
              <p className="text-sm text-gray-900">
                {new Date(lead.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">STATUS</p>
              <select
                value={lead.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={updatingStatus}
                className="rounded-lg border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500 py-1 px-2 disabled:opacity-50"
              >
                {LEAD_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {lead.message && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">MESSAGE</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{lead.message}</p>
            </div>
          )}
          {lead.demo_org && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">DEMO ORG</p>
              <p className="text-sm text-gray-900">{lead.demo_org}</p>
              {lead.demo_expires_at && (
                <p className="text-xs text-gray-400 mt-0.5">
                  Expires: {new Date(lead.demo_expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Leads Tab ----------

function LeadsTab() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  useEffect(() => {
    setLoading(true);
    getLeads()
      .then((data) => setLeads(data as Lead[]))
      .catch(() => setLeads([]))
      .finally(() => setLoading(false));
  }, []);

  const handleStatusChange = (id: string, newStatus: string) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === id ? { ...l, status: newStatus as Lead['status'] } : l))
    );
    if (selectedLead && selectedLead.id === id) {
      setSelectedLead({ ...selectedLead, status: newStatus as Lead['status'] });
    }
  };

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Name</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3 hidden sm:table-cell">Email</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3 hidden md:table-cell">Company</th>
              <th className="text-center text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Status</th>
              <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-3 hidden lg:table-cell">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">Loading...</td></tr>
            ) : leads.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">No leads found.</td></tr>
            ) : (
              leads.map((lead) => (
                <tr
                  key={lead.id}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => setSelectedLead(lead)}
                >
                  <td className="px-4 sm:px-6 py-3">
                    <p className="font-medium text-gray-900">{lead.first_name} {lead.last_name}</p>
                  </td>
                  <td className="px-4 sm:px-6 py-3 text-gray-500 hidden sm:table-cell">{lead.email}</td>
                  <td className="px-4 sm:px-6 py-3 text-gray-500 hidden md:table-cell">{lead.company_name || '--'}</td>
                  <td className="px-4 sm:px-6 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${LEAD_STATUS_COLORS[lead.status] || 'bg-gray-100 text-gray-600'}`}>
                      {lead.status.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </span>
                  </td>
                  <td className="px-4 sm:px-6 py-3 text-right text-xs text-gray-400 hidden lg:table-cell">
                    {new Date(lead.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </>
  );
}

// ---------- Dashboard Tab ----------

const PIE_COLORS = ['#D40029', '#22c55e', '#6b7280'];

function DashboardTab() {
  const [engagement, setEngagement] = useState<EngagementStats | null>(null);
  const [funnel, setFunnel] = useState<LeadFunnel | null>(null);
  const [aiCosts, setAiCosts] = useState<AICostData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getEngagementStats().catch(() => null),
      getLeadFunnel().catch(() => null),
      getAICosts().catch(() => null),
    ])
      .then(([e, f, ai]) => { setEngagement(e); setFunnel(f); setAiCosts(ai); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-center py-12 text-gray-400">Loading dashboard...</div>;
  }

  const engagementTierData = engagement
    ? [
        { name: '0 walks', value: engagement.engagement_tiers.zero_walks },
        { name: '1-5 walks', value: engagement.engagement_tiers.one_to_five },
        { name: '5+ walks', value: engagement.engagement_tiers.five_plus },
      ]
    : [];

  const leadSourceData = funnel?.by_source ?? [];

  return (
    <div className="space-y-6">
      {/* Conversion & Engagement KPIs */}
      {engagement && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Total Orgs', value: engagement.total_orgs },
            { label: 'Trialing', value: engagement.trialing },
            { label: 'Active', value: engagement.active },
            { label: 'Canceled', value: engagement.canceled },
            { label: 'Conversion', value: `${(engagement.conversion_rate * 100).toFixed(1)}%` },
            { label: 'Avg Walks/Org', value: engagement.avg_walks_per_org.toFixed(1) },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4">
              <p className="text-xs font-medium text-gray-500">{kpi.label}</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{kpi.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Signups Chart */}
        {engagement && engagement.recent_signups.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Recent Signups (14 days)</h3>
            <ChartContainer
              config={{ signups: { label: 'Signups', color: '#D40029' } }}
              className="h-48"
            >
              <BarChart data={engagement.recent_signups}>
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: string) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip content={<ChartTooltipContent labelFormatter={(l) => new Date(l).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />} />
                <Bar dataKey="count" name="Signups" fill="#D40029" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </div>
        )}

        {/* Engagement Tiers Pie */}
        {engagement && (
          <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Engagement Breakdown</h3>
            <ChartContainer
              config={{
                zero: { label: '0 walks', color: '#6b7280' },
                low: { label: '1-5 walks', color: '#22c55e' },
                high: { label: '5+ walks', color: '#D40029' },
              }}
              className="h-48"
            >
              <PieChart>
                <Pie
                  data={engagementTierData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, value }: { name?: string; value?: number }) => `${name ?? ''}: ${value ?? ''}`}
                  labelLine={false}
                >
                  {engagementTierData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>
          </div>
        )}

        {/* Lead Sources */}
        {funnel && leadSourceData.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Leads by Source</h3>
            <ChartContainer
              config={{ leads: { label: 'Leads', color: '#7c3aed' } }}
              className="h-48"
            >
              <BarChart data={leadSourceData} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis dataKey="source" type="category" tick={{ fontSize: 11 }} width={100} />
                <Tooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" name="Leads" fill="#7c3aed" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          </div>
        )}

        {/* Conversion by Source */}
        {funnel && funnel.conversion_by_source.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Conversion by Source</h3>
            <div className="space-y-3">
              {funnel.conversion_by_source.map((s) => (
                <div key={s.source}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-700 font-medium">{s.source || 'Direct'}</span>
                    <span className="text-gray-500 text-xs">{s.converted}/{s.total} ({(s.rate * 100).toFixed(0)}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-primary-600 h-2 rounded-full transition-all"
                      style={{ width: `${Math.max(s.rate * 100, 2)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* AI Usage & Costs */}
      {aiCosts && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">AI Usage & Costs</h3>

          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4">
              <p className="text-xs font-medium text-gray-500">Total Spend</p>
              <p className="text-xl font-bold text-gray-900 mt-1">${aiCosts.totals.total_cost.toFixed(2)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4">
              <p className="text-xs font-medium text-gray-500">Total Calls</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{aiCosts.totals.total_calls.toLocaleString()}</p>
            </div>
            {aiCosts.by_provider.map((p) => (
              <div key={p.provider} className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4">
                <p className="text-xs font-medium text-gray-500">{p.provider === 'anthropic' ? 'Anthropic' : 'Google'}</p>
                <p className="text-xl font-bold text-gray-900 mt-1">${p.cost.toFixed(2)}</p>
                <p className="text-xs text-gray-400 mt-0.5">{p.calls.toLocaleString()} calls</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Monthly cost trend */}
            {aiCosts.monthly_trend.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Monthly Cost Trend</h3>
                <ChartContainer
                  config={{ cost: { label: 'Cost ($)', color: '#D40029' } }}
                  className="h-48"
                >
                  <AreaChart data={aiCosts.monthly_trend}>
                    <defs>
                      <linearGradient id="aiCostGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#D40029" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#D40029" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v: string) => {
                        const [y, m] = v.split('-');
                        return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-US', { month: 'short' });
                      }}
                    />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `$${v}`} />
                    <Tooltip
                      content={<ChartTooltipContent
                        labelFormatter={(l) => {
                          const [y, m] = String(l).split('-');
                          return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                        }}
                        valueFormatter={(v) => `$${v.toFixed(2)}`}
                      />}
                    />
                    <Area type="monotone" dataKey="cost" stroke="#D40029" fill="url(#aiCostGrad)" strokeWidth={2} />
                  </AreaChart>
                </ChartContainer>
              </div>
            )}

            {/* Cost by call type */}
            {aiCosts.by_call_type.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Cost by Feature</h3>
                <ChartContainer
                  config={{ cost: { label: 'Cost ($)', color: '#7c3aed' } }}
                  className="h-48"
                >
                  <BarChart data={aiCosts.by_call_type} layout="vertical">
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `$${v}`} />
                    <YAxis
                      dataKey="call_type"
                      type="category"
                      tick={{ fontSize: 11 }}
                      width={100}
                      tickFormatter={(v: string) => v.replace(/_/g, ' ')}
                    />
                    <Tooltip
                      content={<ChartTooltipContent
                        valueFormatter={(v) => `$${v.toFixed(2)}`}
                      />}
                    />
                    <Bar dataKey="cost" name="Cost" fill="#7c3aed" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ChartContainer>
              </div>
            )}

            {/* Cost by org */}
            {aiCosts.by_org.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-5 lg:col-span-2">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Top Organizations by AI Spend</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left text-xs font-medium text-gray-500 pb-2">Organization</th>
                        <th className="text-right text-xs font-medium text-gray-500 pb-2">Cost</th>
                        <th className="text-right text-xs font-medium text-gray-500 pb-2">Calls</th>
                        <th className="text-right text-xs font-medium text-gray-500 pb-2">Avg/Call</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {aiCosts.by_org.map((org) => (
                        <tr key={org.org_id}>
                          <td className="py-2 text-gray-900 font-medium">{org.org_name}</td>
                          <td className="py-2 text-right text-gray-700">${org.cost.toFixed(2)}</td>
                          <td className="py-2 text-right text-gray-500">{org.calls.toLocaleString()}</td>
                          <td className="py-2 text-right text-gray-400">${org.calls > 0 ? (org.cost / org.calls).toFixed(4) : '0'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Tickets Tab ----------

const TICKET_STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-600',
};

const TICKET_PRIORITY_COLORS: Record<string, string> = {
  low: 'text-gray-500',
  medium: 'text-yellow-600',
  high: 'text-red-600',
};

const TICKET_CATEGORY_COLORS: Record<string, string> = {
  bug: 'bg-red-100 text-red-700',
  ui_feedback: 'bg-purple-100 text-purple-700',
  enhancement: 'bg-blue-100 text-blue-700',
  question: 'bg-teal-100 text-teal-700',
  other: 'bg-gray-100 text-gray-600',
};

const TICKET_CATEGORY_LABELS: Record<string, string> = {
  bug: 'Bug',
  ui_feedback: 'UI Feedback',
  enhancement: 'Enhancement',
  question: 'Question',
  other: 'Other',
};

function renderResolutionNotes(text: string) {
  // Auto-link commit hashes (7-40 hex chars)
  const parts = text.split(/\b([a-f0-9]{7,40})\b/g);
  return parts.map((part, i) =>
    /^[a-f0-9]{7,40}$/.test(part) ? (
      <code key={i} className="bg-gray-200 text-gray-800 px-1 py-0.5 rounded text-xs font-mono">{part}</code>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function TicketsTab() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('open_in_progress');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [orgFilter, setOrgFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');

  // Resolution notes state for modal
  const [resolutionDraft, setResolutionDraft] = useState('');
  const [savingResolution, setSavingResolution] = useState(false);

  useEffect(() => {
    setLoading(true);
    getTickets('platform')
      .then(setTickets)
      .catch(() => setTickets([]))
      .finally(() => setLoading(false));
  }, []);

  // Derive unique orgs for filter
  const uniqueOrgs = Array.from(new Set(tickets.map((t) => t.organization_name).filter(Boolean))).sort() as string[];

  // Apply filters
  const filteredTickets = tickets.filter((t) => {
    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!t.subject.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) return false;
    }
    // Status
    if (statusFilter === 'open_in_progress') {
      if (t.status !== 'open' && t.status !== 'in_progress') return false;
    } else if (statusFilter !== 'all') {
      if (t.status !== statusFilter) return false;
    }
    // Priority
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    // Category
    if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
    // Organization
    if (orgFilter !== 'all' && t.organization_name !== orgFilter) return false;
    // Source
    if (sourceFilter !== 'all' && t.source !== sourceFilter) return false;
    return true;
  });

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    setUpdatingId(ticketId);
    try {
      await updateTicketStatus(ticketId, newStatus);
      setTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? { ...t, status: newStatus as SupportTicket['status'] } : t))
      );
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket((prev) => prev ? { ...prev, status: newStatus as SupportTicket['status'] } : prev);
      }
    } catch {
      // ignore
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCategoryChange = async (ticketId: string, newCategory: string) => {
    setUpdatingId(ticketId);
    try {
      await updateTicket(ticketId, { category: newCategory });
      setTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? { ...t, category: newCategory as SupportTicket['category'] } : t))
      );
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket((prev) => prev ? { ...prev, category: newCategory as SupportTicket['category'] } : prev);
      }
    } catch {
      // ignore
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSaveResolution = async () => {
    if (!selectedTicket) return;
    setSavingResolution(true);
    try {
      const updated = await updateTicket(selectedTicket.id, { resolution_notes: resolutionDraft });
      setTickets((prev) =>
        prev.map((t) => (t.id === selectedTicket.id ? { ...t, resolution_notes: updated.resolution_notes } : t))
      );
      setSelectedTicket((prev) => prev ? { ...prev, resolution_notes: updated.resolution_notes } : prev);
    } catch {
      // ignore
    } finally {
      setSavingResolution(false);
    }
  };

  // When a ticket is selected, initialize the resolution draft
  const openTicketDetail = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setResolutionDraft(ticket.resolution_notes || '');
  };

  const selectClass = 'rounded-lg border-gray-300 text-sm py-1.5 pl-2 pr-7 shadow-sm ring-1 ring-gray-900/5 focus:border-primary-500 focus:ring-primary-500 bg-white';

  return (
    <>
      {/* Filter Bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search tickets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-48 rounded-lg border-gray-300 bg-white text-sm py-1.5 pl-8 pr-3 shadow-sm ring-1 ring-gray-900/5 focus:border-primary-500 focus:ring-primary-500"
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectClass}>
          <option value="open_in_progress">Open &amp; In Progress</option>
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className={selectClass}>
          <option value="all">All Priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={selectClass}>
          <option value="all">All Categories</option>
          <option value="bug">Bug</option>
          <option value="ui_feedback">UI Feedback</option>
          <option value="enhancement">Enhancement</option>
          <option value="question">Question</option>
          <option value="other">Other</option>
        </select>
        <select value={orgFilter} onChange={(e) => setOrgFilter(e.target.value)} className={selectClass}>
          <option value="all">All Organizations</option>
          {uniqueOrgs.map((org) => (
            <option key={org} value={org}>{org}</option>
          ))}
        </select>
        <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className={selectClass}>
          <option value="all">All Sources</option>
          <option value="manual">Manual</option>
          <option value="sentry">Sentry</option>
        </select>
        <span className="text-xs text-gray-500 ml-auto">
          Showing {filteredTickets.length} of {tickets.length} tickets
        </span>
      </div>

      <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Subject</th>
              <th className="text-center text-xs font-medium text-gray-500 px-4 sm:px-6 py-3 hidden sm:table-cell">Category</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3 hidden md:table-cell">Organization</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3 hidden lg:table-cell">Submitted By</th>
              <th className="text-center text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Priority</th>
              <th className="text-center text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Status</th>
              <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-3 hidden xl:table-cell">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">Loading...</td></tr>
            ) : filteredTickets.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">No tickets match your filters.</td></tr>
            ) : (
              filteredTickets.map((ticket) => (
                <tr
                  key={ticket.id}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => openTicketDetail(ticket)}
                >
                  <td className="px-4 sm:px-6 py-3">
                    <p className="font-medium text-gray-900">{ticket.subject}</p>
                  </td>
                  <td className="px-4 sm:px-6 py-3 text-center hidden sm:table-cell">
                    <select
                      value={ticket.category}
                      onChange={(e) => { e.stopPropagation(); handleCategoryChange(ticket.id, e.target.value); }}
                      onClick={(e) => e.stopPropagation()}
                      disabled={updatingId === ticket.id}
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border-0 cursor-pointer disabled:opacity-50 ${TICKET_CATEGORY_COLORS[ticket.category] || 'bg-gray-100 text-gray-600'}`}
                    >
                      <option value="bug">Bug</option>
                      <option value="ui_feedback">UI Feedback</option>
                      <option value="enhancement">Enhancement</option>
                      <option value="question">Question</option>
                      <option value="other">Other</option>
                    </select>
                  </td>
                  <td className="px-4 sm:px-6 py-3 text-gray-500 hidden md:table-cell">
                    {ticket.source === 'sentry' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">Sentry</span>
                    ) : (
                      ticket.organization_name || '--'
                    )}
                  </td>
                  <td className="px-4 sm:px-6 py-3 text-gray-500 hidden lg:table-cell">
                    {ticket.user ? `${ticket.user.first_name} ${ticket.user.last_name}` : '--'}
                  </td>
                  <td className="px-4 sm:px-6 py-3 text-center">
                    <span className={`text-xs font-medium ${TICKET_PRIORITY_COLORS[ticket.priority] || 'text-gray-500'}`}>
                      {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 sm:px-6 py-3 text-center">
                    <select
                      value={ticket.status}
                      onChange={(e) => { e.stopPropagation(); handleStatusChange(ticket.id, e.target.value); }}
                      onClick={(e) => e.stopPropagation()}
                      disabled={updatingId === ticket.id}
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border-0 cursor-pointer disabled:opacity-50 ${TICKET_STATUS_COLORS[ticket.status] || 'bg-gray-100 text-gray-600'}`}
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                  </td>
                  <td className="px-4 sm:px-6 py-3 text-right text-xs text-gray-400 hidden xl:table-cell">
                    {new Date(ticket.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Ticket Detail Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setSelectedTicket(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{selectedTicket.subject}</h2>
                <p className="text-sm text-gray-500">
                  {selectedTicket.source === 'sentry' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 mr-1">Sentry</span>
                  ) : (
                    selectedTicket.organization_name || 'Unknown'
                  )}
                  {' '}&middot; {selectedTicket.user ? `${selectedTicket.user.first_name} ${selectedTicket.user.last_name}` : 'System'}
                </p>
              </div>
              <button onClick={() => setSelectedTicket(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">DESCRIPTION</p>
                <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{selectedTicket.description}</p>
              </div>
              <div className="grid grid-cols-5 gap-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">PRIORITY</p>
                  <span className={`text-sm font-medium ${TICKET_PRIORITY_COLORS[selectedTicket.priority]}`}>
                    {selectedTicket.priority.charAt(0).toUpperCase() + selectedTicket.priority.slice(1)}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">STATUS</p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TICKET_STATUS_COLORS[selectedTicket.status]}`}>
                    {selectedTicket.status.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">CATEGORY</p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TICKET_CATEGORY_COLORS[selectedTicket.category] || 'bg-gray-100 text-gray-600'}`}>
                    {TICKET_CATEGORY_LABELS[selectedTicket.category] || selectedTicket.category}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">SOURCE</p>
                  {selectedTicket.source === 'sentry' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">Sentry</span>
                  ) : (
                    <span className="text-sm text-gray-700">Manual</span>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">DATE</p>
                  <p className="text-sm text-gray-700">
                    {new Date(selectedTicket.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              </div>
              {selectedTicket.messages.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">MESSAGES ({selectedTicket.messages.length})</p>
                  <div className="space-y-2">
                    {selectedTicket.messages.map((msg) => (
                      <div key={msg.id} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-gray-700">
                            {msg.user ? `${msg.user.first_name} ${msg.user.last_name}` : 'System'}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(msg.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">{msg.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Resolution Notes */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">RESOLUTION NOTES</p>
                {selectedTicket.resolution_notes && (
                  <div className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 mb-2 whitespace-pre-wrap">
                    {renderResolutionNotes(selectedTicket.resolution_notes)}
                  </div>
                )}
                <textarea
                  rows={3}
                  value={resolutionDraft}
                  onChange={(e) => setResolutionDraft(e.target.value)}
                  placeholder="Add resolution notes, commit references (e.g. abc1234)..."
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 mb-2"
                />
                <button
                  onClick={handleSaveResolution}
                  disabled={savingResolution || resolutionDraft === (selectedTicket.resolution_notes || '')}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {savingResolution ? 'Saving...' : 'Save Resolution Notes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---------- Strategy Tab ----------

const SCOPE_ANALYSIS = `# StoreScore — Scope & Strategic Analysis

**Date:** February 19, 2026
**Purpose:** Ensure the project stays on track without feature bloat, and clearly define what each piece of the platform does and why it exists.

---

## Executive Summary

StoreScore has completed Phases 1 through 5.75 — a substantial SaaS platform with **40+ frontend routes**, **100+ backend API endpoints**, and **25+ data models**. The core thesis ("store quality → customer experience → sales → staffing") remains tight and well-served by everything built so far. However, the platform has reached a complexity inflection point where every new feature must justify its existence against the risk of confusing users and diluting the core value proposition.

**Current state:** 1 organization (Northwest Ace), 16 stores, 137 walks, 8 users, 85.3% average score.

---

## What We Set Out to Build

The original vision was a **store quality management platform for retail franchises** built on four pillars:

1. **Evaluate** — Structured store walks with scoring, photos, and location verification
2. **Analyze** — AI-powered summaries, trend analytics, and benchmarking
3. **Improve** — Action items, corrective actions, SOPs, and coaching
4. **Prove** — Data integration (sales, staffing) to correlate quality with business outcomes

Everything built should serve one of these four pillars. Anything that doesn't is scope creep.

---

## Feature Inventory — What's Built & Why

### PILLAR 1: EVALUATE

| Feature | Phase | Why It Exists | Risk of Confusion |
|---------|-------|---------------|-------------------|
| **Store Walks** (core scoring flow) | 1-2 | The core product. Section-by-section scoring with photos. | None — this is the product |
| **Department Evaluations** | 5.7 | Extends walks to department-level (grocery needs 8-15 dept evals). AI photo scoring prevents bias. | LOW |
| **Self-Assessments** | 5.75 | Store managers self-evaluate with photos; AI compares to standards. Franchise accountability tool. | MEDIUM |
| **Evaluation Schedules** | 4 | Plan recurring walks. Prevents ad-hoc chaos. | LOW |
| **QR + GPS Location Verification** | 5.3 | Proves evaluator was physically present. Trust signal for franchise owners. | LOW |
| **Scoring Templates** | 1.5 | Define what gets scored. Different templates for different use cases. | LOW |
| **Template Library** | 5.7 | Browse and install pre-built templates. Speeds onboarding. | LOW |
| **Template Duplication** | 5.7 | Fork templates for customization. | LOW |

**Assessment:** Pillar 1 is strong. The three evaluation types (Walks, Department Evals, Self-Assessments) each serve distinct use cases. The main risk is **user confusion between the three types**.

### PILLAR 2: ANALYZE

| Feature | Phase | Why It Exists | Risk of Confusion |
|---------|-------|---------------|-------------------|
| **Dashboard** | 1-2 | At-a-glance health: in-progress walks, recent scores, key stats. | LOW |
| **Reports / Analytics** | 4 | Trend lines, regional comparison, store rankings, section breakdown. | LOW |
| **Benchmarking** | 5 | Anonymized cross-org comparison. | LOW |
| **Scoring Drivers** | 5.7 | Tag root causes (staffing, training, supply chain) on scores. | MEDIUM |
| **AI Walk Summaries** | 1.5 | Claude generates narrative summary of walk findings. | LOW |
| **AI Photo Analysis** | 5.75 | Gemini analyzes photos for objective quality assessment. | LOW |
| **Evaluator Consistency** | 4 | Detect scoring bias across evaluators. | LOW |

**Assessment:** Needs **Phase 5.8 (Advanced Reports)** to reach full potential. #1 priority for converting trials to paid.

### PILLAR 3: IMPROVE

| Feature | Phase | Why It Exists | Risk of Confusion |
|---------|-------|---------------|-------------------|
| **Action Items** | 4 | Track issues found during walks → assign → resolve with photo proof. | LOW |
| **Corrective Actions** | 4 | Formal corrective process for serious/recurring issues. | MEDIUM |
| **SOP Documents** | 5.7 | Link standard operating procedures to specific criteria. | LOW |
| **Reference Images** | 5.7 | "This is what a 5/5 looks like" for each criterion. | LOW |
| **AI-Suggested Action Items** | 5.75 | AI generates recommended actions from assessment findings. | LOW |

**Assessment:** Consider merging Corrective Actions into Action Items with a severity flag.

### PILLAR 4: PROVE (Data Integration)

| Feature | Phase | Why It Exists | Risk of Confusion |
|---------|-------|---------------|-------------------|
| **Manual Data Entry** | 4.5 | Store managers input weekly sales/staffing numbers. | LOW |
| **CSV Import** | 4.5 | Finance uploads Excel/CSV exports from POS systems. | LOW |
| **Integration Settings** | 4.5 | Configure external data connections (Mango, Eagle). | LOW |

**Assessment:** Weakest pillar (60% complete). Completing this is the "holy grail" unlock for ROI correlation.

---

## Scope Creep Assessment

### RED FLAGS

1. **Gamification (Phase 8) — HIGH RISK:** Half-built gamification is worse than none. Either fully ship or hide entirely.
2. **Corrective Actions vs. Action Items — MEDIUM RISK:** Users struggle with "what's the difference?" Consider merging.
3. **Eight Role Tiers — MEDIUM RISK:** Most orgs need 3-4 roles. Show 4 by default, expand for enterprise.
4. **Too Many Tabs — MEDIUM RISK:** Add contextual help to each tab explaining its purpose.

### GREEN FLAGS

1. Store Walks — Core product, well-executed
2. AI Summaries — Unique differentiator, obvious value
3. Location Verification — Invisible complexity, visible trust
4. Department Evaluations — Clear use case
5. Self-Assessments — Franchise accountability
6. Reports/Analytics — Well-delivered
7. Onboarding — Reduces time-to-value
8. Template Library — Speeds setup

---

## Competitive Positioning

### Our 8 Unique Differentiators:
1. **AI Walk Summaries** — No competitor offers this
2. **Location Verification Badges** — Dual QR+GPS verification
3. **Franchise-Native Self-Assessments** — Only FranConnect offers similar (at 10-40x cost)
4. **Gamified Store Quality** — Blue ocean
5. **SOP-to-Finding Linking** — In-context guidance during walks
6. **Purpose-Built for Retail Franchises** — No competitor matches this depth
7. **Affordable Franchise Pricing** — $49-99/mo vs. competitors at $1K+/mo
8. **Scoring Drivers** — Root cause tagging, no competitor offers this

### Our Moat:
AI + franchise-native + affordable + department-level evals. No single competitor has all four. Deepen each rather than adding new surface area.

---

## Priority Recommendations

### Must Do Next:
1. **Phase 5.8: Advanced Reports** — #1 conversion driver
2. **Phase 4.5 Completion: Mango SFTP** — Unlocks sales correlation story
3. **UX Clarity Pass** — Tab descriptions, merge Action Items + Corrective Actions, simplify roles, polish or hide gamification
4. **Phase 5.9: Public Site** — Homepage rewrite for lead generation

### Should Defer:
- Phase 6 (White-Label) — No paying customers yet
- Phase 9 (Video Analysis) — Enterprise-only, wait for revenue
- Phase 7 completion (Predictive AI) — Nice-to-have
- Phase 8 completion (Gamification) — Only if done well

---

## Summary

**StoreScore is NOT bloated.** Every major feature maps to the four-pillar thesis. The risk is that the volume of features may overwhelm new users.

**The path forward is depth, not breadth:**
1. Make existing features more understandable (UX clarity pass)
2. Complete the data story (Phase 4.5 → sales correlation)
3. Build the reporting that proves ROI (Phase 5.8)
4. Tell the story publicly (Phase 5.9)

Don't add new feature categories. Deepen the ones you have.
`;

function StrategyTab() {
  return (
    <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-6 sm:p-8 lg:p-10 max-w-4xl">
      <div className="
        prose prose-sm max-w-none
        prose-headings:text-gray-900 prose-h1:text-2xl prose-h1:font-bold prose-h1:mb-2
        prose-h2:text-lg prose-h2:font-semibold prose-h2:mt-8 prose-h2:mb-3
        prose-h3:text-base prose-h3:font-semibold prose-h3:mt-6 prose-h3:mb-2
        prose-p:text-gray-600 prose-p:leading-relaxed
        prose-strong:text-gray-900 prose-strong:font-semibold
        prose-li:text-gray-600 prose-li:leading-relaxed
        prose-table:text-sm prose-th:text-left prose-th:text-xs prose-th:font-medium
        prose-th:text-gray-500 prose-th:uppercase prose-th:tracking-wider prose-th:py-2
        prose-th:px-3 prose-th:bg-gray-50 prose-td:py-2 prose-td:px-3 prose-td:text-gray-600
        prose-td:border-t prose-td:border-gray-100
        prose-hr:my-6 prose-hr:border-gray-200
        [&_table]:w-full [&_table]:border-collapse [&_table]:rounded-lg [&_table]:overflow-hidden
        [&_table]:ring-1 [&_table]:ring-gray-200
        [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5
      ">
        <ReactMarkdown>{SCOPE_ANALYSIS}</ReactMarkdown>
      </div>
    </div>
  );
}

// ---------- Main Platform Admin Page ----------

export default function PlatformAdmin() {
  const { user } = useAuth();
  type AdminTab = 'dashboard' | 'franchises' | 'leads' | 'tickets' | 'strategy';
  const validTabs: AdminTab[] = ['dashboard', 'franchises', 'leads', 'tickets', 'strategy'];
  const getTabFromHash = (): AdminTab => {
    const hash = window.location.hash.replace('#', '');
    return validTabs.includes(hash as AdminTab) ? (hash as AdminTab) : 'dashboard';
  };
  const [activeTab, setActiveTabState] = useState<AdminTab>(getTabFromHash);
  const setActiveTab = (tab: AdminTab) => {
    window.location.hash = tab;
    setActiveTabState(tab);
  };

  // Sync on back/forward navigation
  useEffect(() => {
    const onHashChange = () => setActiveTabState(getTabFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [orgs, setOrgs] = useState<PlatformOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsData, orgsData] = await Promise.all([
        getPlatformStats().catch(() => null),
        getPlatformOrgs().catch(() => []),
      ]);
      setStats(statsData);
      setOrgs(orgsData);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredOrgs = orgs.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      o.name.toLowerCase().includes(q) ||
      o.slug.toLowerCase().includes(q) ||
      o.owner.email.toLowerCase().includes(q)
    );
  });

  const handleMasquerade = (orgId: string, orgName: string) => {
    // Switch to the franchise's context
    localStorage.setItem('selectedOrgId', orgId);
    localStorage.setItem('masquerading', orgName);
    window.location.href = '/dashboard';
  };

  const handleOrgCreated = (org: PlatformOrg) => {
    setOrgs((prev) => [org, ...prev]);
    setShowCreateOrg(false);
  };

  if (!user?.is_staff && !user?.is_superuser) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-12 text-center">
        <h1 className="text-xl font-bold text-gray-900">Access Denied</h1>
        <p className="text-sm text-gray-500 mt-2">Platform admin access is required.</p>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Platform Admin</h1>
          <p className="mt-0.5 text-sm text-gray-500">Manage all franchises and stores</p>
        </div>
        <button
          onClick={() => setShowCreateOrg(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Onboard Franchise
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Organizations', value: stats.total_organizations, color: 'bg-primary-600' },
            { label: 'Stores', value: stats.total_stores, color: 'bg-green-500' },
            { label: 'Users', value: stats.total_users, color: 'bg-violet-500' },
            { label: 'Total Walks', value: stats.total_walks, color: 'bg-blue-500' },
            { label: 'Completed', value: stats.total_completed_walks, color: 'bg-amber-500' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-8 rounded-full ${stat.color}`} />
                <div>
                  <p className="text-xs font-medium text-gray-500">{stat.label}</p>
                  <p className="text-xl font-bold text-gray-900">{stat.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex gap-6">
          {(['dashboard', 'franchises', 'leads', 'tickets'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'dashboard' && <DashboardTab />}

      {activeTab === 'franchises' && (
        <>
          {/* Search */}
          <div className="mb-4">
            <div className="relative max-w-xs">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search franchises..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border-gray-300 bg-white text-sm py-2 pl-9 pr-3 shadow-sm ring-1 ring-gray-900/5 focus:border-primary-500 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Org List */}
          <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Franchise</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3 hidden sm:table-cell">Owner</th>
                  <th className="text-center text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Stores</th>
                  <th className="text-center text-xs font-medium text-gray-500 px-4 sm:px-6 py-3 hidden md:table-cell">Members</th>
                  <th className="text-center text-xs font-medium text-gray-500 px-4 sm:px-6 py-3 hidden md:table-cell">Walks</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-3 hidden lg:table-cell">Last Walk</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-8 text-gray-400">Loading...</td></tr>
                ) : filteredOrgs.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-gray-400">No franchises found.</td></tr>
                ) : (
                  filteredOrgs.map((org) => (
                    <tr key={org.id} className={`hover:bg-gray-50 transition-colors ${!org.is_active ? 'opacity-60' : ''}`}>
                      <td className="px-4 sm:px-6 py-3">
                        <button
                          onClick={() => setSelectedOrgId(org.id)}
                          className="text-left hover:text-primary-600"
                        >
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900">{org.name}</p>
                            {!org.is_active && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700">
                                Inactive
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400">/{org.slug}</p>
                        </button>
                      </td>
                      <td className="px-4 sm:px-6 py-3 text-gray-500 hidden sm:table-cell">
                        <p className="text-sm">{org.owner.first_name} {org.owner.last_name}</p>
                        <p className="text-xs text-gray-400">{org.owner.email}</p>
                      </td>
                      <td className="px-4 sm:px-6 py-3 text-center text-gray-700 font-medium">{org.store_count}</td>
                      <td className="px-4 sm:px-6 py-3 text-center text-gray-500 hidden md:table-cell">{org.member_count}</td>
                      <td className="px-4 sm:px-6 py-3 text-center text-gray-500 hidden md:table-cell">{org.completed_walk_count}</td>
                      <td className="px-4 sm:px-6 py-3 text-right text-xs text-gray-400 hidden lg:table-cell">
                        {org.last_walk_date
                          ? new Date(org.last_walk_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : '--'}
                      </td>
                      <td className="px-4 sm:px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setSelectedOrgId(org.id)}
                            className="text-gray-400 hover:text-gray-600 p-1"
                            title="View details"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleMasquerade(org.id, org.name)}
                            className="text-violet-400 hover:text-violet-600 p-1"
                            title="View as franchise"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'leads' && <LeadsTab />}

      {activeTab === 'tickets' && <TicketsTab />}

      {activeTab === 'strategy' && <StrategyTab />}

      {/* Create Org Modal */}
      {showCreateOrg && (
        <CreateOrgModal
          onClose={() => setShowCreateOrg(false)}
          onCreated={handleOrgCreated}
        />
      )}

      {/* Org Detail Panel */}
      {selectedOrgId && (
        <OrgDetailPanel
          orgId={selectedOrgId}
          initialActive={orgs.find((o) => o.id === selectedOrgId)?.is_active ?? true}
          onClose={() => setSelectedOrgId(null)}
          onMasquerade={handleMasquerade}
          onOrgUpdated={loadData}
        />
      )}
    </div>
  );
}
