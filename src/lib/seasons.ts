/**
 * Seasons / Battle Pass — Client-side season tracking.
 * Syncs XP/level progress with /api/v1/seasons backend.
 *
 * Nothing here is shown to the player as written: the page (src/pages/season.astro)
 * turns XP sources and reward types into words in the interface language.
 */

import { ApiError } from './api-client';

const API_BASE = import.meta.env.PUBLIC_API_URL || '';

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

/**
 * The API signs a player in with the httpOnly `im_token` cookie, so every
 * request here sends credentials. (Until 2026-11 this file sent a bearer token
 * read from localStorage, which nothing has stored since sign-in moved to
 * passkeys: every call answered null.)
 */
async function seasonRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}/api/v1/seasons${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  // The status and the body, for src/lib/api-errors.ts to turn into a code. Never shown as they are.
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return res.json();
}

function toProgress(data: any): SeasonProgress {
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
}

/**
 * Current season progress, or the reason there is none: throws ApiError
 * (401 signed out, 404 no season running) or TypeError (no answer).
 */
export async function fetchCurrentSeason(): Promise<SeasonProgress> {
  return toProgress(await seasonRequest('/current'));
}

/** Get current season progress; null when signed out, when no season runs, or offline. */
export async function getCurrentSeason(): Promise<SeasonProgress | null> {
  try {
    return await fetchCurrentSeason();
  } catch {
    return null;
  }
}

/** Add XP from an activity */
export async function addXP(source: string): Promise<SeasonProgress | null> {
  try {
    return toProgress(await seasonRequest('/xp', { method: 'POST', body: JSON.stringify({ source }) }));
  } catch {
    return null;
  }
}

/** Get all season rewards */
export async function getRewards(): Promise<SeasonReward[]> {
  try {
    const data = await seasonRequest<any[]>('/rewards');
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

/** Claim a level reward. Throws ApiError or TypeError when it cannot. */
export async function claimReward(level: number): Promise<void> {
  await seasonRequest(`/claim/${level}`, { method: 'POST' });
}

/** Calculate level progress percentage */
export function getLevelProgress(progress: SeasonProgress): number {
  if (progress.level >= progress.season.maxLevel) return 100;
  const xpIntoLevel = progress.xp - ((progress.level - 1) * 200);
  return Math.min(100, Math.max(0, (xpIntoLevel / 200) * 100));
}
