import api from './client';

// ---------- Types ----------

export interface OverviewData {
  total_walks: number;
  total_stores_walked: number;
  avg_score: number | null;
  best_store: {
    id: string;
    name: string;
    avg_score: number;
  } | null;
  score_trend: 'up' | 'down' | 'stable';
}

export interface TrendPoint {
  period: string;
  avg_score: number;
  walk_count: number;
}

export interface StoreRanking {
  store_id: string;
  store_name: string;
  store_number: string;
  region_name: string;
  avg_score: number;
  walk_count: number;
  last_walk_date: string | null;
  trend: 'improving' | 'declining' | 'stable';
}

export interface CriterionBreakdown {
  name: string;
  avg_points: number;
  max_points: number;
  avg_percentage: number;
}

export interface SectionBreakdown {
  section_name: string;
  avg_percentage: number;
  criteria: CriterionBreakdown[];
}

export type Period = '30d' | '90d' | '6m' | '1y' | 'all';

export interface TrendsParams {
  period?: Period;
  granularity?: 'weekly' | 'monthly';
  store?: string;
}

export interface StoreComparisonParams {
  period?: Period;
  region?: string;
  sort?: string;
}

export interface SectionParams {
  period?: Period;
  store?: string;
}

export interface ExportParams {
  period?: Period;
  store?: string;
}

// ---------- API Functions ----------

export async function getOverview(
  orgId: string,
  period: Period = '90d'
): Promise<OverviewData> {
  const response = await api.get<OverviewData>('/walks/analytics/overview/', {
    headers: { 'X-Organization': orgId },
    params: { period },
  });
  return response.data;
}

export async function getTrends(
  orgId: string,
  params: TrendsParams = {}
): Promise<TrendPoint[]> {
  const response = await api.get<TrendPoint[]>('/walks/analytics/trends/', {
    headers: { 'X-Organization': orgId },
    params,
  });
  return response.data;
}

export async function getStoreComparison(
  orgId: string,
  params: StoreComparisonParams = {}
): Promise<StoreRanking[]> {
  const response = await api.get<StoreRanking[]>('/walks/analytics/stores/', {
    headers: { 'X-Organization': orgId },
    params,
  });
  return response.data;
}

export async function getSectionBreakdown(
  orgId: string,
  params: SectionParams = {}
): Promise<SectionBreakdown[]> {
  const response = await api.get<SectionBreakdown[]>(
    '/walks/analytics/sections/',
    {
      headers: { 'X-Organization': orgId },
      params,
    }
  );
  return response.data;
}

export async function exportCSV(
  orgId: string,
  params: ExportParams = {}
): Promise<void> {
  const response = await api.get('/walks/analytics/export/', {
    headers: { 'X-Organization': orgId },
    params: { ...params, format: 'csv' },
    responseType: 'blob',
  });

  // Trigger file download
  const blob = new Blob([response.data], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'storescore_export.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
