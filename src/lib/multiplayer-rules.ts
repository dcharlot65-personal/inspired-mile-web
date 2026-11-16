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
 * How an online round differs from the single-player duel in duel.ts:
 *   - both players write at once, under the same form, without seeing the
 *     other's verse; so the riposte answers the opponent's verse from the
 *     PREVIOUS round (in round one there is nothing to answer yet);
 *   - no relics, potions or ink in this first version;
 *   - the judge share is always the rule-based comparison (rulesJudge): no
 *     language model takes part;
 *   - neither side is "the challenger", so a dead-level round is a draw.
 */
import { CARD_CATALOG, getCardById } from './cards';
import { ROUNDS, rng, scoreVerse, type VerseScore } from './verse/duel';
import { ACROSTIC_WORDS, formsFor, getForm } from './verse/forms';
import { CRITERIA, rulesJudge } from './verse/judge';
import { cleanVerse, contentWords, fold, wordsOf } from './verse/text';

/** The one language online play is scored in, for now. */
export const ONLINE_LANG = 'en';
export const ONLINE_DECK_MIN = 3;
export const ONLINE_DECK_MAX = 5;

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
  const words = ACROSTIC_WORDS[ONLINE_LANG];
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
    for (const c of CARD_CATALOG) {
      for (const w of wordsOf(c.name)) if ([...w].length >= 4) lexicon.add(fold(w));
      for (const w of contentWords(c.quote)) lexicon.add(fold(w));
    }
  }
  return lexicon;
}

export interface OnlineSide {
  charId: string;
  /** Every character in this side's deck, for house synergy. */
  deck: string[];
  verse: string;
  /** The other side's verse from the round before, which a riposte may answer. */
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

export type OnlineVerdict = 'a' | 'b' | 'split';

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
  const judge = rulesJudge(verseA, verseB, ONLINE_LANG, onlineLexicon());
  const criteria: Record<string, OnlineVerdict> = {};
  for (const c of CRITERIA) criteria[c] = judge.criteria[c] === 'player' ? 'a' : judge.criteria[c] === 'opponent' ? 'b' : 'split';
  const totalA = scoreA.craft + judge.player;
  const totalB = scoreB.craft + judge.opponent;
  // The better total takes the round; level totals go to the judge's preference; level on both is a draw.
  const winner = totalA !== totalB ? (totalA > totalB ? 'a' : 'b') : judge.player !== judge.opponent ? (judge.player > judge.opponent ? 'a' : 'b') : 'draw';
  return {
    a: { verse: verseA, score: scoreA, judge: judge.player, total: totalA },
    b: { verse: verseB, score: scoreB, judge: judge.opponent, total: totalB },
    criteria,
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
