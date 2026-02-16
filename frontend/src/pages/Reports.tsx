import { useEffect, useState, useMemo, useCallback } from 'react';
import { getOrgId } from '../utils/org';
import { getStores } from '../api/walks';
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
  exportCSV,
} from '../api/analytics';
import type {
  OverviewData,
  TrendPoint,
  StoreRanking,
  SectionBreakdown,
  RegionComparison,
  SectionTrendData,
  ReportScheduleData,
  Period,
} from '../api/analytics';
import type { Store } from '../types';

// ---------- Helpers ----------

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
  { value: '6m', label: 'Last 6 Months' },
  { value: '1y', label: 'Last Year' },
  { value: 'all', label: 'All Time' },
];

function getScoreColor(pct: number): string {
  if (pct >= 80) return 'text-green-600';
  if (pct >= 60) return 'text-amber-600';
  return 'text-red-600';
}

function getScoreBgColor(pct: number): string {
  if (pct >= 80) return 'bg-green-500';
  if (pct >= 60) return 'bg-amber-500';
  return 'bg-red-500';
}

function getScoreBarBg(pct: number): string {
  if (pct >= 80) return 'bg-green-100';
  if (pct >= 60) return 'bg-amber-100';
  return 'bg-red-100';
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ---------- SVG Line Chart ----------

interface LineChartProps {
  data: TrendPoint[];
}

function LineChart({ data }: LineChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const chartWidth = 700;
  const chartHeight = 300;
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const computed = useMemo(() => {
    if (data.length === 0) return null;

    const scores = data.map((d) => d.avg_score);
    const minScore = Math.max(0, Math.floor(Math.min(...scores) / 10) * 10 - 10);
    const maxScore = Math.min(100, Math.ceil(Math.max(...scores) / 10) * 10 + 10);
    const scoreRange = maxScore - minScore || 1;

    const points = data.map((d, i) => ({
      x: padding.left + (data.length === 1 ? innerWidth / 2 : (i / (data.length - 1)) * innerWidth),
      y: padding.top + innerHeight - ((d.avg_score - minScore) / scoreRange) * innerHeight,
    }));

    const pathD = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
      .join(' ');

    // Y-axis grid lines
    const yTicks: number[] = [];
    const step = scoreRange <= 20 ? 5 : 10;
    for (let v = minScore; v <= maxScore; v += step) {
      yTicks.push(v);
    }

    return { points, pathD, minScore, maxScore, scoreRange, yTicks };
  }, [data, innerWidth, innerHeight, padding.left, padding.top]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-400">
        No trend data available for this period.
      </div>
    );
  }

  if (!computed) return null;

  const { points, pathD, minScore, scoreRange, yTicks } = computed;

  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full min-w-[400px]"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Y-axis grid lines and labels */}
        {yTicks.map((tick) => {
          const y = padding.top + innerHeight - ((tick - minScore) / scoreRange) * innerHeight;
          return (
            <g key={tick}>
              <line
                x1={padding.left}
                y1={y}
                x2={padding.left + innerWidth}
                y2={y}
                stroke="#e5e7eb"
                strokeWidth={1}
              />
              <text
                x={padding.left - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-gray-400"
                fontSize={11}
              >
                {tick}%
              </text>
            </g>
          );
        })}

        {/* Area fill */}
        <path
          d={`${pathD} L ${points[points.length - 1].x} ${padding.top + innerHeight} L ${points[0].x} ${padding.top + innerHeight} Z`}
          fill="url(#areaGradient)"
        />
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#D40029" stopOpacity={0.15} />
            <stop offset="100%" stopColor="#D40029" stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {/* Line */}
        <path
          d={pathD}
          fill="none"
          stroke="#D40029"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Dots and hover zones */}
        {points.map((p, i) => (
          <g key={i}>
            {/* Invisible wider hit area */}
            <circle
              cx={p.x}
              cy={p.y}
              r={16}
              fill="transparent"
              onMouseEnter={() => {
                setHoveredIndex(i);
                setTooltipPos({ x: p.x, y: p.y });
              }}
              onMouseLeave={() => {
                setHoveredIndex(null);
                setTooltipPos(null);
              }}
            />
            {/* Visible dot */}
            <circle
              cx={p.x}
              cy={p.y}
              r={hoveredIndex === i ? 6 : 4}
              fill={hoveredIndex === i ? '#D40029' : '#fff'}
              stroke="#D40029"
              strokeWidth={2.5}
              className="transition-all duration-150"
            />
          </g>
        ))}

        {/* X-axis labels */}
        {data.map((d, i) => {
          // Show all labels if few points, otherwise show every nth
          const showLabel = data.length <= 12 || i % Math.ceil(data.length / 10) === 0 || i === data.length - 1;
          if (!showLabel) return null;
          return (
            <text
              key={i}
              x={points[i].x}
              y={chartHeight - 8}
              textAnchor="middle"
              className="fill-gray-400"
              fontSize={10}
            >
              {d.period}
            </text>
          );
        })}

        {/* Tooltip */}
        {hoveredIndex !== null && tooltipPos && (
          <g>
            <rect
              x={tooltipPos.x - 55}
              y={tooltipPos.y - 50}
              width={110}
              height={38}
              rx={6}
              fill="#1f2937"
              fillOpacity={0.95}
            />
            <text
              x={tooltipPos.x}
              y={tooltipPos.y - 34}
              textAnchor="middle"
              fill="#fff"
              fontSize={11}
              fontWeight={600}
            >
              {data[hoveredIndex].avg_score.toFixed(1)}% avg
            </text>
            <text
              x={tooltipPos.x}
              y={tooltipPos.y - 19}
              textAnchor="middle"
              fill="#9ca3af"
              fontSize={10}
            >
              {data[hoveredIndex].walk_count} walk{data[hoveredIndex].walk_count !== 1 ? 's' : ''} - {data[hoveredIndex].period}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

// ---------- Trend Arrow ----------

function TrendArrow({ trend }: { trend: 'up' | 'down' | 'stable' | 'improving' | 'declining' }) {
  if (trend === 'up' || trend === 'improving') {
    return (
      <span className="inline-flex items-center gap-0.5 text-green-600">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
        </svg>
      </span>
    );
  }
  if (trend === 'down' || trend === 'declining') {
    return (
      <span className="inline-flex items-center gap-0.5 text-red-600">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-gray-400">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14" />
      </svg>
    </span>
  );
}

// ---------- Section Breakdown Card ----------

interface SectionCardProps {
  section: SectionBreakdown;
}

function SectionCard({ section }: SectionCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex-1 min-w-0">
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
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && section.criteria.length > 0 && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-3">
          {section.criteria.map((criterion) => (
            <div key={criterion.name}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-600 truncate mr-2">
                  {criterion.name}
                </span>
                <span className="text-xs font-medium text-gray-500 flex-shrink-0">
                  {criterion.avg_points}/{criterion.max_points} ({criterion.avg_percentage.toFixed(0)}%)
                </span>
              </div>
              <div className="w-full h-1.5 bg-gray-100 rounded-full">
                <div
                  className={`h-1.5 rounded-full ${getScoreBgColor(criterion.avg_percentage)}`}
                  style={{ width: `${Math.min(100, criterion.avg_percentage)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Store Filter Dropdown ----------

interface StoreFilterProps {
  stores: Store[];
  selectedStore: string;
  onChange: (storeId: string) => void;
}

function StoreFilter({ stores, selectedStore, onChange }: StoreFilterProps) {
  return (
    <select
      value={selectedStore}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border-gray-300 bg-white text-sm py-1.5 pl-3 pr-8 shadow-sm ring-1 ring-gray-900/5 focus:border-primary-500 focus:ring-primary-500"
    >
      <option value="">All Stores</option>
      {stores.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}

// ---------- Main Reports Page ----------

export default function Reports() {
  const orgId = getOrgId();

  // Shared state
  const [period, setPeriod] = useState<Period>('90d');
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

  // Filters
  const [trendStore, setTrendStore] = useState('');
  const [sectionStore, setSectionStore] = useState('');
  const [sortField, setSortField] = useState('-avg_score');

  // Load stores once
  useEffect(() => {
    if (!orgId) return;
    getStores(orgId)
      .then((data) => setStores(data.filter((s) => s.is_active)))
      .catch(() => setStores([]));
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

  // Load overview + store rankings + regions when period changes
  useEffect(() => {
    if (!orgId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    async function fetchData() {
      try {
        const [overviewData, storeData, regions, secTrends] = await Promise.all([
          getOverview(orgId, period).catch(() => null),
          getStoreComparison(orgId, { period, sort: sortField }).catch(() => []),
          getRegionComparison(orgId, period).catch(() => []),
          getSectionTrends(orgId, { period }).catch(() => []),
        ]);

        if (!cancelled) {
          setOverview(overviewData);
          setStoreRankings(storeData);
          setRegionData(regions);
          setSectionTrends(secTrends);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [orgId, period, sortField]);

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
      // Could show a toast here, but for now silently fail
    } finally {
      setExporting(false);
    }
  }, [orgId, period, exporting]);

  const handleSort = useCallback((field: string) => {
    setSortField((prev) => {
      // Toggle between ascending and descending
      if (prev === `-${field}`) return field;
      return `-${field}`;
    });
  }, []);

  const sortIndicator = useCallback((field: string) => {
    if (sortField === field) return ' \u2191';
    if (sortField === `-${field}`) return ' \u2193';
    return '';
  }, [sortField]);

  // ---------- Render ----------

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Insights across all store evaluations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="rounded-lg border-gray-300 bg-white text-sm py-2 pl-3 pr-8 shadow-sm ring-1 ring-gray-900/5 focus:border-primary-500 focus:ring-primary-500"
          >
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
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
      </div>

      {/* Digest Subscription */}
      <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Email Digest Reports</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Get a summary of store walk activity delivered to your inbox.
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

      {/* Overview Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
        {/* Total Walks */}
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-600 text-white flex-shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-500 truncate">Total Walks</p>
              <p className="text-xl font-bold text-gray-900">
                {loading ? '--' : overview?.total_walks ?? 0}
              </p>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-gray-400 truncate">Completed evaluations</p>
        </div>

        {/* Avg Score */}
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-violet-500 text-white flex-shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-500 truncate">Avg Score</p>
              <p className="text-xl font-bold text-gray-900">
                {loading ? '--' : overview?.avg_score !== null && overview?.avg_score !== undefined ? `${Math.round(overview.avg_score)}%` : 'N/A'}
              </p>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-gray-400 truncate">Across all stores</p>
        </div>

        {/* Stores Evaluated */}
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-500 text-white flex-shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-500 truncate">Stores Evaluated</p>
              <p className="text-xl font-bold text-gray-900">
                {loading ? '--' : overview?.total_stores_walked ?? 0}
              </p>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-gray-400 truncate">Unique store locations</p>
        </div>

        {/* Score Trend */}
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-500 text-white flex-shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-500 truncate">Score Trend</p>
              <div className="flex items-center gap-1.5">
                <p className="text-xl font-bold text-gray-900">
                  {loading ? '--' : overview?.score_trend === 'up' ? 'Up' : overview?.score_trend === 'down' ? 'Down' : 'Stable'}
                </p>
                {!loading && overview && <TrendArrow trend={overview.score_trend} />}
              </div>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-gray-400 truncate">
            {overview?.best_store ? `Best: ${overview.best_store.name}` : 'Compared to previous period'}
          </p>
        </div>
      </div>

      {/* Score Trends Chart */}
      <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4 sm:p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <h2 className="text-sm font-semibold text-gray-900">Score Trends</h2>
          <StoreFilter
            stores={stores}
            selectedStore={trendStore}
            onChange={setTrendStore}
          />
        </div>
        <LineChart data={trends} />
      </div>

      {/* Store Rankings Table */}
      <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 mb-6 overflow-hidden">
        <div className="p-4 sm:p-6 pb-0 sm:pb-0">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Store Rankings</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3 w-12">
                  #
                </th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">
                  Store
                </th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3 hidden sm:table-cell">
                  Region
                </th>
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
                <th className="text-center text-xs font-medium text-gray-500 px-4 sm:px-6 py-3 hidden lg:table-cell">
                  Trend
                </th>
                <th className="text-right text-xs font-medium text-gray-500 px-4 sm:px-6 py-3 hidden lg:table-cell">
                  Last Walk
                </th>
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
                  <tr key={store.store_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 sm:px-6 py-3 text-gray-400 font-medium">
                      {idx + 1}
                    </td>
                    <td className="px-4 sm:px-6 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{store.store_name}</p>
                        {store.store_number && (
                          <p className="text-xs text-gray-400">#{store.store_number}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-3 text-gray-500 hidden sm:table-cell">
                      {store.region_name || '--'}
                    </td>
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
                    <td className="px-4 sm:px-6 py-3 text-center text-gray-500 hidden md:table-cell">
                      {store.walk_count}
                    </td>
                    <td className="px-4 sm:px-6 py-3 text-center hidden lg:table-cell">
                      <TrendArrow trend={store.trend} />
                    </td>
                    <td className="px-4 sm:px-6 py-3 text-right text-gray-400 text-xs hidden lg:table-cell">
                      {formatDate(store.last_walk_date)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Region Comparison */}
      {regionData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 mb-6 overflow-hidden">
          <div className="p-4 sm:p-6 pb-0 sm:pb-0">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Regional Comparison</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Region</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Avg Score</th>
                  <th className="text-center text-xs font-medium text-gray-500 px-4 sm:px-6 py-3 hidden sm:table-cell">Stores</th>
                  <th className="text-center text-xs font-medium text-gray-500 px-4 sm:px-6 py-3 hidden sm:table-cell">Walks</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3 hidden lg:table-cell">Best Store</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3 hidden lg:table-cell">Needs Attention</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {regionData.map((region) => (
                  <tr key={region.region_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 sm:px-6 py-3 font-medium text-gray-900">{region.region_name}</td>
                    <td className="px-4 sm:px-6 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-16 h-2 rounded-full ${getScoreBarBg(region.avg_score)}`}>
                          <div
                            className={`h-2 rounded-full ${getScoreBgColor(region.avg_score)}`}
                            style={{ width: `${Math.min(100, region.avg_score)}%` }}
                          />
                        </div>
                        <span className={`font-semibold ${getScoreColor(region.avg_score)}`}>
                          {region.avg_score.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-3 text-center text-gray-500 hidden sm:table-cell">{region.store_count}</td>
                    <td className="px-4 sm:px-6 py-3 text-center text-gray-500 hidden sm:table-cell">{region.walk_count}</td>
                    <td className="px-4 sm:px-6 py-3 text-gray-500 hidden lg:table-cell">
                      {region.best_store ? (
                        <span className="text-green-600">{region.best_store.name} ({region.best_store.avg_score.toFixed(1)}%)</span>
                      ) : '--'}
                    </td>
                    <td className="px-4 sm:px-6 py-3 text-gray-500 hidden lg:table-cell">
                      {region.worst_store ? (
                        <span className="text-amber-600">{region.worst_store.name} ({region.worst_store.avg_score.toFixed(1)}%)</span>
                      ) : '--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Section Trends Over Time */}
      {sectionTrends.length > 0 && sectionTrends.some((s) => s.points.length > 1) && (
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4 sm:p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Section Score Trends</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sectionTrends.filter((s) => s.points.length > 0).map((section) => {
              const latest = section.points[section.points.length - 1];
              const first = section.points[0];
              const diff = latest && first ? latest.avg_percentage - first.avg_percentage : 0;
              const trend = diff > 2 ? 'up' : diff < -2 ? 'down' : 'stable';

              return (
                <div key={section.section_name} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900 truncate">{section.section_name}</span>
                    <div className="flex items-center gap-1">
                      <span className={`text-sm font-bold ${getScoreColor(latest?.avg_percentage ?? 0)}`}>
                        {latest?.avg_percentage.toFixed(1)}%
                      </span>
                      <TrendArrow trend={trend} />
                    </div>
                  </div>
                  {/* Mini sparkline */}
                  {section.points.length > 1 && (
                    <div className="flex items-end gap-1 h-8">
                      {section.points.map((pt, i) => (
                        <div
                          key={i}
                          className={`flex-1 rounded-sm ${getScoreBgColor(pt.avg_percentage)}`}
                          style={{ height: `${Math.max(4, (pt.avg_percentage / 100) * 32)}px` }}
                          title={`${pt.month}: ${pt.avg_percentage.toFixed(1)}%`}
                        />
                      ))}
                    </div>
                  )}
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-gray-400">{section.points[0]?.month}</span>
                    <span className="text-[10px] text-gray-400">{section.points[section.points.length - 1]?.month}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Section Breakdown */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <h2 className="text-sm font-semibold text-gray-900">Section Breakdown</h2>
          <StoreFilter
            stores={stores}
            selectedStore={sectionStore}
            onChange={setSectionStore}
          />
        </div>

        {sections.length === 0 && !loading ? (
          <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-6 text-center">
            <p className="text-sm text-gray-400">No section data available for this period.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sections.map((section) => (
              <SectionCard key={section.section_name} section={section} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
