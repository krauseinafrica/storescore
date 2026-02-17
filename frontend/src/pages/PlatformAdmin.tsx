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
} from '../api/platform';
import type {
  PlatformStats,
  PlatformOrg,
  PlatformOrgDetail,
  StoreImportResult,
} from '../api/platform';
import { getLeads, updateLeadStatus } from '../api/integrations';
import type { Lead } from '../types';

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

  useEffect(() => {
    setLoading(true);
    getPlatformOrgDetail(orgId)
      .then((d) => {
        setDetail(d);
        setOrgActive(d.organization.is_active);
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

// ---------- Main Platform Admin Page ----------

export default function PlatformAdmin() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'franchises' | 'leads'>('franchises');
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
          <button
            onClick={() => setActiveTab('franchises')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'franchises'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Franchises
          </button>
          <button
            onClick={() => setActiveTab('leads')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'leads'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Leads
          </button>
        </nav>
      </div>

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
