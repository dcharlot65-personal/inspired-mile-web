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

  return response.json();
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`API ${status}: ${body}`);
    this.name = 'ApiError';
  }
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface UserResponse {
  id: string;
  username: string;
  email: string;
  display_name: string | null;
}

export interface AuthResponse {
  user: UserResponse;
}

export async function register(username: string, email: string, password: string, displayName?: string): Promise<AuthResponse> {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password, display_name: displayName }),
  });
}

export async function login(username: string, password: string): Promise<AuthResponse> {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
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
