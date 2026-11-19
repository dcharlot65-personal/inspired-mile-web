/**
 * Storage Backend — Abstracts local/server storage for dual-mode play.
 *
 * Default: 'local' (V1 behavior, localStorage-only)
 * When logged in: 'server' (API calls via api-client.ts)
 *
 * Anonymous localStorage play always works. Backend is progressive enhancement.
 */

import * as api from './api-client';
import type { UserResponse } from './api-client';
import { forgetUserCaches } from './pwa';
import { forgetAccountCards, refreshAccountCards } from './account-cards';

export type StorageMode = 'local' | 'server';

const MODE_KEY = 'inspired-mile-storage-mode';
const USER_KEY = 'inspired-mile-user';

let currentMode: StorageMode = 'local';
let currentUser: UserResponse | null = null;

/** Fired on window when the signed-in account changes (signed in, out, or its age tier). */
export const ACCOUNT_CHANGED_EVENT = 'im-account-changed';
function announce(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(ACCOUNT_CHANGED_EVENT));
}

// ---------------------------------------------------------------------------
// Mode Management
// ---------------------------------------------------------------------------

export function getStorageMode(): StorageMode {
  return currentMode;
}

export function isLoggedIn(): boolean {
  return currentMode === 'server' && currentUser !== null;
}

export function getCurrentUser(): UserResponse | null {
  return currentUser;
}

/**
 * Initialize storage backend on page load.
 * Checks for existing session by calling /auth/me.
 */
export async function initStorageBackend(): Promise<void> {
  // Check if we had a previous session
  const savedMode = localStorage.getItem(MODE_KEY);
  if (savedMode === 'server') {
    try {
      const { user } = await api.getMe();
      currentMode = 'server';
      currentUser = user;
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      void refreshAccountCards();
      announce();
      return;
    } catch {
      // Session expired or server down — fall back to local
      currentMode = 'local';
      currentUser = null;
      localStorage.removeItem(MODE_KEY);
      localStorage.removeItem(USER_KEY);
      forgetAccountCards();
      announce();
    }
  }
  currentMode = 'local';
}

/**
 * Switch to server mode after login/register.
 */
export function activateServerMode(user: UserResponse): void {
  currentMode = 'server';
  currentUser = user;
  localStorage.setItem(MODE_KEY, 'server');
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  // Signed in, the collection is the account's (src/lib/account-cards.ts).
  void refreshAccountCards();
  announce();
}

/** The account's age tier changed (its owner answered the age question). */
export function setCurrentUserAgeTier(ageTier: string): void {
  if (!currentUser) return;
  currentUser = { ...currentUser, age_tier: ageTier };
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
  } catch { /* the next /auth/me writes it */ }
  announce();
}

/**
 * Switch back to local mode after logout.
 */
export function deactivateServerMode(): void {
  currentMode = 'local';
  currentUser = null;
  localStorage.removeItem(MODE_KEY);
  localStorage.removeItem(USER_KEY);
  forgetAccountCards();
  announce();
}

// ---------------------------------------------------------------------------
// Auth Convenience Methods
// ---------------------------------------------------------------------------

// Signing in lives in ./passwordless.ts (passkeys and email codes); it calls
// activateServerMode() once the server has set the session cookie.

export async function logoutUser(): Promise<void> {
  try {
    await api.logout();
  } catch {
    // Ignore — clear local state regardless
  }
  deactivateServerMode();
  // Nothing of the account may stay in the service worker's caches (src/lib/pwa.ts).
  await forgetUserCaches();
}
