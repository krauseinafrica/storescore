import api from './client';
import type { User, Store } from '../types';

export interface PlatformStats {
  total_organizations: number;
  total_stores: number;
  total_users: number;
  total_walks: number;
  total_completed_walks: number;
}

export interface PlatformOrg {
  id: string;
  name: string;
  slug: string;
  owner: User;
  member_count: number;
  store_count: number;
  walk_count: number;
  completed_walk_count: number;
  last_walk_date: string | null;
  is_active: boolean;
  created_at: string;
}

export interface PlatformOrgSubscription {
  plan_name: string;
  status: string;
  store_count: number;
  discount_percent: number;
  promo_discount_name: string;
  promo_discount_percent: number;
  effective_discount_percent: number;
  billing_interval: string;
}

export interface PlatformOrgDetail {
  organization: {
    id: string;
    name: string;
    slug: string;
    is_active: boolean;
    owner: User;
    created_at: string;
  };
  stores: Store[];
  members: Array<{
    id: string;
    user: User;
    role: string;
    created_at: string;
  }>;
  regions: Array<{
    id: string;
    name: string;
    store_count: number;
  }>;
  subscription: PlatformOrgSubscription | null;
}

export interface CreateOrgData {
  name: string;
  owner_email: string;
  owner_first_name?: string;
  owner_last_name?: string;
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const response = await api.get<PlatformStats>('/auth/platform/stats/');
  return response.data;
}

export async function getPlatformOrgs(): Promise<PlatformOrg[]> {
  const response = await api.get<PlatformOrg[]>('/auth/platform/orgs/');
  return response.data;
}

export async function createPlatformOrg(
  data: CreateOrgData
): Promise<PlatformOrg> {
  const response = await api.post<PlatformOrg>('/auth/platform/orgs/', data);
  return response.data;
}

export async function getPlatformOrgDetail(
  orgId: string
): Promise<PlatformOrgDetail> {
  const response = await api.get<PlatformOrgDetail>(
    `/auth/platform/orgs/${orgId}/`
  );
  return response.data;
}

export async function updatePlatformOrg(
  orgId: string,
  data: { name?: string; promo_discount_name?: string; promo_discount_percent?: number }
): Promise<PlatformOrg> {
  const response = await api.patch<PlatformOrg>(
    `/auth/platform/orgs/${orgId}/`,
    data
  );
  return response.data;
}

export async function activatePlatformOrg(
  orgId: string,
  action: 'activate' | 'deactivate'
): Promise<void> {
  await api.post(`/auth/platform/orgs/${orgId}/activation/`, { action });
}

export async function createPlatformOrgStore(
  orgId: string,
  data: {
    name: string;
    store_number?: string;
    region?: string;
    address?: string;
    city?: string;
    state?: string;
    zip_code?: string;
  }
): Promise<Store> {
  const response = await api.post<Store>(
    `/auth/platform/orgs/${orgId}/stores/`,
    data
  );
  return response.data;
}

export interface StoreImportResult {
  created: number;
  errors: string[];
}

export async function importPlatformOrgStores(
  orgId: string,
  file: File,
  columnMapping?: Record<string, number>
): Promise<StoreImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  if (columnMapping) {
    formData.append('column_mapping', JSON.stringify(columnMapping));
  }
  const response = await api.post<StoreImportResult>(
    `/auth/platform/orgs/${orgId}/stores/import/`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return response.data;
}

export interface EngagementStats {
  total_orgs: number;
  trialing: number;
  active: number;
  canceled: number;
  conversion_rate: number;
  avg_walks_per_org: number;
  engagement_tiers: {
    zero_walks: number;
    one_to_five: number;
    five_plus: number;
  };
  recent_signups: Array<{ day: string; count: number }>;
}

export interface LeadFunnel {
  total_leads: number;
  by_source: Array<{ source: string; count: number }>;
  by_status: Array<{ status: string; count: number }>;
  conversion_by_source: Array<{ source: string; total: number; converted: number; rate: number }>;
}

export async function getEngagementStats(): Promise<EngagementStats> {
  const response = await api.get<EngagementStats>('/auth/platform/engagement/');
  return response.data;
}

export async function getLeadFunnel(): Promise<LeadFunnel> {
  const response = await api.get<LeadFunnel>('/auth/platform/lead-funnel/');
  return response.data;
}
