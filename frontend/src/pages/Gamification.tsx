import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSubscription } from '../hooks/useSubscription';
import FeatureGate from '../components/FeatureGate';
import { getOrgId } from '../utils/org';
import { getRegions, getTemplates } from '../api/walks';
import {
  getLeaderboard,
  getChallenges,
  getChallengeStandings,
  createChallenge,
  deleteChallenge,
  getAchievements,
  getAwardedAchievements,
} from '../api/gamification';
import type {
  Achievement,
  AwardedAchievement,
  Challenge,
  ChallengeStanding,
  LeaderboardEntry,
  Region,
  AchievementTier,
  ScoringTemplate,
} from '../types';
import type { ChallengeData } from '../api/gamification';

type Tab = 'leaderboard' | 'challenges' | 'achievements';

const TIER_COLORS: Record<AchievementTier, string> = {
  bronze: 'bg-amber-100 text-amber-800 ring-amber-300',
  silver: 'bg-gray-100 text-gray-700 ring-gray-300',
  gold: 'bg-yellow-100 text-yellow-800 ring-yellow-400',
  platinum: 'bg-indigo-100 text-indigo-800 ring-indigo-300',
};

const TIER_BG: Record<AchievementTier, string> = {
  bronze: 'from-amber-400 to-amber-600',
  silver: 'from-gray-300 to-gray-500',
  gold: 'from-yellow-400 to-yellow-600',
  platinum: 'from-indigo-400 to-indigo-600',
};

const CHALLENGE_TYPE_LABELS: Record<string, string> = {
  score_target: 'Score Target',
  most_improved: 'Most Improved',
  walk_count: 'Walk Count',
  highest_score: 'Highest Score',
};

const LEADERBOARD_TYPES = [
  { value: 'avg_score', label: 'Best Score' },
  { value: 'walk_count', label: 'Most Walks' },
  { value: 'most_improved', label: 'Most Improved' },
  { value: 'consistency', label: 'Most Consistent' },
  { value: 'streak', label: 'Longest Streak' },
];

const PERIODS = [
  { value: '30d', label: 'This Month' },
  { value: '90d', label: 'This Quarter' },
  { value: '6m', label: '6 Months' },
  { value: '1y', label: 'This Year' },
];

// ---------- Challenge Form Modal ----------

function ChallengeFormModal({
  regions,
  sectionNames,
  onSave,
  onClose,
}: {
  regions: Region[];
  sectionNames: string[];
  onSave: (data: ChallengeData) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ChallengeData>({
    name: '',
    description: '',
    challenge_type: 'score_target',
    scope: 'organization',
    region: null,
    target_value: null,
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    is_active: true,
    prizes_text: '',
    section_name: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.end_date) return;
    setSaving(true);
    setError('');
    try {
      await onSave(form);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create challenge');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">New Challenge</h2>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Challenge Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500"
              placeholder="e.g. February Score Sprint"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500"
              rows={2}
              placeholder="Rules and details..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
              <select
                value={form.challenge_type}
                onChange={(e) => setForm({ ...form, challenge_type: e.target.value })}
                className="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500"
              >
                <option value="score_target">Score Target</option>
                <option value="most_improved">Most Improved</option>
                <option value="walk_count">Walk Count</option>
                <option value="highest_score">Highest Score</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Value</label>
              <input
                type="number"
                step="0.01"
                value={form.target_value ?? ''}
                onChange={(e) => setForm({ ...form, target_value: e.target.value ? parseFloat(e.target.value) : null })}
                className="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500"
                placeholder="e.g. 85"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Scope</label>
            <div className="flex gap-2">
              {(['organization', 'region'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setForm({ ...form, scope: s, region: null })}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    form.scope === s
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {s === 'organization' ? 'All Stores' : 'Region'}
                </button>
              ))}
            </div>
          </div>

          {form.scope === 'region' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
              <select
                value={form.region || ''}
                onChange={(e) => setForm({ ...form, region: e.target.value || null })}
                className="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500"
              >
                <option value="">Select region...</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          )}

          {sectionNames.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Section (optional)</label>
              <select
                value={form.section_name || ''}
                onChange={(e) => setForm({ ...form, section_name: e.target.value })}
                className="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500"
              >
                <option value="">All sections (overall score)</option>
                {sectionNames.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <p className="text-[10px] text-gray-400 mt-1">Scope standings to a specific template section.</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prizes (optional)</label>
            <textarea
              value={form.prizes_text || ''}
              onChange={(e) => setForm({ ...form, prizes_text: e.target.value })}
              className="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500"
              rows={2}
              placeholder="e.g. Winner gets pizza party, 2nd place gets gift cards..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">
              {saving ? 'Creating...' : 'Create Challenge'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------- Main Page ----------

export default function Gamification() {
  const { hasRole } = useAuth();
  const { hasFeature } = useSubscription();
  const orgId = getOrgId();
  const isAdmin = hasRole('admin');

  const hasBasic = hasFeature('gamification_basic');
  const hasAdvanced = hasFeature('gamification_advanced');

  // Default tab depends on tier
  const [tab, setTab] = useState<Tab>(hasAdvanced ? 'leaderboard' : 'achievements');
  const [loading, setLoading] = useState(true);

  // Leaderboard state
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [lbPeriod, setLbPeriod] = useState('30d');
  const [lbType, setLbType] = useState('avg_score');
  const [lbRegion, setLbRegion] = useState('');
  const [regions, setRegions] = useState<Region[]>([]);

  // Challenge state
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [standings, setStandings] = useState<ChallengeStanding[]>([]);
  const [showChallengeForm, setShowChallengeForm] = useState(false);

  // Achievement state
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [awardedAchievements, setAwardedAchievements] = useState<AwardedAchievement[]>([]);
  const [tierFilter, setTierFilter] = useState<AchievementTier | 'all'>('all');

  // Section names for challenge creation
  const [sectionNames, setSectionNames] = useState<string[]>([]);

  const loadLeaderboard = useCallback(async () => {
    if (!orgId) return;
    try {
      const data = await getLeaderboard(orgId, {
        period: lbPeriod,
        type: lbType,
        region: lbRegion || undefined,
        limit: 20,
      });
      setLeaderboard(data);
    } catch {
      setLeaderboard([]);
    }
  }, [orgId, lbPeriod, lbType, lbRegion]);

  const loadChallenges = useCallback(async () => {
    if (!orgId) return;
    try {
      const data = await getChallenges(orgId);
      setChallenges(data);
    } catch {
      setChallenges([]);
    }
  }, [orgId]);

  const loadAchievements = useCallback(async () => {
    if (!orgId) return;
    try {
      const [achData, awardData] = await Promise.all([
        getAchievements(orgId),
        getAwardedAchievements(orgId),
      ]);
      setAchievements(achData);
      setAwardedAchievements(awardData);
    } catch {
      setAchievements([]);
      setAwardedAchievements([]);
    }
  }, [orgId]);

  useEffect(() => {
    if (!orgId) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      getRegions(orgId).catch(() => []),
      getLeaderboard(orgId, { period: '30d', type: 'avg_score', limit: 20 }).catch(() => []),
      getChallenges(orgId).catch(() => []),
      getAchievements(orgId).catch(() => []),
      getAwardedAchievements(orgId).catch(() => []),
      getTemplates(orgId).catch(() => [] as ScoringTemplate[]),
    ]).then(([regionData, lbData, challengeData, achData, awardData, templateData]) => {
      setRegions(regionData);
      setLeaderboard(lbData);
      setChallenges(challengeData);
      setAchievements(achData);
      setAwardedAchievements(awardData);
      // Extract unique section names from templates
      const names = new Set<string>();
      templateData.forEach((t: ScoringTemplate) => {
        (t.sections || []).forEach((s) => names.add(s.name));
      });
      setSectionNames(Array.from(names).sort());
    }).finally(() => setLoading(false));
  }, [orgId]);

  useEffect(() => {
    if (!loading) loadLeaderboard();
  }, [lbPeriod, lbType, lbRegion, loadLeaderboard, loading]);

  const handleSelectChallenge = async (challenge: Challenge) => {
    setSelectedChallenge(challenge);
    if (orgId) {
      try {
        const data = await getChallengeStandings(orgId, challenge.id);
        setStandings(data);
      } catch {
        setStandings([]);
      }
    }
  };

  const handleCreateChallenge = async (data: ChallengeData) => {
    if (!orgId) return;
    await createChallenge(orgId, data);
    setShowChallengeForm(false);
    loadChallenges();
  };

  const handleDeleteChallenge = async (id: string) => {
    if (!orgId) return;
    await deleteChallenge(orgId, id);
    if (selectedChallenge?.id === id) {
      setSelectedChallenge(null);
      setStandings([]);
    }
    loadChallenges();
  };

  const earnedIds = new Set(awardedAchievements.map((a) => a.achievement.id));
  const filteredAchievements = achievements.filter(
    (a) => tierFilter === 'all' || a.tier === tierFilter
  );
  const recentAwards = [...awardedAchievements].sort(
    (a, b) => new Date(b.awarded_at).getTime() - new Date(a.awarded_at).getTime()
  ).slice(0, 6);

  const activeChallenges = challenges.filter((c) => c.is_active && c.is_ongoing);
  const pastChallenges = challenges.filter((c) => !c.is_ongoing);

  const getMedalIcon = (rank: number) => {
    if (rank === 1) return <span className="text-yellow-500 font-bold">1st</span>;
    if (rank === 2) return <span className="text-gray-400 font-bold">2nd</span>;
    if (rank === 3) return <span className="text-amber-600 font-bold">3rd</span>;
    return <span className="text-gray-500">{rank}</span>;
  };

  const getTrendArrow = (trend: string) => {
    if (trend === 'up') return <span className="text-green-500">&#9650;</span>;
    if (trend === 'down') return <span className="text-red-500">&#9660;</span>;
    return <span className="text-gray-400">&#8212;</span>;
  };

  // If no gamification features at all, show upgrade prompt
  if (!hasBasic) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-6 pb-24">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Leaderboard & Gamification</h1>
          <p className="mt-0.5 text-sm text-gray-500">Rankings, challenges, and achievements across your stores</p>
        </div>
        <FeatureGate feature="gamification_basic" requiredPlan="Pro">
          <div />
        </FeatureGate>
      </div>
    );
  }

  // Build visible tabs based on plan
  const visibleTabs: { key: Tab; label: string }[] = [
    ...(hasAdvanced ? [{ key: 'leaderboard' as Tab, label: 'Leaderboard' }] : []),
    ...(hasAdvanced ? [{ key: 'challenges' as Tab, label: 'Challenges' }] : []),
    { key: 'achievements' as Tab, label: 'Achievements' },
  ];

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 pb-24">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Leaderboard & Gamification</h1>
        <p className="mt-0.5 text-sm text-gray-500">Rankings, challenges, and achievements across your stores</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 max-w-md">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : tab === 'leaderboard' ? (
        /* ---------- Leaderboard Tab ---------- */
        <div>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setLbPeriod(p.value)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    lbPeriod === p.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
              {LEADERBOARD_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setLbType(t.value)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    lbType === t.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {regions.length > 0 && (
              <select
                value={lbRegion}
                onChange={(e) => setLbRegion(e.target.value)}
                className="rounded-lg border-gray-300 text-xs shadow-sm focus:border-primary-500 focus:ring-primary-500"
              >
                <option value="">All Regions</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Leaderboard Table */}
          {leaderboard.length === 0 ? (
            <div className="bg-white rounded-xl ring-1 ring-gray-900/5 p-8 text-center shadow-sm">
              <svg className="w-12 h-12 text-gray-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="mt-3 text-sm text-gray-500">No data for this period</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl ring-1 ring-gray-900/5 shadow-sm overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Store</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Region</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      {lbType === 'walk_count' ? 'Walks' : lbType === 'most_improved' ? 'Change' : lbType === 'consistency' ? 'Avg Score' : lbType === 'streak' ? 'Weeks' : 'Avg Score'}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      {lbType === 'consistency' ? 'Std Dev' : lbType === 'streak' ? '' : 'Trend'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {leaderboard.map((entry) => (
                    <tr key={entry.store_id} className={entry.rank <= 3 ? 'bg-yellow-50/30' : ''}>
                      <td className="px-4 py-3 text-sm">{getMedalIcon(entry.rank)}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {entry.store_name}
                        {entry.store_number && <span className="text-gray-400 ml-1">#{entry.store_number}</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{entry.region_name}</td>
                      <td className="px-4 py-3 text-sm text-right font-semibold">
                        {lbType === 'walk_count' ? entry.value : lbType === 'streak' ? `${entry.value} wk${entry.value !== 1 ? 's' : ''}` : lbType === 'most_improved' ? `${entry.value > 0 ? '+' : ''}${entry.value}%` : `${entry.value}%`}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {lbType === 'streak' ? (
                          <span />
                        ) : lbType === 'consistency' ? (
                          <span className="text-gray-500">{entry.change}</span>
                        ) : (
                          <span className="flex items-center justify-end gap-1">
                            {getTrendArrow(entry.trend)}
                            {entry.change !== null && (
                              <span className="text-xs text-gray-400">
                                {entry.change > 0 ? '+' : ''}{entry.change}
                              </span>
                            )}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : tab === 'challenges' ? (
        /* ---------- Challenges Tab ---------- */
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">Challenges</h2>
            {isAdmin && (
              <button
                onClick={() => setShowChallengeForm(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Challenge
              </button>
            )}
          </div>

          {/* Active Challenges */}
          {activeChallenges.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Active</h3>
              <div className="space-y-3">
                {activeChallenges.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => handleSelectChallenge(c)}
                    className={`bg-white rounded-xl ring-1 ring-gray-900/5 p-4 shadow-sm cursor-pointer hover:ring-primary-300 transition-all ${
                      selectedChallenge?.id === c.id ? 'ring-2 ring-primary-500' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold text-gray-900">{c.name}</h4>
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-green-50 text-green-700">Active</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-blue-50 text-blue-700">
                            {CHALLENGE_TYPE_LABELS[c.challenge_type]}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {c.days_remaining} days remaining
                          {c.target_value && ` \u00b7 Target: ${c.target_value}`}
                          {c.region_name && ` \u00b7 Region: ${c.region_name}`}
                          {c.section_name && ` \u00b7 Section: ${c.section_name}`}
                        </p>
                        {c.prizes_text && (
                          <div className="mt-1.5 flex items-start gap-1.5">
                            <svg className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5 5a3 3 0 015-2.236A3 3 0 0114.83 6H16a2 2 0 110 4h-5V9a1 1 0 10-2 0v1H4a2 2 0 110-4h1.17C5.06 5.687 5 5.35 5 5zm4 1V5a1 1 0 10-1 1h1zm2 0a1 1 0 10-1-1v1h1zm-6 7v2a2 2 0 002 2h6a2 2 0 002-2v-2H5z" clipRule="evenodd" />
                            </svg>
                            <p className="text-[11px] text-amber-700 font-medium">{c.prizes_text}</p>
                          </div>
                        )}
                      </div>
                      {isAdmin && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteChallenge(c.id); }}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                    {/* Progress bar for days */}
                    <div className="mt-3">
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div
                          className="bg-primary-500 h-1.5 rounded-full"
                          style={{
                            width: `${Math.max(5, Math.min(100, ((new Date().getTime() - new Date(c.start_date).getTime()) / (new Date(c.end_date).getTime() - new Date(c.start_date).getTime())) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Past Challenges */}
          {pastChallenges.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Past</h3>
              <div className="space-y-2">
                {pastChallenges.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => handleSelectChallenge(c)}
                    className={`bg-white rounded-xl ring-1 ring-gray-900/5 p-3 shadow-sm cursor-pointer hover:ring-primary-300 opacity-70 ${
                      selectedChallenge?.id === c.id ? 'ring-2 ring-primary-500 opacity-100' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-medium text-gray-700">{c.name}</h4>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-gray-100 text-gray-500">Ended</span>
                      </div>
                      <span className="text-xs text-gray-400">
                        {new Date(c.start_date).toLocaleDateString()} - {new Date(c.end_date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {challenges.length === 0 && (
            <div className="bg-white rounded-xl ring-1 ring-gray-900/5 p-8 text-center shadow-sm">
              <svg className="w-12 h-12 text-gray-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <p className="mt-3 text-sm text-gray-500">No challenges yet</p>
              {isAdmin && <p className="text-xs text-gray-400 mt-1">Create a challenge to motivate your stores.</p>}
            </div>
          )}

          {/* Standings */}
          {selectedChallenge && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Standings: {selectedChallenge.name}
              </h3>
              {standings.length === 0 ? (
                <p className="text-sm text-gray-400">No standings data available.</p>
              ) : (
                <div className="bg-white rounded-xl ring-1 ring-gray-900/5 shadow-sm overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Store</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Value</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Target</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {standings.map((s) => (
                        <tr key={s.store_id}>
                          <td className="px-4 py-3 text-sm">{getMedalIcon(s.rank)}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{s.store_name}</td>
                          <td className="px-4 py-3 text-sm text-right font-semibold">{s.value}</td>
                          <td className="px-4 py-3 text-center">
                            {s.meets_target ? (
                              <span className="text-green-500">
                                <svg className="w-4 h-4 inline" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ---------- Achievements Tab ---------- */
        <div>
          {/* Recently Earned */}
          {recentAwards.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Recently Earned</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {recentAwards.map((award) => (
                  <div key={award.id} className="bg-white rounded-xl ring-1 ring-gray-900/5 p-3 shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${TIER_BG[award.achievement.tier]} flex items-center justify-center text-white text-xs font-bold`}>
                        {award.achievement.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-900 truncate">{award.achievement.name}</p>
                        <p className="text-[10px] text-gray-500 truncate">{award.store_name}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tier Filter */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5 mb-4 max-w-sm">
            {(['all', 'bronze', 'silver', 'gold', 'platinum'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTierFilter(t)}
                className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${
                  tierFilter === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Achievement Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredAchievements.map((achievement) => {
              const earned = earnedIds.has(achievement.id);
              return (
                <div
                  key={achievement.id}
                  className={`rounded-xl ring-1 p-4 text-center transition-all ${
                    earned
                      ? `${TIER_COLORS[achievement.tier]} ring-1 shadow-sm`
                      : 'bg-gray-50 text-gray-400 ring-gray-200'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center text-lg font-bold ${
                    earned
                      ? `bg-gradient-to-br ${TIER_BG[achievement.tier]} text-white`
                      : 'bg-gray-200 text-gray-400'
                  }`}>
                    {achievement.name.charAt(0)}
                  </div>
                  <h4 className={`text-sm font-semibold ${earned ? '' : 'text-gray-400'}`}>{achievement.name}</h4>
                  <p className={`text-[10px] mt-1 ${earned ? 'opacity-80' : 'text-gray-300'}`}>
                    {achievement.description}
                  </p>
                  <span className={`inline-block mt-2 text-[10px] px-1.5 py-0.5 rounded font-medium capitalize ${
                    earned ? TIER_COLORS[achievement.tier] : 'bg-gray-100 text-gray-400'
                  }`}>
                    {achievement.tier}
                  </span>
                </div>
              );
            })}
          </div>

          {filteredAchievements.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm">No achievements for this filter.</div>
          )}

          {/* Upgrade prompt for Pro users to see advanced badges */}
          {!hasAdvanced && (
            <div className="mt-6">
              <FeatureGate feature="gamification_advanced" requiredPlan="Enterprise">
                <div />
              </FeatureGate>
            </div>
          )}
        </div>
      )}

      {/* Challenge Form Modal */}
      {showChallengeForm && (
        <ChallengeFormModal
          regions={regions}
          sectionNames={sectionNames}
          onSave={handleCreateChallenge}
          onClose={() => setShowChallengeForm(false)}
        />
      )}
    </div>
  );
}
