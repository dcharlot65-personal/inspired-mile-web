/**
 * The duel: a three-round match of verses.
 *
 * Each round is fought under a FORM drawn for that round. The opponent opens:
 * the player sees the form, the opponent's character, any curse it has cast,
 * and its verse. The player then chooses a character (each can be played once
 * per match), may spend ink on a relic or a potion, and answers.
 *
 * A verse scores  craft + judge (+ the world card's bonus, for the player):
 *   craft = (form points + power-word bonus) × multiplier − curse penalties
 *   judge = this side's share of JUDGE_POOL, from comparing the two verses
 *
 * A verse that is empty, too thin to be a verse (text.ts `substance`) or taken
 * from the other side's verse (text.ts `copyOf`) is void: it lands nothing and
 * its craft is 0. A player's copied verse also forfeits the judge.
 *
 * Form points scale with the share of the verse that is words of its language
 * (FormScore.scale), and the multiplier's bonuses with what the verse says
 * beyond the words that land its device and signature (VerseScore.substance),
 * so tokens laid out in a form's shape, or a chant that is only its device,
 * cannot multiply themselves into a winning score.
 *
 * Everything in this file is pure and seeded: the same seed, deck and verses
 * always produce the same plan and the same scores. No randomness is applied
 * after a verse is written. (A verse written by a model is sampled, so a match
 * against a model is not reproducible from its seed; one against the written
 * opponent is.)
 */
import { CARD_CATALOG, getCardById, type Card } from '../cards';
import {
  CURSES,
  CURSE_PENALTY,
  CURSE_PENALTY_CAP,
  POTION_CURSE,
  POWER_WORD_BONUS,
  checkPowerWords,
  checkSignature,
  deviceInPlay,
  invocationNames,
  type DeviceResult,
} from './devices';
import { formsFor, scoreForm, type Form, type FormContext, type FormScore } from './forms';
import { getPack } from './packs';
import { rhymeEnds, rhymes } from './rhyme';
import { cleanVerse, copyOf, linesOf, ownContent, wordsOf, type CopyMeasure } from './text';

export const ROUNDS = 3;
export const START_INK = 2;
export const INK_PER_ROUND = 1;
export const RELIC_COST = 1;
export const POTION_COST = 1;
/** Points the judge shares between the two verses each round. */
export const JUDGE_POOL = 24;
/**
 * A verse is a copy, not an answer (isCopy), when either
 *   - it carries the other verse's lines over, each into a line of its own (text.ts copyOf
 *     `carry`, every word counted): every line of COPY_LINE_WORDS words or more but one (all of
 *     them in a couplet) has COPY_LINE_SHARE of its words said in its order by a line of the verse
 *     that keeps its rhyme: it ends on the same word, or on a word that rhymes with it (a copy that
 *     swaps each line's rhyme word for another rhyme keeps the form and is still the other's verse:
 *     the third check's blocker). Or, when the verse has no line of its own beyond the other's
 *     (no more lines than it), COPY_LINE_NEAR of each line's words in order, whatever the line ends
 *     on (each line's last word swapped for any other, in a form that asks no rhyme), or
 *     COPY_LINE_SHARE of every one of its lines, none left out (the last word and one more swapped in
 *     every line of a haiku), or COPY_LINE_ANY of every one in any order (its inner words moved about),
 *     with one of their content words at least (a verse that keeps only the other's little words is
 *     its own).
 *     Words dropped
 *     from each line, a few put in, neighbours swapped and the lines moved however the form allows
 *     leave this whole; an answer throws words back into one line or two, and its little words
 *     seldom fall in the other's order. Only for a verse of COPY_LINE_SOURCE words or more: in a
 *     shorter one a line of three words is two thrown words and a little one. Or
 *   - it takes more than three of the other side's content words in order (COPY_MIN_TAKEN: the
 *     Riposte asks for two or three thrown back) and they are at least COPY_THRESHOLD of its own
 *     content words (it adds little), or at least COPY_COVERAGE_ALONE of the other verse's content
 *     words however laid out, or COPY_COVERAGE of them with two or more in each of two lines or
 *     more (it carries the other verse over, whatever it adds: words put into every line leave all
 *     of the other's in place), or
 *   - it says COPY_ANY_ORDER_MIN or more of the other verse's content words in any order, and
 *     COPY_COVERAGE_ALONE of them, and COPY_THRESHOLD of all its words, the little ones too (its
 *     lines shuffled word by word; a Riposte's thrown words and one more said by chance leave the
 *     other's little words behind), or COPY_COVERAGE_ALONE of all the words of a verse of
 *     COPY_LINE_SOURCE words or more, in any order, or
 *   - it has no content word of its own and COPY_THRESHOLD of all its words, three or more, are the
 *     other's in order (the other verse with words deleted).
 * Set from measurement (review.test.ts, review3.test.ts, finding 24): see
 * docs/language/RULES-MEASUREMENTS.md for the copies and the honest pairs and answers on either side
 * of each threshold, in every language.
 */
export const COPY_THRESHOLD = 0.7;
export const COPY_COVERAGE = 0.85;
export const COPY_COVERAGE_ALONE = 0.9;
export const COPY_MIN_TAKEN = 4;
/** Content words said in any order that a shuffled copy must carry: more than a Riposte's three. */
export const COPY_ANY_ORDER_MIN = 4;
/** Words a line of the other verse needs before the line rule counts it (shorter lines are a word or two). */
export const COPY_LINE_WORDS = 3;
/** Share of a line's words, its last among them, that a line of the verse says in order when it carries that line over. */
export const COPY_LINE_SHARE = 0.6;
/** Words the other verse needs before the line rule applies at all. */
export const COPY_LINE_SOURCE = 7;
/**
 * Share of a line's words a line of the verse says in order when it carries that line over with
 * its last word changed for one that does not rhyme; counted only for a verse with no line of its
 * own beyond the other's. (0.6 with that condition voided three honest Ripostes of the packs; at
 * 0.67 none, measured in review3.test.ts.)
 */
export const COPY_LINE_NEAR = 0.67;
/**
 * Share of a line's words, in any order, that the line of the verse carrying it says, in every line
 * of a verse with no line of its own beyond the other's: the line's inner words cut in two halves that
 * change places, and its last word swapped (the engine check's "half" family, which kept under 0.6 of
 * a line of seven in order). Measured in review4.test.ts against every honest set.
 */
export const COPY_LINE_ANY = 0.8;
/**
 * Content words of its own, beyond those that land its device and signature, that a verse
 * needs per line its form asks for before its multiplier's bonuses apply in full (scoreVerse).
 * Measured in review.test.ts (finding 25) against the bank's honest verses.
 */
export const OWN_WORDS_PER_LINE = 1.5;

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

/** A world (city) card: bonus points each round the judge gives the player its criterion. */
export interface WorldCard {
  /** The city, as shown. */
  label: string;
  /** One of the judge's criteria (judge.ts CRITERIA). */
  criterion: string;
  bonus: number;
}

export interface Duel {
  /** The seed as the rules use it (see `normalizeSeed`). */
  seed: number;
  lang: string;
  player: DuelDeck;
  opponent: DuelDeck;
  rounds: RoundPlan[];
  /** What each of the player's potions would cast, fixed at the start so it can be shown. */
  playerCurses: Record<string, CastCurse>;
  playerRelics: Record<string, LentWords>;
  /** The player's world card, when one is equipped. */
  worldCard?: WorldCard;
}

export interface PlayerMove {
  charId: string;
  relicId?: string;
  potionId?: string;
}

export interface VerseScore {
  form: FormScore;
  /** The device by id; its name and brief are the messages `device.<id>.name` and DEVICES[id].brief(lang). */
  device: DeviceResult & { id: string };
  signature: DeviceResult;
  synergy: boolean;
  multiplier: number;
  powerWords?: { used: string[]; met: boolean; bonus: number };
  /** The curse by id; its name is the message `curse.<id>.name`. */
  curse?: { id: string; violations: number; penalty: number };
  /**
   * How far the multiplier's bonuses apply, from 0 to 1: the verse's own content words beyond
   * those that land its device and signature, one a line the form asks for (text.ts ownContent).
   */
  substance: number;
  craft: number;
  /**
   * Set when the verse earns nothing: it is empty, too thin to be a verse, or
   * copied from the other side. Shown as the message `void.<reason>`.
   */
  voided?: 'empty' | 'thin' | 'copied';
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
  /** The judge's split as scored: a copied verse forfeits its share, whatever the judge said. */
  judge: JudgeSplit;
  /** The world card's bonus this round: `points` is 0 when the player did not take its criterion. */
  bonus?: { label: string; criterion: string; points: number };
  /** craft + judge (+ bonus for the player). */
  playerTotal: number;
  opponentTotal: number;
  winner: 'player' | 'opponent';
}

// --- Seeded randomness ---

/**
 * The seed the rules actually use: a whole number from 0 to 2^32 - 1. A fraction
 * is dropped and anything larger wraps, so 0.5 and 0.7 are both 0 and
 * 4294967297 is 1. Front ends show this number, not the one typed.
 */
export function normalizeSeed(seed: number): number {
  return Number.isFinite(seed) ? Math.trunc(seed) >>> 0 : 0;
}

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

function castFor(r: () => number, potionId: string, lang: string): CastCurse {
  const curseId = POTION_CURSE[potionId] ?? 'no-repeats';
  return { potionId, curseId, param: curseId === 'forbidden-letter' ? pick(r, getPack(lang).forbidden) : '' };
}

function wordsFor(relicId: string, lang: string): LentWords {
  return { relicId, words: getPack(lang).relics[relicId] ?? [] };
}

/**
 * Characters the opponent is never dealt. SM-001 is The Sonnet Man, the stage name of a real
 * person, Devon Glover: with a model loaded, the opponent's prompt would read "You are The Sonnet
 * Man…" and a model would write as him. Until he agrees, the opponent does not play his card at all,
 * with or without a model (owner decision D-04, 2026-11-19, docs/dossier/28-owner-decisions.md on
 * docs/dossier). A player may still hold and play it: only the house's draw leaves it out.
 */
export const NEVER_THE_OPPONENT: readonly string[] = ['SM-001'];

/**
 * A deck for the house: three characters, one relic, one potion, drawn by seed.
 *
 * The whole catalogue is still shuffled and the first three characters the opponent may play are
 * taken, so the draw uses the seed exactly as it did before NEVER_THE_OPPONENT: a seed that never
 * dealt SM-001 deals the same deck as before (and the same relic and potion), and one that did deals
 * the next character of its shuffle in its place.
 */
export function opponentDeck(seed: number): DuelDeck {
  const r = rng(seed ^ 0x9e3779b9);
  const chars = shuffled(r, CARD_CATALOG.filter((c) => c.type === 'Character'))
    .filter((c) => !NEVER_THE_OPPONENT.includes(c.id))
    .slice(0, ROUNDS);
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

/**
 * Plan a duel. The language's pack must be loaded first (loadPack in ./packs);
 * English always is.
 */
export function createDuel(seedGiven: number, lang: string, player: DuelDeck, opponent?: DuelDeck, worldCard?: WorldCard): Duel {
  if (player.characters.length < ROUNDS) throw new Error(`A deck needs at least ${ROUNDS} characters to duel`);
  const seed = normalizeSeed(seedGiven);
  opponent ??= opponentDeck(seed);
  const r = rng(seed);
  const forms = shuffled(r, formsFor(lang)).slice(0, ROUNDS);
  const oppChars = shuffled(r, opponent.characters).slice(0, ROUNDS);
  // The opponent spends its potion and its relic in different rounds, never the first:
  // round one is a clean read of the form for both sides.
  const curseRound = opponent.potions.length ? 1 + Math.floor(r() * (ROUNDS - 1)) : -1;
  const relicRound = opponent.relics.length ? (curseRound === 1 ? 2 : 1) : -1;
  const acrostics = getPack(lang).acrostic;

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

  return { seed, lang, player, opponent, rounds, playerCurses, playerRelics, ...(worldCard ? { worldCard } : {}) };
}

// --- Ink and legal moves ---

export function inkAt(roundIndex: number, spentBefore: number): number {
  return START_INK + INK_PER_ROUND * roundIndex - spentBefore;
}

export function moveCost(move: PlayerMove): number {
  return (move.relicId ? RELIC_COST : 0) + (move.potionId ? POTION_COST : 0);
}

/** Why a move cannot be played. Each is the message `illegal.<code>`. */
export type IllegalMove =
  | 'character-not-in-deck'
  | 'character-used'
  | 'relic-not-in-deck'
  | 'potion-not-in-deck'
  | 'relic-spent'
  | 'potion-spent'
  | 'potion-last-round'
  | 'no-ink';

/** Why a move cannot be played, or null when it can. */
export function illegalMove(duel: Duel, roundIndex: number, move: PlayerMove, earlier: PlayerMove[]): IllegalMove | null {
  if (!duel.player.characters.includes(move.charId)) return 'character-not-in-deck';
  if (earlier.some((m) => m.charId === move.charId)) return 'character-used';
  if (move.relicId && !duel.player.relics.includes(move.relicId)) return 'relic-not-in-deck';
  if (move.potionId && !duel.player.potions.includes(move.potionId)) return 'potion-not-in-deck';
  if (move.relicId && earlier.some((m) => m.relicId === move.relicId)) return 'relic-spent';
  if (move.potionId && earlier.some((m) => m.potionId === move.potionId)) return 'potion-spent';
  // A potion curses the opponent's NEXT verse; in the last round there is none.
  if (move.potionId && roundIndex >= ROUNDS - 1) return 'potion-last-round';
  const spent = earlier.reduce((s, m) => s + moveCost(m), 0);
  if (moveCost(move) > inkAt(roundIndex, spent)) return 'no-ink';
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
  /**
   * The verse this one answers: the Riposte is checked against it, and a verse
   * copied from it is void. Absent for a verse that opens the duel.
   */
  opponentVerse?: string;
  /** Curse this verse was written under. */
  curse?: CastCurse;
  /** Power words this side paid for. */
  lent?: LentWords;
  /**
   * The verse was chosen by the game itself (the opponent's, written or model):
   * it is not tested for being a copy of the verse it answers. A model's draft
   * that parrots the player is weeded out when it is written (opponent.ts). If
   * the test ran again at scoring, a player could void the written opponent by
   * typing its next verse, which the seed makes knowable, a round early.
   */
  trusted?: boolean;
}

const CHARACTER_NAMES = invocationNames(CARD_CATALOG.filter((c) => c.type === 'Character').map((c) => c.name));

/** A line of the copy measure (text.ts CopyMeasure `carry`) and its index among the source's lines. */
type CarriedLine = CopyMeasure['carry'][number];

/**
 * Does `c` carry the other verse's lines over, each into a line of its own (see COPY_LINE_SHARE)?
 * `rhymed` says whether the verse line matched to source line `i` keeps its rhyme: by default only
 * when it says the source line's last word (all the measure alone can tell); isCopy also asks
 * whether the two lines rhyme.
 */
export function carriesLines(c: CopyMeasure, rhymed: (l: CarriedLine, i: number) => boolean = (l) => l.end): boolean {
  const words = c.carry.reduce((n, l) => n + l.source, 0);
  const counted = c.carry.map((l, i) => [l, i] as const).filter(([l]) => l.source >= COPY_LINE_WORDS);
  if (counted.length < 2 || words < COPY_LINE_SOURCE) return false;
  const need = counted.length >= 3 ? counted.length - 1 : counted.length;
  const kept = (l: CarriedLine, i: number) => l.said >= 2 && l.said >= Math.ceil(COPY_LINE_SHARE * l.source) && rhymed(l, i);
  if (counted.filter(([l, i]) => kept(l, i)).length >= need) return true;
  // Nothing of its own beyond the other's lines: each line nearly whole, whatever it now ends on;
  // or every one of them carried over, a word or two of each changed or moved (a haiku or a crescendo
  // with each line's last word and one more swapped, a word dropped and one put in, or the inner
  // words cut in halves that change places: the engine check's copy residue, review4.test.ts).
  if (c.verseLines > c.carry.length) return false;
  if (counted.filter(([l, i]) => kept(l, i) || (l.said >= 2 && l.said >= Math.ceil(COPY_LINE_NEAR * l.source))).length >= need) return true;
  // Every one of them, none left out: COPY_LINE_SHARE of it in order, or COPY_LINE_ANY of it in any
  // order (its inner words moved about), whatever it now ends on; and one of their content words at
  // least (where they have any). A verse that keeps only the other's little words in place, every word
  // that means something changed, answers it in its own frame: counting little words alone, this
  // voided such verses (the engine check's second round: es 112 of 238, de 56, pt 70). Asking a content
  // word of every line, or of half of them, freed more copies whose lines' only content word is the
  // last, swapped, or was dropped (review5.test.ts; RULES-MEASUREMENTS.md, "Engine pass, third round").
  if (!counted.every(([l]) => l.said >= 2 && (l.said >= Math.ceil(COPY_LINE_SHARE * l.source) || l.any >= Math.ceil(COPY_LINE_ANY * l.source)))) return false;
  return counted.every(([l]) => l.content === 0) || counted.some(([l]) => l.contentSaid >= 1);
}

/** Is `verse` a copy of `answered` (see COPY_THRESHOLD)? */
export function isCopy(verse: string, answered: string, lang: string): boolean {
  if (!answered) return false;
  const c = copyOf(verse, answered, lang);
  const theirs = linesOf(answered);
  const mine = linesOf(verse);
  // A line keeps its rhyme when it ends on the source line's word or on one that rhymes with it.
  const rhymed = (l: CarriedLine, i: number) => {
    if (l.end) return true;
    if (l.line < 0 || !theirs[i] || !mine[l.line]) return false;
    const [a, b] = rhymeEnds(theirs[i], mine[l.line], lang);
    return rhymes(a, b, lang);
  };
  if (carriesLines(c, rhymed)) return true;
  // Every word counted, the little ones too: asked only when the content words leave it open.
  let all: CopyMeasure | undefined;
  const allWords = () => (all ??= copyOf(verse, answered, lang, { all: true }));
  // Nothing of its own: every content word is the other's, and so are nearly all its little words
  // (a short verse with words deleted, or two of the other's words said with "so" between them).
  if (c.own === 0 && allWords().taken >= 3 && allWords().share >= COPY_THRESHOLD) return true;
  // Said in any order, as often as the source says them, and most of the source's little words with them
  // (a Riposte's thrown words and one more said by chance leave the little words behind); or nearly
  // every word of a verse of COPY_LINE_SOURCE words or more, the little ones too, in any order (where
  // a shuffle leaves too few content words to count: a Chinese line cut into single characters).
  if (Math.round(c.anyOrder * c.source) >= COPY_ANY_ORDER_MIN && c.anyOrder >= COPY_COVERAGE_ALONE && allWords().anyOrder >= COPY_THRESHOLD) return true;
  if (allWords().source >= COPY_LINE_SOURCE && allWords().anyOrder >= COPY_COVERAGE_ALONE) return true;
  if (c.taken < COPY_MIN_TAKEN) return false;
  const spread = c.perLine.filter((n) => n >= 2).length >= 2;
  return c.share >= COPY_THRESHOLD || c.coverage >= COPY_COVERAGE_ALONE || (spread && c.coverage >= COPY_COVERAGE);
}

/** Why a verse earns nothing, or undefined when it is a verse of the writer's own. */
function voidReason(verse: string, form: FormScore, lang: string, answered: string): VerseScore['voided'] {
  if (!verse || !wordsOf(verse, lang).length) return 'empty';
  if (form.thin) return 'thin';
  if (isCopy(verse, answered, lang)) return 'copied';
  return undefined;
}

export function scoreVerse(input: ScoreInput): VerseScore {
  const verse = cleanVerse(input.verse);
  // A curse reads the verse as typed: a word that mixes alphabets is itself the trick (text.ts wordsAsRead).
  const typed = cleanVerse(input.verse, { unmix: false });
  const form = scoreForm(input.form, verse, input.ctx);
  const lang = input.ctx.lang;
  const answered = input.opponentVerse ? cleanVerse(input.opponentVerse) : '';
  const voided = voidReason(verse, form, lang, input.trusted ? '' : answered);
  // A Riposte house with nothing to answer is held to its opening device instead.
  const dev = deviceInPlay(input.card.house, lang, !!answered);
  // A void verse lands nothing: devices and signatures are for verses.
  const landed = (r: DeviceResult): DeviceResult => (voided ? { met: false, detail: '', ...(r.code ? { code: 'void' } : {}) } : r);
  const device = { id: dev.id, ...landed(dev.check(verse, { lang, opponentVerse: answered || undefined, names: CHARACTER_NAMES })) };
  const signature = landed(checkSignature(input.card, verse, lang));

  const sameHouse = input.deckCharacters.filter((id) => getCardById(id)?.house === input.card.house).length;
  const synergy = device.met && sameHouse >= 2;
  // A multiplier multiplies what the verse says: its own content words beyond those that land the
  // device and the signature, one a line the form asks for. "Dare / Dare me / Dare me, who dares" is
  // its device and its signature and nothing else, so it multiplies nothing.
  const used = [...(device.met ? device.words ?? [] : []), ...(signature.met ? signature.words ?? [] : [])];
  const substance = voided ? 0 : Math.min(1, ownContent(verse, lang, used) / (OWN_WORDS_PER_LINE * Math.max(1, input.form.lines(input.ctx))));
  const bonus = (device.met ? 0.5 : 0) + (signature.met ? 0.5 : 0) + (synergy ? 0.25 : 0);
  const multiplier = 1 + Math.round(bonus * substance * 100) / 100;

  let power: VerseScore['powerWords'];
  if (input.lent) {
    const p = checkPowerWords(input.lent.words, verse, lang);
    power = { ...p, bonus: p.met && !voided ? POWER_WORD_BONUS : 0 };
  }

  let curse: VerseScore['curse'];
  if (input.curse) {
    const c = CURSES[input.curse.curseId];
    const violations = c.violations(typed, input.curse.param, lang);
    curse = { id: c.id, violations, penalty: Math.min(CURSE_PENALTY_CAP, violations * CURSE_PENALTY) };
  }

  // A void verse earns nothing, whatever the cards say.
  const base = voided ? 0 : form.earned + (power?.bonus ?? 0);
  const craft = Math.max(0, Math.round(base * multiplier) - (curse?.penalty ?? 0));
  return { form, device, signature, synergy, multiplier, powerWords: power, curse, substance, craft, ...(voided ? { voided } : {}) };
}

/** The judge's split when a verse is a copy: every criterion goes to the other side. */
function forfeit(judge: JudgeSplit, to: 'player' | 'opponent'): JudgeSplit {
  const criteria: JudgeSplit['criteria'] = {};
  for (const c of Object.keys(judge.criteria)) criteria[c] = to;
  return { ...judge, player: to === 'player' ? JUDGE_POOL : 0, opponent: to === 'opponent' ? JUDGE_POOL : 0, criteria, reason: 'copied' };
}

export function resolveRound(
  duel: Duel,
  roundIndex: number,
  move: PlayerMove,
  playerVerseRaw: string,
  opponentVerseRaw: string,
  judgeGiven: JudgeSplit,
  previousPlayerVerse?: string,
): RoundResult {
  const plan = duel.rounds[roundIndex];
  const form = formsFor(duel.lang).find((f) => f.id === plan.formId)!;
  const playerVerse = cleanVerse(playerVerseRaw);
  const opponentVerse = cleanVerse(opponentVerseRaw);

  const player = scoreVerse({
    // As typed, so a curse can see a word that mixes alphabets; scoreVerse cleans it.
    verse: playerVerseRaw,
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
    trusted: true,
  });

  // A copy forfeits the judge as well as its craft. (Only the player's verse is tested: see ScoreInput.trusted.)
  const judge = player.voided === 'copied' ? forfeit(judgeGiven, 'opponent') : judgeGiven;

  // The world card: bonus points when the judge gives the player its criterion. Applied here and nowhere else.
  const card = duel.worldCard;
  const bonus = card ? { label: card.label, criterion: card.criterion, points: judge.criteria[card.criterion] === 'player' && !player.voided ? card.bonus : 0 } : undefined;

  const playerTotal = player.craft + judge.player + (bonus?.points ?? 0);
  const opponentTotal = opponent.craft + judge.opponent;
  // Ties go to the judge's preference, then to the challenger.
  const winner: RoundResult['winner'] =
    playerTotal !== opponentTotal ? (playerTotal > opponentTotal ? 'player' : 'opponent') : judge.opponent > judge.player ? 'opponent' : 'player';

  return { index: roundIndex, playerVerse, opponentVerse, player, opponent, judge, ...(bonus ? { bonus } : {}), playerTotal, opponentTotal, winner };
}

export function matchWinner(results: RoundResult[]): 'player' | 'opponent' | null {
  const p = results.filter((r) => r.winner === 'player').length;
  const o = results.length - p;
  const need = Math.floor(ROUNDS / 2) + 1;
  if (p >= need) return 'player';
  if (o >= need) return 'opponent';
  return null;
}
