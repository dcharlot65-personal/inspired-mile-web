/**
 * The duel: a three-round match of verses.
 *
 * Each round is fought under a FORM drawn for that round. The opponent opens:
 * the player sees the form, the opponent's character, any curse it has cast,
 * and its verse. The player then chooses a character (each can be played once
 * per match), may spend ink on a relic or a potion, and answers.
 *
 * A verse scores  craft + judge:
 *   craft = (form points + power-word bonus) × multiplier − curse penalties
 *   judge = this side's share of JUDGE_POOL, from comparing the two verses
 *
 * Everything in this file is pure and seeded: the same seed, deck and verses
 * always produce the same match. No randomness is applied after a verse is
 * written.
 */
import { CARD_CATALOG, getCardById, type Card } from '../cards';
import {
  CURSES,
  CURSE_PENALTY,
  CURSE_PENALTY_CAP,
  FORBIDDEN_LETTERS,
  POTION_CURSE,
  POWER_WORD_BONUS,
  RELIC_WORDS,
  checkPowerWords,
  checkSignature,
  deviceForHouse,
  type DeviceResult,
} from './devices';
import { ACROSTIC_WORDS, formsFor, scoreForm, type Form, type FormContext, type FormScore } from './forms';
import { cleanVerse } from './text';

export const ROUNDS = 3;
export const START_INK = 2;
export const INK_PER_ROUND = 1;
export const RELIC_COST = 1;
export const POTION_COST = 1;
/** Points the judge shares between the two verses each round. */
export const JUDGE_POOL = 24;

export interface DuelDeck {
  characters: string[];
  relics: string[];
  potions: string[];
}

export interface CastCurse {
  potionId: string;
  curseId: string;
  /** The forbidden letter, when the curse needs one. */
  param: string;
}

export interface LentWords {
  relicId: string;
  words: string[];
}

export interface OpponentMove {
  charId: string;
  curse?: CastCurse;
  relic?: LentWords;
}

export interface RoundPlan {
  index: number;
  formId: string;
  ctx: FormContext;
  opponent: OpponentMove;
}

export interface Duel {
  seed: number;
  lang: string;
  player: DuelDeck;
  opponent: DuelDeck;
  rounds: RoundPlan[];
  /** What each of the player's potions would cast, fixed at the start so it can be shown. */
  playerCurses: Record<string, CastCurse>;
  playerRelics: Record<string, LentWords>;
}

export interface PlayerMove {
  charId: string;
  relicId?: string;
  potionId?: string;
}

export interface VerseScore {
  form: FormScore;
  device: DeviceResult & { id: string; name: string };
  signature: DeviceResult;
  synergy: boolean;
  multiplier: number;
  powerWords?: { used: string[]; met: boolean; bonus: number };
  curse?: { name: string; violations: number; penalty: number };
  craft: number;
}

export interface JudgeSplit {
  /** Points out of JUDGE_POOL for the player and for the opponent. */
  player: number;
  opponent: number;
  /** Who took each criterion: 'player', 'opponent' or 'split'. */
  criteria: Record<string, 'player' | 'opponent' | 'split'>;
  /** 'model' when a language model compared the verses, 'rules' when the built-in comparison did. */
  source: 'model' | 'rules';
  reason?: string;
}

export interface RoundResult {
  index: number;
  playerVerse: string;
  opponentVerse: string;
  player: VerseScore;
  opponent: VerseScore;
  judge: JudgeSplit;
  playerTotal: number;
  opponentTotal: number;
  winner: 'player' | 'opponent';
}

// --- Seeded randomness ---

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(r: () => number, items: T[]): T {
  return items[Math.floor(r() * items.length)];
}

function shuffled<T>(r: () => number, items: T[]): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function baseLang(lang: string): string {
  return lang.split('-')[0];
}

function castFor(r: () => number, potionId: string, lang: string): CastCurse {
  const curseId = POTION_CURSE[potionId] ?? 'no-repeats';
  const letters = FORBIDDEN_LETTERS[baseLang(lang)] ?? FORBIDDEN_LETTERS.en;
  return { potionId, curseId, param: curseId === 'forbidden-letter' ? pick(r, letters) : '' };
}

function wordsFor(relicId: string, lang: string): LentWords {
  const table = RELIC_WORDS[baseLang(lang)] ?? RELIC_WORDS.en;
  return { relicId, words: table[relicId] ?? [] };
}

/** A deck for the house: three characters, one relic, one potion, drawn by seed. */
export function opponentDeck(seed: number): DuelDeck {
  const r = rng(seed ^ 0x9e3779b9);
  const chars = shuffled(r, CARD_CATALOG.filter((c) => c.type === 'Character')).slice(0, ROUNDS);
  const relics = CARD_CATALOG.filter((c) => c.type === 'Relic');
  const potions = CARD_CATALOG.filter((c) => c.type === 'Potion');
  return { characters: chars.map((c) => c.id), relics: [pick(r, relics).id], potions: [pick(r, potions).id] };
}

/** A starter deck for a player who has not built one: enough to play a full match. */
export function starterDeck(ownedIds: Iterable<string> = []): DuelDeck {
  const owned = new Set(ownedIds);
  const byType = (t: Card['type']) => CARD_CATALOG.filter((c) => c.type === t);
  const prefer = (cards: Card[], n: number) => {
    const mine = cards.filter((c) => owned.has(c.id));
    return [...mine, ...cards.filter((c) => !owned.has(c.id))].slice(0, n).map((c) => c.id);
  };
  return { characters: prefer(byType('Character'), ROUNDS), relics: prefer(byType('Relic'), 1), potions: prefer(byType('Potion'), 1) };
}

export function createDuel(seed: number, lang: string, player: DuelDeck, opponent: DuelDeck = opponentDeck(seed)): Duel {
  if (player.characters.length < ROUNDS) throw new Error(`A deck needs at least ${ROUNDS} characters to duel`);
  const r = rng(seed);
  const forms = shuffled(r, formsFor(lang)).slice(0, ROUNDS);
  const oppChars = shuffled(r, opponent.characters).slice(0, ROUNDS);
  // The opponent spends its potion and its relic in different rounds, never the first:
  // round one is a clean read of the form for both sides.
  const curseRound = opponent.potions.length ? 1 + Math.floor(r() * (ROUNDS - 1)) : -1;
  const relicRound = opponent.relics.length ? (curseRound === 1 ? 2 : 1) : -1;
  const acrostics = ACROSTIC_WORDS[baseLang(lang)] ?? ACROSTIC_WORDS.en;

  const rounds: RoundPlan[] = forms.map((form, index) => ({
    index,
    formId: form.id,
    ctx: { lang, acrostic: form.id === 'acrostic' ? pick(r, acrostics) : undefined },
    opponent: {
      charId: oppChars[index],
      curse: index === curseRound ? castFor(r, opponent.potions[0], lang) : undefined,
      relic: index === relicRound ? wordsFor(opponent.relics[0], lang) : undefined,
    },
  }));

  const playerCurses: Record<string, CastCurse> = {};
  for (const id of player.potions) playerCurses[id] = castFor(r, id, lang);
  const playerRelics: Record<string, LentWords> = {};
  for (const id of player.relics) playerRelics[id] = wordsFor(id, lang);

  return { seed, lang, player, opponent, rounds, playerCurses, playerRelics };
}

// --- Ink and legal moves ---

export function inkAt(roundIndex: number, spentBefore: number): number {
  return START_INK + INK_PER_ROUND * roundIndex - spentBefore;
}

export function moveCost(move: PlayerMove): number {
  return (move.relicId ? RELIC_COST : 0) + (move.potionId ? POTION_COST : 0);
}

/** Why a move cannot be played, or null when it can. */
export function illegalMove(duel: Duel, roundIndex: number, move: PlayerMove, earlier: PlayerMove[]): string | null {
  if (!duel.player.characters.includes(move.charId)) return 'That character is not in your deck.';
  if (earlier.some((m) => m.charId === move.charId)) return 'Each character can take the stage once per match.';
  if (move.relicId && !duel.player.relics.includes(move.relicId)) return 'That relic is not in your deck.';
  if (move.potionId && !duel.player.potions.includes(move.potionId)) return 'That potion is not in your deck.';
  if (move.relicId && earlier.some((m) => m.relicId === move.relicId)) return 'That relic is spent.';
  if (move.potionId && earlier.some((m) => m.potionId === move.potionId)) return 'That potion is spent.';
  const spent = earlier.reduce((s, m) => s + moveCost(m), 0);
  if (moveCost(move) > inkAt(roundIndex, spent)) return 'Not enough ink.';
  return null;
}

// --- Scoring ---

export interface ScoreInput {
  verse: string;
  form: Form;
  ctx: FormContext;
  card: Card;
  /** The other characters in this side's deck, for house synergy. */
  deckCharacters: string[];
  opponentVerse?: string;
  /** Curse this verse was written under. */
  curse?: CastCurse;
  /** Power words this side paid for. */
  lent?: LentWords;
}

const CHARACTER_NAMES = CARD_CATALOG.filter((c) => c.type === 'Character').flatMap((c) => c.name.replace(/^The /, '').split(/\s+/));

export function scoreVerse(input: ScoreInput): VerseScore {
  const verse = cleanVerse(input.verse);
  const form = scoreForm(input.form, verse, input.ctx);
  const dev = deviceForHouse(input.card.house);
  const device = { id: dev.id, name: dev.name, ...dev.check(verse, { opponentVerse: input.opponentVerse, names: CHARACTER_NAMES }) };
  const signature = checkSignature(input.card, verse);

  const sameHouse = input.deckCharacters.filter((id) => getCardById(id)?.house === input.card.house).length;
  const synergy = device.met && sameHouse >= 2;
  const multiplier = 1 + (device.met ? 0.5 : 0) + (signature.met ? 0.5 : 0) + (synergy ? 0.25 : 0);

  let power: VerseScore['powerWords'];
  if (input.lent) {
    const p = checkPowerWords(input.lent.words, verse);
    power = { ...p, bonus: p.met ? POWER_WORD_BONUS : 0 };
  }

  let curse: VerseScore['curse'];
  if (input.curse) {
    const c = CURSES[input.curse.curseId];
    const violations = c.violations(verse, input.curse.param);
    curse = { name: c.name, violations, penalty: Math.min(CURSE_PENALTY_CAP, violations * CURSE_PENALTY) };
  }

  // An empty verse earns nothing, whatever the cards say.
  const base = verse ? form.earned + (power?.bonus ?? 0) : 0;
  const craft = Math.max(0, Math.round(base * multiplier) - (curse?.penalty ?? 0));
  return { form, device, signature, synergy, multiplier, powerWords: power, curse, craft };
}

export function resolveRound(
  duel: Duel,
  roundIndex: number,
  move: PlayerMove,
  playerVerseRaw: string,
  opponentVerseRaw: string,
  judge: JudgeSplit,
  previousPlayerVerse?: string,
): RoundResult {
  const plan = duel.rounds[roundIndex];
  const form = formsFor(duel.lang).find((f) => f.id === plan.formId)!;
  const playerVerse = cleanVerse(playerVerseRaw);
  const opponentVerse = cleanVerse(opponentVerseRaw);

  const player = scoreVerse({
    verse: playerVerse,
    form,
    ctx: plan.ctx,
    card: getCardById(move.charId)!,
    deckCharacters: duel.player.characters,
    // The opponent opens each round, so the player can answer what was just said.
    opponentVerse,
    curse: plan.opponent.curse,
    lent: move.relicId ? duel.playerRelics[move.relicId] : undefined,
  });
  const opponent = scoreVerse({
    verse: opponentVerse,
    form,
    ctx: plan.ctx,
    card: getCardById(plan.opponent.charId)!,
    deckCharacters: duel.opponent.characters,
    opponentVerse: previousPlayerVerse,
    curse: move.potionId ? duel.playerCurses[move.potionId] : undefined,
    lent: plan.opponent.relic,
  });

  const playerTotal = player.craft + judge.player;
  const opponentTotal = opponent.craft + judge.opponent;
  // Ties go to the judge's preference, then to the challenger.
  const winner: RoundResult['winner'] =
    playerTotal !== opponentTotal ? (playerTotal > opponentTotal ? 'player' : 'opponent') : judge.opponent > judge.player ? 'opponent' : 'player';

  return { index: roundIndex, playerVerse, opponentVerse, player, opponent, judge, playerTotal, opponentTotal, winner };
}

export function matchWinner(results: RoundResult[]): 'player' | 'opponent' | null {
  const p = results.filter((r) => r.winner === 'player').length;
  const o = results.length - p;
  const need = Math.floor(ROUNDS / 2) + 1;
  if (p >= need) return 'player';
  if (o >= need) return 'opponent';
  return null;
}
