/**
 * The account's cards, as the server holds them, kept on this device.
 *
 * Cards come only from the server (docs/ECONOMY.md). Signed in, the collection every page shows
 * and plays with is the account's: the starter characters (every account holds them, without a
 * row, and cannot sell them) and the rows the server keeps (packs it opened, the market, season
 * rewards, the one-time import). The device's own collection (src/lib/inventory.ts) is for solo
 * play signed out, and comes over to an account once, capped.
 *
 * The copy here lets solo pages read the collection without waiting (and once fetched, offline).
 * It is refreshed after sign-in and after anything that changes it, and removed at sign-out
 * (src/lib/storage-backend.ts). It holds card ids and the balance, nothing else of the account.
 */
import * as api from './api-client';
import { ECONOMY } from './economy-rules';

const KEY = 'inspired-mile-account-cards';
const MODE_KEY = 'inspired-mile-storage-mode';
const USER_KEY = 'inspired-mile-user';
/** Fired on window whenever the copy changes; pages that draw the collection redraw. */
export const ACCOUNT_CARDS_EVENT = 'im-account-cards';

export interface AccountCard {
  cardId: string;
  source: string;
  acquiredAt: number;
  /** On sale in the market (locked). */
  listed: boolean;
}

export interface AccountCopy {
  userId: string;
  cards: AccountCard[];
  starter: string[];
  credits: number;
  starterClaimed: boolean;
  /** When the next daily pack can be claimed (ms), or 0 when it can now. */
  nextDailyAt: number;
  fetchedAt: number;
}

function read<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** The signed-in account's id, as this browser last knew it; null when signed out. */
export function signedInUserId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    if (localStorage.getItem(MODE_KEY) !== 'server') return null;
  } catch {
    return null;
  }
  return read<{ id?: string }>(USER_KEY)?.id ?? null;
}

/** Whether the collection is the account's (signed in) rather than this device's own. */
export function usingAccountCards(): boolean {
  return signedInUserId() !== null;
}

/** The copy of the signed-in account's cards, if it has been fetched on this device. */
export function accountCopy(): AccountCopy | null {
  const user = signedInUserId();
  const copy = read<AccountCopy>(KEY);
  return user && copy && copy.userId === user ? copy : null;
}

function write(copy: AccountCopy): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(copy));
  } catch { /* quota: the next refresh tries again */ }
  window.dispatchEvent(new CustomEvent(ACCOUNT_CARDS_EVENT, { detail: copy }));
}

/** Fetch the account's cards and balance again. Null when signed out or unreachable. */
export async function refreshAccountCards(): Promise<AccountCopy | null> {
  const userId = signedInUserId();
  if (!userId) return null;
  try {
    const [rows, status] = await Promise.all([api.getInventory(), api.getInventoryStatus()]);
    const copy: AccountCopy = {
      userId,
      cards: rows.map((r) => ({ cardId: r.card_id, source: r.source, acquiredAt: Date.parse(r.acquired_at) || 0, listed: r.listed })),
      starter: status.starter_characters,
      credits: status.credits,
      starterClaimed: status.starter_claimed,
      nextDailyAt: status.next_daily_at ? Date.parse(status.next_daily_at) : 0,
      fetchedAt: Date.now(),
    };
    if (signedInUserId() !== userId) return null; // signed out meanwhile
    write(copy);
    return copy;
  } catch {
    return null;
  }
}

/** Set the balance the server just answered with. */
export function setAccountCredits(credits: number): void {
  const copy = accountCopy();
  if (copy) write({ ...copy, credits });
}

/** Forget the copy (sign-out). */
export function forgetAccountCards(): void {
  try {
    localStorage.removeItem(KEY);
  } catch { /* nothing to forget */ }
}

/**
 * The account's cards that can be listed for sale: held, not listed, not a starter character, and
 * not brought over from a device (those stay with the account that brought them while
 * `import.sellable` is false: docs/ECONOMY.md). The server checks all of it again.
 */
export function sellableCardIds(): string[] {
  const copy = accountCopy();
  if (!copy) return [];
  return sellable(copy.cards);
}

/** `sellableCardIds` of these rows (exported for its test). */
export function sellable(cards: AccountCard[]): string[] {
  return [...new Set(cards.filter((c) => !c.listed && (ECONOMY.import.sellable || c.source !== 'import')).map((c) => c.cardId))];
}
