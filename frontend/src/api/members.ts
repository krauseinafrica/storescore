import api from './client';
import type { OrgMember } from '../types';

export interface InviteMemberData {
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'manager' | 'member';
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
  role: string
): Promise<OrgMember> {
  const response = await api.patch<OrgMember>(
    `/auth/members/${memberId}/`,
    { role },
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
