/**
 * Tournament Client — API wrapper for tournament endpoints.
 */

import { ApiError } from './api-client';

const API_BASE = '/api/v1/tournaments';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  // The status and the body, for src/lib/api-errors.ts to turn into a code. Never shown as they are.
  if (!response.ok) throw new ApiError(response.status, await response.text());
  return response.json();
}

export interface Tournament {
  id: string;
  name: string;
  format: string;
  max_players: number;
  status: string;
  starts_at: string;
  created_at: string;
  /** Players registered. */
  player_count?: number;
}

export interface BracketMatch {
  id: string;
  round: number;
  match_order: number;
  player1_id: string | null;
  player1_name: string | null;
  player2_id: string | null;
  player2_name: string | null;
  winner_id: string | null;
  status: string;
  room_id: string | null;
  /** When the match is to have been played (once both players are known); then the server
   *  decides it (docs/ECONOMY.md, "Tournaments"). */
  play_by?: string | null;
  /** room, bye, no_show, lot or unplayed. */
  decided_by?: string | null;
}

export interface LeaderboardEntry {
  user_id: string;
  username: string;
  wins: number;
  losses: number;
  eliminated: boolean;
}

export async function listTournaments(): Promise<Tournament[]> {
  return request('');
}

export async function getTournament(id: string): Promise<Tournament> {
  return request(`/${id}`);
}

export async function registerForTournament(id: string): Promise<{ status: string }> {
  return request(`/${id}/register`, { method: 'POST' });
}

export async function getBracket(id: string): Promise<BracketMatch[]> {
  return request(`/${id}/bracket`);
}

export async function getLeaderboard(id: string): Promise<LeaderboardEntry[]> {
  return request(`/${id}/leaderboard`);
}

/**
 * The room a tournament match is played in (the same one for both players). Its result, as the
 * server judges it, decides the match: no player names a winner.
 */
export async function openMatchRoom(tournamentId: string, matchId: string): Promise<{ room_id: string }> {
  return request(`/${tournamentId}/matches/${matchId}/room`, { method: 'POST' });
}
