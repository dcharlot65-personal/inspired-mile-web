/**
 * The collection a page plays with.
 *
 * Signed out, it is this device's own (localStorage), for solo play: the device's starter and
 * daily packs and what solo play wins add to it, and nothing of it reaches the server except a
 * one-time capped import when an account is first signed in on the device (docs/ECONOMY.md).
 *
 * Signed in, it is the account's, as the server holds it (src/lib/account-cards.ts): cards come
 * only from the server, so nothing here adds to it. `getOwnedCards` and the functions built on
 * it answer with the account's cards then; the device's counters (battle wins, trivia) stay the
 * device's.
 */
import { ECONOMY } from './economy-rules';
import { accountCopy, usingAccountCards } from './account-cards';

export type AcquisitionSource = 'starter' | 'daily' | 'pack' | 'battle' | 'trivia' | 'challenge' | 'purchase';
export interface OwnedCard {
  cardId: string;
  acquiredAt: number; // timestamp
  source: AcquisitionSource;
}

export interface InventoryData {
  cards: OwnedCard[];
  starterClaimed: boolean;
  lastDailyPack: number; // timestamp of last daily pack claim
  battleWins: number;
  triviaCorrect: number;
  challengesCompleted: number;
}

const STORAGE_KEY = 'inspired-mile-inventory';

function defaultInventory(): InventoryData {
  return {
    cards: [],
    starterClaimed: false,
    lastDailyPack: 0,
    battleWins: 0,
    triviaCorrect: 0,
    challengesCompleted: 0,
  };
}

export function getInventory(): InventoryData {
  if (typeof window === 'undefined') return defaultInventory();

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultInventory();
    return JSON.parse(raw);
  } catch {
    return defaultInventory();
  }
}

function saveInventory(inv: InventoryData): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inv));
  } catch { /* quota exceeded */ }
}

/** Add a card to this device's own collection (signed out only: signed in, cards come from the server). */
export function addCard(cardId: string, source: AcquisitionSource): OwnedCard {
  const inv = getInventory();
  const entry: OwnedCard = {
    cardId,
    acquiredAt: Date.now(),
    source,
  };
  inv.cards.push(entry);
  saveInventory(inv);
  return entry;
}

/** The device's own collection, whoever is signed in: what an import would offer. */
export function getDeviceCards(): OwnedCard[] {
  return getInventory().cards;
}

export function hasCard(cardId: string): boolean {
  return getOwnedCards().some(c => c.cardId === cardId);
}

/** The collection to play with: the account's when signed in, this device's otherwise. */
export function getOwnedCards(): OwnedCard[] {
  if (usingAccountCards()) {
    const copy = accountCopy();
    // Until the account's cards have been fetched on this device it holds its starter characters.
    const starter = copy?.starter ?? [];
    return [
      ...starter.map((cardId): OwnedCard => ({ cardId, acquiredAt: 0, source: 'starter' })),
      ...(copy?.cards ?? []).map((c): OwnedCard => ({ cardId: c.cardId, acquiredAt: c.acquiredAt, source: c.source as AcquisitionSource })),
    ];
  }
  return getInventory().cards;
}

export function getOwnedCardIds(): Set<string> {
  return new Set(getOwnedCards().map(c => c.cardId));
}

export function getUniqueOwnedCount(): number {
  return getOwnedCardIds().size;
}

export function getDuplicateCount(cardId: string): number {
  return getOwnedCards().filter(c => c.cardId === cardId).length;
}

/** Check if starter pack has been claimed */
export function isStarterClaimed(): boolean {
  return getInventory().starterClaimed;
}

/** Mark starter pack as claimed */
export function claimStarter(): void {
  const inv = getInventory();
  inv.starterClaimed = true;
  saveInventory(inv);
}

/** Check if daily pack is available (resets every 24h) */
export function isDailyAvailable(): boolean {
  const inv = getInventory();
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  return now - inv.lastDailyPack >= oneDay;
}

/** Get milliseconds until the next daily pack is available */
export function getTimeUntilNextDaily(): number {
  const inv = getInventory();
  if (inv.lastDailyPack === 0) return 0;
  const oneDay = 24 * 60 * 60 * 1000;
  const elapsed = Date.now() - inv.lastDailyPack;
  return Math.max(0, oneDay - elapsed);
}

/** Mark daily pack as claimed */
export function claimDaily(): void {
  const inv = getInventory();
  inv.lastDailyPack = Date.now();
  saveInventory(inv);
}

/**
 * Cards a solo trivia round or quote challenge may add to this device's collection today (UTC):
 * `device.trivia_cards_per_day` and `device.challenge_cards_per_day` in backend/data/economy.json.
 * Until 2026-11-19 each paid a card every time, without end.
 */
const DEVICE_REWARDS_KEY = 'inspired-mile-device-rewards';

export function takeDeviceCard(kind: 'trivia' | 'challenge'): boolean {
  if (typeof window === 'undefined') return false;
  const day = new Date().toISOString().slice(0, 10);
  const cap = kind === 'trivia' ? ECONOMY.device.trivia_cards_per_day : ECONOMY.device.challenge_cards_per_day;
  let record: { day: string; trivia: number; challenge: number } = { day, trivia: 0, challenge: 0 };
  try {
    const raw = JSON.parse(localStorage.getItem(DEVICE_REWARDS_KEY) || 'null');
    if (raw && raw.day === day) record = { day, trivia: Number(raw.trivia) || 0, challenge: Number(raw.challenge) || 0 };
  } catch { /* a fresh day */ }
  if (record[kind] >= cap) return false;
  record[kind] += 1;
  try {
    localStorage.setItem(DEVICE_REWARDS_KEY, JSON.stringify(record));
  } catch {
    return false; // without storage the count cannot be kept: no card
  }
  return true;
}

/** Increment battle wins counter (one per match won, not per round) */
export function recordBattleWin(): void {
  const inv = getInventory();
  inv.battleWins++;
  saveInventory(inv);
}

/** Increment trivia correct counter */
export function recordTriviaCorrect(): void {
  const inv = getInventory();
  inv.triviaCorrect++;
  saveInventory(inv);
}

/** Increment challenges completed counter */
export function recordChallengeComplete(): void {
  const inv = getInventory();
  inv.challengesCompleted++;
  saveInventory(inv);
}

/** Get player stats */
export function getStats(): { totalCards: number; uniqueCards: number; battleWins: number; triviaCorrect: number; challengesCompleted: number } {
  const inv = getInventory();
  return {
    totalCards: getOwnedCards().length,
    uniqueCards: getUniqueOwnedCount(),
    battleWins: inv.battleWins,
    triviaCorrect: inv.triviaCorrect,
    challengesCompleted: inv.challengesCompleted,
  };
}

/** Reset inventory (for debugging) */
export function resetInventory(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}
