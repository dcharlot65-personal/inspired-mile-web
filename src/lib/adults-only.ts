/**
 * The market and referrals are for adult accounts only (owner, 2026-11-19; docs/ECONOMY.md).
 *
 * The server refuses every other account (backend/src/auth/age.rs `is_adult`, used by the market
 * and referral routes); this only decides what the pages show. Signed in, it is the account's own
 * tier as the server last said it (`/auth/me`, kept in `inspired-mile-user`); signed out, the age
 * gate's answer on this device. A teen account, an account whose age is unknown, a copy of the
 * account stored before the tier was sent, and a visitor the gate took for a teen or blocked are
 * not shown them.
 */

const MODE_KEY = 'inspired-mile-storage-mode';
const USER_KEY = 'inspired-mile-user';
const GATE_KEY = 'inspired-mile-age-verified';

/** What decides it, read from this device's storage (exported for its test). */
export function adultsOnlyAllowed(stored: { mode: string | null; user: string | null; gate: string | null }): boolean {
  if (stored.mode === 'server') {
    try {
      return (JSON.parse(stored.user ?? 'null') as { age_tier?: string } | null)?.age_tier === 'adult';
    } catch {
      return false;
    }
  }
  return stored.gate === 'adult';
}

/** Whether this visitor is shown the market and referrals. */
export function adultsOnlyShown(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return adultsOnlyAllowed({
      mode: localStorage.getItem(MODE_KEY),
      user: localStorage.getItem(USER_KEY),
      gate: localStorage.getItem(GATE_KEY),
    });
  } catch {
    return false;
  }
}
