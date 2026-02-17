import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '../hooks/useAuth';
import InfoButton from '../components/InfoButton';
import { getOrgId } from '../utils/org';
import { getMembers, inviteMember, updateMemberRole, removeMember, resendInvite, adminEditUser, adminSendPasswordReset } from '../api/members';
import { getStores, getRegions } from '../api/walks';
import type { OrgMember, Region, Store } from '../types';

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin', description: 'Can manage team, stores, templates, and all walks.' },
  { value: 'regional_manager', label: 'Regional Manager', description: 'Can manage walks for assigned regions only.' },
  { value: 'store_manager', label: 'Store Manager', description: 'Can manage walks for assigned stores only.' },
  { value: 'manager', label: 'Manager', description: 'Can create and manage walks, view stores and templates.' },
  { value: 'finance', label: 'Finance', description: 'Read-only access to scores, reports, and analytics.' },
  { value: 'member', label: 'Member', description: 'Read-only access to stores, templates, and walks.' },
] as const;

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  regional_manager: 'Regional Manager',
  store_manager: 'Store Manager',
  manager: 'Manager',
  finance: 'Finance',
  member: 'Member',
};

const ROLE_BADGE_COLORS: Record<string, string> = {
  owner: 'bg-primary-50 text-primary-700 ring-primary-600/20',
  admin: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  regional_manager: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  store_manager: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  manager: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  finance: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  member: 'bg-gray-50 text-gray-600 ring-gray-500/20',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function Team() {
  const { user, hasRole } = useAuth();
  const orgId = getOrgId();
  const isAdmin = hasRole('admin');

  const [members, setMembers] = useState<OrgMember[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFirstName, setInviteFirstName] = useState('');
  const [inviteLastName, setInviteLastName] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('member');
  const [inviteRegionIds, setInviteRegionIds] = useState<string[]>([]);
  const [inviteStoreIds, setInviteStoreIds] = useState<string[]>([]);
  const [inviteError, setInviteError] = useState('');
  const [inviteSubmitting, setInviteSubmitting] = useState(false);

  // Remove confirmation state
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [removeSubmitting, setRemoveSubmitting] = useState(false);

  // Role update state
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);

  // Resend invite state
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);

  // Edit assignments modal
  const [editingMember, setEditingMember] = useState<OrgMember | null>(null);
  const [editRegionIds, setEditRegionIds] = useState<string[]>([]);
  const [editStoreIds, setEditStoreIds] = useState<string[]>([]);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Sort state
  const [sortBy, setSortBy] = useState<'name' | 'email' | 'role' | 'joined'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Edit user modal
  const [editUserMember, setEditUserMember] = useState<OrgMember | null>(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editUserSubmitting, setEditUserSubmitting] = useState(false);
  const [editUserError, setEditUserError] = useState('');
  const [editUserSuccess, setEditUserSuccess] = useState('');
  const [sendingReset, setSendingReset] = useState(false);

  useEffect(() => {
    if (!orgId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchData() {
      try {
        const [membersData, regionsData, storesData] = await Promise.all([
          getMembers(orgId),
          getRegions(orgId).catch(() => []),
          getStores(orgId).catch(() => []),
        ]);
        if (!cancelled) {
          setMembers(membersData);
          setRegions(regionsData);
          setStores(storesData);
        }
      } catch {
        if (!cancelled) {
          setError('Failed to load team members.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault();
    setInviteError('');
    setInviteSubmitting(true);

    try {
      const newMember = await inviteMember(orgId, {
        email: inviteEmail,
        first_name: inviteFirstName,
        last_name: inviteLastName,
        role: inviteRole,
        region_ids: inviteRole === 'regional_manager' ? inviteRegionIds : [],
        store_ids: inviteRole === 'store_manager' ? inviteStoreIds : [],
      });
      setMembers((prev) => [...prev, newMember]);
      setShowInviteModal(false);
      resetInviteForm();
    } catch (err: any) {
      const detail =
        err.response?.data?.email?.[0] ||
        err.response?.data?.detail ||
        err.response?.data?.non_field_errors?.[0] ||
        'Failed to invite member.';
      setInviteError(detail);
    } finally {
      setInviteSubmitting(false);
    }
  };

  const resetInviteForm = () => {
    setInviteEmail('');
    setInviteFirstName('');
    setInviteLastName('');
    setInviteRole('member');
    setInviteRegionIds([]);
    setInviteStoreIds([]);
    setInviteError('');
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    setUpdatingRoleId(memberId);
    try {
      const updated = await updateMemberRole(orgId, memberId, newRole);
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? updated : m))
      );
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'Failed to update role.';
      alert(detail);
    } finally {
      setUpdatingRoleId(null);
    }
  };

  const handleRemove = async (memberId: string) => {
    setRemoveSubmitting(true);
    try {
      await removeMember(orgId, memberId);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      setRemovingMemberId(null);
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'Failed to remove member.';
      alert(detail);
    } finally {
      setRemoveSubmitting(false);
    }
  };

  const handleResendInvite = async (memberId: string) => {
    setResendingId(memberId);
    setResendSuccess(null);
    try {
      await resendInvite(orgId, memberId);
      setResendSuccess(memberId);
      setTimeout(() => setResendSuccess(null), 3000);
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'Failed to resend invite.';
      alert(detail);
    } finally {
      setResendingId(null);
    }
  };

  const openEditAssignments = (member: OrgMember) => {
    setEditingMember(member);
    setEditRegionIds(member.assigned_regions?.map((r) => r.region__id) || []);
    setEditStoreIds(member.assigned_stores?.map((s) => s.store__id) || []);
  };

  const handleSaveAssignments = async () => {
    if (!editingMember) return;
    setEditSubmitting(true);
    try {
      const updated = await updateMemberRole(orgId, editingMember.id, editingMember.role, {
        region_ids: editRegionIds,
        store_ids: editStoreIds,
      });
      setMembers((prev) =>
        prev.map((m) => (m.id === editingMember.id ? updated : m))
      );
      setEditingMember(null);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update assignments.');
    } finally {
      setEditSubmitting(false);
    }
  };

  const openEditUser = (member: OrgMember) => {
    setEditUserMember(member);
    setEditFirstName(member.user.first_name || '');
    setEditLastName(member.user.last_name || '');
    setEditEmail(member.user.email || '');
    setEditUserError('');
    setEditUserSuccess('');
  };

  const handleSaveUser = async () => {
    if (!editUserMember) return;
    setEditUserSubmitting(true);
    setEditUserError('');
    setEditUserSuccess('');
    try {
      const updated = await adminEditUser(orgId, editUserMember.id, {
        first_name: editFirstName.trim(),
        last_name: editLastName.trim(),
        email: editEmail.trim(),
      });
      setMembers((prev) =>
        prev.map((m) => (m.id === editUserMember.id ? updated : m))
      );
      setEditUserSuccess('User updated successfully.');
      setTimeout(() => setEditUserMember(null), 1200);
    } catch (err: any) {
      const detail =
        err.response?.data?.email?.[0] ||
        err.response?.data?.detail ||
        'Failed to update user.';
      setEditUserError(detail);
    } finally {
      setEditUserSubmitting(false);
    }
  };

  const handleSendPasswordReset = async () => {
    if (!editUserMember) return;
    setSendingReset(true);
    try {
      await adminSendPasswordReset(orgId, editUserMember.id);
      setEditUserSuccess('Password reset email sent.');
    } catch {
      setEditUserError('Failed to send password reset email.');
    } finally {
      setSendingReset(false);
    }
  };

  const toggleArrayItem = (arr: string[], item: string): string[] =>
    arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];

  const roleDescription = ROLE_OPTIONS.find((r) => r.value === inviteRole)?.description || '';

  const sortedMembers = useMemo(() => {
    const sorted = [...members].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'name': {
          const nameA = `${a.user.first_name || ''} ${a.user.last_name || ''}`.trim().toLowerCase();
          const nameB = `${b.user.first_name || ''} ${b.user.last_name || ''}`.trim().toLowerCase();
          cmp = nameA.localeCompare(nameB);
          break;
        }
        case 'email': {
          cmp = (a.user.email || '').toLowerCase().localeCompare((b.user.email || '').toLowerCase());
          break;
        }
        case 'role': {
          cmp = (a.role || '').localeCompare(b.role || '');
          break;
        }
        case 'joined': {
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        }
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [members, sortBy, sortDir]);

  const handleSort = (column: 'name' | 'email' | 'role' | 'joined') => {
    if (sortBy === column) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading team...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        <div className="rounded-xl bg-red-50 border border-red-200 p-6 text-center">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">Team <InfoButton contextKey="team-roles" /></h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {members.length} member{members.length !== 1 ? 's' : ''} in your organization
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 active:bg-primary-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Invite Member
          </button>
        )}
      </div>

      {/* Members list */}
      <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 overflow-hidden">
        {/* Table header - desktop */}
        <div className="hidden sm:grid sm:grid-cols-12 gap-4 px-6 py-3 bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wider">
          <button
            type="button"
            onClick={() => handleSort('name')}
            className="col-span-3 flex items-center gap-1 hover:text-gray-700 transition-colors text-left"
          >
            Member
            {sortBy === 'name' && (
              <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 12 12" fill="currentColor">
                {sortDir === 'asc' ? (
                  <path d="M6 3l4 5H2l4-5z" />
                ) : (
                  <path d="M6 9L2 4h8L6 9z" />
                )}
              </svg>
            )}
          </button>
          <button
            type="button"
            onClick={() => handleSort('email')}
            className="col-span-3 flex items-center gap-1 hover:text-gray-700 transition-colors text-left"
          >
            Email
            {sortBy === 'email' && (
              <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 12 12" fill="currentColor">
                {sortDir === 'asc' ? (
                  <path d="M6 3l4 5H2l4-5z" />
                ) : (
                  <path d="M6 9L2 4h8L6 9z" />
                )}
              </svg>
            )}
          </button>
          <button
            type="button"
            onClick={() => handleSort('role')}
            className="col-span-2 flex items-center gap-1 hover:text-gray-700 transition-colors text-left"
          >
            Role
            {sortBy === 'role' && (
              <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 12 12" fill="currentColor">
                {sortDir === 'asc' ? (
                  <path d="M6 3l4 5H2l4-5z" />
                ) : (
                  <path d="M6 9L2 4h8L6 9z" />
                )}
              </svg>
            )}
          </button>
          <div className="col-span-2">Scope</div>
          <button
            type="button"
            onClick={() => handleSort('joined')}
            className="col-span-1 flex items-center gap-1 hover:text-gray-700 transition-colors text-left"
          >
            Joined
            {sortBy === 'joined' && (
              <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 12 12" fill="currentColor">
                {sortDir === 'asc' ? (
                  <path d="M6 3l4 5H2l4-5z" />
                ) : (
                  <path d="M6 9L2 4h8L6 9z" />
                )}
              </svg>
            )}
          </button>
          {isAdmin && <div className="col-span-1"></div>}
        </div>

        {/* Member rows */}
        <div className="divide-y divide-gray-100">
          {sortedMembers.map((member) => {
            const isOwner = member.role === 'owner';
            const isSelf = member.user.id === user?.id;
            const canEditRole = isAdmin && !isOwner && !isSelf;
            const canRemove = isAdmin && !isOwner;
            const hasAssignments = (member.assigned_regions?.length > 0) || (member.assigned_stores?.length > 0);
            const needsAssignment = member.role === 'regional_manager' || member.role === 'store_manager';
            const managedRegions = regions.filter(r => r.manager === member.id);

            return (
              <div
                key={member.id}
                className="px-6 py-4 sm:grid sm:grid-cols-12 sm:gap-4 sm:items-center"
              >
                {/* Name + avatar */}
                <div className="flex items-center gap-3 col-span-3">
                  <div className="flex items-center justify-center w-9 h-9 rounded-full bg-primary-600 text-white text-sm font-medium flex-shrink-0">
                    {member.user.first_name?.charAt(0).toUpperCase() || 'U'}
                    {member.user.last_name?.charAt(0).toUpperCase() || ''}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {member.user.first_name} {member.user.last_name}
                      {isSelf && (
                        <span className="ml-1.5 text-xs text-gray-400 font-normal">(you)</span>
                      )}
                    </p>
                    {/* Mobile-only email + scope */}
                    <p className="text-xs text-gray-400 truncate sm:hidden">{member.user.email}</p>
                    {needsAssignment && (hasAssignments || managedRegions.length > 0) && (
                      <div className="flex flex-wrap gap-1 mt-0.5 sm:hidden">
                        {managedRegions.map((r) => (
                          <span key={r.id} className="inline-flex items-center gap-1 text-[10px] text-gray-500">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: r.color || '#3B82F6' }} />
                            {r.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Email - desktop */}
                <div className="hidden sm:block col-span-3">
                  <p className="text-sm text-gray-500 truncate">{member.user.email}</p>
                </div>

                {/* Role */}
                <div className="col-span-2 mt-2 sm:mt-0">
                  {canEditRole ? (
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member.id, e.target.value)}
                      disabled={updatingRoleId === member.id}
                      className="block w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-gray-700 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none disabled:opacity-50 transition-colors"
                    >
                      {ROLE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ring-1 ring-inset ${
                        ROLE_BADGE_COLORS[member.role] || ROLE_BADGE_COLORS.member
                      }`}
                    >
                      {ROLE_LABELS[member.role] || member.role}
                    </span>
                  )}
                </div>

                {/* Scope / Assignments */}
                <div className="hidden sm:block col-span-2">
                  {needsAssignment ? (
                    <button
                      onClick={() => isAdmin ? openEditAssignments(member) : undefined}
                      className={`text-left ${isAdmin ? 'cursor-pointer group' : ''}`}
                    >
                      {(hasAssignments || managedRegions.length > 0) ? (
                        <div className="space-y-1">
                          {/* Show managed regions with color dots */}
                          {managedRegions.map((r) => (
                            <div key={r.id} className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: r.color || '#3B82F6' }} />
                              <span className="text-xs text-gray-600 group-hover:text-primary-600 truncate">{r.name}</span>
                            </div>
                          ))}
                          {/* Show assigned regions not already shown as managed */}
                          {member.assigned_regions?.filter((ar) => !managedRegions.some((mr) => mr.id === ar.region__id)).map((r) => (
                            <div key={r.id} className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full flex-shrink-0 bg-gray-300" />
                              <span className="text-xs text-gray-500 group-hover:text-primary-600 truncate">{r.region__name}</span>
                            </div>
                          ))}
                          {member.assigned_stores?.map((s) => (
                            <span key={s.id} className="text-xs text-gray-500 group-hover:text-primary-600 block truncate">{s.store__name}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-amber-600">No assignments</span>
                      )}
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400">
                      {member.role === 'owner' || member.role === 'admin' || member.role === 'manager' ? 'All stores' :
                       member.role === 'finance' ? 'All (read-only)' : 'All (read-only)'}
                    </span>
                  )}
                </div>

                {/* Joined date */}
                <div className="hidden sm:block col-span-1">
                  <p className="text-xs text-gray-400">{formatDate(member.created_at)}</p>
                </div>

                {/* Actions */}
                {isAdmin && (
                  <div className="col-span-1 flex justify-end gap-1 mt-2 sm:mt-0">
                    {!isOwner && (
                      <button
                        onClick={() => openEditUser(member)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                        title="Edit user details"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </button>
                    )}
                    {!isOwner && !isSelf && (
                      <button
                        onClick={() => handleResendInvite(member.id)}
                        disabled={resendingId === member.id}
                        className={`p-1.5 rounded-lg transition-colors ${
                          resendSuccess === member.id
                            ? 'text-green-500 bg-green-50'
                            : 'text-gray-400 hover:text-primary-500 hover:bg-primary-50'
                        }`}
                        title={resendSuccess === member.id ? 'Invite sent!' : 'Resend invite email'}
                      >
                        {resendSuccess === member.id ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : resendingId === member.id ? (
                          <div className="w-4 h-4 border-2 border-gray-300 border-t-primary-500 rounded-full animate-spin" />
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
                    )}
                    {needsAssignment && (
                      <button
                        onClick={() => openEditAssignments(member)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-primary-500 hover:bg-primary-50 transition-colors"
                        title="Edit assignments"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    )}
                    {canRemove && (
                      <button
                        onClick={() => setRemovingMemberId(member.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Remove member"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {members.length === 0 && (
          <div className="px-6 py-12 text-center">
            <svg className="w-10 h-10 text-gray-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <p className="mt-2 text-sm text-gray-500">No team members found.</p>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => {
              setShowInviteModal(false);
              resetInviteForm();
            }}
          />
          <div className="relative bg-white rounded-xl shadow-xl ring-1 ring-gray-900/5 w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">Invite Team Member</h2>
              <button
                onClick={() => {
                  setShowInviteModal(false);
                  resetInviteForm();
                }}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleInvite} className="space-y-4">
              {inviteError && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                  <p className="text-sm text-red-700">{inviteError}</p>
                </div>
              )}

              <div>
                <label htmlFor="invite-email" className="block text-sm font-medium text-gray-700">
                  Email address
                </label>
                <input
                  id="invite-email"
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none transition-colors sm:text-sm"
                  placeholder="member@company.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="invite-first-name" className="block text-sm font-medium text-gray-700">
                    First name
                  </label>
                  <input
                    id="invite-first-name"
                    type="text"
                    required
                    value={inviteFirstName}
                    onChange={(e) => setInviteFirstName(e.target.value)}
                    className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none transition-colors sm:text-sm"
                    placeholder="Jane"
                  />
                </div>
                <div>
                  <label htmlFor="invite-last-name" className="block text-sm font-medium text-gray-700">
                    Last name
                  </label>
                  <input
                    id="invite-last-name"
                    type="text"
                    required
                    value={inviteLastName}
                    onChange={(e) => setInviteLastName(e.target.value)}
                    className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none transition-colors sm:text-sm"
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="invite-role" className="block text-sm font-medium text-gray-700">
                  Role
                </label>
                <select
                  id="invite-role"
                  value={inviteRole}
                  onChange={(e) => {
                    setInviteRole(e.target.value);
                    setInviteRegionIds([]);
                    setInviteStoreIds([]);
                  }}
                  className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-gray-900 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none transition-colors sm:text-sm"
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-gray-400">{roleDescription}</p>
              </div>

              {/* Region assignment for regional_manager */}
              {inviteRole === 'regional_manager' && regions.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assign Regions
                  </label>
                  <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3">
                    {regions.map((region) => (
                      <label key={region.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={inviteRegionIds.includes(region.id)}
                          onChange={() => setInviteRegionIds(toggleArrayItem(inviteRegionIds, region.id))}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-sm text-gray-700">{region.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Store assignment for store_manager */}
              {inviteRole === 'store_manager' && stores.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assign Stores
                  </label>
                  <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3">
                    {stores.filter((s) => s.is_active).map((store) => (
                      <label key={store.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={inviteStoreIds.includes(store.id)}
                          onChange={() => setInviteStoreIds(toggleArrayItem(inviteStoreIds, store.id))}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-sm text-gray-700">{store.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowInviteModal(false);
                    resetInviteForm();
                  }}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteSubmitting}
                  className="flex-1 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {inviteSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Inviting...
                    </span>
                  ) : (
                    'Send Invite'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Assignments Modal */}
      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setEditingMember(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl ring-1 ring-gray-900/5 w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    Edit Assignments
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary-600 text-white text-xs font-medium">
                      {editingMember.user.first_name?.charAt(0).toUpperCase()}{editingMember.user.last_name?.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm text-gray-600">{editingMember.user.first_name} {editingMember.user.last_name}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium ring-1 ring-inset ${ROLE_BADGE_COLORS[editingMember.role]}`}>
                      {ROLE_LABELS[editingMember.role]}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setEditingMember(null)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {editingMember.role === 'regional_manager' && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Assigned Regions</h3>
                  {regions.filter((r) => !r.parent).length === 0 ? (
                    <p className="text-sm text-gray-400 italic">No regions created yet. Create regions on the Stores page first.</p>
                  ) : (
                    <div className="space-y-2">
                      {regions.filter((r) => !r.parent).map((region) => {
                        const isAssigned = editRegionIds.includes(region.id);
                        const isManager = region.manager === editingMember.id;
                        const totalStores = region.store_count + (region.children?.reduce((sum, c) => sum + c.store_count, 0) || 0);
                        const childRegionIds = region.children?.map((c) => c.id) || [];
                        const hasChildAssigned = childRegionIds.some((id) => editRegionIds.includes(id));
                        return (
                          <div key={region.id}>
                            <button
                              onClick={() => setEditRegionIds(toggleArrayItem(editRegionIds, region.id))}
                              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${
                                isAssigned
                                  ? 'border-primary-300 bg-primary-50/50 shadow-sm'
                                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                              }`}
                              style={{ borderLeftWidth: '4px', borderLeftColor: region.color || '#3B82F6' }}
                            >
                              <div className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0" style={{ backgroundColor: `${region.color || '#3B82F6'}15`, color: region.color || '#3B82F6' }}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-gray-900">{region.name}</span>
                                  {isManager && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20">Manager</span>
                                  )}
                                </div>
                                <span className="text-xs text-gray-400">{totalStores} store{totalStores !== 1 ? 's' : ''}</span>
                              </div>
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isAssigned ? 'bg-primary-600 border-primary-600' : 'border-gray-300'}`}>
                                {isAssigned && (
                                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                )}
                              </div>
                            </button>
                            {/* Child regions */}
                            {region.children && region.children.length > 0 && (isAssigned || hasChildAssigned) && (
                              <div className="ml-6 mt-1 space-y-1">
                                {region.children.map((child) => {
                                  const isChildAssigned = editRegionIds.includes(child.id);
                                  return (
                                    <button
                                      key={child.id}
                                      onClick={() => setEditRegionIds(toggleArrayItem(editRegionIds, child.id))}
                                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-left text-sm ${
                                        isChildAssigned
                                          ? 'border-primary-200 bg-primary-50/40'
                                          : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                                      }`}
                                    >
                                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: child.color || region.color || '#3B82F6' }} />
                                      <span className="flex-1 text-gray-700">{child.name}</span>
                                      <span className="text-xs text-gray-400">{child.store_count} stores</span>
                                      <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${isChildAssigned ? 'bg-primary-600 border-primary-600' : 'border-gray-300'}`}>
                                        {isChildAssigned && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {editingMember.role === 'store_manager' && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Assigned Stores</h3>
                  <div className="space-y-2">
                    {stores.filter((s) => s.is_active).map((store) => {
                      const isAssigned = editStoreIds.includes(store.id);
                      const storeRegion = regions.find((r) => r.id === store.region);
                      return (
                        <button
                          key={store.id}
                          onClick={() => setEditStoreIds(toggleArrayItem(editStoreIds, store.id))}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${
                            isAssigned
                              ? 'border-primary-300 bg-primary-50/50 shadow-sm'
                              : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                          }`}
                          style={storeRegion ? { borderLeftWidth: '4px', borderLeftColor: storeRegion.color || '#3B82F6' } : undefined}
                        >
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-gray-900">{store.name}</span>
                            {store.store_number && <span className="text-xs text-gray-400 ml-1.5">#{store.store_number}</span>}
                            {storeRegion && <p className="text-xs text-gray-400 mt-0.5">{storeRegion.name}</p>}
                          </div>
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isAssigned ? 'bg-primary-600 border-primary-600' : 'border-gray-300'}`}>
                            {isAssigned && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex gap-3">
              <button
                onClick={() => setEditingMember(null)}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAssignments}
                disabled={editSubmitting}
                className="flex-1 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {editSubmitting ? 'Saving...' : 'Save Assignments'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editUserMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setEditUserMember(null)}
          />
          <div className="relative bg-white rounded-xl shadow-xl ring-1 ring-gray-900/5 w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">Edit User</h2>
              <button
                onClick={() => setEditUserMember(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {editUserError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 text-sm text-red-700">{editUserError}</div>
            )}
            {editUserSuccess && (
              <div className="mb-4 p-3 rounded-lg bg-green-50 text-sm text-green-700">{editUserSuccess}</div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                <input
                  type="text"
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                  className="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                <input
                  type="text"
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                  className="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setEditUserMember(null)}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveUser}
                disabled={editUserSubmitting}
                className="flex-1 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {editUserSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <button
                onClick={handleSendPasswordReset}
                disabled={sendingReset}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {sendingReset ? 'Sending...' : 'Send Password Reset Email'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Confirmation Modal */}
      {removingMemberId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setRemovingMemberId(null)}
          />
          <div className="relative bg-white rounded-xl shadow-xl ring-1 ring-gray-900/5 w-full max-w-sm mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-100 flex-shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">Remove Member</h3>
                <p className="text-sm text-gray-500">
                  Are you sure you want to remove this member? They will lose access to this organization.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setRemovingMemberId(null)}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRemove(removingMemberId)}
                disabled={removeSubmitting}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {removeSubmitting ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
