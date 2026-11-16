/**
 * A duel in progress: the state and the order of play, with no screen attached.
 *
 * A front end (the flat battle page, the 3D theatre) creates a session, shows
 * what `view()` returns, and calls the methods below as the player acts. The
 * session writes the opponent's verse, checks moves, asks the referee and keeps
 * the score, so every front end plays by exactly the same rules.
 */
import { getCardById } from '../cards';
import { brainInfo, generate, isBrainLoaded } from '../brain';
import {
  ROUNDS, createDuel, illegalMove, inkAt, matchWinner, moveCost, resolveRound, scoreVerse,
  type CastCurse, type Duel, type DuelDeck, type IllegalMove, type PlayerMove, type RoundResult, type VerseScore,
} from './duel';
import { getForm } from './forms';
import { writeOpponentVerse, type Difficulty } from './opponent';
import { referee } from './referee';
import { cleanVerse } from './text';

export type Phase = 'opponent-writing' | 'player-turn' | 'judging' | 'verdict' | 'finished';

/** Why a verse cannot be submitted yet. Each is the message `blocked.<code>`. */
export type Blocked = 'not-your-turn' | 'choose-character' | 'write-verse' | IllegalMove;

export interface SessionOptions {
  seed: number;
  lang: string;
  deck: DuelDeck;
  difficulty: Difficulty;
  /** Use the loaded model to write and judge. False plays the written opponent with rule judging. */
  useModel: boolean;
  /** Called whenever something a screen shows has changed. */
  onChange?: () => void;
}

export class DuelSession {
  readonly duel: Duel;
  phase: Phase = 'opponent-writing';
  roundIndex = 0;
  move: PlayerMove = { charId: '' };
  verse = '';
  opponentVerse = '';
  opponentSource: 'model' | 'written' = 'written';
  /** "Draft 1 of 2" while the opponent composes. */
  drafting: { draft: number; of: number } | null = null;
  readonly moves: PlayerMove[] = [];
  readonly results: RoundResult[] = [];
  winner: 'player' | 'opponent' | null = null;
  /** A potion played last round, binding the opponent's verse this round. */
  private carried?: CastCurse;

  /** The language's pack must be loaded first (loadPack in ./packs); English always is. */
  constructor(private readonly opts: SessionOptions) {
    this.duel = createDuel(opts.seed, opts.lang, opts.deck);
  }

  private changed() {
    this.opts.onChange?.();
  }

  get plan() {
    return this.duel.rounds[this.roundIndex];
  }
  get form() {
    return getForm(this.plan.formId);
  }
  get opponentCard() {
    return getCardById(this.plan.opponent.charId)!;
  }
  /** Ink left after what is already chosen this round. */
  get ink(): number {
    return inkAt(this.roundIndex, this.moves.reduce((n, m) => n + moveCost(m), 0)) - moveCost(this.move);
  }
  get playerRounds(): number {
    return this.results.filter((r) => r.winner === 'player').length;
  }
  get opponentRounds(): number {
    return this.results.length - this.playerRounds;
  }
  characterUsed(id: string): boolean {
    return this.moves.some((m) => m.charId === id);
  }
  itemUsed(id: string): boolean {
    return this.moves.some((m) => m.relicId === id || m.potionId === id);
  }

  /** The opponent opens the round. Resolves when its verse is on the table. */
  async beginRound(): Promise<void> {
    this.phase = 'opponent-writing';
    this.move = { charId: '' };
    this.verse = '';
    this.opponentVerse = '';
    this.drafting = null;
    this.changed();
    const canWrite = this.opts.useModel && isBrainLoaded() && !!brainInfo()?.writes;
    const written = await writeOpponentVerse({
      duel: this.duel,
      roundIndex: this.roundIndex,
      curse: this.carried,
      previousPlayerVerse: this.results.at(-1)?.playerVerse,
      difficulty: this.opts.difficulty,
      generate: canWrite ? (m, o) => generate(m, { maxTokens: o.maxTokens, temperature: o.temperature }) : undefined,
      onDraft: (draft, of) => {
        this.drafting = { draft, of };
        this.changed();
      },
    });
    this.opponentVerse = written.verse;
    this.opponentSource = written.source;
    this.drafting = null;
    this.phase = 'player-turn';
    this.changed();
  }

  chooseCharacter(id: string): boolean {
    if (this.phase !== 'player-turn' || this.characterUsed(id) || !this.duel.player.characters.includes(id)) return false;
    this.move.charId = id;
    this.changed();
    return true;
  }

  /** Put a relic or potion on the table, or take it back. */
  toggleItem(id: string): boolean {
    if (this.phase !== 'player-turn' || this.itemUsed(id)) return false;
    const relic = this.duel.player.relics.includes(id);
    const potion = this.duel.player.potions.includes(id);
    if (!relic && !potion) return false;
    const key = relic ? 'relicId' : 'potionId';
    if (this.move[key] === id) this.move[key] = undefined;
    else {
      const swap = this.move[key] ? 0 : 1;
      if (this.ink < swap) return false;
      this.move[key] = id;
    }
    this.changed();
    return true;
  }

  setVerse(text: string) {
    this.verse = text;
    this.changed();
  }

  /** How the verse being written would score for craft, or null before a character is chosen. */
  preview(): VerseScore | null {
    if (!this.move.charId) return null;
    return scoreVerse({
      verse: this.verse,
      form: this.form,
      ctx: this.plan.ctx,
      card: getCardById(this.move.charId)!,
      deckCharacters: this.duel.player.characters,
      opponentVerse: this.opponentVerse,
      curse: this.plan.opponent.curse,
      lent: this.move.relicId ? this.duel.playerRelics[this.move.relicId] : undefined,
    });
  }

  /** Why the verse cannot be submitted yet, or null when it can. */
  blocked(): Blocked | null {
    if (this.phase !== 'player-turn') return 'not-your-turn';
    if (!this.move.charId) return 'choose-character';
    if (!cleanVerse(this.verse)) return 'write-verse';
    return illegalMove(this.duel, this.roundIndex, this.move, this.moves);
  }

  async submit(): Promise<RoundResult | null> {
    if (this.blocked()) return null;
    this.phase = 'judging';
    this.changed();
    const playerVerse = cleanVerse(this.verse);
    const judge = this.opts.useModel
      ? await referee(playerVerse, this.opponentVerse, this.duel.lang)
      : (await import('./judge')).rulesJudge(playerVerse, this.opponentVerse, this.duel.lang, (await import('./referee')).allusionLexicon());

    // The opponent's verse this round was written under the curse carried in, if any.
    const carried = this.carried;
    const duel = carried ? { ...this.duel, playerCurses: { ...this.duel.playerCurses, __carried: carried } } : this.duel;
    const result = resolveRound(duel, this.roundIndex, { ...this.move, potionId: carried ? '__carried' : undefined }, playerVerse, this.opponentVerse, judge, this.results.at(-1)?.playerVerse);

    this.results.push(result);
    this.moves.push({ ...this.move });
    this.carried = this.move.potionId ? this.duel.playerCurses[this.move.potionId] : undefined;
    this.winner = matchWinner(this.results) ?? (this.results.length >= ROUNDS ? (this.playerRounds > this.opponentRounds ? 'player' : 'opponent') : null);
    this.phase = 'verdict';
    this.changed();
    return result;
  }

  /** After a verdict: the next round, or the end of the match. */
  async next(): Promise<void> {
    if (this.phase !== 'verdict') return;
    if (this.winner) {
      this.phase = 'finished';
      this.changed();
      return;
    }
    this.roundIndex++;
    await this.beginRound();
  }
}
