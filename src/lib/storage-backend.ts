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

export type StorageMode = 'local' | 'server';

const MODE_KEY = 'inspired-mile-storage-mode';
const USER_KEY = 'inspired-mile-user';

let currentMode: StorageMode = 'local';
let currentUser: UserResponse | null = null;

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
      return;
    } catch {
      // Session expired or server down — fall back to local
      currentMode = 'local';
      currentUser = null;
      localStorage.removeItem(MODE_KEY);
      localStorage.removeItem(USER_KEY);
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
}

/**
 * Switch back to local mode after logout.
 */
export function deactivateServerMode(): void {
  currentMode = 'local';
  currentUser = null;
  localStorage.removeItem(MODE_KEY);
  localStorage.removeItem(USER_KEY);
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
