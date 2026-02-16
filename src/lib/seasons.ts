/**
 * Seasons / Battle Pass — Client-side season tracking.
 * Syncs XP/level progress with /api/v1/seasons backend.
 */

const STORAGE_KEY = 'inspired-mile-season';
const API_BASE = import.meta.env.PUBLIC_API_URL || 'http://localhost:3847';

export interface SeasonInfo {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  maxLevel: number;
}

export interface SeasonProgress {
  season: SeasonInfo;
  xp: number;
  level: number;
  xpToNext: number;
}

export interface SeasonReward {
  level: number;
  rewardType: string;
  rewardValue: string;
  isPremium: boolean;
  claimed: boolean;
}

/** XP rates for display */
export const XP_RATES: Record<string, number> = {
  battle: 100,
  trivia: 50,
  challenge: 40,
  daily: 25,
};

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('inspired-mile-token');
}

/** Get current season progress */
export async function getCurrentSeason(): Promise<SeasonProgress | null> {
  const token = getToken();
  if (!token) return null;

  try {
    const res = await fetch(`${API_BASE}/api/v1/seasons/current`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      season: {
        id: data.season.id,
        name: data.season.name,
        startDate: data.season.start_date,
        endDate: data.season.end_date,
        maxLevel: data.season.max_level,
      },
      xp: data.xp,
      level: data.level,
      xpToNext: data.xp_to_next,
    };
  } catch {
    return null;
  }
}

/** Add XP from an activity */
export async function addXP(source: string): Promise<SeasonProgress | null> {
  const token = getToken();
  if (!token) return null;

  try {
    const res = await fetch(`${API_BASE}/api/v1/seasons/xp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ source }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      season: {
        id: data.season.id,
        name: data.season.name,
        startDate: data.season.start_date,
        endDate: data.season.end_date,
        maxLevel: data.season.max_level,
      },
      xp: data.xp,
      level: data.level,
      xpToNext: data.xp_to_next,
    };
  } catch {
    return null;
  }
}

/** Get all season rewards */
export async function getRewards(): Promise<SeasonReward[]> {
  const token = getToken();
  if (!token) return [];

  try {
    const res = await fetch(`${API_BASE}/api/v1/seasons/rewards`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((r: any) => ({
      level: r.level,
      rewardType: r.reward_type,
      rewardValue: r.reward_value,
      isPremium: r.is_premium,
      claimed: r.claimed,
    }));
  } catch {
    return [];
  }
}

/** Claim a level reward */
export async function claimReward(level: number): Promise<boolean> {
  const token = getToken();
  if (!token) return false;

  try {
    const res = await fetch(`${API_BASE}/api/v1/seasons/claim/${level}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Calculate level progress percentage */
export function getLevelProgress(progress: SeasonProgress): number {
  if (progress.level >= progress.season.maxLevel) return 100;
  const xpForThisLevel = progress.level * 200;
  const xpIntoLevel = progress.xp - ((progress.level - 1) * 200);
  return Math.min(100, Math.max(0, (xpIntoLevel / 200) * 100));
}
