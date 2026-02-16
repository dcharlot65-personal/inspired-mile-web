/**
 * Credits — Client-side in-game currency API.
 * Communicates with the /api/v1/credits backend.
 */

import { getStorageMode } from './storage-backend';

const STORAGE_KEY = 'inspired-mile-credits';
const API_BASE = import.meta.env.PUBLIC_API_URL || 'http://localhost:3847';

/** Get current credit balance (local or server) */
export function getCredits(): number {
  if (typeof window === 'undefined') return 0;
  try {
    return parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
  } catch {
    return 0;
  }
}

/** Set local credit balance */
function setLocalCredits(amount: number): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, String(amount));
  } catch { /* quota */ }
}

/** Earn credits from a game activity */
export async function earnCredits(source: string, amount?: number): Promise<number> {
  // Default amounts for local mode
  const defaults: Record<string, number> = {
    battle_win: 50,
    trivia: 30,
    challenge: 20,
    daily: 10,
  };
  const earned = amount ?? defaults[source] ?? 10;

  if (getStorageMode() === 'server') {
    try {
      const token = localStorage.getItem('inspired-mile-token');
      const res = await fetch(`${API_BASE}/api/v1/credits/earn`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ source, amount: earned }),
      });
      if (res.ok) {
        const data = await res.json();
        setLocalCredits(data.credits);
        return data.credits;
      }
    } catch { /* fall through to local */ }
  }

  const current = getCredits() + earned;
  setLocalCredits(current);
  return current;
}

/** Spend credits */
export async function spendCredits(amount: number, reason: string): Promise<{ success: boolean; balance: number }> {
  const current = getCredits();
  if (current < amount) return { success: false, balance: current };

  if (getStorageMode() === 'server') {
    try {
      const token = localStorage.getItem('inspired-mile-token');
      const res = await fetch(`${API_BASE}/api/v1/credits/spend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ amount, reason }),
      });
      if (res.ok) {
        const data = await res.json();
        setLocalCredits(data.credits);
        return { success: true, balance: data.credits };
      }
      return { success: false, balance: current };
    } catch { /* fall through to local */ }
  }

  const newBalance = current - amount;
  setLocalCredits(newBalance);
  return { success: true, balance: newBalance };
}

/** Sync credit balance from server */
export async function syncCredits(): Promise<number> {
  if (getStorageMode() !== 'server') return getCredits();
  try {
    const token = localStorage.getItem('inspired-mile-token');
    const res = await fetch(`${API_BASE}/api/v1/credits`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setLocalCredits(data.credits);
      return data.credits;
    }
  } catch { /* ignore */ }
  return getCredits();
}
