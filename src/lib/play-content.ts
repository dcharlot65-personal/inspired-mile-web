/**
 * The trivia bank and the quote challenges in the interface language.
 *
 * English is the data in trivia.ts and challenges.ts. Every other language is a
 * page area file (src/i18n/pages/trivia, src/i18n/pages/challenges), fetched here
 * on demand and read directly: a thousand quiz strings have no business in t().
 * A question keeps its place in the bank and its options keep their order, so the
 * bank's correctIndex holds in every language.
 *
 * Quote challenges exist in a language only for the lines whose published
 * translation was found (never an invented one). A language with fewer than
 * MIN_LOCAL_CHALLENGES of them plays Shakespeare's own English lines, and says so.
 */
import { locale, type Locale, type Messages } from '../i18n';
import { TRIVIA_BANK, type TriviaQuestion } from './trivia';
import { CHALLENGE_BANK, type QuoteChallenge } from './challenges';

export const MIN_LOCAL_CHALLENGES = 8;

export interface LocalChallenge extends QuoteChallenge {
  /** Index in CHALLENGE_BANK. */
  id: number;
  /** The language the line is in: the interface language, or 'en' for the original. */
  lang: Locale;
  /** Who translated the line, when it is a translation. */
  translator?: string;
}

function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const FILES = import.meta.glob<{ default: Messages }>('../i18n/pages/{trivia,challenges}/*.ts');

/** One language's own file of an area; empty if there is none or it will not load. */
async function own(name: 'trivia' | 'challenges', l: Locale): Promise<Messages> {
  const load = FILES[`../i18n/pages/${name}/${l}.ts`];
  if (!load) return {};
  try {
    return (await load()).default;
  } catch (err) {
    console.error(`[play-content] could not load ${name} in "${l}"; using English`, err);
    return {};
  }
}

/** The whole trivia bank in a language, in the bank's order. */
export function triviaBankFrom(m: Messages): TriviaQuestion[] {
  return TRIVIA_BANK.map((q, n) => ({
    ...q,
    question: m[`trivia.${n}.q`] ?? q.question,
    options: q.options.map((o, i) => m[`trivia.${n}.o${i}`] ?? o),
  }));
}

export async function localTriviaBank(l: Locale = locale()): Promise<TriviaQuestion[]> {
  if (l === 'en') return TRIVIA_BANK;
  return triviaBankFrom(await own('trivia', l));
}

/** `count` questions in the interface language, options shuffled, correctIndex following the right answer. */
export async function localRandomQuestions(count: number, l: Locale = locale()): Promise<TriviaQuestion[]> {
  const bank = await localTriviaBank(l);
  return shuffle(bank.map((q, n) => ({ q, n })))
    .slice(0, count)
    .map(({ q }) => {
      const order = shuffle(q.options.map((_, i) => i));
      return { ...q, options: order.map((i) => q.options[i]), correctIndex: order.indexOf(q.correctIndex) };
    });
}

/** The challenges a language's own file holds (not English filling in). */
export function challengesFrom(m: Messages, l: Locale): LocalChallenge[] {
  const ids = (m['challenges.ids'] ?? '').split(',').filter(Boolean).map(Number);
  const out: LocalChallenge[] = [];
  for (const id of ids) {
    const base = CHALLENGE_BANK[id];
    const full = m[`challenge.${id}.full`];
    const display = m[`challenge.${id}.display`];
    const missing = m[`challenge.${id}.missing`];
    if (!base || !full || !display || !missing) continue;
    out.push({
      id,
      lang: l,
      fullQuote: full,
      displayQuote: display,
      missingWords: missing.split('|'),
      play: m[`challenge.${id}.play`] ?? base.play,
      character: m[`challenge.${id}.character`] ?? base.character,
      difficulty: base.difficulty,
      translator: m[`challenge.${id}.translator`],
    });
  }
  return out;
}

/** A language's own challenges, without English filling in. */
export async function ownChallenges(l: Locale): Promise<LocalChallenge[]> {
  return challengesFrom(await own('challenges', l), l);
}

/** The challenges to play in a language: its own if it has enough, else the English originals. */
export async function localChallenges(l: Locale = locale()): Promise<LocalChallenge[]> {
  if (l !== 'en') {
    const mine = await ownChallenges(l);
    if (mine.length >= MIN_LOCAL_CHALLENGES) return mine;
  }
  return CHALLENGE_BANK.map((c, id) => ({ ...c, id, lang: 'en' as Locale }));
}

export async function localRandomChallenge(l: Locale = locale()): Promise<LocalChallenge> {
  const all = await localChallenges(l);
  return all[Math.floor(Math.random() * all.length)];
}

/**
 * Do the answers fill the blanks? Compared without case, surrounding spaces or
 * punctuation, and after Unicode normalisation, so that a composed and a
 * decomposed accent, or a full-width and a half-width letter, are the same answer.
 */
export function answersMatch(missing: readonly string[], answers: readonly string[], l: string = 'en'): boolean {
  if (answers.length !== missing.length) return false;
  const norm = (s: string) =>
    s
      .normalize('NFKC')
      .toLocaleLowerCase(l)
      .replace(/^[\s\p{P}]+|[\s\p{P}]+$/gu, '');
  return missing.every((w, i) => norm(answers[i] ?? '') === norm(w));
}
