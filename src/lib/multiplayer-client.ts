/**
 * Multiplayer client: the WebSocket protocol of an online duel, and the check a page runs
 * on every round the server sends.
 *
 * The server decides every score (backend/src/multiplayer/game_room.rs, with the rules in
 * backend/src/verse/). This client sends three things only: which room to join and with
 * which deck, a verse for the round being played, and a forfeit. It never sends a score,
 * and the server has no field to receive one.
 *
 * What the browser can do is check the server: auditRound() recomputes a round from the
 * two verses with the TypeScript rules and lists every number that differs.
 */
import { onlinePlan, resolveOnlineRound, type OnlineRound, type OnlineRoundPlan } from './multiplayer-rules';
import type { VerseScore } from './verse/duel';
import { CRITERIA } from './verse/judge';

// --- What the server sends ---

export type Side = 'you' | 'opponent';
export type RoomState = 'waiting' | 'in_progress' | 'completed';
export type EndReason = 'rounds' | 'points' | 'forfeit' | 'disconnect';

/** A verse's craft as the server worked it out. Labels and details are the page's to write. */
export interface WireScore {
  form: {
    form_id: string;
    checks: Array<{ id: string; points: number; earned: number; met: boolean }>;
    earned: number;
    kept: boolean;
  };
  device: { id: string; met: boolean };
  signature: boolean;
  synergy: boolean;
  multiplier: number;
  power_words: { used: string[]; met: boolean; bonus: number } | null;
  curse: { id: string; violations: number; penalty: number } | null;
  craft: number;
}

export interface WireSide {
  char_id: string;
  /** The verse as scored: cleaned and capped. */
  verse: string;
  /** No verse arrived in time; the round was scored without one. */
  timed_out: boolean;
  score: WireScore;
  /** This side's share of the judge's pool. */
  judge: number;
  total: number;
}

export interface Pair {
  you: number;
  opponent: number;
}

export interface WirePlan {
  index: number;
  form_id: string;
  acrostic: string | null;
}

export interface WirePlayer {
  username: string;
  deck: string[];
  used: string[];
}

export interface RoundView {
  round: number;
  form_id: string;
  acrostic: string | null;
  you: WireSide;
  opponent: WireSide;
  criteria: Record<(typeof CRITERIA)[number], Side | 'split'>;
  winner: Side | 'draw';
  rounds_won: Pair;
  totals: Pair;
}

export interface MatchStart {
  room_id: string;
  /** 0 or 1. Seat 0 is side "a" of the rules. */
  seat: 0 | 1;
  seed: number;
  lang: string;
  rounds: WirePlan[];
  you: WirePlayer;
  opponent: WirePlayer;
  limits: { max_verse_chars: number; max_verse_lines: number; deck_min: number; deck_max: number; round_seconds: number };
  /** Rounds already decided, oldest first. */
  results: RoundView[];
}

export type ServerEvent =
  | { type: 'room_joined'; room_id: string; state: RoomState; opponent: string | null }
  | ({ type: 'match_start' } & MatchStart)
  | { type: 'round_start'; round: number; form_id: string; acrostic: string | null; seconds_left: number; submitted: boolean; opponent_submitted: boolean }
  | { type: 'verse_accepted'; round: number }
  | { type: 'opponent_submitted'; round: number }
  | ({ type: 'round_result' } & RoundView)
  | { type: 'match_complete'; winner: Side | 'draw'; reason: EndReason; rounds_won: Pair; totals: Pair }
  | { type: 'opponent_disconnected'; grace_seconds: number }
  | { type: 'opponent_reconnected' }
  | { type: 'error'; code: string; message: string };

// --- What the client sends. There is no score here. ---

export type ClientEvent =
  | { type: 'join_room'; room_id: string; deck: string[] }
  | { type: 'submit_verse'; round: number; char_id: string; text: string }
  | { type: 'forfeit' };

/** Connection changes a page may want to show. */
export type ConnectionState = 'open' | 'reconnecting' | 'closed';

type EventHandler = (event: ServerEvent) => void;
type StateHandler = (state: ConnectionState) => void;

/** Error codes after which the server has closed the connection for good. */
const FINAL_ERRORS = new Set(['connection_replaced', 'too_many_messages', 'join_timeout']);

export class MultiplayerClient {
  private ws: WebSocket | null = null;
  private handlers: EventHandler[] = [];
  private stateHandlers: StateHandler[] = [];
  private attempts = 0;
  private readonly maxAttempts = 5;
  /** Set once nothing more should be sent or retried: the match is over, or we left. */
  private finished = false;
  private room: { id: string; deck: string[] } | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private baseUrl: string) {}

  /** Open the connection. Resolves when it is open; rejects if the first attempt fails. */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const ws = new WebSocket(this.baseUrl.replace(/^http/, 'ws') + '/api/v1/multiplayer/ws');
      this.ws = ws;

      ws.onopen = () => {
        settled = true;
        this.attempts = 0;
        // After a dropped connection the server still holds our seat: ask for it back.
        // It answers with the whole match as it stands.
        if (this.room) this.send({ type: 'join_room', room_id: this.room.id, deck: this.room.deck });
        this.stateHandlers.forEach((h) => h('open'));
        resolve();
      };

      ws.onmessage = (message) => {
        let event: ServerEvent;
        try {
          event = JSON.parse(message.data);
        } catch {
          return; // not ours
        }
        if (event.type === 'match_complete' || (event.type === 'error' && FINAL_ERRORS.has(event.code))) this.finished = true;
        this.handlers.forEach((h) => h(event));
      };

      ws.onerror = () => {
        if (!settled) {
          settled = true;
          reject(new Error('WebSocket connection failed'));
        }
      };

      ws.onclose = () => {
        if (this.ws !== ws) return;
        this.ws = null;
        if (this.finished || !this.room || this.attempts >= this.maxAttempts) {
          this.stateHandlers.forEach((h) => h('closed'));
          return;
        }
        this.attempts += 1;
        this.stateHandlers.forEach((h) => h('reconnecting'));
        this.timer = setTimeout(() => {
          this.connect().catch(() => {
            /* onclose of that attempt schedules the next */
          });
        }, 1000 * this.attempts);
      };
    });
  }

  private send(event: ClientEvent): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(event));
    return true;
  }

  /** Take a seat in a room with a deck of three to five character ids. */
  joinRoom(roomId: string, deck: string[]): void {
    this.room = { id: roomId, deck };
    this.send({ type: 'join_room', room_id: roomId, deck });
  }

  /** Submit the verse for a round. False if the connection is not open. */
  submitVerse(round: number, charId: string, text: string): boolean {
    return this.send({ type: 'submit_verse', round, char_id: charId, text });
  }

  forfeit(): void {
    this.send({ type: 'forfeit' });
  }

  onEvent(handler: EventHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  onState(handler: StateHandler): void {
    this.stateHandlers.push(handler);
  }

  disconnect(): void {
    this.finished = true;
    if (this.timer) clearTimeout(this.timer);
    this.ws?.close();
    this.ws = null;
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// --- Checking the server ---

function sideProblems(who: string, wire: WireSide, local: { verse: string; score: VerseScore; judge: number; total: number }): string[] {
  const out: string[] = [];
  const differ = (what: string, server: unknown, here: unknown) => {
    if (server !== here) out.push(`${who} ${what}: server ${String(server)}, rules ${String(here)}`);
  };
  differ('verse', wire.verse, local.verse);
  differ('craft', wire.score.craft, local.score.craft);
  differ('form points', wire.score.form.earned, local.score.form.earned);
  differ('form kept', wire.score.form.kept, local.score.form.kept);
  differ('number of form checks', wire.score.form.checks.length, local.score.form.checks.length);
  wire.score.form.checks.forEach((c, i) => {
    const mine = local.score.form.checks[i];
    if (!mine) return;
    differ(`check ${c.id}`, `${c.id}:${c.met}:${c.earned}/${c.points}`, `${mine.id}:${mine.met}:${mine.earned}/${mine.points}`);
  });
  differ('device', `${wire.score.device.id}:${wire.score.device.met}`, `${local.score.device.id}:${local.score.device.met}`);
  differ('signature', wire.score.signature, local.score.signature.met);
  differ('synergy', wire.score.synergy, local.score.synergy);
  differ('multiplier', wire.score.multiplier, local.score.multiplier);
  differ('judge share', wire.judge, local.judge);
  differ('total', wire.total, local.total);
  return out;
}

/** The round as the TypeScript rules score it, from what the server said was played. */
export function recomputeRound(start: MatchStart, earlier: RoundView[], result: RoundView): OnlineRound {
  const plan: OnlineRoundPlan = { index: result.round, formId: result.form_id, acrostic: result.acrostic };
  // A riposte answers the other side's verse from the round before.
  const before = earlier.find((r) => r.round === result.round - 1);
  const mine = { charId: result.you.char_id, deck: start.you.deck, verse: result.you.verse, previousOpponentVerse: before?.opponent.verse };
  const theirs = { charId: result.opponent.char_id, deck: start.opponent.deck, verse: result.opponent.verse, previousOpponentVerse: before?.you.verse };
  return start.seat === 0 ? resolveOnlineRound(plan, mine, theirs) : resolveOnlineRound(plan, theirs, mine);
}

/**
 * Recompute a round with the TypeScript rules and list everything that differs from what
 * the server sent. An empty list means the server's numbers are exactly the rules'.
 */
export function auditRound(start: MatchStart, earlier: RoundView[], result: RoundView): string[] {
  const out: string[] = [];
  const planned = start.rounds[result.round];
  if (!planned || planned.form_id !== result.form_id || planned.acrostic !== result.acrostic) {
    out.push(`round ${result.round + 1} was not scored under the form the match announced`);
  }
  let local: OnlineRound;
  try {
    local = recomputeRound(start, earlier, result);
  } catch (err) {
    return [...out, `the round could not be recomputed: ${err instanceof Error ? err.message : String(err)}`];
  }
  const [mine, theirs] = start.seat === 0 ? [local.a, local.b] : [local.b, local.a];
  out.push(...sideProblems('your', result.you, mine), ...sideProblems("opponent's", result.opponent, theirs));

  const me = start.seat === 0 ? 'a' : 'b';
  const seen = (v: 'a' | 'b' | 'split' | 'draw') => (v === 'split' || v === 'draw' ? v : v === me ? 'you' : 'opponent');
  for (const c of CRITERIA) {
    if (result.criteria[c] !== seen(local.criteria[c])) out.push(`${c}: server ${result.criteria[c]}, rules ${seen(local.criteria[c])}`);
  }
  if (result.winner !== seen(local.winner)) out.push(`winner: server ${result.winner}, rules ${seen(local.winner)}`);
  return out;
}

/** Whether the three forms the server announced are the ones its seed draws. */
export function planMatchesSeed(start: MatchStart): boolean {
  const drawn = onlinePlan(start.seed);
  return (
    drawn.length === start.rounds.length &&
    drawn.every((p, i) => p.index === start.rounds[i].index && p.formId === start.rounds[i].form_id && p.acrostic === start.rounds[i].acrostic)
  );
}

// --- REST: the queue, private rooms, reports ---

async function refusal(response: Response, fallback: string): Promise<Error> {
  if (response.status === 401) return new Error('Sign in to play online.');
  const text = await response.text().catch(() => '');
  // The API answers refusals in a short plain sentence; anything else is not for the player.
  return new Error(text && text.length < 200 && !text.trimStart().startsWith('<') ? text : fallback);
}

/** Ask for a quick match. Waits up to about half a minute for another player. */
export async function joinQueue(signal?: AbortSignal): Promise<{ room_id: string | null; status: 'matched' | 'timeout' | 'cancelled' }> {
  const response = await fetch('/api/v1/multiplayer/queue', { method: 'POST', credentials: 'include', signal });
  if (!response.ok) throw await refusal(response, 'Could not join the queue.');
  return response.json();
}

/** Leave the quick-match queue. */
export async function leaveQueue(): Promise<void> {
  await fetch('/api/v1/multiplayer/queue', { method: 'DELETE', credentials: 'include' }).catch(() => undefined);
}

/** Open a private room. The token is what a friend joins with. */
export async function createPrivateRoom(): Promise<{ room_id: string; token: string }> {
  const response = await fetch('/api/v1/multiplayer/create-private', { method: 'POST', credentials: 'include' });
  if (!response.ok) throw await refusal(response, 'Could not open a room.');
  return response.json();
}

/** Check an invitation: the room exists and has a seat for this player. */
export async function checkInvitation(token: string): Promise<{ room_id: string }> {
  const response = await fetch(`/api/v1/multiplayer/join/${encodeURIComponent(token)}`, { credentials: 'include' });
  if (!response.ok) throw await refusal(response, 'That invitation is no longer open.');
  return response.json();
}

/** The rooms this player has a seat in. */
export async function listRooms(): Promise<{ id: string; state: RoomState; player_count: number }[]> {
  const response = await fetch('/api/v1/multiplayer/rooms', { credentials: 'include' });
  if (!response.ok) throw await refusal(response, 'Could not list rooms.');
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
  if (!response.ok) throw await refusal(response, 'Could not send the report.');
  return response.json();
}
