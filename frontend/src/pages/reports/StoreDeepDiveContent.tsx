import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { getOrgId } from '../../utils/org';
import { getStores } from '../../api/walks';
import {
  getStoreScorecard,
  getOverview,
  getSectionBreakdown,
} from '../../api/analytics';
import type {
  StoreScorecardData,
  SectionBreakdown,
  Period,
} from '../../api/analytics';
import type { Store } from '../../types';
import { ChartContainer } from '../../components/charts/ChartContainer';
import type { ChartConfig } from '../../components/charts/ChartContainer';
import { ChartTooltipContent } from '../../components/charts/ChartTooltip';
import {
  COLORS,
  SECTION_COLORS,
  KpiCard,
  TrendArrow,
  ScoreGauge,
  SectionTrendsChart,
  SectionCard,
  LoadingSpinner,
  getScoreColor,
  getScoreHex,
  formatDate,
} from './reportHelpers';

interface StoreDeepDiveContentProps {
  period: Period;
  initialStoreId: string | null;
  onStoreSelected: () => void;
}

export function StoreDeepDiveContent({ period, initialStoreId, onStoreSelected }: StoreDeepDiveContentProps) {
  const orgId = getOrgId();
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>(initialStoreId || '');
  const [scorecard, setScorecard] = useState<StoreScorecardData | null>(null);
  const [orgAvg, setOrgAvg] = useState<number | null>(null);
  const [sections, setSections] = useState<SectionBreakdown[]>([]);
  const [loading, setLoading] = useState(false);
  const [storesLoading, setStoresLoading] = useState(true);

  // Use drill ID on first mount
  useEffect(() => {
    if (initialStoreId && initialStoreId !== selectedStoreId) {
      setSelectedStoreId(initialStoreId);
      onStoreSelected();
    }
  }, [initialStoreId]);

  // Load stores
  useEffect(() => {
    if (!orgId) return;
    getStores(orgId)
      .then((data) => setStores(data.filter((s) => s.is_active)))
      .catch(() => setStores([]))
      .finally(() => setStoresLoading(false));
  }, [orgId]);

  // Load store data when selection changes
  useEffect(() => {
    if (!orgId || !selectedStoreId) {
      setScorecard(null);
      setSections([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    Promise.all([
      getStoreScorecard(orgId, selectedStoreId, period).catch(() => null),
      getOverview(orgId, period).catch(() => null),
      getSectionBreakdown(orgId, { period, store: selectedStoreId }).catch(() => []),
    ]).then(([sc, ov, secs]) => {
      if (!cancelled) {
        setScorecard(sc);
        setOrgAvg(ov?.avg_score ?? null);
        setSections(secs);
      }
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [orgId, selectedStoreId, period]);

  const storeName = useMemo(() => {
    return stores.find((s) => s.id === selectedStoreId)?.name || '';
  }, [stores, selectedStoreId]);

  // Score history chart data with org avg line
  const historyChartData = useMemo(() => {
    if (!scorecard?.score_history) return [];
    return scorecard.score_history.map((h) => ({
      date: h.date ? new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
      score: h.score,
      walkId: h.walk_id,
    }));
  }, [scorecard]);

  const historyConfig: ChartConfig = {
    score: { label: 'Walk Score', color: COLORS.brand },
  };

  // Section trends data for multi-line chart
  const sectionTrendData = useMemo(() => {
    if (!scorecard?.section_trends) return [];
    return scorecard.section_trends.map((s) => ({
      section_name: s.section_name,
      points: s.monthly,
    }));
  }, [scorecard]);

  // Determine score trend
  const scoreTrend = useMemo(() => {
    if (!scorecard?.score_history || scorecard.score_history.length < 2) return 'stable' as const;
    const recent = scorecard.score_history.slice(-3);
    const earlier = scorecard.score_history.slice(-6, -3);
    if (earlier.length === 0) return 'stable' as const;
    const recentAvg = recent.reduce((sum, h) => sum + (h.score || 0), 0) / recent.length;
    const earlierAvg = earlier.reduce((sum, h) => sum + (h.score || 0), 0) / earlier.length;
    if (recentAvg - earlierAvg > 3) return 'up' as const;
    if (recentAvg - earlierAvg < -3) return 'down' as const;
    return 'stable' as const;
  }, [scorecard]);

  if (storesLoading) return <LoadingSpinner message="Loading stores..." />;

  // Empty state: no store selected
  if (!selectedStoreId) {
    return (
      <div>
        <div className="mb-6">
          <select
            value={selectedStoreId}
            onChange={(e) => setSelectedStoreId(e.target.value)}
            className="rounded-lg border-gray-300 bg-white text-sm py-2 pl-3 pr-8 shadow-sm ring-1 ring-gray-900/5 focus:border-primary-500 focus:ring-primary-500"
          >
            <option value="">Select a store...</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-gray-900">Select a store to analyze</h3>
          <p className="mt-1 text-sm text-gray-500 max-w-sm">
            Choose a store from the dropdown above, or click a store name on the Overview tab to drill down.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Store selector + back button */}
      <div className="flex items-center gap-3 mb-6">
        <select
          value={selectedStoreId}
          onChange={(e) => setSelectedStoreId(e.target.value)}
          className="rounded-lg border-gray-300 bg-white text-sm py-2 pl-3 pr-8 shadow-sm ring-1 ring-gray-900/5 focus:border-primary-500 focus:ring-primary-500"
        >
          <option value="">Select a store...</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        {selectedStoreId && (
          <button
            onClick={() => setSelectedStoreId('')}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Clear
          </button>
        )}
      </div>

      {loading ? (
        <LoadingSpinner message={`Loading ${storeName} data...`} />
      ) : scorecard ? (
        <>
          {/* KPI Strip */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
            <KpiCard
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              }
              iconBg="bg-primary-600"
              label="Avg Score"
              value={scorecard.avg_score != null ? `${Math.round(scorecard.avg_score)}%` : 'N/A'}
              subtitle={orgAvg != null ? `Org avg: ${Math.round(orgAvg)}%` : 'No org avg'}
              loading={false}
              trend={<TrendArrow trend={scoreTrend} />}
            />
            <KpiCard
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              }
              iconBg="bg-violet-500"
              label="Walk Count"
              value={String(scorecard.walk_count)}
              subtitle="Evaluations completed"
              loading={false}
            />
            <KpiCard
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              }
              iconBg="bg-green-500"
              label="Latest Score"
              value={scorecard.latest_walk?.total_score != null ? `${Math.round(scorecard.latest_walk.total_score)}%` : 'N/A'}
              subtitle={scorecard.latest_walk?.date ? formatDate(scorecard.latest_walk.date) : 'No walks'}
              loading={false}
            />
            <KpiCard
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              }
              iconBg="bg-amber-500"
              label="Last Evaluator"
              value={scorecard.latest_walk?.conducted_by || 'N/A'}
              subtitle="Most recent walk"
              loading={false}
            />
          </div>

          {/* Score gauge + history chart */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {scorecard.avg_score != null && (
              <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-5 flex flex-col items-center">
                <ScoreGauge score={scorecard.avg_score} label={storeName} />
                {orgAvg != null && (
                  <p className={`text-sm mt-2 font-medium ${scorecard.avg_score >= orgAvg ? 'text-green-600' : 'text-amber-600'}`}>
                    {scorecard.avg_score >= orgAvg ? 'Above' : 'Below'} org avg ({Math.round(orgAvg)}%)
                  </p>
                )}
              </div>
            )}

            <div className={`bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4 sm:p-6 ${scorecard.avg_score != null ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Score History</h2>
              {historyChartData.length > 0 ? (
                <ChartContainer config={historyConfig} className="h-[280px] w-full">
                  <LineChart data={historyChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#f0f0f0" />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={10}
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tick={{ fontSize: 12, fill: '#9ca3af' }}
                      tickFormatter={(v) => `${v}%`}
                      domain={[
                        (min: number) => Math.max(0, Math.floor(min / 10) * 10 - 10),
                        (max: number) => Math.min(100, Math.ceil(max / 10) * 10 + 10),
                      ]}
                      width={45}
                    />
                    {orgAvg != null && (
                      <ReferenceLine
                        y={orgAvg}
                        stroke="#9ca3af"
                        strokeDasharray="6 3"
                        label={{ value: `Org Avg ${Math.round(orgAvg)}%`, position: 'right', fontSize: 10, fill: '#9ca3af' }}
                      />
                    )}
                    <Tooltip
                      content={
                        <ChartTooltipContent
                          valueFormatter={(v) => `${Number(v).toFixed(1)}%`}
                        />
                      }
                      cursor={{ stroke: '#d1d5db', strokeWidth: 1 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      name="Walk Score"
                      stroke={COLORS.brand}
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#fff', stroke: COLORS.brand, strokeWidth: 2 }}
                      activeDot={{ r: 6, strokeWidth: 2, fill: '#fff' }}
                    />
                  </LineChart>
                </ChartContainer>
              ) : (
                <div className="flex items-center justify-center h-48 text-sm text-gray-400">
                  No score history available.
                </div>
              )}
            </div>
          </div>

          {/* Section Trends */}
          {sectionTrendData.length > 0 && sectionTrendData.some((s) => s.points.length > 1) && (
            <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4 sm:p-6 mb-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Section Trends - {storeName}</h2>
              <SectionTrendsChart data={sectionTrendData} />
            </div>
          )}

          {/* Section Breakdown */}
          {sections.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Section Breakdown - {storeName}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {sections
                  .filter((s) => s.criteria.length > 0 && s.criteria.some((c) => c.avg_points > 0))
                  .map((section) => (
                    <SectionCard key={section.section_name} section={section} />
                  ))}
              </div>
            </div>
          )}

          {/* Walk History Table */}
          {scorecard.score_history.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 overflow-hidden">
              <div className="p-4 sm:p-6 pb-0 sm:pb-0">
                <h2 className="text-sm font-semibold text-gray-900 mb-4">Walk History</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Date</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Score</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {[...scorecard.score_history].reverse().map((walk) => (
                      <tr key={walk.walk_id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 sm:px-6 py-3 text-gray-600">
                          {formatDate(walk.date)}
                        </td>
                        <td className="px-4 sm:px-6 py-3">
                          <span className={`font-semibold ${walk.score != null ? getScoreColor(walk.score) : 'text-gray-400'}`}>
                            {walk.score != null ? `${walk.score.toFixed(1)}%` : 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 sm:px-6 py-3 text-right">
                          <Link
                            to={`/walks/${walk.walk_id}`}
                            className="text-xs font-medium text-primary-600 hover:text-primary-700"
                          >
                            View &rarr;
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="flex items-center justify-center py-16 text-sm text-gray-400">
          No data available for this store and period.
        </div>
      )}
    </div>
  );
}
