import api from './client';
import type { IntegrationConfig, StoreDataPoint } from '../types';

// ---------- Integration Configs ----------

export async function getIntegrations(orgId: string): Promise<IntegrationConfig[]> {
  const response = await api.get('/stores/integrations/', {
    headers: { 'X-Organization': orgId },
    params: { page_size: 100 },
  });
  const data = response.data;
  return Array.isArray(data) ? data : data.results ?? [];
}

export async function getIntegration(
  orgId: string,
  id: string
): Promise<IntegrationConfig> {
  const response = await api.get<IntegrationConfig>(`/stores/integrations/${id}/`, {
    headers: { 'X-Organization': orgId },
  });
  return response.data;
}

export async function createIntegration(
  orgId: string,
  data: { name: string; integration_type: string; provider?: string; config?: Record<string, unknown> }
): Promise<IntegrationConfig> {
  const response = await api.post<IntegrationConfig>('/stores/integrations/', data, {
    headers: { 'X-Organization': orgId },
  });
  return response.data;
}

export async function updateIntegration(
  orgId: string,
  id: string,
  data: Partial<IntegrationConfig>
): Promise<IntegrationConfig> {
  const response = await api.patch<IntegrationConfig>(`/stores/integrations/${id}/`, data, {
    headers: { 'X-Organization': orgId },
  });
  return response.data;
}

export async function deleteIntegration(
  orgId: string,
  id: string
): Promise<void> {
  await api.delete(`/stores/integrations/${id}/`, {
    headers: { 'X-Organization': orgId },
  });
}

// ---------- Store Data Points ----------

export async function getDataPoints(
  orgId: string,
  params?: Record<string, string>
): Promise<StoreDataPoint[]> {
  const response = await api.get('/stores/data-points/', {
    headers: { 'X-Organization': orgId },
    params: { page_size: 100, ...params },
  });
  const data = response.data;
  return Array.isArray(data) ? data : data.results ?? [];
}

export async function createDataPoint(
  orgId: string,
  data: { store: string; metric: string; value: string; date: string; source?: string; integration?: string; metadata?: Record<string, unknown> }
): Promise<StoreDataPoint> {
  const response = await api.post<StoreDataPoint>('/stores/data-points/', data, {
    headers: { 'X-Organization': orgId },
  });
  return response.data;
}

export async function uploadDataPointsCSV(
  orgId: string,
  file: File,
  columnMapping: Record<string, number>
): Promise<{ created: number; errors: string[] }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('column_mapping', JSON.stringify(columnMapping));
  const response = await api.post('/stores/data-points/csv-upload/', formData, {
    headers: {
      'X-Organization': orgId,
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}

// ---------- Leads (Platform Admin) ----------

export interface LeadData {
  email: string;
  first_name: string;
  last_name: string;
  company_name?: string;
  phone?: string;
  store_count?: number;
  message?: string;
  source?: string;
}

export async function getLeads(): Promise<unknown[]> {
  const response = await api.get('/auth/leads/');
  return response.data;
}

export async function getLead(id: string): Promise<unknown> {
  const response = await api.get(`/auth/leads/${id}/`);
  return response.data;
}

export async function createLead(data: LeadData): Promise<{ id: string; message: string }> {
  const response = await api.post('/auth/leads/', data);
  return response.data;
}

export async function updateLeadStatus(id: string, status: string): Promise<unknown> {
  const response = await api.patch(`/auth/leads/${id}/`, { status });
  return response.data;
}
