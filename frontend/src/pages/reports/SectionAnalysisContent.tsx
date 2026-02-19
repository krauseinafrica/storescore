import { useEffect, useState, useMemo } from 'react';
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { getOrgId } from '../../utils/org';
import {
  getSectionBreakdown,
  getSectionTrends,
  getSectionStoreComparison,
} from '../../api/analytics';
import type {
  SectionBreakdown,
  SectionTrendData,
  SectionStoreData,
  Period,
} from '../../api/analytics';
import { ChartContainer } from '../../components/charts/ChartContainer';
import type { ChartConfig } from '../../components/charts/ChartContainer';
import { ChartTooltipContent } from '../../components/charts/ChartTooltip';
import {
  COLORS,
  SECTION_COLORS,
  getScoreColor,
  getScoreBgColor,
  getScoreBarBg,
  getScoreHex,
  LoadingSpinner,
} from './reportHelpers';

interface SectionAnalysisContentProps {
  period: Period;
  initialSectionName: string | null;
  onSectionSelected: () => void;
}

export function SectionAnalysisContent({ period, initialSectionName, onSectionSelected }: SectionAnalysisContentProps) {
  const orgId = getOrgId();
  const [sections, setSections] = useState<SectionBreakdown[]>([]);
  const [sectionTrends, setSectionTrends] = useState<SectionTrendData[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>(initialSectionName || '');
  const [storeComparison, setStoreComparison] = useState<SectionStoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  // Use drill section on first mount
  useEffect(() => {
    if (initialSectionName && initialSectionName !== selectedSection) {
      setSelectedSection(initialSectionName);
      onSectionSelected();
    }
  }, [initialSectionName]);

  // Load sections data
  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    setLoading(true);

    Promise.all([
      getSectionBreakdown(orgId, { period }).catch(() => []),
      getSectionTrends(orgId, { period }).catch(() => []),
    ]).then(([secs, trends]) => {
      if (!cancelled) {
        setSections(secs);
        setSectionTrends(trends);
        // Auto-select first section if none selected and we have sections
        if (!selectedSection && secs.length > 0) {
          const scored = secs.filter((s) => s.criteria.length > 0 && s.criteria.some((c) => c.avg_points > 0));
          if (scored.length > 0) {
            // Select worst section by default
            const sorted = [...scored].sort((a, b) => a.avg_percentage - b.avg_percentage);
            setSelectedSection(sorted[0].section_name);
          }
        }
      }
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [orgId, period]);

  // Load store comparison when section changes
  useEffect(() => {
    if (!orgId || !selectedSection) {
      setStoreComparison(null);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);

    getSectionStoreComparison(orgId, { section: selectedSection, period })
      .then((data) => { if (!cancelled) setStoreComparison(data); })
      .catch(() => { if (!cancelled) setStoreComparison(null); })
      .finally(() => { if (!cancelled) setDetailLoading(false); });

    return () => { cancelled = true; };
  }, [orgId, selectedSection, period]);

  // Scored sections only
  const scoredSections = useMemo(() => {
    return sections
      .filter((s) => s.criteria.length > 0 && s.criteria.some((c) => c.avg_points > 0))
      .sort((a, b) => a.avg_percentage - b.avg_percentage);
  }, [sections]);

  // Selected section data
  const selectedSectionData = useMemo(() => {
    return sections.find((s) => s.section_name === selectedSection);
  }, [sections, selectedSection]);

  // Selected section trend data
  const selectedTrend = useMemo(() => {
    const trend = sectionTrends.find((s) => s.section_name === selectedSection);
    if (!trend || trend.points.length < 2) return [];
    return trend.points.map((p) => ({
      month: p.month,
      avg_percentage: p.avg_percentage,
    }));
  }, [sectionTrends, selectedSection]);

  // Low-scoring criteria across all sections
  const lowCriteria = useMemo(() => {
    const items: { name: string; section: string; avg_percentage: number }[] = [];
    sections.forEach((s) => {
      s.criteria.forEach((c) => {
        if (c.avg_percentage < 60 && c.avg_points > 0) {
          items.push({
            name: c.name,
            section: s.section_name,
            avg_percentage: c.avg_percentage,
          });
        }
      });
    });
    return items.sort((a, b) => a.avg_percentage - b.avg_percentage);
  }, [sections]);

  // Criteria chart data for selected section
  const criteriaChartData = useMemo(() => {
    if (!selectedSectionData) return [];
    return selectedSectionData.criteria
      .filter((c) => c.avg_points > 0)
      .sort((a, b) => a.avg_percentage - b.avg_percentage)
      .map((c) => ({
        name: c.name.length > 25 ? c.name.slice(0, 25) + '...' : c.name,
        fullName: c.name,
        avg_percentage: Number(c.avg_percentage.toFixed(1)),
        fill: getScoreHex(c.avg_percentage),
      }));
  }, [selectedSectionData]);

  // Store comparison chart data
  const storeChartData = useMemo(() => {
    if (!storeComparison?.stores) return [];
    return storeComparison.stores
      .sort((a, b) => a.avg_percentage - b.avg_percentage)
      .map((s) => ({
        name: s.store_name.length > 12 ? s.store_name.slice(0, 12) + '...' : s.store_name,
        fullName: s.store_name,
        avg_percentage: Number(s.avg_percentage.toFixed(1)),
        fill: getScoreHex(s.avg_percentage),
      }));
  }, [storeComparison]);

  const criteriaConfig: ChartConfig = {
    avg_percentage: { label: 'Avg %', color: COLORS.brand },
  };

  const trendConfig: ChartConfig = {
    avg_percentage: { label: selectedSection || 'Score', color: COLORS.violet },
  };

  if (loading) return <LoadingSpinner message="Loading section data..." />;

  if (scoredSections.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-gray-400">
        No section data available for this period.
      </div>
    );
  }

  return (
    <div>
      {/* Section overview cards - click to select */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-6">
        {scoredSections.map((section) => (
          <button
            key={section.section_name}
            onClick={() => setSelectedSection(section.section_name)}
            className={`text-left bg-white rounded-xl shadow-sm ring-1 p-4 transition-all ${
              selectedSection === section.section_name
                ? 'ring-primary-500 ring-2 shadow-md'
                : 'ring-gray-900/5 hover:shadow-md'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-semibold text-gray-900 truncate">
                {section.section_name}
              </span>
              <span className={`text-sm font-bold ml-2 flex-shrink-0 ${getScoreColor(section.avg_percentage)}`}>
                {section.avg_percentage.toFixed(1)}%
              </span>
            </div>
            <div className={`w-full h-2.5 rounded-full ${getScoreBarBg(section.avg_percentage)}`}>
              <div
                className={`h-2.5 rounded-full transition-all duration-500 ${getScoreBgColor(section.avg_percentage)}`}
                style={{ width: `${Math.min(100, section.avg_percentage)}%` }}
              />
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5">
              {section.criteria.length} criteria
            </p>
          </button>
        ))}
      </div>

      {/* Selected section detail */}
      {selectedSection && (
        <>
          <h2 className="text-sm font-semibold text-gray-900 mb-4">
            {selectedSection}
            {selectedSectionData && (
              <span className={`ml-2 ${getScoreColor(selectedSectionData.avg_percentage)}`}>
                {selectedSectionData.avg_percentage.toFixed(1)}%
              </span>
            )}
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Criteria bar chart */}
            {criteriaChartData.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4 sm:p-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Criteria Scores</h3>
                <ChartContainer config={criteriaConfig} className="h-[280px] w-full">
                  <BarChart data={criteriaChartData} layout="vertical" margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
                    <CartesianGrid horizontal={false} stroke="#f0f0f0" />
                    <XAxis
                      type="number"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${v}%`}
                      domain={[0, 100]}
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tickLine={false}
                      axisLine={false}
                      width={120}
                      tick={{ fontSize: 11, fill: '#6b7280' }}
                    />
                    <Tooltip
                      content={
                        <ChartTooltipContent
                          valueFormatter={(v) => `${Number(v).toFixed(1)}%`}
                        />
                      }
                    />
                    <Bar dataKey="avg_percentage" name="Avg %" radius={[0, 4, 4, 0]} maxBarSize={24}>
                      {criteriaChartData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </div>
            )}

            {/* Store comparison bar chart */}
            {detailLoading ? (
              <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-6 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
              </div>
            ) : storeChartData.length > 0 ? (
              <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4 sm:p-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">By Store</h3>
                <ChartContainer config={criteriaConfig} className="h-[280px] w-full">
                  <BarChart data={storeChartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#f0f0f0" />
                    <XAxis
                      dataKey="name"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={10}
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      interval={0}
                      angle={storeChartData.length > 6 ? -30 : 0}
                      textAnchor={storeChartData.length > 6 ? 'end' : 'middle'}
                      height={storeChartData.length > 6 ? 60 : 40}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tick={{ fontSize: 12, fill: '#9ca3af' }}
                      tickFormatter={(v) => `${v}%`}
                      domain={[0, 100]}
                      width={45}
                    />
                    <Tooltip
                      content={
                        <ChartTooltipContent
                          valueFormatter={(v) => `${Number(v).toFixed(1)}%`}
                        />
                      }
                      cursor={{ fill: 'rgba(0, 0, 0, 0.04)' }}
                    />
                    <Bar dataKey="avg_percentage" name="Avg %" radius={[4, 4, 0, 0]} maxBarSize={48}>
                      {storeChartData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </div>
            ) : null}
          </div>

          {/* Section trend chart */}
          {selectedTrend.length > 1 && (
            <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4 sm:p-6 mb-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                {selectedSection} - Monthly Trend
              </h3>
              <ChartContainer config={trendConfig} className="h-[250px] w-full">
                <AreaChart data={selectedTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradientSection" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.violet} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={COLORS.violet} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
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
                  <Area
                    type="monotone"
                    dataKey="avg_percentage"
                    name={selectedSection}
                    stroke={COLORS.violet}
                    strokeWidth={2.5}
                    fill="url(#gradientSection)"
                    dot={false}
                    activeDot={{ r: 5, stroke: COLORS.violet, strokeWidth: 2, fill: '#fff' }}
                  />
                </AreaChart>
              </ChartContainer>
            </div>
          )}
        </>
      )}

      {/* Low-scoring criteria table */}
      {lowCriteria.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 overflow-hidden">
          <div className="p-4 sm:p-6 pb-0 sm:pb-0">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">Low-Scoring Criteria</h2>
            <p className="text-xs text-gray-500 mb-4">Criteria averaging below 60%</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Criterion</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Section</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Avg Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {lowCriteria.map((c, i) => (
                  <tr key={`${c.section}-${c.name}-${i}`} className="hover:bg-gray-50">
                    <td className="px-4 sm:px-6 py-3 text-gray-900">{c.name}</td>
                    <td className="px-4 sm:px-6 py-3 text-gray-500">{c.section}</td>
                    <td className="px-4 sm:px-6 py-3 text-right">
                      <span className={`font-semibold ${getScoreColor(c.avg_percentage)}`}>
                        {c.avg_percentage.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
