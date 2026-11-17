/**
 * The online duel's rules, as the browser sees them.
 *
 * Online, the SERVER decides every score (backend/src/verse/, a Rust port of
 * src/lib/verse/ that is held to it by golden vectors: see
 * src/lib/multiplayer-golden.test.ts and backend/tests/verse_parity.rs).
 * This file is the same arithmetic in TypeScript, used for two things only:
 *
 *   - the live checklist while a player writes (a preview of their craft), and
 *   - an audit after each round: the page recomputes the round from the two
 *     verses and says so if its numbers differ from the server's.
 *
 * Nothing computed here is ever sent to the server.
 *
 * English is scored by sound, from the pronunciation table (verse/pronounce.ts).
 * The server always has the table; a page must load it (loadPronunciation)
 * before it previews or audits, or its numbers are the spelling rules' and can
 * differ from the server's.
 *
 * Online duels are fought in English only (ONLINE_LANG): the server's port of the
 * engine is the English path, read from the same data as the browser (the
 * pronunciation table, the confusables, the card catalogue and the English pack).
 * The other fifteen languages are read by sound tables, a Japanese analyser and
 * the platform's word segmenter (Chinese, Thai), which the server does not have and
 * could not reproduce exactly; a server that scored them would score them differently
 * from the preview. The page says so, and the server refuses any other language.
 *
 * How an online round differs from the single-player duel in duel.ts:
 *   - both players write at once, under the same form, without seeing the
 *     other's verse. So everything that "answers" is read against the other
 *     side's verse of the round BEFORE: the Riposte, the judge's comeback (wit)
 *     and the test for a copied verse. In round one there is nothing to answer:
 *     a Riposte house is held to its opening device, as in the duel, and wit is
 *     a split (comebacks are compared only when both sides had a verse to answer);
 *   - no relics, potions or ink in this first version;
 *   - the judge share is always the rule-based comparison: no language model
 *     takes part;
 *   - neither side is "the challenger", so a dead-level round is a draw;
 *   - a copied verse forfeits the judge to the other side, whichever seat it is in.
 */
import { CARD_CATALOG, getCardById } from './cards';
import { invocationNames, signatureWords } from './verse/devices';
import { JUDGE_POOL, ROUNDS, rng, scoreVerse, starterDeck, type VerseScore } from './verse/duel';
import { formsFor, getForm } from './verse/forms';
import { CRITERIA, rulesJudge } from './verse/judge';
import { rulesFor } from './verse/lang';
import { getPack } from './verse/packs';
import { STOP_WORDS, cleanVerse, fold, isStopWord, letterCount, substance, wordSpan, wordsOf } from './verse/text';

/** The one language online play is scored in, for now. */
export const ONLINE_LANG = 'en';
export const ONLINE_DECK_MIN = 3;
export const ONLINE_DECK_MAX = 5;
/**
 * The characters every account may field online without holding them: the ones a new player's
 * starter deck gives (starterDeck with nothing owned). Any other character must be one the
 * account holds (the server's record of its cards); the server checks (handlers.rs).
 */
export const ONLINE_STARTER: readonly string[] = starterDeck([]).characters;

export interface OnlineRoundPlan {
  index: number;
  formId: string;
  /** The word an acrostic must spell; null for every other form. */
  acrostic: string | null;
}

// duel.ts keeps its shuffle and pick private, so they are repeated here. The golden test
// checks that this plan draws the same three forms as createDuel does for the same seed.
function shuffled<T>(r: () => number, items: T[]): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pick<T>(r: () => number, items: T[]): T {
  return items[Math.floor(r() * items.length)];
}

/** The three forms a seed draws, and the word for an acrostic. The server sends this; the page can check it. */
export function onlinePlan(seed: number): OnlineRoundPlan[] {
  const r = rng(seed);
  const forms = shuffled(r, formsFor(ONLINE_LANG)).slice(0, ROUNDS);
  const words = getPack(ONLINE_LANG).acrostic;
  return forms.map((f, index) => ({ index, formId: f.id, acrostic: f.id === 'acrostic' ? pick(r, words) : null }));
}

/**
 * Words that count as literary allusion for the rule-based judge. The same set as
 * allusionLexicon() in verse/referee.ts, rebuilt here because that module also loads the
 * in-browser model code, which the multiplayer page has no use for.
 */
let lexicon: Set<string> | null = null;
export function onlineLexicon(): Set<string> {
  if (!lexicon) {
    lexicon = new Set<string>();
    const names = invocationNames(CARD_CATALOG.filter((c) => c.type === 'Character').map((c) => c.name));
    for (const n of names) if (!n.includes(' ') && letterCount(n) >= 4) lexicon.add(fold(n));
    for (const c of CARD_CATALOG) {
      // A signature phrase (Viola's "not what") is not a word.
      for (const w of signatureWords(c)) if (!w.includes(' ') && letterCount(w) >= 4 && !STOP_WORDS.has(w)) lexicon.add(w);
    }
  }
  return lexicon;
}

/** Most cleaning passes settleVerse makes. */
export const SETTLE_PASSES = 8;

/** Half a surrogate pair becomes U+FFFD, as a Rust string (and JSON the server reads) holds it. */
const wellFormed = (s: string): string => (typeof s.toWellFormed === 'function' ? s.toWellFormed() : s);

/**
 * A verse as online play holds it: cleaned again and again until cleaning changes nothing
 * more (at most SETTLE_PASSES times), and well-formed.
 *
 * cleanVerse is not idempotent. It applies NFKC before it takes out invisible characters,
 * so a letter, a zero-width space and a combining accent become one composed letter only
 * on a second pass, and a syllable count can change with it; a cut at the length limit can
 * leave a space that a second pass trims. The server cleans what it receives, and scoring
 * cleans again, so a preview of the verse as typed could differ from the server's score.
 * The page therefore sends and previews this text, the server applies the same steps to
 * whatever arrives (settle_verse in backend/src/verse/duel.rs), and every cleaning after it
 * changes nothing: the preview, the server and the page's audit all score the same text.
 */
export function settleVerse(text: string): string {
  let s = text;
  for (let i = 0; i < SETTLE_PASSES; i++) {
    const next = wellFormed(cleanVerse(s));
    if (next === s) return s;
    s = next;
  }
  return s;
}

export interface OnlineSide {
  charId: string;
  /** Every character in this side's deck, for house synergy. */
  deck: string[];
  verse: string;
  /**
   * The other side's verse from the round before: what a riposte and a comeback
   * answer, and what a copied verse is copied from. Absent in round one.
   */
  previousOpponentVerse?: string;
}

/** A player's craft for a verse: exactly what the server will award for it. */
export function onlineCraft(plan: OnlineRoundPlan, side: OnlineSide): VerseScore {
  const card = getCardById(side.charId);
  if (!card) throw new Error(`Unknown card: ${side.charId}`);
  return scoreVerse({
    verse: side.verse,
    form: getForm(plan.formId),
    ctx: { lang: ONLINE_LANG, acrostic: plan.acrostic ?? undefined },
    card,
    deckCharacters: side.deck,
    opponentVerse: side.previousOpponentVerse || undefined,
  });
}

export interface OnlinePreview {
  /** The verse as typed, settled: the text the page sends and the server keeps and scores. */
  verse: string;
  /** Its craft, exactly as the server will award it. */
  score: VerseScore;
}

/**
 * What the server will make of a verse as the player typed it: the settled text (see
 * settleVerse) and its craft. The page previews this and sends this text, so the two cannot
 * part; its live checklist never shows onlineCraft of the raw text.
 */
export function previewCraft(plan: OnlineRoundPlan, side: OnlineSide): OnlinePreview {
  const verse = settleVerse(side.verse);
  return { verse, score: onlineCraft(plan, { ...side, verse }) };
}

export type OnlineVerdict = 'a' | 'b' | 'split';

export interface OnlineJudge {
  /** Points out of JUDGE_POOL for each side. */
  a: number;
  b: number;
  criteria: Record<string, OnlineVerdict>;
}

/** Most words thrown back that count (MAX_THROWN in verse/judge.ts). */
const MAX_THROWN = 3;

/**
 * The judge's comeback score for one verse: witScore in verse/judge.ts, which is
 * not exported. A copy, kept honest by a test that compares it with the engine's
 * own verdicts (multiplayer-golden.test.ts). Punctuation counts for nothing.
 */
export function onlineWit(verse: string, answered?: string): number {
  const lang = ONLINE_LANG;
  const min = rulesFor(lang).riposte;
  const theirs = new Set(wordsOf(answered ?? '', lang).filter((w) => wordSpan(w) >= min && !isStopWord(w, lang)).map(fold));
  const thrown = new Set(wordsOf(verse, lang).map(fold).filter((w) => theirs.has(w))).size;
  return Math.min(thrown, MAX_THROWN);
}

/**
 * The rule-based judge for a round written at once. Wordplay, allusion and flow
 * are the engine's own verdicts (rulesJudge). Wit, the comeback, is read for
 * each side against the other's verse of the round before, where the engine
 * reads the player's against the opponent's verse of this round, which online
 * nobody has seen; and, as in the engine, only when both sides had a verse to
 * answer (an empty one is none): otherwise neither could do what wit measures,
 * and it is a split. Text too thin to be a verse loses every criterion to a real one.
 */
export function onlineJudge(verseA: string, verseB: string, previousB?: string, previousA?: string): OnlineJudge {
  const a = cleanVerse(verseA);
  const b = cleanVerse(verseB);
  const engine = rulesJudge(a, b, ONLINE_LANG, onlineLexicon());
  const criteria: Record<string, OnlineVerdict> = {};
  for (const c of CRITERIA) criteria[c] = engine.criteria[c] === 'player' ? 'a' : engine.criteria[c] === 'opponent' ? 'b' : 'split';
  const real = [substance(a, ONLINE_LANG).ok, substance(b, ONLINE_LANG).ok];
  const both = !!previousA && !!previousB;
  const witA = both ? onlineWit(a, cleanVerse(previousB!)) : 0;
  const witB = both ? onlineWit(b, cleanVerse(previousA!)) : 0;
  criteria.wit = real[0] !== real[1] ? (real[0] ? 'a' : 'b') : Math.abs(witA - witB) < 1e-9 ? 'split' : witA > witB ? 'a' : 'b';
  const each = JUDGE_POOL / CRITERIA.length;
  let pointsA = 0;
  for (const c of CRITERIA) pointsA += criteria[c] === 'a' ? each : criteria[c] === 'split' ? each / 2 : 0;
  return { a: pointsA, b: JUDGE_POOL - pointsA, criteria };
}

/** The judge's split when one verse is a copy: every criterion goes to the other side. */
function forfeitTo(to: 'a' | 'b'): OnlineJudge {
  const criteria: Record<string, OnlineVerdict> = {};
  for (const c of CRITERIA) criteria[c] = to;
  return { a: to === 'a' ? JUDGE_POOL : 0, b: to === 'b' ? JUDGE_POOL : 0, criteria };
}

export interface OnlineSideResult {
  verse: string;
  score: VerseScore;
  /** This side's share of the judge's pool. */
  judge: number;
  total: number;
}

export interface OnlineRound {
  a: OnlineSideResult;
  b: OnlineSideResult;
  criteria: Record<string, OnlineVerdict>;
  winner: 'a' | 'b' | 'draw';
}

export function resolveOnlineRound(plan: OnlineRoundPlan, a: OnlineSide, b: OnlineSide): OnlineRound {
  const verseA = cleanVerse(a.verse);
  const verseB = cleanVerse(b.verse);
  const scoreA = onlineCraft(plan, { ...a, verse: verseA });
  const scoreB = onlineCraft(plan, { ...b, verse: verseB });
  const judged = onlineJudge(verseA, verseB, a.previousOpponentVerse, b.previousOpponentVerse);
  // A copy forfeits the judge as well as its craft. Two copies leave the judge as it found them.
  const copiedA = scoreA.voided === 'copied';
  const copiedB = scoreB.voided === 'copied';
  const judge = copiedA !== copiedB ? forfeitTo(copiedA ? 'b' : 'a') : judged;
  const totalA = scoreA.craft + judge.a;
  const totalB = scoreB.craft + judge.b;
  // The better total takes the round; level totals go to the judge's preference; level on both is a draw.
  const winner = totalA !== totalB ? (totalA > totalB ? 'a' : 'b') : judge.a !== judge.b ? (judge.a > judge.b ? 'a' : 'b') : 'draw';
  return {
    a: { verse: verseA, score: scoreA, judge: judge.a, total: totalA },
    b: { verse: verseB, score: scoreB, judge: judge.b, total: totalB },
    criteria: judge.criteria,
    winner,
  };
}

export interface OnlineRoundOutcome {
  winner: 'a' | 'b' | 'draw';
  totalA: number;
  totalB: number;
}

/**
 * Who has won the match, or null while it is still open. Two rounds win it; after the
 * last round the side with more rounds wins, then the side with more points over the
 * whole match, and a match level on both is a draw.
 */
export function onlineMatchWinner(rounds: OnlineRoundOutcome[]): 'a' | 'b' | 'draw' | null {
  const a = rounds.filter((r) => r.winner === 'a').length;
  const b = rounds.filter((r) => r.winner === 'b').length;
  const need = Math.floor(ROUNDS / 2) + 1;
  if (a >= need) return 'a';
  if (b >= need) return 'b';
  if (rounds.length < ROUNDS) return null;
  if (a !== b) return a > b ? 'a' : 'b';
  const ta = rounds.reduce((s, r) => s + r.totalA, 0);
  const tb = rounds.reduce((s, r) => s + r.totalB, 0);
  if (ta !== tb) return ta > tb ? 'a' : 'b';
  return 'draw';
}

/** Why a list of card ids cannot be an online deck, or null when it can. The server applies the same rule. */
export function onlineDeckProblem(ids: string[]): string | null {
  if (ids.length < ONLINE_DECK_MIN || ids.length > ONLINE_DECK_MAX) return `An online deck has ${ONLINE_DECK_MIN} to ${ONLINE_DECK_MAX} characters.`;
  if (new Set(ids).size !== ids.length) return 'A character can be in the deck only once.';
  for (const id of ids) if (getCardById(id)?.type !== 'Character') return `${id} is not a character card.`;
  return null;
}
