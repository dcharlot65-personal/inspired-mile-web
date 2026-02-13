/**
 * User Inventory — Tracks which cards the user owns.
 * Persists to localStorage. No server needed.
 */

export type AcquisitionSource = 'starter' | 'daily' | 'pack' | 'battle' | 'trivia' | 'challenge' | 'purchase';
export type CardOwnershipState = 'owned' | 'minted'; // 'minted' = on-chain NFT (future)

export interface OwnedCard {
  cardId: string;
  acquiredAt: number; // timestamp
  source: AcquisitionSource;
  state: CardOwnershipState;
  mintAddress?: string; // Solana address if minted (future)
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(inv));
}

export function addCard(cardId: string, source: AcquisitionSource): OwnedCard {
  const inv = getInventory();
  const entry: OwnedCard = {
    cardId,
    acquiredAt: Date.now(),
    source,
    state: 'owned',
  };
  inv.cards.push(entry);
  saveInventory(inv);
  return entry;
}

export function hasCard(cardId: string): boolean {
  const inv = getInventory();
  return inv.cards.some(c => c.cardId === cardId);
}

export function getOwnedCards(): OwnedCard[] {
  return getInventory().cards;
}

export function getOwnedCardIds(): Set<string> {
  return new Set(getOwnedCards().map(c => c.cardId));
}

export function getUniqueOwnedCount(): number {
  return getOwnedCardIds().size;
}

export function getDuplicateCount(cardId: string): number {
  return getInventory().cards.filter(c => c.cardId === cardId).length;
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

/** Mark daily pack as claimed */
export function claimDaily(): void {
  const inv = getInventory();
  inv.lastDailyPack = Date.now();
  saveInventory(inv);
}

/** Increment battle wins counter */
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
    totalCards: inv.cards.length,
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
