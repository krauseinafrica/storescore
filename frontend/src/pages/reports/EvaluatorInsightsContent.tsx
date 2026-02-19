import { Fragment, useEffect, useState, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import { getOrgId } from '../../utils/org';
import {
  getEvaluatorConsistency,
  getEvaluatorTrends,
} from '../../api/analytics';
import type {
  EvaluatorConsistencyData,
  EvaluatorTrendsData,
  Period,
} from '../../api/analytics';
import InfoButton from '../../components/InfoButton';
import { ChartContainer } from '../../components/charts/ChartContainer';
import type { ChartConfig } from '../../components/charts/ChartContainer';
import { ChartTooltipContent } from '../../components/charts/ChartTooltip';
import {
  COLORS,
  getScoreColor,
  getScoreBgColor,
  getScoreBarBg,
  EvaluatorDistribution,
  LoadingSpinner,
} from './reportHelpers';

interface EvaluatorInsightsContentProps {
  period: Period;
  initialEvaluatorId: string | null;
  onEvaluatorSelected: () => void;
}

export function EvaluatorInsightsContent({ period, initialEvaluatorId, onEvaluatorSelected }: EvaluatorInsightsContentProps) {
  const orgId = getOrgId();
  const [evaluatorData, setEvaluatorData] = useState<EvaluatorConsistencyData[]>([]);
  const [selectedEvaluator, setSelectedEvaluator] = useState<string>(initialEvaluatorId || '');
  const [trends, setTrends] = useState<EvaluatorTrendsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [trendsLoading, setTrendsLoading] = useState(false);

  // Use drill evaluator on first mount
  useEffect(() => {
    if (initialEvaluatorId && initialEvaluatorId !== selectedEvaluator) {
      setSelectedEvaluator(initialEvaluatorId);
      onEvaluatorSelected();
    }
  }, [initialEvaluatorId]);

  // Load evaluator data
  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    setLoading(true);

    getEvaluatorConsistency(orgId, period)
      .then((data) => { if (!cancelled) setEvaluatorData(data); })
      .catch(() => { if (!cancelled) setEvaluatorData([]); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [orgId, period]);

  // Load individual evaluator trends
  useEffect(() => {
    if (!orgId || !selectedEvaluator) {
      setTrends(null);
      return;
    }

    let cancelled = false;
    setTrendsLoading(true);

    getEvaluatorTrends(orgId, selectedEvaluator, period)
      .then((data) => { if (!cancelled) setTrends(data); })
      .catch(() => { if (!cancelled) setTrends(null); })
      .finally(() => { if (!cancelled) setTrendsLoading(false); });

    return () => { cancelled = true; };
  }, [orgId, selectedEvaluator, period]);

  // Selected evaluator data
  const selectedData = useMemo(() => {
    return evaluatorData.find((e) => e.evaluator_id === selectedEvaluator);
  }, [evaluatorData, selectedEvaluator]);

  // Monthly trend chart data
  const monthlyChartData = useMemo(() => {
    if (!trends?.monthly_scores) return [];
    return trends.monthly_scores.map((m) => ({
      month: m.month,
      evaluator: m.avg_score,
      org: m.org_avg,
    }));
  }, [trends]);

  // Section bias chart data
  const biasChartData = useMemo(() => {
    if (!trends?.section_bias) return [];
    return trends.section_bias
      .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference))
      .map((s) => ({
        section: s.section_name.length > 15 ? s.section_name.slice(0, 15) + '...' : s.section_name,
        fullName: s.section_name,
        difference: Number(s.difference.toFixed(1)),
        fill: Math.abs(s.difference) > 10 ? '#dc2626' : Math.abs(s.difference) > 5 ? '#d97706' : '#16a34a',
      }));
  }, [trends]);

  const monthlyConfig: ChartConfig = {
    evaluator: { label: 'Evaluator Avg', color: COLORS.brand },
    org: { label: 'Org Avg', color: '#9ca3af' },
  };

  const biasConfig: ChartConfig = {
    difference: { label: 'Deviation from Org', color: COLORS.brand },
  };

  if (loading) return <LoadingSpinner message="Loading evaluator data..." />;

  if (evaluatorData.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-gray-400">
        No evaluator data available for this period. Evaluators need at least 3 completed walks to appear here.
      </div>
    );
  }

  return (
    <div>
      {/* Evaluator Summary Table */}
      <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 mb-6 overflow-hidden">
        <div className="p-4 sm:p-6 pb-3 sm:pb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-900">Evaluator Scoring Patterns</h2>
            <InfoButton contextKey="evaluator-consistency" />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Click an evaluator to see detailed trends and section bias analysis.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Evaluator</th>
                <th className="text-center text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Walks</th>
                <th className="text-center text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Avg Score</th>
                <th className="text-center text-xs font-medium text-gray-500 px-4 sm:px-6 py-3 hidden sm:table-cell">Most Given</th>
                <th className="text-center text-xs font-medium text-gray-500 px-4 sm:px-6 py-3 hidden md:table-cell">Variety</th>
                <th className="text-center text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Pattern</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {evaluatorData.map((ev) => {
                const isSelected = selectedEvaluator === ev.evaluator_id;

                return (
                  <Fragment key={ev.evaluator_id}>
                    <tr
                      className={`hover:bg-gray-50 transition-colors cursor-pointer ${isSelected ? 'bg-primary-50' : ''}`}
                      onClick={() => setSelectedEvaluator(isSelected ? '' : ev.evaluator_id)}
                    >
                      <td className="px-4 sm:px-6 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                            {ev.evaluator_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{ev.evaluator_name}</p>
                            <p className="text-[11px] text-gray-400 sm:hidden">
                              Most: {ev.dominant_score}/5 ({ev.dominant_score_pct}%)
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-3 text-center text-gray-600">{ev.walk_count}</td>
                      <td className="px-4 sm:px-6 py-3 text-center">
                        <span className={`font-semibold ${ev.avg_total_score ? getScoreColor(ev.avg_total_score) : 'text-gray-400'}`}>
                          {ev.avg_total_score ? `${ev.avg_total_score.toFixed(1)}%` : '--'}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-3 text-center hidden sm:table-cell">
                        <span className="font-semibold text-gray-900">{ev.dominant_score}</span>
                        <span className="text-gray-400 text-xs ml-1">({ev.dominant_score_pct}%)</span>
                      </td>
                      <td className="px-4 sm:px-6 py-3 text-center hidden md:table-cell">
                        <span className={`text-sm ${ev.unique_score_values <= 2 ? 'text-red-600 font-semibold' : ev.unique_score_values <= 3 ? 'text-amber-600' : 'text-gray-600'}`}>
                          {ev.unique_score_values} values
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-3 text-center">
                        {ev.flag_level === 'high' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            Uniform
                          </span>
                        ) : ev.flag_level === 'medium' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                            Review
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            Normal
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* Inline distribution row (always shown for selected) */}
                    {isSelected && (
                      <tr>
                        <td colSpan={6} className="bg-gray-50 px-4 sm:px-6 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <h4 className="text-xs font-semibold text-gray-700 mb-2">Score Distribution</h4>
                              <EvaluatorDistribution ev={ev} />
                            </div>
                            <div>
                              <h4 className="text-xs font-semibold text-gray-700 mb-2">
                                Scores by Store
                                <span className="text-gray-400 font-normal ml-1">
                                  (range: {ev.store_score_range.toFixed(1)}pts)
                                </span>
                              </h4>
                              <div className="space-y-1">
                                {ev.stores.map((s) => (
                                  <div key={s.store_id} className="flex items-center justify-between text-xs">
                                    <span className="text-gray-700 truncate mr-2">{s.store_name}</span>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      <div className="w-16 h-1.5 bg-gray-200 rounded-full">
                                        <div
                                          className={`h-full rounded-full ${getScoreBgColor(s.avg_score)}`}
                                          style={{ width: `${Math.min(100, s.avg_score)}%` }}
                                        />
                                      </div>
                                      <span className={`font-medium ${getScoreColor(s.avg_score)}`}>
                                        {s.avg_score.toFixed(1)}%
                                      </span>
                                      <span className="text-gray-400">({s.walk_count})</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              {ev.store_score_range < 5 && ev.stores.length > 1 && (
                                <p className="mt-2 text-[11px] text-amber-600 bg-amber-50 rounded px-2 py-1">
                                  Low store variance: this evaluator scores all stores within {ev.store_score_range.toFixed(1)} points of each other.
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Evaluator detail panels (shown when selected) */}
      {selectedEvaluator && (
        <>
          {trendsLoading ? (
            <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-6 flex items-center justify-center mb-6">
              <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
            </div>
          ) : trends ? (
            <>
              {/* Monthly Score Trend */}
              {monthlyChartData.length > 1 && (
                <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4 sm:p-6 mb-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">
                    Monthly Score Trend - {selectedData?.evaluator_name}
                  </h3>
                  <ChartContainer config={monthlyConfig} className="h-[280px] w-full">
                    <LineChart data={monthlyChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="#f0f0f0" />
                      <XAxis
                        dataKey="month"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={10}
                        tick={{ fontSize: 12, fill: '#9ca3af' }}
                        tickFormatter={(v) => {
                          if (v.includes('-')) {
                            const parts = v.split('-');
                            return new Date(Number(parts[0]), Number(parts[1]) - 1).toLocaleString('en', { month: 'short' });
                          }
                          return v;
                        }}
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
                        dataKey="evaluator"
                        name="Evaluator Avg"
                        stroke={COLORS.brand}
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: '#fff', stroke: COLORS.brand, strokeWidth: 2 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="org"
                        name="Org Avg"
                        stroke="#9ca3af"
                        strokeWidth={2}
                        strokeDasharray="6 3"
                        dot={false}
                      />
                    </LineChart>
                  </ChartContainer>
                </div>
              )}

              {/* Section Bias Analysis */}
              {biasChartData.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4 sm:p-6 mb-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">Section Bias Analysis</h3>
                  <p className="text-xs text-gray-500 mb-4">
                    Deviation from org average per section. Red indicates &gt;10% difference.
                  </p>
                  <ChartContainer config={biasConfig} className="h-[280px] w-full">
                    <BarChart data={biasChartData} layout="vertical" margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
                      <CartesianGrid horizontal={false} stroke="#f0f0f0" />
                      <XAxis
                        type="number"
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `${v > 0 ? '+' : ''}${v}%`}
                        tick={{ fontSize: 11, fill: '#9ca3af' }}
                      />
                      <YAxis
                        type="category"
                        dataKey="section"
                        tickLine={false}
                        axisLine={false}
                        width={120}
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                      />
                      <ReferenceLine x={0} stroke="#9ca3af" strokeWidth={1} />
                      <Tooltip
                        content={
                          <ChartTooltipContent
                            valueFormatter={(v) => `${Number(v) > 0 ? '+' : ''}${Number(v).toFixed(1)}%`}
                          />
                        }
                      />
                      <Bar dataKey="difference" name="Deviation" radius={[0, 4, 4, 0]} maxBarSize={20}>
                        {biasChartData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                </div>
              )}

              {/* Store-level Comparison Table */}
              {trends.store_comparison && trends.store_comparison.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 overflow-hidden">
                  <div className="p-4 sm:p-6 pb-0 sm:pb-0">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">Store-Level Comparison</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Store</th>
                          <th className="text-center text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Evaluator Avg</th>
                          <th className="text-center text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Org Avg</th>
                          <th className="text-center text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Difference</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {trends.store_comparison.map((s) => {
                          const diff = s.evaluator_avg - s.org_avg;
                          return (
                            <tr key={s.store_id} className="hover:bg-gray-50">
                              <td className="px-4 sm:px-6 py-3 font-medium text-gray-900">{s.store_name}</td>
                              <td className="px-4 sm:px-6 py-3 text-center">
                                <span className={`font-semibold ${getScoreColor(s.evaluator_avg)}`}>
                                  {s.evaluator_avg.toFixed(1)}%
                                </span>
                              </td>
                              <td className="px-4 sm:px-6 py-3 text-center text-gray-500">
                                {s.org_avg.toFixed(1)}%
                              </td>
                              <td className="px-4 sm:px-6 py-3 text-center">
                                <span className={`font-semibold ${Math.abs(diff) > 10 ? 'text-red-600' : Math.abs(diff) > 5 ? 'text-amber-600' : 'text-green-600'}`}>
                                  {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
