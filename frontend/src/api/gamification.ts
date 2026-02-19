import api from './client';
import type {
  Achievement,
  AwardedAchievement,
  Challenge,
  ChallengeStanding,
  LeaderboardEntry,
} from '../types';

// ---------- Leaderboard ----------

export interface LeaderboardParams {
  period?: string;
  type?: string;
  region?: string;
  limit?: number;
}

export async function getLeaderboard(
  orgId: string,
  params?: LeaderboardParams
): Promise<LeaderboardEntry[]> {
  const response = await api.get<LeaderboardEntry[]>('/stores/leaderboard/', {
    headers: { 'X-Organization': orgId },
    params,
  });
  return response.data;
}

// ---------- Challenges ----------

export async function getChallenges(orgId: string): Promise<Challenge[]> {
  const response = await api.get('/stores/challenges/', {
    headers: { 'X-Organization': orgId },
    params: { page_size: 100 },
  });
  const data = response.data;
  return Array.isArray(data) ? data : data.results ?? [];
}

export async function getChallenge(
  orgId: string,
  id: string
): Promise<Challenge> {
  const response = await api.get<Challenge>(`/stores/challenges/${id}/`, {
    headers: { 'X-Organization': orgId },
  });
  return response.data;
}

export interface ChallengeData {
  name: string;
  description?: string;
  challenge_type: string;
  scope: string;
  region?: string | null;
  target_value?: number | null;
  start_date: string;
  end_date: string;
  is_active?: boolean;
  prizes_text?: string;
  section_name?: string;
}

export async function createChallenge(
  orgId: string,
  data: ChallengeData
): Promise<Challenge> {
  const response = await api.post<Challenge>('/stores/challenges/', data, {
    headers: { 'X-Organization': orgId },
  });
  return response.data;
}

export async function updateChallenge(
  orgId: string,
  id: string,
  data: Partial<ChallengeData>
): Promise<Challenge> {
  const response = await api.patch<Challenge>(
    `/stores/challenges/${id}/`,
    data,
    { headers: { 'X-Organization': orgId } }
  );
  return response.data;
}

export async function deleteChallenge(
  orgId: string,
  id: string
): Promise<void> {
  await api.delete(`/stores/challenges/${id}/`, {
    headers: { 'X-Organization': orgId },
  });
}

export async function getChallengeStandings(
  orgId: string,
  id: string
): Promise<ChallengeStanding[]> {
  const response = await api.get<ChallengeStanding[]>(
    `/stores/challenges/${id}/standings/`,
    { headers: { 'X-Organization': orgId } }
  );
  return response.data;
}

// ---------- Achievements ----------

export async function getAchievements(orgId: string): Promise<Achievement[]> {
  const response = await api.get('/stores/achievements/', {
    headers: { 'X-Organization': orgId },
    params: { page_size: 100 },
  });
  const data = response.data;
  return Array.isArray(data) ? data : data.results ?? [];
}

export async function getAwardedAchievements(
  orgId: string,
  params?: Record<string, string>
): Promise<AwardedAchievement[]> {
  const response = await api.get('/stores/achievements/awarded/', {
    headers: { 'X-Organization': orgId },
    params,
  });
  return response.data;
}
