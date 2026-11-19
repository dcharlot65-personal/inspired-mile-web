/**
 * The page's numbers are the server's: one file (backend/data/economy.json) holds every amount,
 * rate and cap, and the places that still say a number of their own are held to it here.
 */
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ECONOMY, SOLO_SOURCES } from './economy-rules';
import { CARD_CATALOG, PACK_TIERS, RARITY_WEIGHTS } from './cards';
import { ACHIEVEMENTS, type PlayerStats } from './achievements';
import { ERROR_VARS } from './api-errors';
import { XP_RATES } from './seasons';
import playgroundEn from '../i18n/pages/playground/en';

describe('the economy file', () => {
  it('pays each solo source a fixed amount, capped per day, in credits and in XP', () => {
    expect([...SOLO_SOURCES].sort()).toEqual(['challenge', 'daily', 'solo_win', 'trivia']);
    for (const source of SOLO_SOURCES) {
      for (const rate of [ECONOMY.solo.credits[source], ECONOMY.solo.xp[source]]) {
        expect(Number.isInteger(rate.amount) && rate.amount > 0, source).toBe(true);
        expect(Number.isInteger(rate.per_day) && rate.per_day > 0, source).toBe(true);
      }
    }
  });

  it('draws packs with the weights and tiers the cards module shows (src/lib/cards.ts)', () => {
    expect(ECONOMY.packs.weights).toEqual(RARITY_WEIGHTS);
    expect(ECONOMY.packs.tiers.map((t) => [t.tier, t.cards, t.guaranteed, t.price])).toEqual(
      PACK_TIERS.map((t) => [t.tier, t.cardCount, t.guaranteedRarity, t.cost]),
    );
    // Every rarity a pack can guarantee has cards.
    for (const t of ECONOMY.packs.tiers) if (t.guaranteed) expect(CARD_CATALOG.some((c) => c.rarity === t.guaranteed)).toBe(true);
  });

  it('is what the playground says a pack holds and costs', () => {
    const en = playgroundEn as Record<string, string>;
    for (const t of ECONOMY.packs.tiers) {
      const line = en[`pg.odds.${t.tier}Line`];
      expect(line, t.tier).toContain(`${t.cards} cards`);
      expect(line, t.tier).toContain(`${t.price} Credits`);
    }
  });

  it('is what the about page and the season page promise', () => {
    const about = readFileSync('src/pages/about.astro', 'utf8');
    expect(about, 'the about page reads the amounts from the file').toContain("ECONOMY.solo.credits[s].amount");
    expect(about).not.toMatch(/const credits = \[\d/);
    expect(XP_RATES).toEqual({
      battle: ECONOMY.solo.xp.solo_win.amount,
      trivia: ECONOMY.solo.xp.trivia.amount,
      challenge: ECONOMY.solo.xp.challenge.amount,
      daily: ECONOMY.solo.xp.daily.amount,
    });
    expect(ERROR_VARS.price_invalid).toEqual({ min: ECONOMY.market.price_min, max: ECONOMY.market.price_max });
  });

  it('names as account achievements only ones the device has, reached at the same goal', () => {
    const statOf: Record<string, keyof PlayerStats> = {
      online_wins: 'battleWins',
      online_matches: 'totalBattles',
      online_rounds: 'totalRounds',
      best_round: 'highestScore',
      unique_cards: 'uniqueCards',
      packs_opened: 'packsOpened',
    };
    const zero: PlayerStats = {
      battleWins: 0, totalBattles: 0, totalRounds: 0, highestScore: 0, triviaCorrect: 0, triviaPerfect: 0,
      challengesCompleted: 0, uniqueCards: 0, totalCards: 0, packsOpened: 0,
    };
    for (const a of ECONOMY.account_achievements) {
      const device = ACHIEVEMENTS.find((d) => d.id === a.id);
      expect(device, a.id).toBeDefined();
      const key = statOf[a.metric];
      expect(key, a.metric).toBeDefined();
      expect(device!.check({ ...zero, [key]: a.goal }), `${a.id} at ${a.goal}`).toBe(true);
      expect(device!.check({ ...zero, [key]: a.goal - 1 }), `${a.id} below ${a.goal}`).toBe(false);
    }
    // What the server cannot see (trivia, quote challenges) is never an account achievement.
    const unseen = ACHIEVEMENTS.filter((d) => d.check({ ...zero, triviaCorrect: 1000, triviaPerfect: 1000, challengesCompleted: 1000 }));
    for (const d of unseen) expect(ECONOMY.account_achievements.some((a) => a.id === d.id), d.id).toBe(false);
  });
});

describe("a device's own cards from trivia and quote challenges", () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = new Map();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    (globalThis as any).window = globalThis;
    (globalThis as any).localStorage = storage;
  });
  afterEach(() => {
    delete (globalThis as any).window;
    delete (globalThis as any).localStorage;
  });

  it('are a few a day each, not one every time', async () => {
    const { takeDeviceCard } = await import('./inventory');
    const taken = (kind: 'trivia' | 'challenge', times: number) => Array.from({ length: times }, () => takeDeviceCard(kind)).filter(Boolean).length;
    expect(taken('trivia', 10)).toBe(ECONOMY.device.trivia_cards_per_day);
    expect(taken('challenge', 10)).toBe(ECONOMY.device.challenge_cards_per_day);
    // A new day, a new count.
    store.set('inspired-mile-device-rewards', JSON.stringify({ day: '2000-01-01', trivia: 99, challenge: 99 }));
    expect(taken('trivia', 1)).toBe(1);
  });
});
