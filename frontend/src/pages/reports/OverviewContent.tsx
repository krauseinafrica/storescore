import { Fragment, useEffect, useState, useMemo, useCallback } from 'react';
import { getOrgId } from '../../utils/org';
import { getStores } from '../../api/walks';
import { useAuth } from '../../hooks/useAuth';
import InfoButton from '../../components/InfoButton';
import { getGoals } from '../../api/walks';
import type { GoalData } from '../../api/walks';
import {
  getOverview,
  getTrends,
  getStoreComparison,
  getSectionBreakdown,
  getRegionComparison,
  getSectionTrends,
  getReportSchedules,
  setReportSchedule,
  deleteReportSchedule,
  getEvaluatorConsistency,
  exportCSV,
} from '../../api/analytics';
import type {
  OverviewData,
  TrendPoint,
  StoreRanking,
  SectionBreakdown,
  RegionComparison,
  SectionTrendData,
  ReportScheduleData,
  EvaluatorConsistencyData,
  Period,
} from '../../api/analytics';
import type { Store } from '../../types';
import {
  COLORS,
  KpiCard,
  TrendArrow,
  ScoreGauge,
  RegionScoreBars,
  ScoreTrendChart,
  StoreBarChart,
  SectionTrendsChart,
  SectionCard,
  StoreFilter,
  getScoreColor,
  getScoreBgColor,
  getScoreBarBg,
  getScoreHex,
  formatDate,
} from './reportHelpers';

interface OverviewContentProps {
  period: Period;
  onDrillToStore: (storeId: string) => void;
  onDrillToSection: (sectionName: string) => void;
}

export function OverviewContent({ period, onDrillToStore, onDrillToSection }: OverviewContentProps) {
  const orgId = getOrgId();
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Data
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [storeRankings, setStoreRankings] = useState<StoreRanking[]>([]);
  const [sections, setSections] = useState<SectionBreakdown[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [regionData, setRegionData] = useState<RegionComparison[]>([]);
  const [sectionTrends, setSectionTrends] = useState<SectionTrendData[]>([]);
  const [schedules, setSchedules] = useState<ReportScheduleData[]>([]);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [evaluatorData, setEvaluatorData] = useState<EvaluatorConsistencyData[]>([]);
  const [scoreGoal, setScoreGoal] = useState<number | null>(null);

  // Filters
  const [trendStore, setTrendStore] = useState('');
  const [sectionStore, setSectionStore] = useState('');
  const [sortField, setSortField] = useState('-avg_score');
  const [rankingRegion, setRankingRegion] = useState('');

  // Load stores and goals once
  useEffect(() => {
    if (!orgId) return;
    getStores(orgId)
      .then((data) => setStores(data.filter((s) => s.is_active)))
      .catch(() => setStores([]));
    getGoals(orgId)
      .then((goals) => {
        const orgScoreGoal = goals.find(
          (g) => g.goal_type === 'score_target' && g.scope === 'organization' && g.is_active
        );
        if (orgScoreGoal) setScoreGoal(Number(orgScoreGoal.target_value));
      })
      .catch(() => {});
  }, [orgId]);

  // Load report schedules
  useEffect(() => {
    if (!orgId) return;
    getReportSchedules(orgId)
      .then(setSchedules)
      .catch(() => setSchedules([]));
  }, [orgId]);

  const handleToggleSchedule = useCallback(async (frequency: 'weekly' | 'monthly') => {
    if (!orgId || schedulesLoading) return;
    setSchedulesLoading(true);
    try {
      const existing = schedules.find((s) => s.frequency === frequency);
      if (existing) {
        await deleteReportSchedule(orgId, frequency);
        setSchedules((prev) => prev.filter((s) => s.frequency !== frequency));
      } else {
        const created = await setReportSchedule(orgId, frequency, true);
        setSchedules((prev) => [...prev, created]);
      }
    } catch {
      // silently fail
    } finally {
      setSchedulesLoading(false);
    }
  }, [orgId, schedules, schedulesLoading]);

  // Load main data when period changes
  useEffect(() => {
    if (!orgId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    async function fetchData() {
      try {
        const [overviewData, storeData, regions, secTrends, evalData] = await Promise.all([
          getOverview(orgId, period).catch(() => null),
          getStoreComparison(orgId, { period, sort: sortField, region: rankingRegion || undefined }).catch(() => []),
          getRegionComparison(orgId, period).catch(() => []),
          getSectionTrends(orgId, { period }).catch(() => []),
          isAdmin ? getEvaluatorConsistency(orgId, period).catch(() => []) : Promise.resolve([]),
        ]);

        if (!cancelled) {
          setOverview(overviewData);
          setStoreRankings(storeData);
          setRegionData(regions);
          setSectionTrends(secTrends);
          setEvaluatorData(evalData);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [orgId, period, sortField, rankingRegion, isAdmin]);

  // Load trends when period or trendStore changes
  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;

    const granularity = period === '30d' ? 'weekly' : 'monthly';
    getTrends(orgId, { period, granularity, store: trendStore || undefined })
      .then((data) => { if (!cancelled) setTrends(data); })
      .catch(() => { if (!cancelled) setTrends([]); });

    return () => { cancelled = true; };
  }, [orgId, period, trendStore]);

  // Load sections when period or sectionStore changes
  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;

    getSectionBreakdown(orgId, { period, store: sectionStore || undefined })
      .then((data) => { if (!cancelled) setSections(data); })
      .catch(() => { if (!cancelled) setSections([]); });

    return () => { cancelled = true; };
  }, [orgId, period, sectionStore]);

  const handleExport = useCallback(async () => {
    if (!orgId || exporting) return;
    setExporting(true);
    try {
      await exportCSV(orgId, { period });
    } catch {
      // silent fail
    } finally {
      setExporting(false);
    }
  }, [orgId, period, exporting]);

  const handleSort = useCallback((field: string) => {
    setSortField((prev) => prev === `-${field}` ? field : `-${field}`);
  }, []);

  const sortIndicator = useCallback((field: string) => {
    if (sortField === field) return ' \u2191';
    if (sortField === `-${field}`) return ' \u2193';
    return '';
  }, [sortField]);

  // Quick insights derived from data
  const insights = useMemo(() => {
    const items: { type: 'success' | 'warning' | 'info'; text: string }[] = [];

    if (overview?.score_trend === 'up') {
      items.push({ type: 'success', text: 'Scores are trending upward this period' });
    } else if (overview?.score_trend === 'down') {
      items.push({ type: 'warning', text: 'Scores are trending downward - review recent evaluations' });
    }

    if (storeRankings.length > 0) {
      const declining = storeRankings.filter((s) => s.trend === 'declining');
      if (declining.length > 0) {
        items.push({
          type: 'warning',
          text: `${declining.length} store${declining.length > 1 ? 's' : ''} declining: ${declining.slice(0, 2).map((s) => s.store_name).join(', ')}`,
        });
      }
    }

    if (sections.length > 0) {
      const scoredSections = sections.filter((s) =>
        s.criteria.length > 0 && s.criteria.some((c) => c.avg_points > 0)
      );
      const lowSections = scoredSections.filter((s) => s.avg_percentage < 60);
      if (lowSections.length > 0) {
        items.push({
          type: 'warning',
          text: `Sections needing attention: ${lowSections.map((s) => s.section_name).join(', ')}`,
        });
      }
    }

    if (evaluatorData.length > 0) {
      const flagged = evaluatorData.filter((e) => e.flag_level === 'high');
      if (flagged.length > 0) {
        items.push({
          type: 'info',
          text: `${flagged.length} evaluator${flagged.length > 1 ? 's' : ''} with uniform scoring patterns`,
        });
      }
    }

    if (overview?.best_store) {
      items.push({
        type: 'success',
        text: `Top performer: ${overview.best_store.name} (${overview.best_store.avg_score.toFixed(1)}%)`,
      });
    }

    return items;
  }, [overview, storeRankings, sections, evaluatorData]);

  return (
    <>
      {/* Export button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={handleExport}
          disabled={exporting}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 active:bg-primary-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {exporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>

      {/* Quick Insights Banner */}
      {!loading && insights.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4 mb-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Quick Insights</h3>
          <div className="space-y-1.5">
            {insights.map((insight, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                {insight.type === 'success' && (
                  <svg className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
                {insight.type === 'warning' && (
                  <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                )}
                {insight.type === 'info' && (
                  <svg className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                )}
                <span className="text-gray-700">{insight.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
        <KpiCard
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          }
          iconBg="bg-primary-600"
          label="Total Evaluations"
          value={String(overview?.total_walks ?? 0)}
          subtitle="Completed evaluations"
          loading={loading}
        />
        <KpiCard
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
          iconBg="bg-violet-500"
          label="Avg Score"
          value={overview?.avg_score != null ? `${Math.round(overview.avg_score)}%` : 'N/A'}
          subtitle="Across all stores"
          loading={loading}
        />
        <KpiCard
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          }
          iconBg="bg-green-500"
          label="Stores Evaluated"
          value={String(overview?.total_stores_walked ?? 0)}
          subtitle="Unique store locations"
          loading={loading}
        />
        <KpiCard
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          }
          iconBg="bg-amber-500"
          label="Score Trend"
          value={overview?.score_trend === 'up' ? 'Up' : overview?.score_trend === 'down' ? 'Down' : 'Stable'}
          subtitle={overview?.best_store ? `Best: ${overview.best_store.name}` : 'Compared to previous period'}
          loading={loading}
          trend={!loading && overview ? <TrendArrow trend={overview.score_trend} /> : undefined}
        />
      </div>

      {/* Score Overview: Gauge + Regions (left) | Trend (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {!loading && overview?.avg_score != null && (
          <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-5 flex flex-col items-center">
            <ScoreGauge score={overview.avg_score} label="Overall Score" goal={scoreGoal} />
            {regionData.length > 0 && (
              <div className="w-full mt-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3 text-center">By Region</h3>
                <RegionScoreBars data={regionData} goal={scoreGoal} />
              </div>
            )}
            {regionData.length === 0 && scoreGoal != null && (
              <p className={`text-sm mt-2 font-medium ${overview.avg_score >= scoreGoal ? 'text-green-600' : 'text-amber-600'}`}>
                {overview.avg_score >= scoreGoal ? 'Above' : 'Below'} goal of {scoreGoal}%
              </p>
            )}
          </div>
        )}

        <div className={`bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4 sm:p-6 ${!loading && overview?.avg_score != null ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Score Trends</h2>
            <StoreFilter stores={stores} selectedStore={trendStore} onChange={setTrendStore} />
          </div>
          <ScoreTrendChart data={trends} />
        </div>
      </div>

      {/* Section Score Trends */}
      {sectionTrends.length > 0 && sectionTrends.some((s) => s.points.length > 1) && (
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4 sm:p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Section Score Trends</h2>
          <SectionTrendsChart data={sectionTrends} onLegendClick={onDrillToSection} />
        </div>
      )}

      {/* Store Rankings: Chart + Table */}
      <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 mb-6 overflow-hidden">
        <div className="p-4 sm:p-6 pb-0 sm:pb-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Store Rankings</h2>
            {regionData.length > 0 && (
              <select
                value={rankingRegion}
                onChange={(e) => setRankingRegion(e.target.value)}
                className="rounded-lg border-gray-300 bg-white text-sm py-1.5 pl-3 pr-8 shadow-sm ring-1 ring-gray-900/5 focus:border-primary-500 focus:ring-primary-500"
              >
                <option value="">All Regions</option>
                {regionData.map((r) => (
                  <option key={r.region_id} value={r.region_id}>{r.region_name}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {storeRankings.length > 0 && storeRankings.length <= 20 && (
          <div className="px-4 sm:px-6 pb-4">
            <StoreBarChart data={storeRankings} onBarClick={onDrillToStore} />
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3 w-12">#</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Store</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3 hidden sm:table-cell">Region</th>
                <th
                  className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3 cursor-pointer hover:text-gray-700 select-none"
                  onClick={() => handleSort('avg_score')}
                >
                  Avg Score{sortIndicator('avg_score')}
                </th>
                <th
                  className="text-center text-xs font-medium text-gray-500 px-4 sm:px-6 py-3 cursor-pointer hover:text-gray-700 select-none hidden md:table-cell"
                  onClick={() => handleSort('walk_count')}
                >
                  Walks{sortIndicator('walk_count')}
                </th>
                <th className="text-center text-xs font-medium text-gray-500 px-4 sm:px-6 py-3 hidden lg:table-cell">Trend</th>
                <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-3 hidden lg:table-cell">Last Walk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {storeRankings.length === 0 && !loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-sm text-gray-400">
                    No store data available for this period.
                  </td>
                </tr>
              ) : (
                storeRankings.map((store, idx) => (
                  <tr
                    key={store.store_id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => onDrillToStore(store.store_id)}
                  >
                    <td className="px-4 sm:px-6 py-3 text-gray-400 font-medium">{idx + 1}</td>
                    <td className="px-4 sm:px-6 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{store.store_name}</p>
                        {store.store_number && <p className="text-xs text-gray-400">#{store.store_number}</p>}
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-3 text-gray-500 hidden sm:table-cell">{store.region_name || '--'}</td>
                    <td className="px-4 sm:px-6 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-20 h-2 rounded-full ${getScoreBarBg(store.avg_score)}`}>
                          <div
                            className={`h-2 rounded-full ${getScoreBgColor(store.avg_score)}`}
                            style={{ width: `${Math.min(100, store.avg_score)}%` }}
                          />
                        </div>
                        <span className={`font-semibold ${getScoreColor(store.avg_score)}`}>
                          {store.avg_score.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-3 text-center text-gray-500 hidden md:table-cell">{store.walk_count}</td>
                    <td className="px-4 sm:px-6 py-3 text-center hidden lg:table-cell"><TrendArrow trend={store.trend} /></td>
                    <td className="px-4 sm:px-6 py-3 text-right text-gray-400 text-xs hidden lg:table-cell">{formatDate(store.last_walk_date)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Regional Details */}
      {regionData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 mb-6 overflow-hidden">
          <div className="p-4 sm:p-6 pb-0 sm:pb-0">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Regional Details</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-gray-100">
            {regionData.map((region) => (
              <div key={region.region_id} className="bg-white p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-900">{region.region_name}</span>
                  <span className={`text-lg font-bold ${getScoreColor(region.avg_score)}`}>
                    {region.avg_score.toFixed(1)}%
                  </span>
                </div>
                <div className={`w-full h-2 rounded-full ${getScoreBarBg(region.avg_score)} mb-3`}>
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${getScoreBgColor(region.avg_score)}`}
                    style={{ width: `${Math.min(100, region.avg_score)}%` }}
                  />
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                  <span>{region.store_count} stores</span>
                  <span>{region.walk_count} walks</span>
                </div>
                {region.best_store && (
                  <p
                    className="text-xs text-green-600 truncate cursor-pointer hover:underline"
                    onClick={() => onDrillToStore(region.best_store!.id)}
                  >
                    Best: {region.best_store.name} ({region.best_store.avg_score.toFixed(1)}%)
                  </p>
                )}
                {region.worst_store && (
                  <p
                    className="text-xs text-amber-600 truncate mt-0.5 cursor-pointer hover:underline"
                    onClick={() => onDrillToStore(region.worst_store!.id)}
                  >
                    Low: {region.worst_store.name} ({region.worst_store.avg_score.toFixed(1)}%)
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section Breakdown */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <h2 className="text-sm font-semibold text-gray-900">Section Breakdown</h2>
          <StoreFilter stores={stores} selectedStore={sectionStore} onChange={setSectionStore} />
        </div>

        {sections.length === 0 && !loading ? (
          <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-6 text-center">
            <p className="text-sm text-gray-400">No section data available for this period.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sections
              .filter((s) => s.criteria.length > 0 && s.criteria.some((c) => c.avg_points > 0))
              .map((section) => (
                <SectionCard
                  key={section.section_name}
                  section={section}
                  onClick={() => onDrillToSection(section.section_name)}
                />
              ))}
          </div>
        )}
      </div>

      {/* Email Digest Subscription */}
      <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Email Digest Reports</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Get a summary of evaluation activity delivered to your inbox.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleToggleSchedule('weekly')}
              disabled={schedulesLoading}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
                schedules.some((s) => s.frequency === 'weekly')
                  ? 'bg-primary-600 text-white hover:bg-primary-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Weekly
            </button>
            <button
              onClick={() => handleToggleSchedule('monthly')}
              disabled={schedulesLoading}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
                schedules.some((s) => s.frequency === 'monthly')
                  ? 'bg-primary-600 text-white hover:bg-primary-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Monthly
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
