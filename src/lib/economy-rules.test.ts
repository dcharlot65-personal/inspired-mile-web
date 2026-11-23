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

describe('what the pages offer, as the server allows it', () => {
  it('lists for sale no card brought over from a device, none on sale already, and each card once', async () => {
    const { sellable } = await import('./account-cards');
    const row = (cardId: string, source: string, listed = false) => ({ cardId, source, listed, acquiredAt: 0 });
    expect(ECONOMY.import.sellable, 'the second check of 2026-11-19: imported cards stay with their account').toBe(false);
    expect(sellable([row('DC-001', 'pack'), row('DC-001', 'pack'), row('OL-001', 'import'), row('RL-002', 'pack', true), row('MO-002', 'purchase')]))
      .toEqual(['DC-001', 'MO-002']);
  });

  it('shows the market and referrals to an adult account, and signed out to a visitor the gate took for an adult', async () => {
    const { adultsOnlyAllowed } = await import('./adults-only');
    const user = (age_tier?: string) => JSON.stringify({ id: 'u', username: 'u', ...(age_tier ? { age_tier } : {}) });
    expect(adultsOnlyAllowed({ mode: 'server', user: user('adult'), gate: 'teen-consented' })).toBe(true);
    // Signed in, the account's tier decides, whatever this browser's gate says.
    for (const tier of ['teen', 'unknown', undefined]) {
      expect(adultsOnlyAllowed({ mode: 'server', user: user(tier), gate: 'adult' }), String(tier)).toBe(false);
    }
    expect(adultsOnlyAllowed({ mode: 'server', user: 'not json', gate: 'adult' })).toBe(false);
    expect(adultsOnlyAllowed({ mode: null, user: null, gate: 'adult' })).toBe(true);
    for (const gate of ['teen-consented', 'blocked', null]) expect(adultsOnlyAllowed({ mode: null, user: null, gate }), String(gate)).toBe(false);
  });

  it("draws the season bar on the server's level curve", async () => {
    const { getLevelProgress, xpForLevel } = await import('./seasons');
    // backend/src/ledger.rs: level 1 at nothing, level n at n × 200.
    expect(readFileSync('backend/src/ledger.rs', 'utf8')).toMatch(/pub fn xp_for_level\(level: i32\) -> i32 \{\s*level \* 200\s*\}/);
    expect([1, 2, 3, 10].map(xpForLevel)).toEqual([0, 400, 600, 2000]);
    const at = (xp: number, level: number) => getLevelProgress({ xp, level, xpToNext: 0, season: { maxLevel: 30 } } as any);
    expect(at(0, 1)).toBe(0);
    expect(at(200, 1)).toBe(50);
    expect(at(400, 2)).toBe(0);
    expect(at(500, 2)).toBe(50);
    expect(at(5000, 30)).toBe(100);
  });
});

describe("the sign-in offer of a device's collection", () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = new Map();
    (globalThis as any).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
  });
  afterEach(() => {
    delete (globalThis as any).localStorage;
  });

  it('is made once per device: not again after the cards went to an account, nor to an account that skipped it', async () => {
    const { importDone, importSkipped, offerImport } = await import('./import-offer');
    expect(offerImport('ann', 0), 'nothing to bring').toBe(false);
    expect(offerImport(null, 5), 'signed out').toBe(false);
    expect(offerImport('ann', 5)).toBe(true);
    importSkipped('ann');
    expect(offerImport('ann', 5), 'ann said no on this device').toBe(false);
    expect(offerImport('bob', 5), 'bob has not been asked').toBe(true);
    importDone('bob');
    // The second check of 2026-11-19: every account signed in on one device was offered the same cards.
    for (const who of ['bob', 'cat', 'ann']) expect(offerImport(who, 5), who).toBe(false);
  });

  it('sends each different card once, however many rows the device holds of it', async () => {
    // Third check of 2026-11-19: 520 rows of six cards were sent whole, and the server refused
    // more than 500 ("Too many cards"), so the device could never bring its cards over.
    const { importIds } = await import('./import-offer');
    const six = ['DC-001', 'DC-002', 'MO-002', 'MO-003', 'CA-002', 'CA-003'];
    const rows = Array.from({ length: 520 }, (_, i) => ({ cardId: six[i % 6], acquiredAt: i, source: 'battle' }));
    expect(importIds(rows)).toEqual(six);
    expect(importIds([])).toEqual([]);
  });
});
