/**
 * The economy's numbers, for the pages: the same file the API compiles in
 * (backend/data/economy.json; backend/src/economy.rs). The server decides every amount; a page
 * shows these numbers and never sends one. docs/ECONOMY.md says why each is what it is.
 */
import rules from '../../backend/data/economy.json';

export type SoloSource = 'solo_win' | 'trivia' | 'challenge' | 'daily';

export interface Rate {
  amount: number;
  per_day: number;
}

export interface PackTierRule {
  tier: 'standard' | 'rare' | 'epic';
  cards: number;
  guaranteed: string | null;
  price: number;
}

export const ECONOMY = rules as unknown as {
  solo: { credits: Record<SoloSource, Rate>; xp: Record<SoloSource, Rate> };
  online: {
    win_credits: number;
    win_credits_per_day: number;
    win_credits_per_opponent_per_day: number;
    xp_win: number;
    xp_other: number;
    xp_matches_per_day: number;
    xp_matches_per_opponent_per_day: number;
  };
  packs: {
    weights: Record<string, number>;
    tiers: PackTierRule[];
    starter_pack_cards: number;
    daily_pack_cards: number;
    daily_pack_every_hours: number;
  };
  import: { window_hours: number; max_cards: number; max_by_rarity: Record<string, number>; sellable: boolean };
  device: { trivia_cards_per_day: number; challenge_cards_per_day: number };
  market: { price_min: number; price_max: number };
  teen_daily_spend: number;
  referral: { referrer_credits: number; rewards_per_day: number };
  founding: { credits: number; created_before: string };
  tournaments: { match_hours: number };
  account_achievements: Array<{ id: string; metric: string; goal: number }>;
};

export const SOLO_SOURCES = Object.keys(ECONOMY.solo.credits) as SoloSource[];
