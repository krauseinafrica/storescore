import { useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  RadialBarChart, RadialBar,
  ResponsiveContainer,
} from 'recharts';
import { ChartContainer } from '../../components/charts/ChartContainer';
import type { ChartConfig } from '../../components/charts/ChartContainer';
import { ChartTooltipContent, ChartLegend } from '../../components/charts/ChartTooltip';
import type {
  TrendPoint,
  StoreRanking,
  SectionBreakdown,
  RegionComparison,
  SectionTrendData,
  EvaluatorConsistencyData,
  Period,
} from '../../api/analytics';
import type { Store } from '../../types';

// ---------- Constants ----------

export const COLORS = {
  brand: '#D40029',
  violet: '#7c3aed',
  sky: '#0ea5e9',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
  indigo: '#6366f1',
  teal: '#14b8a6',
};

export const SECTION_COLORS = [
  COLORS.brand, COLORS.violet, COLORS.sky, COLORS.emerald,
  COLORS.amber, COLORS.rose, COLORS.indigo, COLORS.teal,
];

export const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
  { value: '6m', label: 'Last 6 Months' },
  { value: '1y', label: 'Last Year' },
  { value: 'all', label: 'All Time' },
];

export const trendConfig: ChartConfig = {
  avg_score: { label: 'Avg Score', color: COLORS.brand },
  walk_count: { label: 'Evaluations', color: COLORS.violet },
};

// ---------- Helpers ----------

export function getScoreColor(pct: number): string {
  if (pct >= 80) return 'text-green-600';
  if (pct >= 60) return 'text-amber-600';
  return 'text-red-600';
}

export function getScoreBgColor(pct: number): string {
  if (pct >= 80) return 'bg-green-500';
  if (pct >= 60) return 'bg-amber-500';
  return 'bg-red-500';
}

export function getScoreBarBg(pct: number): string {
  if (pct >= 80) return 'bg-green-100';
  if (pct >= 60) return 'bg-amber-100';
  return 'bg-red-100';
}

export function getScoreHex(pct: number): string {
  if (pct >= 80) return '#16a34a';
  if (pct >= 60) return '#d97706';
  return '#dc2626';
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ---------- KPI Card ----------

interface KpiCardProps {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  subtitle: string;
  loading: boolean;
  trend?: React.ReactNode;
}

export function KpiCard({ icon, iconBg, label, value, subtitle, loading, trend }: KpiCardProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gray-200 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-16 bg-gray-200 rounded" />
            <div className="h-6 w-12 bg-gray-200 rounded" />
          </div>
        </div>
        <div className="mt-3 h-2.5 w-24 bg-gray-100 rounded" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4">
      <div className="flex items-center gap-3">
        <div className={`flex items-center justify-center w-10 h-10 rounded-lg text-white flex-shrink-0 ${iconBg}`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-gray-500 truncate">{label}</p>
          <div className="flex items-center gap-1.5">
            <p className="text-xl font-bold text-gray-900">{value}</p>
            {trend}
          </div>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-gray-400 truncate">{subtitle}</p>
    </div>
  );
}

// ---------- Trend Arrow ----------

export function TrendArrow({ trend }: { trend: 'up' | 'down' | 'stable' | 'improving' | 'declining' }) {
  if (trend === 'up' || trend === 'improving') {
    return (
      <span className="inline-flex items-center text-green-600">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
        </svg>
      </span>
    );
  }
  if (trend === 'down' || trend === 'declining') {
    return (
      <span className="inline-flex items-center text-red-600">
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

// ---------- Score Gauge (Radial) ----------

export function ScoreGauge({ score, label, goal }: { score: number; label: string; goal?: number | null }) {
  const data = [{ value: score, fill: getScoreHex(score) }];

  return (
    <div className="flex flex-col items-center">
      <div className="h-[180px] w-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="55%"
            innerRadius="68%"
            outerRadius="88%"
            startAngle={180}
            endAngle={0}
            data={data}
            barSize={14}
          >
            <RadialBar
              dataKey="value"
              cornerRadius={10}
              background={{ fill: '#f3f4f6' }}
            />
            <text
              x="50%"
              y="42%"
              textAnchor="middle"
              dominantBaseline="middle"
              style={{ fontSize: '32px', fontWeight: 800, fill: '#111827' }}
            >
              {score.toFixed(0)}%
            </text>
            <text
              x="50%"
              y="58%"
              textAnchor="middle"
              style={{ fontSize: '12px', fill: '#9ca3af' }}
            >
              {label}
            </text>
            {goal != null && (
              <text
                x="50%"
                y="72%"
                textAnchor="middle"
                style={{ fontSize: '11px', fill: score >= goal ? '#16a34a' : '#d97706' }}
              >
                Goal: {goal}%
              </text>
            )}
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ---------- Region Comparison Vertical Bars ----------

export function RegionScoreBars({ data, goal }: { data: RegionComparison[]; goal?: number | null }) {
  if (data.length === 0) return null;

  const sorted = [...data].sort((a, b) => b.avg_score - a.avg_score);
  const maxScore = 100;

  return (
    <div className="flex items-end justify-center gap-4 h-[160px] relative">
      {goal != null && (
        <div
          className="absolute left-0 right-0 border-t-2 border-dashed border-gray-300 pointer-events-none"
          style={{ bottom: `${(goal / maxScore) * 100}%` }}
        >
          <span className="absolute -top-4 right-0 text-[10px] text-gray-400 font-medium">
            Goal {goal}%
          </span>
        </div>
      )}
      {sorted.map((region) => {
        const height = (region.avg_score / maxScore) * 100;
        return (
          <div key={region.region_id} className="flex flex-col items-center gap-1 flex-1 max-w-[80px]">
            <span className={`text-xs font-bold tabular-nums ${getScoreColor(region.avg_score)}`}>
              {region.avg_score.toFixed(1)}%
            </span>
            <div className="w-full flex justify-center">
              <div
                className="w-10 rounded-t-md transition-all duration-500"
                style={{
                  height: `${Math.max(8, height * 1.4)}px`,
                  backgroundColor: getScoreHex(region.avg_score),
                  opacity: 0.85,
                }}
              />
            </div>
            <span className="text-[10px] text-gray-500 text-center leading-tight truncate w-full">
              {region.region_name}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Score Trend Chart (Area) ----------

export function ScoreTrendChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-400">
        No trend data available for this period.
      </div>
    );
  }

  return (
    <ChartContainer config={trendConfig} className="h-[300px] w-full">
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gradientScore" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-avg_score)" stopOpacity={0.25} />
            <stop offset="95%" stopColor="var(--color-avg_score)" stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#f0f0f0" />
        <XAxis
          dataKey="period"
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          tick={{ fontSize: 12, fill: '#9ca3af' }}
          tickFormatter={(v) => {
            if (v.includes('-')) {
              const parts = v.split('-');
              const month = new Date(Number(parts[0]), Number(parts[1]) - 1).toLocaleString('en', { month: 'short' });
              return parts[0] !== String(new Date().getFullYear()) ? `${month} '${parts[0].slice(2)}` : month;
            }
            return v.length > 6 ? v.slice(0, 6) : v;
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
              labelFormatter={(l) => {
                if (l.includes('-')) {
                  const parts = l.split('-');
                  return new Date(Number(parts[0]), Number(parts[1]) - 1).toLocaleString('en', { month: 'long', year: 'numeric' });
                }
                return l;
              }}
            />
          }
          cursor={{ stroke: '#d1d5db', strokeWidth: 1 }}
        />
        <Area
          type="monotone"
          dataKey="avg_score"
          name="Avg Score"
          stroke="var(--color-avg_score)"
          strokeWidth={2.5}
          fill="url(#gradientScore)"
          fillOpacity={1}
          dot={false}
          activeDot={{ r: 5, stroke: 'var(--color-avg_score)', strokeWidth: 2, fill: '#fff' }}
        />
      </AreaChart>
    </ChartContainer>
  );
}

// ---------- Store Ranking Bar Chart ----------

export function StoreBarChart({ data, onBarClick }: { data: StoreRanking[]; onBarClick?: (storeId: string) => void }) {
  if (data.length === 0) return null;

  const chartData = data.slice(0, 15).map((s) => ({
    name: s.store_name.length > 12 ? s.store_name.slice(0, 12) + '...' : s.store_name,
    fullName: s.store_name,
    storeId: s.store_id,
    avg_score: Number(s.avg_score.toFixed(1)),
    walk_count: s.walk_count,
    fill: getScoreHex(s.avg_score),
  }));

  const config: ChartConfig = {
    avg_score: { label: 'Avg Score', color: COLORS.brand },
  };

  return (
    <ChartContainer config={config} className="h-[280px] w-full">
      <BarChart
        data={chartData}
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        onClick={(state: any) => {
          if (onBarClick && state?.activePayload?.[0]?.payload?.storeId) {
            onBarClick(state.activePayload[0].payload.storeId);
          }
        }}
        style={onBarClick ? { cursor: 'pointer' } : undefined}
      >
        <CartesianGrid vertical={false} stroke="#f0f0f0" />
        <XAxis
          dataKey="name"
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          interval={0}
          angle={data.length > 8 ? -30 : 0}
          textAnchor={data.length > 8 ? 'end' : 'middle'}
          height={data.length > 8 ? 60 : 40}
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
        <Bar
          dataKey="avg_score"
          name="Avg Score"
          radius={[4, 4, 0, 0]}
          maxBarSize={48}
        >
          {chartData.map((entry, index) => (
            <rect key={index} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

// ---------- Section Trends Line Chart ----------

export function SectionTrendsChart({ data, onLegendClick }: { data: SectionTrendData[]; onLegendClick?: (sectionName: string) => void }) {
  if (data.length === 0 || !data.some((s) => s.points.length > 1)) return null;

  const months = new Set<string>();
  data.forEach((s) => s.points.forEach((p) => months.add(p.month)));
  const sortedMonths = Array.from(months).sort();

  const chartData = sortedMonths.map((month) => {
    const row: Record<string, number | string> = { month };
    data.forEach((section) => {
      const pt = section.points.find((p) => p.month === month);
      if (pt) row[section.section_name] = pt.avg_percentage;
    });
    return row;
  });

  const config: ChartConfig = {};
  data.forEach((section, i) => {
    config[section.section_name] = {
      label: section.section_name,
      color: SECTION_COLORS[i % SECTION_COLORS.length],
    };
  });

  return (
    <div>
      <ChartContainer config={config} className="h-[300px] w-full">
        <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
              (min: number) => Math.max(0, Math.floor(min / 5) * 5 - 5),
              (max: number) => Math.min(100, Math.ceil(max / 5) * 5 + 5),
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
          {data.map((section, i) => (
            <Line
              key={section.section_name}
              type="monotone"
              dataKey={section.section_name}
              name={section.section_name}
              stroke={SECTION_COLORS[i % SECTION_COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
            />
          ))}
        </LineChart>
      </ChartContainer>
      <ChartLegend
        items={data.map((section, i) => ({
          label: section.section_name,
          color: SECTION_COLORS[i % SECTION_COLORS.length],
        }))}
        onClick={onLegendClick ? (label) => onLegendClick(label) : undefined}
      />
    </div>
  );
}

// ---------- Section Breakdown Card ----------

export function SectionCard({ section, onClick }: { section: SectionBreakdown; onClick?: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 overflow-hidden">
      <button
        onClick={() => {
          if (onClick) onClick();
          else setExpanded(!expanded);
        }}
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
          className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${!onClick && expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={onClick ? "M9 5l7 7-7 7" : "M19 9l-7 7-7-7"} />
        </svg>
      </button>

      {!onClick && expanded && section.criteria.length > 0 && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-3">
          {section.criteria.map((criterion) => (
            <div key={criterion.name}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-600 truncate mr-2">{criterion.name}</span>
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

// ---------- Store Filter ----------

export function StoreFilter({ stores, selectedStore, onChange }: {
  stores: Store[];
  selectedStore: string;
  onChange: (storeId: string) => void;
}) {
  return (
    <select
      value={selectedStore}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border-gray-300 bg-white text-sm py-1.5 pl-3 pr-8 shadow-sm ring-1 ring-gray-900/5 focus:border-primary-500 focus:ring-primary-500"
    >
      <option value="">All Stores</option>
      {stores.map((s) => (
        <option key={s.id} value={s.id}>{s.name}</option>
      ))}
    </select>
  );
}

// ---------- Evaluator Score Distribution Chart ----------

export function EvaluatorDistribution({ ev }: { ev: EvaluatorConsistencyData }) {
  const data = [1, 2, 3, 4, 5].map((score) => ({
    score: String(score),
    count: ev.score_distribution[score] || 0,
    fill: score === ev.dominant_score ? COLORS.brand : '#9ca3af',
  }));

  return (
    <div className="h-[120px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
          <XAxis
            dataKey="score"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
          />
          <Tooltip
            content={
              <ChartTooltipContent
                hideLabel
                valueFormatter={(v) => `${v} times`}
              />
            }
          />
          <Bar
            dataKey="count"
            name="Times Given"
            radius={[3, 3, 0, 0]}
            maxBarSize={24}
          >
            {data.map((entry, i) => (
              <rect key={i} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------- Loading Spinner ----------

export function LoadingSpinner({ message }: { message?: string }) {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">{message || 'Loading...'}</p>
      </div>
    </div>
  );
}

// ---------- Empty State ----------

export function EmptyState({ icon, title, description, linkText, linkTo }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  linkText?: string;
  linkTo?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-500 max-w-sm">{description}</p>
      {linkText && linkTo && (
        <a href={linkTo} className="mt-4 text-sm font-medium text-primary-600 hover:text-primary-700">
          {linkText} &rarr;
        </a>
      )}
    </div>
  );
}
