/**
 * API Client — Fetch wrapper for the Inspired Mile backend.
 * All requests use credentials: 'include' for httpOnly cookie auth.
 */

const API_BASE = '/api/v1';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(response.status, text);
  }

  // Some answers have no body (logout, deleting a passkey).
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export class ApiError extends Error {
  /** Machine code from a JSON error body (`{"error": "...", "message": "..."}`), if any. */
  public code: string | null = null;
  /** The server's plain-English message from a JSON error body, if any. */
  public serverMessage: string | null = null;

  constructor(
    public status: number,
    public body: string,
  ) {
    super(`API ${status}: ${body}`);
    this.name = 'ApiError';
    try {
      const parsed = JSON.parse(body);
      if (parsed && typeof parsed.error === 'string') this.code = parsed.error;
      if (parsed && typeof parsed.message === 'string') this.serverMessage = parsed.message;
    } catch {
      // Not JSON: older routes answer in plain text.
    }
  }
}

// ---------------------------------------------------------------------------
// Auth (passkeys + email one-time code)
// ---------------------------------------------------------------------------

export interface UserResponse {
  id: string;
  username: string;
  email: string | null;
  display_name: string | null;
  auth_provider: string;
  avatar_url: string | null;
}

export interface AuthResponse {
  user: UserResponse;
  /** Passkeys on the account. 0 after an email sign-in is the cue to offer adding one. */
  passkey_count: number;
  /** Present, and true, only on the sign-in that created the account. */
  is_new_user?: boolean;
  founding_player?: boolean;
}

/** Which sign-in methods the server can serve right now. */
export interface AuthMethods {
  passkey: boolean;
  /** An account can be created with a passkey alone (no email). */
  passkey_signup: boolean;
  /** False until the server has a mail key: show email nowhere. */
  email: boolean;
}

export interface PasskeyInfo {
  id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
}

/** The start of a WebAuthn ceremony: options for the browser, and the id to finish with. */
export interface CeremonyStart {
  challenge_id: string;
  /** PublicKeyCredential{Creation,Request}Options in the WebAuthn JSON form. */
  options: Record<string, unknown>;
}

export type EmailAgeTier = 'adult' | 'teen';

export async function getAuthMethods(): Promise<AuthMethods> {
  return request('/auth/methods');
}

export async function requestEmailCode(email: string, ageTier: EmailAgeTier): Promise<{ ok: boolean; expires_in_seconds: number }> {
  return request('/auth/email/request', {
    method: 'POST',
    body: JSON.stringify({ email, age_tier: ageTier }),
  });
}

export async function verifyEmailCode(email: string, code: string): Promise<AuthResponse> {
  return request('/auth/email/verify', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
  });
}

export async function passkeyLoginBegin(): Promise<CeremonyStart> {
  return request('/auth/passkey/login/begin', { method: 'POST' });
}

export async function passkeyLoginFinish(challengeId: string, credential: unknown): Promise<AuthResponse> {
  return request('/auth/passkey/login/finish', {
    method: 'POST',
    body: JSON.stringify({ challenge_id: challengeId, credential }),
  });
}

/** Start creating an account with a passkey and nothing else. Sends only the age tier. */
export async function passkeySignupBegin(ageTier: EmailAgeTier): Promise<CeremonyStart> {
  return request('/auth/passkey/signup/begin', {
    method: 'POST',
    body: JSON.stringify({ age_tier: ageTier }),
  });
}

export async function passkeySignupFinish(challengeId: string, credential: unknown, name: string): Promise<AuthResponse> {
  return request('/auth/passkey/signup/finish', {
    method: 'POST',
    body: JSON.stringify({ challenge_id: challengeId, credential, name }),
  });
}

/** Signed in: ask for a code to prove an address before it becomes the recovery email. */
export async function addEmailRequest(email: string): Promise<{ ok: boolean; expires_in_seconds: number }> {
  return request('/auth/email/add/request', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function addEmailVerify(email: string, code: string): Promise<AuthResponse> {
  return request('/auth/email/add/verify', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
  });
}

export async function passkeyRegisterBegin(): Promise<CeremonyStart> {
  return request('/auth/passkey/register/begin', { method: 'POST' });
}

export async function passkeyRegisterFinish(challengeId: string, credential: unknown, name: string): Promise<PasskeyInfo> {
  return request('/auth/passkey/register/finish', {
    method: 'POST',
    body: JSON.stringify({ challenge_id: challengeId, credential, name }),
  });
}

export async function listPasskeys(): Promise<PasskeyInfo[]> {
  return request('/auth/passkeys');
}

export async function deletePasskey(id: string): Promise<void> {
  await request(`/auth/passkeys/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function logout(): Promise<void> {
  await request('/auth/logout', { method: 'POST' });
}

export async function getMe(): Promise<AuthResponse> {
  return request('/auth/me');
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

export interface ServerOwnedCard {
  id: string;
  card_id: string;
  acquired_at: string;
  source: string;
  state: string;
}

export async function getInventory(): Promise<ServerOwnedCard[]> {
  return request('/inventory');
}

export async function addCard(cardId: string, source: string): Promise<ServerOwnedCard> {
  return request('/inventory/add', {
    method: 'POST',
    body: JSON.stringify({ card_id: cardId, source }),
  });
}

export async function getInventoryStats(): Promise<{ unique_cards: number; total_cards: number }> {
  return request('/inventory/stats');
}

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

export interface ServerOwnedVariant {
  id: string;
  variant_id: string;
  base_card_id: string;
  acquired_at: string;
  source: string;
}

export async function getVariants(): Promise<ServerOwnedVariant[]> {
  return request('/variants');
}

export async function unlockVariant(variantId: string, baseCardId: string, source: string): Promise<ServerOwnedVariant> {
  return request('/variants/unlock', {
    method: 'POST',
    body: JSON.stringify({ variant_id: variantId, base_card_id: baseCardId, source }),
  });
}

export async function getEligibleVariants(): Promise<{ base_card_id: string }[]> {
  return request('/variants/eligible');
}

// ---------------------------------------------------------------------------
// Stats & Achievements
// ---------------------------------------------------------------------------

export interface ServerPlayerStats {
  battle_wins: number;
  total_battles: number;
  total_rounds: number;
  highest_score: number;
  trivia_correct: number;
  trivia_perfect: number;
  challenges_completed: number;
  unique_cards: number;
  total_cards: number;
  packs_opened: number;
  variants_unlocked: number;
  unique_cities: number;
}

export async function getStats(): Promise<ServerPlayerStats> {
  return request('/stats');
}

export async function updateStats(partial: Partial<ServerPlayerStats>): Promise<ServerPlayerStats> {
  return request('/stats', {
    method: 'POST',
    body: JSON.stringify(partial),
  });
}

export interface ServerAchievement {
  achievement_id: string;
  unlocked_at: string;
}

export async function getAchievements(): Promise<ServerAchievement[]> {
  return request('/stats/achievements');
}

export async function checkAchievements(achievementIds: string[]): Promise<string[]> {
  return request('/stats/achievements', {
    method: 'POST',
    body: JSON.stringify({ achievement_ids: achievementIds }),
  });
}

// ---------------------------------------------------------------------------
// Leaderboard (public — no auth required)
// ---------------------------------------------------------------------------

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  avatar_url: string | null;
  battle_wins: number;
  total_battles: number;
  highest_score: number;
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  return request('/stats/leaderboard');
}

// ---------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------

export interface MigrationStatus {
  migrated: boolean;
  migrated_at: string | null;
  cards_count: number | null;
  achievements_count: number | null;
}

export interface MigrationPayload {
  cards: { card_id: string; acquired_at: number | null; source: string }[];
  stats: {
    battle_wins: number;
    total_battles: number;
    total_rounds: number;
    highest_score: number;
    trivia_correct: number;
    trivia_perfect: number;
    challenges_completed: number;
    unique_cards: number;
    total_cards: number;
    packs_opened: number;
  };
  achievements: string[];
  variants?: { variant_id: string; base_card_id: string; acquired_at: number | null; source: string }[];
}

export interface MigrationResult {
  cards_synced: number;
  achievements_synced: number;
  variants_synced: number;
}

export async function getMigrationStatus(): Promise<MigrationStatus> {
  return request('/migrate/status');
}

export async function syncMigration(payload: MigrationPayload): Promise<MigrationResult> {
  return request('/migrate/sync', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
