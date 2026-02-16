/**
 * Multiplayer Client — WebSocket connection to the multiplayer battle server.
 * Typed event emitter for client ↔ server communication.
 */

import type { BattleAxis } from './battle-rules';

export interface AxisScores {
  wordplay: number;
  shakespeare: number;
  flow: number;
  wit: number;
  total: number;
}

// Server → Client events
export type ServerEvent =
  | { type: 'room_joined'; room_id: string; opponent: string; round: number; total_rounds: number }
  | { type: 'round_start'; round: number; total_rounds: number }
  | { type: 'opponent_submitted' }
  | { type: 'round_result'; round: number; player_score: AxisScores; opponent_score: AxisScores; player_wins: boolean; reason: string }
  | { type: 'match_complete'; winner: string; player_total: number; opponent_total: number }
  | { type: 'opponent_disconnected' }
  | { type: 'error'; message: string };

// Client → Server events
export type ClientEvent =
  | { type: 'join_room'; room_id: string }
  | { type: 'submit_verse'; text: string }
  | { type: 'use_item'; item_id: string }
  | { type: 'forfeit' };

type EventHandler = (event: ServerEvent) => void;

export class MultiplayerClient {
  private ws: WebSocket | null = null;
  private handlers: EventHandler[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;

  constructor(private baseUrl: string) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = this.baseUrl.replace(/^http/, 'ws') + '/api/v1/multiplayer/ws';
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const data: ServerEvent = JSON.parse(event.data);
          this.handlers.forEach(h => h(data));
        } catch {
          // Ignore malformed messages
        }
      };

      this.ws.onerror = () => reject(new Error('WebSocket connection failed'));

      this.ws.onclose = () => {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          setTimeout(() => this.connect(), 2000 * this.reconnectAttempts);
        }
      };
    });
  }

  send(event: ClientEvent): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event));
    }
  }

  joinRoom(roomId: string): void {
    this.send({ type: 'join_room', room_id: roomId });
  }

  submitVerse(text: string): void {
    this.send({ type: 'submit_verse', text });
  }

  useItem(itemId: string): void {
    this.send({ type: 'use_item', item_id: itemId });
  }

  forfeit(): void {
    this.send({ type: 'forfeit' });
  }

  onEvent(handler: EventHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter(h => h !== handler);
    };
  }

  disconnect(): void {
    this.maxReconnectAttempts = 0; // Prevent reconnection
    this.ws?.close();
    this.ws = null;
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

/** Join the matchmaking queue via REST API */
export async function joinQueue(): Promise<{ room_id: string | null; status: string }> {
  const response = await fetch('/api/v1/multiplayer/queue', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) throw new Error('Failed to join queue');
  return response.json();
}

/** Get list of active rooms */
export async function listRooms(): Promise<{ id: string; state: string; player_count: number }[]> {
  const response = await fetch('/api/v1/multiplayer/rooms', {
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Failed to list rooms');
  return response.json();
}

/** Report inappropriate content from a multiplayer session */
export async function reportContent(roomId: string, reason: string): Promise<{ status: string }> {
  const response = await fetch('/api/v1/multiplayer/report', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ room_id: roomId, reason }),
  });
  if (!response.ok) throw new Error('Failed to submit report');
  return response.json();
}
