/**
 * Daily Reward Streak System — Track consecutive daily logins.
 * Escalating rewards: Day 1-2 common, 3-4 uncommon, 5-6 rare, 7 epic + reset.
 * Persists to localStorage with optional server sync.
 */

import type { Rarity } from './cards';

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastClaimDate: string; // ISO date string (YYYY-MM-DD)
  totalClaims: number;
}

export interface DailyReward {
  day: number; // 1-7
  rarity: Rarity;
  packSize: number;
  label: string;
}

const STORAGE_KEY = 'inspired-mile-streaks';

const DAILY_REWARDS: DailyReward[] = [
  { day: 1, rarity: 'Common', packSize: 2, label: 'Common Pack' },
  { day: 2, rarity: 'Common', packSize: 2, label: 'Common Pack' },
  { day: 3, rarity: 'Uncommon', packSize: 3, label: 'Uncommon Pack' },
  { day: 4, rarity: 'Uncommon', packSize: 3, label: 'Uncommon Pack' },
  { day: 5, rarity: 'Rare', packSize: 3, label: 'Rare Pack' },
  { day: 6, rarity: 'Rare', packSize: 4, label: 'Rare Pack' },
  { day: 7, rarity: 'Epic', packSize: 5, label: 'Epic Reward Pack' },
];

function defaultStreak(): StreakData {
  return {
    currentStreak: 0,
    longestStreak: 0,
    lastClaimDate: '',
    totalClaims: 0,
  };
}

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function getYesterdayDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function getStreakData(): StreakData {
  if (typeof window === 'undefined') return defaultStreak();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultStreak();
    return { ...defaultStreak(), ...JSON.parse(raw) };
  } catch {
    return defaultStreak();
  }
}

function saveStreakData(data: StreakData): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* quota exceeded */ }
}

/** Check if today's daily reward has already been claimed */
export function isDailyClaimedToday(): boolean {
  return getStreakData().lastClaimDate === getTodayDate();
}

/** Get the current day's reward info (1-7 cycle) */
export function getCurrentReward(): DailyReward {
  const streak = getStreakData();
  const day = isDailyClaimedToday()
    ? ((streak.currentStreak - 1) % 7) + 1
    : (streak.currentStreak % 7) + 1;
  return DAILY_REWARDS[day - 1];
}

/** Get all 7 reward tiers for display */
export function getRewardTrack(): DailyReward[] {
  return DAILY_REWARDS;
}

/** Claim today's daily reward. Returns the reward info or null if already claimed. */
export function claimDailyReward(): DailyReward | null {
  if (isDailyClaimedToday()) return null;

  const data = getStreakData();
  const today = getTodayDate();
  const yesterday = getYesterdayDate();

  // Check if streak continues or resets
  if (data.lastClaimDate === yesterday) {
    data.currentStreak += 1;
  } else if (data.lastClaimDate === '') {
    data.currentStreak = 1;
  } else {
    // Streak broken — reset
    data.currentStreak = 1;
  }

  // Reset to 1 after completing the 7-day cycle
  if (data.currentStreak > 7) {
    data.currentStreak = 1;
  }

  data.lastClaimDate = today;
  data.totalClaims += 1;
  data.longestStreak = Math.max(data.longestStreak, data.currentStreak);

  saveStreakData(data);

  // Fire event for UI updates
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('daily-claimed', { detail: data }));
  }

  // Sync to server if logged in
  if (typeof window !== 'undefined') {
    import('./storage-backend').then(({ getStorageMode }) => {
      if (getStorageMode() === 'server') {
        import('./api-client').then(({ syncStreakData }) => {
          if (typeof syncStreakData === 'function') {
            syncStreakData(data).catch(() => {});
          }
        }).catch(() => {});
      }
    }).catch(() => {});
  }

  return DAILY_REWARDS[data.currentStreak - 1];
}

/** Get milliseconds until the next daily reward is available (midnight local time) */
export function getTimeUntilNextDaily(): number {
  if (!isDailyClaimedToday()) return 0;
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - now.getTime();
}

/** Format ms into "Xh Ym" countdown string */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Available now!';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
