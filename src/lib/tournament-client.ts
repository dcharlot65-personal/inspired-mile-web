/**
 * Tournament Client — API wrapper for tournament endpoints.
 */

const API_BASE = '/api/v1/tournaments';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!response.ok) throw new Error(await response.text());
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
  entry_count?: number;
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
}

export interface LeaderboardEntry {
  user_id: string;
  username: string;
  wins: number;
  losses: number;
  eliminated: boolean;
}

export async function listTournaments(): Promise<Tournament[]> {
  return request('/');
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
