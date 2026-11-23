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
  /** 'adult', 'teen' or 'unknown'. The market and referrals are shown only to an adult account
   *  (src/lib/adults-only.ts); the server refuses every other one whatever a page shows. Absent
   *  from a copy stored before 2026-11-19. */
  age_tier?: string;
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

/**
 * Signed in: start proving again, with a passkey of this account, that its owner is here.
 * The server asks for this (403 `reauth_required`) before a passkey is added or removed or
 * an email is added, when the last proof is more than a few minutes old.
 */
export async function passkeyVerifyBegin(): Promise<CeremonyStart> {
  return request('/auth/passkey/verify/begin', { method: 'POST' });
}

export async function passkeyVerifyFinish(challengeId: string, credential: unknown): Promise<{ ok: boolean; fresh_for_seconds: number }> {
  return request('/auth/passkey/verify/finish', {
    method: 'POST',
    body: JSON.stringify({ challenge_id: challengeId, credential }),
  });
}

export async function listPasskeys(): Promise<PasskeyInfo[]> {
  return request('/auth/passkeys');
}

export async function deletePasskey(id: string): Promise<void> {
  await request(`/auth/passkeys/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// The server only honours a sign-out that carries `Content-Type: application/json`, which
// request() always sends and a form on another site cannot.
export async function logout(): Promise<void> {
  await request('/auth/logout', { method: 'POST' });
}

/**
 * The signed-in user's own answer to the age question, opened from the account menu. The
 * only call that changes an account's age tier after it is created (rules: backend
 * src/auth/age.rs). 403 `reauth_required` asks for a passkey check first (going back to
 * adult); 403 `age_tier_locked` means the account was made for a teen and stays one.
 */
export async function setAgeTier(ageTier: EmailAgeTier): Promise<{ age_tier: string; changed: boolean }> {
  return request('/auth/age-tier', {
    method: 'POST',
    body: JSON.stringify({ age_tier: ageTier }),
  });
}

/** End every session of the account, on every device, this one included. */
export async function logoutEverywhere(): Promise<void> {
  await request('/auth/logout/all', { method: 'POST' });
}

export async function getMe(): Promise<AuthResponse> {
  return request('/auth/me');
}

// ---------------------------------------------------------------------------
// Inventory: the cards the account holds on the server
// ---------------------------------------------------------------------------
//
// Cards come only from the server (docs/ECONOMY.md): the starter characters (held by every
// account without a row), free and bought packs the server opens, season rewards, and a
// one-time capped import of a device's collection. There is no call that adds a card.

export interface ServerOwnedCard {
  id: string;
  card_id: string;
  acquired_at: string;
  source: string;
  state: string;
  /** On sale in the market: locked until the listing is cancelled. */
  listed: boolean;
}

export async function getInventory(): Promise<ServerOwnedCard[]> {
  return request('/inventory');
}

export async function getInventoryStats(): Promise<{ unique_cards: number; total_cards: number }> {
  return request('/inventory/stats');
}

export interface InventoryStatus {
  starter_claimed: boolean;
  daily_available: boolean;
  next_daily_at: string | null;
  credits: number;
  /** Held by every account without a row; they cannot be sold. */
  starter_characters: string[];
}

export async function getInventoryStatus(): Promise<InventoryStatus> {
  return request('/inventory/status');
}

export interface PackAnswer {
  cards: { id: string; card_id: string }[];
  /** The balance after it. */
  credits: number;
}

/** The free starter pack (once per account) or daily pack (once a day), opened by the server. */
export async function claimPack(kind: 'starter' | 'daily'): Promise<PackAnswer> {
  return request('/inventory/claim', { method: 'POST', body: JSON.stringify({ kind }) });
}

/** A pack of a tier, at the server's price, opened by the server. */
export async function buyPack(tier: 'standard' | 'rare' | 'epic'): Promise<PackAnswer> {
  return request('/inventory/packs', { method: 'POST', body: JSON.stringify({ tier }) });
}

// ---------------------------------------------------------------------------
// Credits and season XP for solo play
// ---------------------------------------------------------------------------

export interface EarnAnswer {
  credits: number;
  /** Credits added now: the source's fixed amount, or 0 once today's cap is reached. */
  granted: number;
  source: string;
  earned_today: number;
  per_day: number;
}

/** Report a solo activity. The server pays its fixed amount within its daily cap; the page names no amount. */
export async function earnCredits(source: string): Promise<EarnAnswer> {
  return request('/credits/earn', { method: 'POST', body: JSON.stringify({ source }) });
}

export async function getCreditBalance(): Promise<{ credits: number }> {
  return request('/credits');
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

export async function getEligibleVariants(): Promise<{ base_card_id: string }[]> {
  return request('/variants/eligible');
}

// ---------------------------------------------------------------------------
// Stats & Achievements: what the server knows, from matches it judged
// ---------------------------------------------------------------------------

export interface OnlineRecord {
  wins: number;
  losses: number;
  draws: number;
  matches: number;
  rounds: number;
  best_round: number;
}

export interface ServerPlayerStats {
  online: OnlineRecord;
  unique_cards: number;
  total_cards: number;
  packs_opened: number;
  credits: number;
}

export async function getStats(): Promise<ServerPlayerStats> {
  return request('/stats');
}

export interface ServerAchievement {
  achievement_id: string;
  unlocked_at: string;
}

/** The account achievements the server can verify (never claimed by the page). */
export async function getAchievements(): Promise<ServerAchievement[]> {
  return request('/stats/achievements');
}

// ---------------------------------------------------------------------------
// Leaderboard (public — no auth required)
// ---------------------------------------------------------------------------

/** Online matches the server judged: `battle_wins` is matches won, `total_battles` matches
 *  finished, `highest_score` the best total of one round (backend/src/stats/handlers.rs). */
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
// The one-time import of a device's collection
// ---------------------------------------------------------------------------

export interface MigrationStatus {
  migrated: boolean;
  migrated_at: string | null;
  cards_count: number | null;
  achievements_count: number | null;
  /** The most cards an import takes. */
  max_cards: number;
  /** Whether the account may still import: it has not, and it is in its first hours
   *  (economy.json `import.window_hours`). Absent from an older API. */
  open?: boolean;
  open_until?: string | null;
}

export interface ImportResult {
  imported: string[];
  left_out: number;
  max_cards: number;
}

export async function getMigrationStatus(): Promise<MigrationStatus> {
  return request('/migrate/status');
}

/** Offer the device's cards once; the server takes at most `max_cards`, the rarest first. */
export async function importCards(cardIds: string[]): Promise<ImportResult> {
  return request('/migrate/import', {
    method: 'POST',
    body: JSON.stringify({ cards: cardIds }),
  });
}
