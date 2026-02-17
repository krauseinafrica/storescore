import api from './client';
import type { OrgMember, User } from '../types';

export interface InviteMemberData {
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  region_ids?: string[];
  store_ids?: string[];
}

export async function getMembers(orgId: string): Promise<OrgMember[]> {
  const response = await api.get<OrgMember[]>('/auth/members/', {
    headers: { 'X-Organization': orgId },
  });
  return response.data;
}

export async function inviteMember(
  orgId: string,
  data: InviteMemberData
): Promise<OrgMember> {
  const response = await api.post<OrgMember>('/auth/members/invite/', data, {
    headers: { 'X-Organization': orgId },
  });
  return response.data;
}

export async function updateMemberRole(
  orgId: string,
  memberId: string,
  role: string,
  assignments?: { region_ids?: string[]; store_ids?: string[] }
): Promise<OrgMember> {
  const response = await api.patch<OrgMember>(
    `/auth/members/${memberId}/`,
    { role, ...assignments },
    { headers: { 'X-Organization': orgId } }
  );
  return response.data;
}

export async function removeMember(
  orgId: string,
  memberId: string
): Promise<void> {
  await api.delete(`/auth/members/${memberId}/`, {
    headers: { 'X-Organization': orgId },
  });
}

// ---------- Profile ----------

export async function getProfile(): Promise<User> {
  const response = await api.get<User>('/auth/profile/');
  return response.data;
}

export async function updateProfile(data: {
  first_name?: string;
  last_name?: string;
  email?: string;
}): Promise<User> {
  const response = await api.patch<User>('/auth/profile/', data);
  return response.data;
}

export async function uploadAvatar(file: File): Promise<User> {
  const formData = new FormData();
  formData.append('avatar', file);
  const response = await api.patch<User>('/auth/profile/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export async function removeAvatar(): Promise<User> {
  const response = await api.delete<User>('/auth/profile/');
  return response.data;
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  await api.post('/auth/profile/change-password/', {
    current_password: currentPassword,
    new_password: newPassword,
  });
}

// ---------- Password Reset ----------

export async function requestPasswordReset(email: string): Promise<void> {
  await api.post('/auth/password-reset/', { email });
}

export async function confirmPasswordReset(
  uid: string,
  token: string,
  newPassword: string
): Promise<void> {
  await api.post('/auth/password-reset/confirm/', {
    uid,
    token,
    new_password: newPassword,
  });
}

// ---------- Resend Invite ----------

export async function resendInvite(
  orgId: string,
  memberId: string
): Promise<{ detail: string }> {
  const response = await api.post<{ detail: string }>(
    `/auth/members/${memberId}/resend-invite/`,
    {},
    { headers: { 'X-Organization': orgId } }
  );
  return response.data;
}

// ---------- Admin User Edit ----------

export async function adminEditUser(
  orgId: string,
  memberId: string,
  data: { first_name?: string; last_name?: string; email?: string }
): Promise<OrgMember> {
  const response = await api.patch<OrgMember>(
    `/auth/members/${memberId}/edit-user/`,
    data,
    { headers: { 'X-Organization': orgId } }
  );
  return response.data;
}

export async function adminSendPasswordReset(
  orgId: string,
  memberId: string
): Promise<{ detail: string }> {
  const response = await api.post<{ detail: string }>(
    `/auth/members/${memberId}/edit-user/`,
    {},
    { headers: { 'X-Organization': orgId } }
  );
  return response.data;
}
