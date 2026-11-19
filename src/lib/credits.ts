/**
 * Credits and season XP from solo play, as the server pays them.
 *
 * Solo play happens in the browser, where the server cannot see it: the page reports what
 * happened (a source: a solo duel won, a trivia round, a quote challenge, the daily bonus) and
 * the server pays that source's fixed amount, at most so many times a day
 * (backend/data/economy.json). The page never names an amount, and nothing is earned signed out
 * or offline: solo play then keeps to this device's own collection (src/lib/inventory.ts).
 *
 * Credits are spent only on what the server sells at its own price: packs
 * (`buyPack` in api-client.ts) and market listings.
 */
import { earnCredits } from './api-client';
import { accountCopy, setAccountCredits, signedInUserId } from './account-cards';
import { addXP } from './seasons';
import type { SoloSource } from './economy-rules';

export interface Earned {
  /** Credits added now: 0 once today's cap for the source is reached. */
  granted: number;
  /** The balance after it. */
  credits: number;
}

/** Report a solo activity. Null when signed out; throws (ApiError, TypeError) when the server refuses or cannot be reached. */
export async function earnSolo(source: SoloSource): Promise<Earned | null> {
  if (!signedInUserId()) return null;
  const answer = await earnCredits(source);
  setAccountCredits(answer.credits);
  // Season XP for the same activity, within its own cap. Nothing when no season runs.
  void addXP(source);
  return { granted: answer.granted, credits: answer.credits };
}

/** The account's balance as last fetched on this device; null when signed out or not fetched yet. */
export function creditBalance(): number | null {
  return accountCopy()?.credits ?? null;
}

const DAILY_KEY = 'inspired-mile-daily-bonus';

/**
 * The daily bonus, asked for at most once a day per device (the server pays it once a day per
 * account whatever the device says).
 */
export async function claimDailyBonus(): Promise<Earned | null> {
  const user = signedInUserId();
  if (!user) return null;
  const today = `${user}:${new Date().toISOString().slice(0, 10)}`;
  try {
    if (localStorage.getItem(DAILY_KEY) === today) return null;
  } catch { /* ask anyway */ }
  const earned = await earnSolo('daily').catch(() => null);
  if (earned) {
    try {
      localStorage.setItem(DAILY_KEY, today);
    } catch { /* asked again next time; the server pays once */ }
  }
  return earned;
}
