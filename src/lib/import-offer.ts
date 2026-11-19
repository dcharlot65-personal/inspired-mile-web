/**
 * When a device offers its own collection to an account (the sign-in banner in BaseLayout.astro).
 *
 * The server takes an import once per account, capped, whatever a page does
 * (backend/src/migration/handlers.rs; docs/ECONOMY.md). What one device's storage could bring to
 * many accounts is held by the caps and by imported cards never being sold. The page adds its own
 * rule so that an honest player is asked once, not on every sign-in: once a device's cards have
 * gone to an account it does not offer them to any account again, and an account that chose to
 * skip is not asked again on that device (second check of 2026-11-19: the banner came back on every
 * sign-in, and every account signed in on one device was offered the same cards).
 */

const MOVED_KEY = 'inspired-mile-collection-moved';
const SKIPPED_KEY = 'inspired-mile-import-skipped';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function skipped(): string[] {
  try {
    const list = JSON.parse(read(SKIPPED_KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Whether to offer this device's cards to this account now. */
export function offerImport(userId: string | null | undefined, deviceCards: number): boolean {
  if (!userId || deviceCards === 0) return false;
  return read(MOVED_KEY) === null && !skipped().includes(userId);
}

/** The device's cards went to this account. */
export function importDone(userId: string | null | undefined): void {
  try {
    localStorage.setItem(MOVED_KEY, JSON.stringify({ to: userId ?? null, at: Date.now() }));
  } catch { /* storage refused: the server still takes an import once per account */ }
}

/** This account chose not to take the device's cards. */
export function importSkipped(userId: string | null | undefined): void {
  if (!userId) return;
  try {
    localStorage.setItem(SKIPPED_KEY, JSON.stringify([...new Set([...skipped(), userId])]));
  } catch { /* asked again next time */ }
}
