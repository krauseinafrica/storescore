import { useEffect, useState } from 'react';
import { getOrgId } from '../../utils/org';
import {
  getActionItemAnalytics,
  getDriverAnalytics,
  getResolutionAnalytics,
} from '../../api/analytics';
import type {
  ActionItemAnalyticsData,
  DriverAnalyticsData,
  ResolutionAnalyticsData,
  Period,
} from '../../api/analytics';
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { ChartContainer } from '../../components/charts/ChartContainer';
import type { ChartConfig } from '../../components/charts/ChartContainer';
import { ChartTooltipContent } from '../../components/charts/ChartTooltip';
import {
  COLORS,
  KpiCard,
  LoadingSpinner,
  EmptyState,
  getScoreHex,
  SLA_THRESHOLDS,
  getSlaLevel,
  getSlaHex,
  getSlaBgColor,
  formatResolutionDays,
} from './reportHelpers';

interface ActionItemsDriversContentProps {
  period: Period;
}

export function ActionItemsDriversContent({ period }: ActionItemsDriversContentProps) {
  const orgId = getOrgId();
  const [actionData, setActionData] = useState<ActionItemAnalyticsData | null>(null);
  const [driverData, setDriverData] = useState<DriverAnalyticsData | null>(null);
  const [resolutionData, setResolutionData] = useState<ResolutionAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    setLoading(true);

    Promise.all([
      getActionItemAnalytics(orgId, period).catch(() => null),
      getDriverAnalytics(orgId, period).catch(() => null),
      getResolutionAnalytics(orgId, period).catch(() => null),
    ]).then(([actions, drivers, resolution]) => {
      if (!cancelled) {
        setActionData(actions);
        setDriverData(drivers);
        setResolutionData(resolution);
      }
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [orgId, period]);

  if (loading) return <LoadingSpinner message="Loading action item & driver data..." />;

  const hasActionData = actionData && actionData.total > 0;
  const hasDriverData = driverData && driverData.total_selections > 0;

  const actionKpiConfig: ChartConfig = {
    created: { label: 'Created', color: COLORS.brand },
    resolved: { label: 'Resolved', color: COLORS.emerald },
  };

  const driverConfig: ChartConfig = {
    count: { label: 'Times Selected', color: COLORS.violet },
  };

  return (
    <div>
      {/* Action Items Section */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Action Items</h2>

        {!hasActionData ? (
          <EmptyState
            icon={
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            }
            title="No action items yet"
            description="Action items are created from low-scoring criteria during walks. Complete some evaluations to see action item analytics here."
            linkText="View Follow-Ups"
            linkTo="/follow-ups"
          />
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
              <KpiCard
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                }
                iconBg="bg-primary-600"
                label="Total"
                value={String(actionData!.total)}
                subtitle="All action items"
                loading={false}
              />
              <KpiCard
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
                iconBg="bg-amber-500"
                label="Open"
                value={String(actionData!.open)}
                subtitle="Awaiting resolution"
                loading={false}
              />
              <KpiCard
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                }
                iconBg="bg-green-500"
                label="Resolved"
                value={String(actionData!.resolved)}
                subtitle="Completed items"
                loading={false}
              />
              <KpiCard
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                }
                iconBg="bg-violet-500"
                label="Avg Resolution"
                value={actionData!.avg_resolution_days != null ? `${Math.round(actionData!.avg_resolution_days)}d` : 'N/A'}
                subtitle="Days to resolve"
                loading={false}
              />
            </div>

            {/* Monthly Trend */}
            {actionData!.monthly_trend && actionData!.monthly_trend.length > 1 && (
              <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4 sm:p-6 mb-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Monthly Trend</h3>
                <ChartContainer config={actionKpiConfig} className="h-[250px] w-full">
                  <BarChart data={actionData!.monthly_trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                      width={35}
                    />
                    <Tooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="created" name="Created" fill={COLORS.brand} radius={[4, 4, 0, 0]} maxBarSize={24} />
                    <Bar dataKey="resolved" name="Resolved" fill={COLORS.emerald} radius={[4, 4, 0, 0]} maxBarSize={24} />
                  </BarChart>
                </ChartContainer>
              </div>
            )}

            {/* By Store */}
            {actionData!.by_store && actionData!.by_store.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 overflow-hidden mb-6">
                <div className="p-4 sm:p-6 pb-0 sm:pb-0">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">By Store</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Store</th>
                        <th className="text-center text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Total</th>
                        <th className="text-center text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Open</th>
                        <th className="text-center text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Resolved</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {actionData!.by_store.map((s) => (
                        <tr key={s.store_id} className="hover:bg-gray-50">
                          <td className="px-4 sm:px-6 py-3 font-medium text-gray-900">{s.store_name}</td>
                          <td className="px-4 sm:px-6 py-3 text-center text-gray-600">{s.total}</td>
                          <td className="px-4 sm:px-6 py-3 text-center">
                            <span className={s.open > 0 ? 'text-amber-600 font-semibold' : 'text-gray-400'}>{s.open}</span>
                          </td>
                          <td className="px-4 sm:px-6 py-3 text-center text-green-600">{s.resolved}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Resolution Analytics Section */}
      {resolutionData && resolutionData.summary.total_resolved > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Resolution Time Analytics</h2>

          {/* Resolution KPI Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
            <KpiCard
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              iconBg="bg-primary-600"
              label="Avg Resolution"
              value={formatResolutionDays(resolutionData.summary.avg_resolution_days)}
              subtitle="Average time to resolve"
              loading={false}
            />
            <KpiCard
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              }
              iconBg="bg-violet-500"
              label="Median"
              value={formatResolutionDays(resolutionData.summary.median_resolution_days)}
              subtitle="Median resolution time"
              loading={false}
            />
            <KpiCard
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              }
              iconBg="bg-green-500"
              label="Resolved"
              value={String(resolutionData.summary.total_resolved)}
              subtitle={`${resolutionData.summary.total_approved} approved`}
              loading={false}
            />
            <KpiCard
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              }
              iconBg="bg-amber-500"
              label="Avg Approval"
              value={formatResolutionDays(resolutionData.summary.avg_approval_days)}
              subtitle="Time to final approval"
              loading={false}
            />
          </div>

          {/* Resolution by Priority - Grouped Bar Chart */}
          {resolutionData.by_priority.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4 sm:p-6 mb-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Resolution Time by Priority</h3>
              <ChartContainer
                config={{
                  avg_days: { label: 'Avg Days', color: COLORS.brand },
                  median_days: { label: 'Median Days', color: COLORS.violet },
                }}
                className="h-[250px] w-full"
              >
                <BarChart
                  data={resolutionData.by_priority.map((p) => ({
                    priority: p.priority.charAt(0).toUpperCase() + p.priority.slice(1),
                    avg_days: p.avg_days ?? 0,
                    median_days: p.median_days ?? 0,
                    rawPriority: p.priority,
                    fillAvg: getSlaHex(getSlaLevel(p.priority, p.avg_days ?? 0)),
                    fillMedian: getSlaHex(getSlaLevel(p.priority, p.median_days ?? 0)),
                  }))}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} stroke="#f0f0f0" />
                  <XAxis
                    dataKey="priority"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                    tick={{ fontSize: 12, fill: '#9ca3af' }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tick={{ fontSize: 12, fill: '#9ca3af' }}
                    tickFormatter={(v) => `${v}d`}
                    width={40}
                  />
                  <Tooltip
                    content={
                      <ChartTooltipContent
                        valueFormatter={(v) => `${Number(v).toFixed(1)} days`}
                      />
                    }
                  />
                  <Bar dataKey="avg_days" name="Avg Days" fill={COLORS.brand} radius={[4, 4, 0, 0]} maxBarSize={32}>
                    {resolutionData.by_priority.map((p, i) => (
                      <Cell key={i} fill={getSlaHex(getSlaLevel(p.priority, p.avg_days ?? 0))} />
                    ))}
                  </Bar>
                  <Bar dataKey="median_days" name="Median Days" fill={COLORS.violet} radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ChartContainer>

              {/* SLA Compliance Badges */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">SLA Compliance</p>
                <div className="flex flex-wrap gap-2">
                  {resolutionData.by_priority.map((p) => {
                    const level = p.resolved_count > 0
                      ? (p.sla_met_pct >= 80 ? 'green' as const : p.sla_met_pct >= 50 ? 'amber' as const : 'red' as const)
                      : 'green' as const;
                    return (
                      <div
                        key={p.priority}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium ${getSlaBgColor(level)}`}
                      >
                        <span className="capitalize">{p.priority}</span>
                        <span className="font-bold">{p.sla_met_pct}%</span>
                        <span className="opacity-70">({p.sla_met_count}/{p.resolved_count})</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Resolution Time Trend - Area Chart */}
          {resolutionData.monthly_trend.length > 1 && (
            <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4 sm:p-6 mb-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Resolution Time Trend</h3>
              <ChartContainer
                config={{
                  avg_resolution_days: { label: 'Avg Resolution (days)', color: COLORS.brand },
                  resolved_count: { label: 'Resolved', color: COLORS.emerald },
                }}
                className="h-[250px] w-full"
              >
                <AreaChart
                  data={resolutionData.monthly_trend}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="gradientResolution" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.brand} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={COLORS.brand} stopOpacity={0.02} />
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
                    tickFormatter={(v) => `${v}d`}
                    width={40}
                  />
                  <Tooltip
                    content={
                      <ChartTooltipContent
                        valueFormatter={(v) => `${Number(v).toFixed(1)}`}
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
                    dataKey="avg_resolution_days"
                    name="Avg Resolution (days)"
                    stroke={COLORS.brand}
                    strokeWidth={2.5}
                    fill="url(#gradientResolution)"
                    fillOpacity={1}
                    dot={false}
                    activeDot={{ r: 5, stroke: COLORS.brand, strokeWidth: 2, fill: '#fff' }}
                    connectNulls
                  />
                </AreaChart>
              </ChartContainer>
            </div>
          )}
        </div>
      )}

      {/* Drivers Section */}
      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Scoring Drivers</h2>

        {!hasDriverData ? (
          <EmptyState
            icon={
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
              </svg>
            }
            title="No driver data yet"
            description={`${driverData?.total_configured ?? 0} drivers are configured but none have been selected during walks yet. Drivers are selected when scoring criteria at 3 or below.`}
            linkText="View Scoring Drivers"
            linkTo="/templates#drivers"
          />
        ) : (
          <>
            {/* Top Drivers */}
            {driverData!.top_drivers && driverData!.top_drivers.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4 sm:p-6 mb-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                  Top Drivers ({driverData!.total_selections} total selections)
                </h3>
                <ChartContainer config={driverConfig} className="h-[300px] w-full">
                  <BarChart
                    data={driverData!.top_drivers.slice(0, 10)}
                    layout="vertical"
                    margin={{ top: 5, right: 10, left: 5, bottom: 5 }}
                  >
                    <CartesianGrid horizontal={false} stroke="#f0f0f0" />
                    <XAxis
                      type="number"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tickLine={false}
                      axisLine={false}
                      width={150}
                      tick={{ fontSize: 11, fill: '#6b7280' }}
                    />
                    <Tooltip
                      content={
                        <ChartTooltipContent
                          valueFormatter={(v) => `${v} times`}
                        />
                      }
                    />
                    <Bar dataKey="count" name="Times Selected" fill={COLORS.violet} radius={[0, 4, 4, 0]} maxBarSize={20} />
                  </BarChart>
                </ChartContainer>
              </div>
            )}

            {/* Drivers by Section */}
            {driverData!.by_section && driverData!.by_section.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 overflow-hidden mb-6">
                <div className="p-4 sm:p-6 pb-0 sm:pb-0">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Drivers by Section</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Section</th>
                        <th className="text-center text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Selections</th>
                        <th className="text-left text-xs font-medium text-gray-500 px-4 sm:px-6 py-3">Top Driver</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {driverData!.by_section.map((s) => (
                        <tr key={s.section_name} className="hover:bg-gray-50">
                          <td className="px-4 sm:px-6 py-3 font-medium text-gray-900">{s.section_name}</td>
                          <td className="px-4 sm:px-6 py-3 text-center text-gray-600">{s.count}</td>
                          <td className="px-4 sm:px-6 py-3 text-gray-500">{s.top_driver || '--'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Monthly Trend */}
            {driverData!.monthly_trend && driverData!.monthly_trend.length > 1 && (
              <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4 sm:p-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Driver Selections - Monthly Trend</h3>
                <ChartContainer config={driverConfig} className="h-[250px] w-full">
                  <AreaChart data={driverData!.monthly_trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradientDrivers" x1="0" y1="0" x2="0" y2="1">
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
                      width={35}
                    />
                    <Tooltip content={<ChartTooltipContent />} />
                    <Area
                      type="monotone"
                      dataKey="count"
                      name="Selections"
                      stroke={COLORS.violet}
                      strokeWidth={2.5}
                      fill="url(#gradientDrivers)"
                      dot={false}
                      activeDot={{ r: 5, stroke: COLORS.violet, strokeWidth: 2, fill: '#fff' }}
                    />
                  </AreaChart>
                </ChartContainer>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
