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

// --- New Phase 4 types ---

export interface StoreScorecardData {
  store_id: string;
  latest_walk: {
    id: string;
    date: string;
    total_score: number | null;
    conducted_by: string;
  } | null;
  walk_count: number;
  avg_score: number | null;
  score_history: Array<{
    date: string;
    score: number | null;
    walk_id: string;
  }>;
  section_trends: Array<{
    section_name: string;
    monthly: Array<{ month: string; avg_percentage: number }>;
  }>;
  action_items?: {
    total: number;
    open: number;
    resolved: number;
    avg_resolution_days: number | null;
  };
}

export interface RegionComparison {
  region_id: string;
  region_name: string;
  avg_score: number;
  walk_count: number;
  store_count: number;
  best_store: { id: string; name: string; avg_score: number } | null;
  worst_store: { id: string; name: string; avg_score: number } | null;
}

export interface SectionTrendData {
  section_name: string;
  points: Array<{ month: string; avg_percentage: number }>;
}

export interface ReportScheduleData {
  id: string;
  frequency: 'weekly' | 'monthly';
  is_active: boolean;
  last_sent_at: string | null;
}

export interface EvaluatorConsistencyData {
  evaluator_id: string;
  evaluator_name: string;
  walk_count: number;
  avg_total_score: number | null;
  avg_criterion_score: number;
  score_std_dev: number;
  dominant_score: number;
  dominant_score_pct: number;
  unique_score_values: number;
  score_distribution: Record<number, number>;
  flag_level: 'high' | 'medium' | 'normal';
  total_criterion_scores: number;
  store_score_range: number;
  stores: Array<{
    store_id: string;
    store_name: string;
    avg_score: number;
    walk_count: number;
  }>;
}

// --- Phase 5.8: New types ---

export interface SectionStoreData {
  section_name: string;
  org_avg: number;
  stores: Array<{
    store_id: string;
    store_name: string;
    avg_percentage: number;
    walk_count: number;
  }>;
  criteria: Array<{
    name: string;
    avg_percentage: number;
  }>;
}

export interface EvaluatorTrendsData {
  evaluator_id: string;
  evaluator_name: string;
  monthly_scores: Array<{
    month: string;
    avg_score: number;
    org_avg: number;
    walk_count: number;
  }>;
  section_bias: Array<{
    section_name: string;
    evaluator_avg: number;
    org_avg: number;
    difference: number;
  }>;
  store_comparison: Array<{
    store_id: string;
    store_name: string;
    evaluator_avg: number;
    org_avg: number;
  }>;
}

export interface ActionItemAnalyticsData {
  total: number;
  open: number;
  in_progress: number;
  resolved: number;
  pending_review: number;
  approved: number;
  dismissed: number;
  avg_resolution_days: number | null;
  by_store: Array<{
    store_id: string;
    store_name: string;
    total: number;
    open: number;
    resolved: number;
  }>;
  by_section: Array<{
    section_name: string;
    count: number;
  }>;
  by_priority: Array<{
    priority: string;
    count: number;
  }>;
  monthly_trend: Array<{
    month: string;
    created: number;
    resolved: number;
  }>;
}

export interface DriverAnalyticsData {
  total_selections: number;
  total_configured: number;
  top_drivers: Array<{
    name: string;
    count: number;
    criterion_name: string;
  }>;
  by_section: Array<{
    section_name: string;
    count: number;
    top_driver: string | null;
  }>;
  by_store: Array<{
    store_id: string;
    store_name: string;
    count: number;
  }>;
  monthly_trend: Array<{
    month: string;
    count: number;
  }>;
}

// --- Resolution Analytics types ---

export interface ResolutionSummary {
  avg_resolution_days: number | null;
  median_resolution_days: number | null;
  total_resolved: number;
  total_approved: number;
  avg_approval_days: number | null;
}

export interface ResolutionByPriority {
  priority: string;
  count: number;
  resolved_count: number;
  avg_days: number | null;
  median_days: number | null;
  sla_met_count: number;
  sla_met_pct: number;
}

export interface ResolutionByStore {
  store_id: string;
  store_name: string;
  total: number;
  resolved: number;
  avg_resolution_days: number | null;
  critical_open: number;
  high_open: number;
}

export interface ResolutionByRegion {
  region_id: string;
  region_name: string;
  total: number;
  resolved: number;
  avg_resolution_days: number | null;
}

export interface ResolutionMonthlyTrend {
  month: string;
  avg_resolution_days: number | null;
  resolved_count: number;
  created_count: number;
}

export interface ResolutionAnalyticsData {
  summary: ResolutionSummary;
  by_priority: ResolutionByPriority[];
  by_store: ResolutionByStore[];
  by_region: ResolutionByRegion[];
  monthly_trend: ResolutionMonthlyTrend[];
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

export async function getStoreScorecard(
  orgId: string,
  storeId: string,
  period: Period = '1y'
): Promise<StoreScorecardData> {
  const response = await api.get<StoreScorecardData>(
    `/walks/analytics/scorecard/${storeId}/`,
    {
      headers: { 'X-Organization': orgId },
      params: { period },
    }
  );
  return response.data;
}

export async function getRegionComparison(
  orgId: string,
  period: Period = '90d'
): Promise<RegionComparison[]> {
  const response = await api.get<RegionComparison[]>(
    '/walks/analytics/regions/',
    {
      headers: { 'X-Organization': orgId },
      params: { period },
    }
  );
  return response.data;
}

export async function getSectionTrends(
  orgId: string,
  params: SectionParams = {}
): Promise<SectionTrendData[]> {
  const response = await api.get<SectionTrendData[]>(
    '/walks/analytics/section-trends/',
    {
      headers: { 'X-Organization': orgId },
      params,
    }
  );
  return response.data;
}

export async function getReportSchedules(
  orgId: string
): Promise<ReportScheduleData[]> {
  const response = await api.get<ReportScheduleData[]>(
    '/walks/analytics/report-schedules/',
    { headers: { 'X-Organization': orgId } }
  );
  return response.data;
}

export async function setReportSchedule(
  orgId: string,
  frequency: 'weekly' | 'monthly',
  isActive: boolean
): Promise<ReportScheduleData> {
  const response = await api.post<ReportScheduleData>(
    '/walks/analytics/report-schedules/',
    { frequency, is_active: isActive },
    { headers: { 'X-Organization': orgId } }
  );
  return response.data;
}

export async function deleteReportSchedule(
  orgId: string,
  frequency: 'weekly' | 'monthly'
): Promise<void> {
  await api.delete('/walks/analytics/report-schedules/', {
    headers: { 'X-Organization': orgId },
    data: { frequency },
  });
}

export async function getEvaluatorConsistency(
  orgId: string,
  period: Period = '90d',
  minWalks = 3
): Promise<EvaluatorConsistencyData[]> {
  const response = await api.get<EvaluatorConsistencyData[]>(
    '/walks/analytics/evaluator-consistency/',
    {
      headers: { 'X-Organization': orgId },
      params: { period, min_walks: minWalks },
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

// --- Phase 5.8: New API functions ---

export async function getSectionStoreComparison(
  orgId: string,
  params: { section: string; period?: Period }
): Promise<SectionStoreData> {
  const response = await api.get<SectionStoreData>(
    '/walks/analytics/section-stores/',
    {
      headers: { 'X-Organization': orgId },
      params,
    }
  );
  return response.data;
}

export async function getEvaluatorTrends(
  orgId: string,
  evaluatorId: string,
  period: Period = '90d'
): Promise<EvaluatorTrendsData> {
  const response = await api.get<EvaluatorTrendsData>(
    `/walks/analytics/evaluator-trends/${evaluatorId}/`,
    {
      headers: { 'X-Organization': orgId },
      params: { period },
    }
  );
  return response.data;
}

export async function getActionItemAnalytics(
  orgId: string,
  period: Period = '90d'
): Promise<ActionItemAnalyticsData> {
  const response = await api.get<ActionItemAnalyticsData>(
    '/walks/analytics/action-items/',
    {
      headers: { 'X-Organization': orgId },
      params: { period },
    }
  );
  return response.data;
}

export async function getDriverAnalytics(
  orgId: string,
  period: Period = '90d'
): Promise<DriverAnalyticsData> {
  const response = await api.get<DriverAnalyticsData>(
    '/walks/analytics/drivers/',
    {
      headers: { 'X-Organization': orgId },
      params: { period },
    }
  );
  return response.data;
}

export async function getResolutionAnalytics(
  orgId: string,
  period: Period = '90d'
): Promise<ResolutionAnalyticsData> {
  const response = await api.get<ResolutionAnalyticsData>(
    '/walks/analytics/resolution/',
    {
      headers: { 'X-Organization': orgId },
      params: { period },
    }
  );
  return response.data;
}
