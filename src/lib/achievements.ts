/**
 * Achievement System — Track player milestones.
 * Persists unlocked achievements to localStorage.
 * Fires custom events for toast notifications.
 */

export type AchievementTier = 'bronze' | 'silver' | 'gold';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  tier: AchievementTier;
  icon: string; // emoji or icon class
  check: (stats: PlayerStats) => boolean;
}

export interface UnlockedAchievement {
  id: string;
  unlockedAt: number;
}

export interface PlayerStats {
  battleWins: number;
  totalBattles: number;
  totalRounds: number;
  highestScore: number;
  triviaCorrect: number;
  triviaPerfect: number; // 5/5 scores
  challengesCompleted: number;
  uniqueCards: number;
  totalCards: number;
  packsOpened: number;
}

const STORAGE_KEY = 'inspired-mile-achievements';
const STATS_KEY = 'inspired-mile-player-stats';

// --- Achievement Definitions ---

export const ACHIEVEMENTS: Achievement[] = [
  // Bronze — Early milestones
  {
    id: 'first-blood',
    name: 'First Blood',
    description: 'Win your first battle',
    tier: 'bronze',
    icon: '\u2694\uFE0F',
    check: (s) => s.battleWins >= 1,
  },
  {
    id: 'card-collector',
    name: 'Card Collector',
    description: 'Collect 5 unique cards',
    tier: 'bronze',
    icon: '\uD83C\uDCCF',
    check: (s) => s.uniqueCards >= 5,
  },
  {
    id: 'opening-act',
    name: 'Opening Act',
    description: 'Complete your first battle',
    tier: 'bronze',
    icon: '\uD83C\uDFAD',
    check: (s) => s.totalBattles >= 1,
  },
  {
    id: 'scholar-novice',
    name: 'Budding Scholar',
    description: 'Answer 5 trivia questions correctly',
    tier: 'bronze',
    icon: '\uD83D\uDCDA',
    check: (s) => s.triviaCorrect >= 5,
  },
  {
    id: 'quotable',
    name: 'Quotable',
    description: 'Complete 3 quote challenges',
    tier: 'bronze',
    icon: '\uD83D\uDCDC',
    check: (s) => s.challengesCompleted >= 3,
  },

  // Silver — Intermediate achievements
  {
    id: 'bards-apprentice',
    name: "Bard's Apprentice",
    description: 'Play 10 battles',
    tier: 'silver',
    icon: '\uD83C\uDFB6',
    check: (s) => s.totalBattles >= 10,
  },
  {
    id: 'wordsmith',
    name: 'Wordsmith',
    description: 'Score 35 or higher in a single round',
    tier: 'silver',
    icon: '\u2728',
    check: (s) => s.highestScore >= 35,
  },
  {
    id: 'scholar',
    name: 'Scholar',
    description: 'Get a perfect 5/5 on trivia',
    tier: 'silver',
    icon: '\uD83C\uDF93',
    check: (s) => s.triviaPerfect >= 1,
  },
  {
    id: 'pack-rat',
    name: 'Pack Rat',
    description: 'Open 10 card packs',
    tier: 'silver',
    icon: '\uD83C\uDF81',
    check: (s) => s.packsOpened >= 10,
  },
  {
    id: 'verse-veteran',
    name: 'Verse Veteran',
    description: 'Complete 25 battle rounds',
    tier: 'silver',
    icon: '\uD83D\uDCDD',
    check: (s) => s.totalRounds >= 25,
  },
  {
    id: 'challenge-master',
    name: 'Challenge Master',
    description: 'Complete 10 quote challenges',
    tier: 'silver',
    icon: '\uD83C\uDFC6',
    check: (s) => s.challengesCompleted >= 10,
  },

  // Gold — Expert milestones
  {
    id: 'completionist',
    name: 'Completionist',
    description: 'Collect all 48 unique cards',
    tier: 'gold',
    icon: '\uD83D\uDC51',
    check: (s) => s.uniqueCards >= 48,
  },
  {
    id: 'master-thespian',
    name: 'Master Thespian',
    description: 'Win 25 battles',
    tier: 'gold',
    icon: '\uD83C\uDFAD',
    check: (s) => s.battleWins >= 25,
  },
  {
    id: 'shakespeare-scholar',
    name: 'Shakespeare Scholar',
    description: 'Answer 50 trivia questions correctly',
    tier: 'gold',
    icon: '\uD83E\uDDD9',
    check: (s) => s.triviaCorrect >= 50,
  },
  {
    id: 'virtuoso',
    name: 'Virtuoso',
    description: 'Score 45 or higher in a single round',
    tier: 'gold',
    icon: '\uD83D\uDD25',
    check: (s) => s.highestScore >= 45,
  },
  {
    id: 'hundred-rounds',
    name: 'Centurion',
    description: 'Complete 100 battle rounds',
    tier: 'gold',
    icon: '\uD83C\uDFAF',
    check: (s) => s.totalRounds >= 100,
  },

  // --- V2: Expanded Achievements ---

  // Bronze — New early milestones
  {
    id: 'first-pack',
    name: 'Unboxing Day',
    description: 'Open your first card pack',
    tier: 'bronze',
    icon: '\uD83C\uDF81',
    check: (s) => s.packsOpened >= 1,
  },
  {
    id: 'trivia-starter',
    name: 'Curious Mind',
    description: 'Answer 1 trivia question correctly',
    tier: 'bronze',
    icon: '\u2753',
    check: (s) => s.triviaCorrect >= 1,
  },
  {
    id: 'first-challenge',
    name: 'Quote Seeker',
    description: 'Complete your first quote challenge',
    tier: 'bronze',
    icon: '\uD83D\uDCDC',
    check: (s) => s.challengesCompleted >= 1,
  },

  // Silver — New intermediate achievements
  {
    id: 'battle-master',
    name: 'Battle Master',
    description: 'Win 10 battles',
    tier: 'silver',
    icon: '\u2694\uFE0F',
    check: (s) => s.battleWins >= 10,
  },
  {
    id: 'relic-hunter',
    name: 'Relic Hunter',
    description: 'Collect 5 relic cards',
    tier: 'silver',
    icon: '\uD83D\uDD2E',
    check: (s) => s.uniqueCards >= 15,
  },
  {
    id: 'trivia-enthusiast',
    name: 'Trivia Enthusiast',
    description: 'Answer 25 trivia questions correctly',
    tier: 'silver',
    icon: '\uD83E\uDDE0',
    check: (s) => s.triviaCorrect >= 25,
  },
  {
    id: 'challenge-adept',
    name: 'Challenge Adept',
    description: 'Complete 20 quote challenges',
    tier: 'silver',
    icon: '\uD83D\uDCD6',
    check: (s) => s.challengesCompleted >= 20,
  },
  {
    id: 'pack-collector',
    name: 'Pack Collector',
    description: 'Open 25 card packs',
    tier: 'silver',
    icon: '\uD83D\uDCE6',
    check: (s) => s.packsOpened >= 25,
  },

  // Gold — New expert milestones
  {
    id: 'legend-50-wins',
    name: 'Legend of the Stage',
    description: 'Win 50 battles',
    tier: 'gold',
    icon: '\uD83C\uDFC6',
    check: (s) => s.battleWins >= 50,
  },
  {
    id: 'trivia-champion',
    name: 'Trivia Champion',
    description: 'Answer 100 trivia questions correctly',
    tier: 'gold',
    icon: '\uD83C\uDF1F',
    check: (s) => s.triviaCorrect >= 100,
  },
  {
    id: 'challenge-legend',
    name: 'Challenge Legend',
    description: 'Complete 50 quote challenges',
    tier: 'gold',
    icon: '\uD83D\uDCDC',
    check: (s) => s.challengesCompleted >= 50,
  },
  {
    id: 'pack-addict',
    name: 'Pack Addict',
    description: 'Open 50 card packs',
    tier: 'gold',
    icon: '\uD83C\uDF89',
    check: (s) => s.packsOpened >= 50,
  },
  {
    id: 'half-collection',
    name: 'Half the Globe',
    description: 'Collect 24 unique cards',
    tier: 'silver',
    icon: '\uD83C\uDF0D',
    check: (s) => s.uniqueCards >= 24,
  },
  {
    id: 'perfect-scholar',
    name: 'Perfect Scholar',
    description: 'Get 5 perfect trivia scores',
    tier: 'gold',
    icon: '\uD83C\uDF93',
    check: (s) => s.triviaPerfect >= 5,
  },
];

// --- Stats Persistence ---

function defaultStats(): PlayerStats {
  return {
    battleWins: 0,
    totalBattles: 0,
    totalRounds: 0,
    highestScore: 0,
    triviaCorrect: 0,
    triviaPerfect: 0,
    challengesCompleted: 0,
    uniqueCards: 0,
    totalCards: 0,
    packsOpened: 0,
  };
}

export function getPlayerStats(): PlayerStats {
  if (typeof window === 'undefined') return defaultStats();
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return defaultStats();
    return { ...defaultStats(), ...JSON.parse(raw) };
  } catch {
    return defaultStats();
  }
}

function savePlayerStats(stats: PlayerStats): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch { /* quota exceeded — stats persist in memory until next successful write */ }
}

export function updateStats(partial: Partial<PlayerStats>): PlayerStats {
  const stats = getPlayerStats();
  Object.assign(stats, partial);
  savePlayerStats(stats);
  checkNewAchievements(stats);
  return stats;
}

export function incrementStat(key: keyof PlayerStats, amount = 1): PlayerStats {
  const stats = getPlayerStats();
  (stats[key] as number) += amount;
  savePlayerStats(stats);
  checkNewAchievements(stats);
  return stats;
}

export function setHighScore(score: number): PlayerStats {
  const stats = getPlayerStats();
  if (score > stats.highestScore) {
    stats.highestScore = score;
    savePlayerStats(stats);
    checkNewAchievements(stats);
  }
  return stats;
}

export function syncCardStats(uniqueCards: number, totalCards: number): void {
  const stats = getPlayerStats();
  stats.uniqueCards = uniqueCards;
  stats.totalCards = totalCards;
  savePlayerStats(stats);
  checkNewAchievements(stats);
}

// --- Achievement Tracking ---

export function getUnlockedAchievements(): UnlockedAchievement[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveUnlockedAchievements(unlocked: UnlockedAchievement[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(unlocked));
  } catch { /* quota exceeded */ }
}

export function isAchievementUnlocked(id: string): boolean {
  return getUnlockedAchievements().some(a => a.id === id);
}

export function getAchievementProgress(): { achievement: Achievement; unlocked: boolean; unlockedAt?: number }[] {
  const unlocked = getUnlockedAchievements();
  return ACHIEVEMENTS.map(a => {
    const match = unlocked.find(u => u.id === a.id);
    return {
      achievement: a,
      unlocked: !!match,
      unlockedAt: match?.unlockedAt,
    };
  });
}

/** Check stats against all achievements and unlock any new ones */
export function checkNewAchievements(stats?: PlayerStats): Achievement[] {
  const currentStats = stats || getPlayerStats();
  const unlocked = getUnlockedAchievements();
  const unlockedIds = new Set(unlocked.map(a => a.id));
  const newlyUnlocked: Achievement[] = [];

  for (const achievement of ACHIEVEMENTS) {
    if (unlockedIds.has(achievement.id)) continue;
    if (achievement.check(currentStats)) {
      unlocked.push({ id: achievement.id, unlockedAt: Date.now() });
      newlyUnlocked.push(achievement);
    }
  }

  if (newlyUnlocked.length > 0) {
    saveUnlockedAchievements(unlocked);
    // Fire events for toast notifications
    for (const a of newlyUnlocked) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('achievement-unlocked', { detail: a }));
      }
    }
    // Sync to server if logged in
    if (typeof window !== 'undefined') {
      import('./storage-backend').then(({ getStorageMode }) => {
        if (getStorageMode() === 'server') {
          import('./api-client').then(({ checkAchievements }) => {
            checkAchievements(newlyUnlocked.map(a => a.id)).catch(() => {});
          }).catch(() => {});
        }
      }).catch(() => {});
    }
  }

  return newlyUnlocked;
}

/** Reset all achievement data (for debugging) */
export function resetAchievements(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(STATS_KEY);
}
