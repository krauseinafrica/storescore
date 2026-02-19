import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSubscription } from '../hooks/useSubscription';
import { isGamificationVisibleForRole } from '../hooks/useOrgSettings';
import InfoButton from '../components/InfoButton';
import { getStores, getWalks, getTemplates, getBenchmarking, getActionItems, getCorrectiveActionSummary, getOrgSettings, getAssessments } from '../api/walks';
import type { BenchmarkData, OrgSettingsData } from '../api/walks';
import { getSectionBreakdown, getSectionTrends, getResolutionAnalytics } from '../api/analytics';
import type { SectionBreakdown, SectionTrendData, ResolutionAnalyticsData } from '../api/analytics';
import { getLeaderboard, getChallenges, getAwardedAchievements } from '../api/gamification';
import { getOrgId } from '../utils/org';
import type { Walk, Store, ScoringTemplate, ActionItem, CorrectiveActionSummary, LeaderboardEntry, Challenge, AwardedAchievement, SelfAssessment } from '../types';
import { formatResolutionDays, getSlaLevel, getSlaHex } from './reports/reportHelpers';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function ordinalSuffix(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return 'th';
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

function getScoreColor(pct: number): string {
  if (pct >= 80) return 'text-green-600';
  if (pct >= 60) return 'text-amber-600';
  return 'text-red-600';
}

export default function Dashboard() {
  const { user, currentMembership } = useAuth();
  const { hasFeature } = useSubscription();
  const orgId = getOrgId();

  const hasGamificationBasic = hasFeature('gamification_basic');
  const hasGamificationAdvanced = hasFeature('gamification_advanced');

  const [stores, setStores] = useState<Store[]>([]);
  const [walks, setWalks] = useState<Walk[]>([]);
  const [templates, setTemplates] = useState<ScoringTemplate[]>([]);
  const [benchmark, setBenchmark] = useState<BenchmarkData | null>(null);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [caSummary, setCaSummary] = useState<CorrectiveActionSummary | null>(null);
  const [sectionBreakdown, setSectionBreakdown] = useState<SectionBreakdown[]>([]);
  const [sectionTrends, setSectionTrends] = useState<SectionTrendData[]>([]);
  const [orgSettings, setOrgSettings] = useState<OrgSettingsData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [activeChallenges, setActiveChallenges] = useState<Challenge[]>([]);
  const [recentAwards, setRecentAwards] = useState<AwardedAchievement[]>([]);
  const [assessments, setAssessments] = useState<SelfAssessment[]>([]);
  const [resolutionData, setResolutionData] = useState<ResolutionAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [rankAsc, setRankAsc] = useState(true);
  const [evalMenuOpen, setEvalMenuOpen] = useState(false);
  const evalMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (evalMenuRef.current && !evalMenuRef.current.contains(e.target as Node)) {
        setEvalMenuOpen(false);
      }
    }
    if (evalMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [evalMenuOpen]);

  useEffect(() => {
    if (!orgId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchAll() {
      try {
        const [storeData, walkData, templateData, benchData, aiData, caData, sbData, stData, settingsData, assessmentData, resData] = await Promise.all([
          getStores(orgId).catch(() => [] as Store[]),
          getWalks(orgId).catch(() => [] as Walk[]),
          getTemplates(orgId).catch(() => [] as ScoringTemplate[]),
          getBenchmarking(orgId).catch(() => null),
          getActionItems(orgId, { status: 'open' }).catch(() => [] as ActionItem[]),
          getCorrectiveActionSummary(orgId).catch(() => null),
          getSectionBreakdown(orgId, { period: '90d' }).catch(() => [] as SectionBreakdown[]),
          getSectionTrends(orgId, { period: '6m' }).catch(() => [] as SectionTrendData[]),
          getOrgSettings(orgId).catch(() => null),
          getAssessments(orgId).catch(() => [] as SelfAssessment[]),
          getResolutionAnalytics(orgId, '90d').catch(() => null),
        ]);

        if (!cancelled) {
          setStores(storeData);
          setWalks(walkData);
          setTemplates(templateData);
          setBenchmark(benchData);
          setActionItems(aiData);
          setCaSummary(caData);
          setSectionBreakdown(sbData);
          setSectionTrends(stData);
          setOrgSettings(settingsData);
          setAssessments(assessmentData);
          setResolutionData(resData);

          // Fetch gamification data based on plan tier, org toggle, and role visibility
          const gamificationVisible = isGamificationVisibleForRole(settingsData, currentMembership?.role);
          if (settingsData?.gamification_enabled && hasGamificationBasic && gamificationVisible) {
            const promises: [
              Promise<LeaderboardEntry[]>,
              Promise<Challenge[]>,
              Promise<AwardedAchievement[]>,
            ] = [
              hasGamificationAdvanced
                ? getLeaderboard(orgId, { period: '30d', type: 'avg_score', limit: 5 }).catch(() => [] as LeaderboardEntry[])
                : Promise.resolve([] as LeaderboardEntry[]),
              hasGamificationAdvanced
                ? getChallenges(orgId).catch(() => [] as Challenge[])
                : Promise.resolve([] as Challenge[]),
              getAwardedAchievements(orgId).catch(() => [] as AwardedAchievement[]),
            ];
            Promise.all(promises).then(([lb, ch, aw]) => {
              if (!cancelled) {
                setLeaderboard(lb);
                setActiveChallenges(ch.filter(c => c.is_active));
                setRecentAwards(aw.slice(0, 3));
              }
            });
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAll();
    return () => { cancelled = true; };
  }, [orgId]);

  const activeStores = stores.filter((s) => s.is_active);
  const inProgressWalks = walks.filter((w) => w.status === 'in_progress');
  const completedWalks = walks
    .filter((w) => w.status === 'completed')
    .sort((a, b) => new Date(b.completed_date || b.updated_at).getTime() - new Date(a.completed_date || a.updated_at).getTime());
  const activeTemplates = templates.filter((t) => t.is_active);

  // Unified recent evaluations: completed walks + submitted/reviewed assessments
  const completedAssessments = assessments.filter((a) => a.status === 'submitted' || a.status === 'reviewed');
  type RecentEval = { type: 'walk'; data: Walk; date: Date } | { type: 'assessment'; data: SelfAssessment; date: Date };
  const recentEvaluations: RecentEval[] = [
    ...completedWalks.map((w) => ({ type: 'walk' as const, data: w, date: new Date(w.completed_date || w.updated_at) })),
    ...completedAssessments.map((a) => ({ type: 'assessment' as const, data: a, date: new Date(a.submitted_at || a.updated_at) })),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 5);

  // Completed in last 90 days
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const completedLast90 = completedWalks.filter((w) => {
    const d = new Date(w.completed_date || w.updated_at);
    return d >= ninetyDaysAgo;
  });

  // Average score across completed walks
  const scoredWalks = completedWalks.filter((w) => w.total_score != null && !isNaN(Number(w.total_score)));
  const avgScore = scoredWalks.length > 0
    ? scoredWalks.reduce((sum, w) => sum + Number(w.total_score), 0) / scoredWalks.length
    : null;

  function getSectionDelta(sectionName: string): number | null {
    const trend = sectionTrends.find(t => t.section_name === sectionName);
    if (!trend || trend.points.length < 2) return null;
    const curr = trend.points[trend.points.length - 1].avg_percentage;
    const prev = trend.points[trend.points.length - 2].avg_percentage;
    return curr - prev;
  }

  const statCards = [
    {
      title: 'Stores',
      value: loading ? '--' : String(activeStores.length),
      description: 'Active registered stores',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      color: 'bg-primary-600',
    },
    {
      title: 'In Progress',
      value: loading ? '--' : String(inProgressWalks.length),
      description: 'Walks currently in progress',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
      color: 'bg-amber-500',
    },
    {
      title: 'Completed',
      value: loading ? '--' : String(completedWalks.length),
      description: loading ? 'Total completed walks' : `${completedLast90.length} in last 90 days`,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'bg-green-500',
    },
    {
      title: 'Avg Score',
      value: loading ? '--' : avgScore !== null ? `${avgScore.toFixed(1)}%` : 'N/A',
      description: activeTemplates.length > 0 ? `Using ${activeTemplates.length} template${activeTemplates.length !== 1 ? 's' : ''}` : 'No templates configured',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      color: 'bg-violet-500',
    },
  ];

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 pb-24">
      {/* Header */}
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 flex items-center gap-2">
            Welcome back, {user?.first_name || 'User'} <InfoButton contextKey="dashboard-overview" />
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Here's your store evaluation overview.
          </p>
        </div>
        <div className="relative hidden sm:block" ref={evalMenuRef}>
          <button
            onClick={() => setEvalMenuOpen((o) => !o)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Start New Evaluation
            <svg className="w-3.5 h-3.5 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {evalMenuOpen && (
            <div className="absolute right-0 mt-1 w-52 bg-white rounded-xl shadow-lg ring-1 ring-gray-900/10 py-1 z-50">
              <Link to="/walks/new" onClick={() => setEvalMenuOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                Store Walk
              </Link>
              <Link to="/evaluations#assessments" onClick={() => setEvalMenuOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Assessment
              </Link>
              <Link to="/evaluations#department" onClick={() => setEvalMenuOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                Dept Evaluation
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:gap-4 sm:grid-cols-4">
        {statCards.map((card) => (
          <div
            key={card.title}
            className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4"
          >
            <div className="flex items-center gap-3">
              <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${card.color} text-white flex-shrink-0`}>
                {card.icon}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500 truncate">{card.title}</p>
                <p className="text-xl font-bold text-gray-900">{card.value}</p>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-gray-400 truncate">{card.description}</p>
          </div>
        ))}
      </div>

      {/* Two-column grid for widgets */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: walks */}
        <div className="lg:col-span-2 space-y-6">
          {/* Continue in-progress walks */}
          {inProgressWalks.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Continue Where You Left Off</h2>
              <div className="space-y-2">
                {inProgressWalks.map((walk) => (
                  <Link
                    key={walk.id}
                    to={`/walks/${walk.id}/conduct`}
                    className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl p-4 hover:bg-amber-100 transition-colors active:bg-amber-100"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">{walk.store_name}</p>
                      <p className="text-xs text-amber-700 mt-0.5">{walk.template_name}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                      <span className="text-xs font-medium text-amber-600">Continue</span>
                      <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Area Performance widget */}
          {sectionBreakdown.some(s => s.criteria.some(c => c.max_points > 0)) && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-900">Area Performance</h2>
                <Link to="/reports" className="text-xs font-medium text-primary-600 hover:text-primary-700">
                  View reports
                </Link>
              </div>
              <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4">
                <p className="text-[11px] text-gray-400 mb-3">Last 90 days, compared to prior month</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {sectionBreakdown.filter(s => s.criteria.some(c => c.max_points > 0)).map((section) => {
                    const delta = getSectionDelta(section.section_name);
                    return (
                      <div key={section.section_name} className="bg-gray-50 rounded-lg p-3 text-center">
                        <p className="text-[11px] font-medium text-gray-500 truncate">{section.section_name}</p>
                        <p className={`text-xl font-bold mt-1 ${section.avg_percentage >= 80 ? 'text-green-600' : section.avg_percentage >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                          {section.avg_percentage}%
                        </p>
                        {delta !== null && Math.abs(delta) >= 0.5 ? (
                          <p className={`text-[11px] font-medium mt-0.5 ${delta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}
                          </p>
                        ) : (
                          <p className="text-[11px] text-gray-300 mt-0.5">&nbsp;</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Recent evaluations (walks + assessments) */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-900">Recent Evaluations</h2>
              {(completedWalks.length + completedAssessments.length) > 5 && (
                <Link to="/evaluations" className="text-xs font-medium text-primary-600 hover:text-primary-700">
                  View all
                </Link>
              )}
            </div>

            {recentEvaluations.length > 0 ? (
              <div className="space-y-2">
                {recentEvaluations.map((item) => item.type === 'walk' ? (
                  <Link
                    key={`walk-${item.data.id}`}
                    to={`/walks/${item.data.id}`}
                    className="flex items-center justify-between bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4 hover:shadow-md transition-shadow active:bg-gray-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">{item.data.store_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatDate(item.data.scheduled_date)}
                        <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-primary-50 text-primary-700 font-medium">Walk</span>
                      </p>
                    </div>
                    {item.data.total_score !== null && (
                      <span className={`text-lg font-bold ml-3 flex-shrink-0 ${getScoreColor(item.data.total_score)}`}>
                        {Math.round(item.data.total_score)}%
                      </span>
                    )}
                  </Link>
                ) : (
                  <Link
                    key={`assessment-${item.data.id}`}
                    to={`/evaluations?assessment=${item.data.id}#assessments`}
                    className="flex items-center justify-between bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4 hover:shadow-md transition-shadow active:bg-gray-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">{item.data.store_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatDate(item.data.submitted_at || item.data.created_at)}
                        <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 font-medium">Assessment</span>
                      </p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ml-3 flex-shrink-0 ${
                      item.data.status === 'reviewed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {item.data.status === 'reviewed' ? 'Reviewed' : 'Submitted'}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-6 text-center">
                <svg className="w-10 h-10 text-gray-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="mt-2 text-sm text-gray-500">No completed evaluations yet</p>
                <div className="mt-3 flex justify-center gap-2">
                  <Link to="/walks/new" className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 px-2.5 py-1.5 rounded-lg bg-primary-50 hover:bg-primary-100 transition-colors">
                    Store Walk
                  </Link>
                  <Link to="/evaluations#assessments" className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700 px-2.5 py-1.5 rounded-lg bg-violet-50 hover:bg-violet-100 transition-colors">
                    Assessment
                  </Link>
                  <Link to="/evaluations#department" className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 transition-colors">
                    Dept Eval
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right column: alerts & metrics sidebar */}
        <div className="lg:col-span-1 space-y-6">
          {/* Corrective Actions widget */}
          {caSummary && caSummary.total > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-900">Escalated Issues</h2>
                <Link to="/corrective-actions" className="text-xs font-medium text-primary-600 hover:text-primary-700">
                  View all
                </Link>
              </div>
              <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  {caSummary.critical > 0 && (
                    <div className="bg-red-50 rounded-lg p-3">
                      <p className="text-2xl font-bold text-red-600">{caSummary.critical}</p>
                      <p className="text-[10px] font-medium text-red-500 uppercase tracking-wider mt-0.5">Critical</p>
                    </div>
                  )}
                  {caSummary.escalated > 0 && (
                    <div className="bg-orange-50 rounded-lg p-3">
                      <p className="text-2xl font-bold text-orange-600">{caSummary.escalated}</p>
                      <p className="text-[10px] font-medium text-orange-500 uppercase tracking-wider mt-0.5">Escalated</p>
                    </div>
                  )}
                  {caSummary.reminder > 0 && (
                    <div className="bg-amber-50 rounded-lg p-3">
                      <p className="text-2xl font-bold text-amber-600">{caSummary.reminder}</p>
                      <p className="text-[10px] font-medium text-amber-500 uppercase tracking-wider mt-0.5">Reminder</p>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                  <span>{caSummary.overdue_evaluations} overdue evaluation{caSummary.overdue_evaluations !== 1 ? 's' : ''}</span>
                  <span>{caSummary.unacknowledged_walks} unacknowledged walk{caSummary.unacknowledged_walks !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>
          )}

          {/* Action Items widget */}
          {actionItems.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-900">Open Action Items</h2>
                <Link to="/action-items" className="text-xs font-medium text-primary-600 hover:text-primary-700">
                  View all
                </Link>
              </div>
              <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-red-500 text-white flex-shrink-0">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-gray-900">{actionItems.length}</p>
                    <p className="text-xs text-gray-500">items need attention</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {actionItems.slice(0, 3).map(item => (
                    <Link key={item.id} to={`/action-items/${item.id}`} className="flex items-center justify-between text-xs hover:bg-gray-50 rounded px-2 py-1.5 -mx-2">
                      <span className="text-gray-700 truncate">{item.criterion_name} - {item.store_name}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        item.priority === 'critical' ? 'bg-red-100 text-red-700' :
                        item.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>{item.priority}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Resolution Speed Widget */}
          {resolutionData && resolutionData.summary.total_resolved > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-900">Resolution Speed</h2>
                <Link to="/reports#action-items" className="text-xs font-medium text-primary-600 hover:text-primary-700">
                  Details
                </Link>
              </div>
              <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4">
                <div className="flex items-center gap-4 mb-3">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">
                      {formatResolutionDays(resolutionData.summary.avg_resolution_days)}
                    </p>
                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Avg</p>
                  </div>
                  <div className="w-px h-8 bg-gray-200" />
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">
                      {formatResolutionDays(resolutionData.summary.median_resolution_days)}
                    </p>
                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Median</p>
                  </div>
                  <div className="w-px h-8 bg-gray-200" />
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">
                      {resolutionData.summary.total_resolved}
                    </p>
                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Resolved</p>
                  </div>
                </div>

                {resolutionData.by_priority.length > 0 && (
                  <div className="space-y-1.5">
                    {resolutionData.by_priority.map((p) => {
                      const level = p.avg_days != null ? getSlaLevel(p.priority, p.avg_days) : ('green' as const);
                      return (
                        <div key={p.priority} className="flex items-center justify-between text-xs">
                          <span className="capitalize text-gray-600 font-medium">{p.priority}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-900 font-semibold">{formatResolutionDays(p.avg_days)}</span>
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: getSlaHex(level) }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Store Rankings Widget */}
          {benchmark?.enabled && benchmark.my_stores && benchmark.my_stores.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-900">Store Rankings</h2>
                <button
                  onClick={() => setRankAsc(prev => !prev)}
                  className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {rankAsc ? (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4 4m0 0l4-4m-4 4V4" /></svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" /></svg>
                  )}
                  {rankAsc ? 'Best first' : 'Worst first'}
                </button>
              </div>
              <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4">
                {benchmark.org_average !== null && (
                  <p className="text-[11px] text-gray-400 mb-3">
                    Org avg <strong className="text-gray-600">{benchmark.org_average}%</strong> across {benchmark.store_count} stores (last {benchmark.period_days} days)
                  </p>
                )}
                <div className="space-y-1">
                  {[...benchmark.my_stores]
                    .sort((a, b) => rankAsc ? a.rank - b.rank : b.rank - a.rank)
                    .map((store) => (
                    <div key={store.store_id} className="flex items-center gap-2 py-1.5">
                      <span className="text-xs font-medium text-gray-400 w-5 text-right flex-shrink-0">{store.rank}</span>
                      <span className="text-xs text-gray-700 truncate flex-1">{store.store_name}</span>
                      <span className={`text-xs font-bold flex-shrink-0 ${
                        store.percentile >= 75 ? 'text-green-600' :
                        store.percentile >= 50 ? 'text-blue-600' :
                        store.percentile >= 25 ? 'text-amber-600' : 'text-red-600'
                      }`}>
                        {store.avg_score}%
                      </span>
                    </div>
                  ))}
                </div>

                {/* Quartile legend */}
                <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-x-3 gap-y-1">
                  <span className="text-[10px] text-green-600 font-medium">Top 25%</span>
                  <span className="text-[10px] text-blue-600 font-medium">50-75%</span>
                  <span className="text-[10px] text-amber-600 font-medium">25-50%</span>
                  <span className="text-[10px] text-red-600 font-medium">Bottom 25%</span>
                </div>

                {/* Goals */}
                {benchmark.goals && benchmark.goals.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs font-medium text-gray-500 mb-2">Active Goals</p>
                    <div className="space-y-1.5">
                      {benchmark.goals.map((goal) => (
                        <div key={goal.id} className="flex items-center justify-between text-xs">
                          <span className="text-gray-600">{goal.name}</span>
                          <span className="font-medium text-gray-900">
                            {goal.goal_type === 'score_target'
                              ? `${goal.target_value}%`
                              : `${goal.target_value} walks/mo`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Mini Leaderboard Widget (Enterprise only) */}
          {orgSettings?.gamification_enabled && hasGamificationAdvanced && isGamificationVisibleForRole(orgSettings, currentMembership?.role) && leaderboard.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-900">Leaderboard</h2>
                <Link to="/gamification" className="text-xs font-medium text-primary-600 hover:text-primary-700">
                  View full
                </Link>
              </div>
              <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4">
                <p className="text-[11px] text-gray-400 mb-3">Top stores this month by avg score</p>
                <div className="space-y-1">
                  {leaderboard.map((entry) => (
                    <div key={entry.store_id} className="flex items-center gap-2 py-1.5">
                      <span className="text-xs font-medium w-5 text-right flex-shrink-0">
                        {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : (
                          <span className="text-gray-400">{entry.rank}</span>
                        )}
                      </span>
                      <span className="text-xs text-gray-700 truncate flex-1">{entry.store_name}</span>
                      <span className={`text-xs font-bold flex-shrink-0 ${getScoreColor(entry.value)}`}>
                        {entry.value.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Active Challenge Widget (Enterprise only) */}
          {orgSettings?.gamification_enabled && hasGamificationAdvanced && isGamificationVisibleForRole(orgSettings, currentMembership?.role) && activeChallenges.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-900">Active Challenge</h2>
                <Link to="/gamification" className="text-xs font-medium text-primary-600 hover:text-primary-700">
                  View all
                </Link>
              </div>
              <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4">
                {activeChallenges.slice(0, 1).map((challenge) => {
                  const daysLeft = Math.max(0, Math.ceil((new Date(challenge.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                  return (
                    <div key={challenge.id}>
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span className="text-sm font-semibold text-gray-900 truncate">{challenge.name}</span>
                      </div>
                      <p className="text-xs text-gray-500 line-clamp-2 mb-2">{challenge.description}</p>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-amber-600 font-medium">{daysLeft} day{daysLeft !== 1 ? 's' : ''} left</span>
                        <span className="text-gray-400">
                          {challenge.challenge_type === 'score_target' ? 'Score Target' :
                           challenge.challenge_type === 'most_improved' ? 'Most Improved' :
                           challenge.challenge_type === 'walk_count' ? 'Walk Count' : 'Highest Score'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent Badges Widget (Pro+ with gamification_basic) */}
          {orgSettings?.gamification_enabled && hasGamificationBasic && isGamificationVisibleForRole(orgSettings, currentMembership?.role) && recentAwards.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-900">Recent Badges</h2>
                <Link to="/gamification" className="text-xs font-medium text-primary-600 hover:text-primary-700">
                  View all
                </Link>
              </div>
              <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-4">
                <div className="space-y-2.5">
                  {recentAwards.map((award) => (
                    <div key={award.id} className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        award.achievement.tier === 'platinum' ? 'bg-violet-100 text-violet-600' :
                        award.achievement.tier === 'gold' ? 'bg-amber-100 text-amber-600' :
                        award.achievement.tier === 'silver' ? 'bg-gray-200 text-gray-600' :
                        'bg-orange-100 text-orange-600'
                      }`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-gray-900 truncate">{award.achievement.name}</p>
                        <p className="text-[10px] text-gray-400 truncate">{award.store_name || award.user_name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile-only: Start New Evaluation */}
      <div className="mt-6 sm:hidden">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Start New Evaluation</p>
        <div className="grid grid-cols-3 gap-2">
          <Link
            to="/walks/new"
            className="flex flex-col items-center gap-1.5 rounded-xl bg-primary-600 px-3 py-3 text-white shadow-sm hover:bg-primary-700 active:bg-primary-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            <span className="text-xs font-semibold">Store Walk</span>
          </Link>
          <Link
            to="/evaluations#assessments"
            className="flex flex-col items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-3 text-white shadow-sm hover:bg-violet-700 active:bg-violet-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span className="text-xs font-semibold">Assessment</span>
          </Link>
          <Link
            to="/evaluations#department"
            className="flex flex-col items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-3 text-white shadow-sm hover:bg-amber-700 active:bg-amber-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
            <span className="text-xs font-semibold">Dept Eval</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
