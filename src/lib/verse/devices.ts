/**
 * Devices, curses and power words: what the cards do.
 *
 * - A character card carries its house's DEVICE. Land the device in your verse
 *   and your craft score is multiplied.
 * - Every character also has a SIGNATURE: echo its famous line without quoting it.
 * - A potion is a CURSE played on the opponent: a rule their verse must obey.
 * - A relic lends POWER WORDS: work them in for bonus craft.
 *
 * All of it is checked by code, so the same verse always scores the same.
 */
import type { Card, House } from '../cards';
import { contentWords, firstWord, fold, initial, lastWord, linesOf, rhymes, wordsOf } from './text';

export interface DeviceResult {
  met: boolean;
  detail: string;
}

export interface Device {
  id: string;
  name: string;
  /** What the player must do, in one short sentence. */
  brief: string;
  check: (verse: string, ctx: DeviceContext) => DeviceResult;
}

export interface DeviceContext {
  /** The opponent's most recent verse, for the riposte. */
  opponentVerse?: string;
  /** Names that count as an invocation. */
  names?: string[];
}

function d(id: string, name: string, brief: string, check: Device['check']): Device {
  return { id, name, brief, check };
}

export const DEVICES: Record<string, Device> = {
  question: d('question', 'The Question', 'Ask a question: end a line with a question mark.', (v) => {
    const hit = linesOf(v).find((l) => /[?？؟]\s*["'”’)]*$/.test(l));
    return { met: !!hit, detail: hit ? `"${hit}"` : 'no line ends in a question mark' };
  }),
  exclaim: d('exclaim', 'The Outcry', 'Cry out: end a line with an exclamation mark.', (v) => {
    const hit = linesOf(v).find((l) => /[!！]\s*["'”’)]*$/.test(l));
    return { met: !!hit, detail: hit ? `"${hit}"` : 'no line ends in an exclamation mark' };
  }),
  alliteration: d('alliteration', 'Alliteration', 'Start three words in one line with the same letter.', (v) => {
    for (const line of linesOf(v)) {
      const counts = new Map<string, number>();
      for (const w of wordsOf(line)) {
        if ([...w].length < 3) continue;
        const k = initial(w);
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
      for (const [k, n] of counts) if (n >= 3) return { met: true, detail: `${n} words on "${k}"` };
    }
    return { met: false, detail: 'no line has three words on one letter' };
  }),
  repetition: d('repetition', 'The Drumbeat', 'Repeat one strong word three times.', (v) => {
    const counts = new Map<string, number>();
    for (const w of contentWords(v)) counts.set(fold(w), (counts.get(fold(w)) ?? 0) + 1);
    for (const [w, n] of counts) if (n >= 3) return { met: true, detail: `"${w}" ×${n}` };
    return { met: false, detail: 'no word of four letters or more appears three times' };
  }),
  'internal-rhyme': d('internal-rhyme', 'Inner Rhyme', 'Rhyme two words inside a single line.', (v) => {
    for (const line of linesOf(v)) {
      const ws = wordsOf(line).filter((w) => [...w].length >= 3);
      for (let i = 0; i < ws.length; i++) {
        for (let j = i + 1; j < ws.length; j++) {
          if (rhymes(ws[i], ws[j])) return { met: true, detail: `"${ws[i]}" / "${ws[j]}"` };
        }
      }
    }
    return { met: false, detail: 'no two words in one line rhyme' };
  }),
  riposte: d('riposte', 'The Riposte', "Turn a word of five letters or more from your opponent's last verse back on them.", (v, ctx) => {
    if (!ctx.opponentVerse) return { met: false, detail: 'no opponent verse to answer yet' };
    const theirs = new Set(wordsOf(ctx.opponentVerse).filter((w) => [...w].length >= 5).map(fold));
    const hit = wordsOf(v).map(fold).find((w) => theirs.has(w));
    return { met: !!hit, detail: hit ? `threw back "${hit}"` : "none of the opponent's words reused" };
  }),
  brevity: d('brevity', 'Brevity', 'Keep every line to six words or fewer.', (v) => {
    const ls = linesOf(v);
    const longest = Math.max(0, ...ls.map((l) => wordsOf(l).length));
    return { met: ls.length > 0 && longest <= 6 && longest > 0, detail: `longest line: ${longest} words` };
  }),
  swell: d('swell', 'The Swell', 'Make your last line your longest.', (v) => {
    const counts = linesOf(v).map((l) => wordsOf(l).length);
    if (counts.length < 2) return { met: false, detail: 'needs at least two lines' };
    const last = counts[counts.length - 1];
    const met = counts.slice(0, -1).every((c) => c < last);
    return { met, detail: `${counts.join(', ')} words` };
  }),
  balance: d('balance', 'Balance', 'Give every line the same number of words.', (v) => {
    const counts = linesOf(v).map((l) => wordsOf(l).length);
    const met = counts.length >= 2 && counts.every((c) => c === counts[0] && c > 0);
    return { met, detail: `${counts.join(', ')} words` };
  }),
  ring: d('ring', 'The Ring', 'End your verse on the same word it began with.', (v) => {
    const ls = linesOf(v);
    if (!ls.length) return { met: false, detail: 'empty' };
    const a = fold(firstWord(ls[0]));
    const b = fold(lastWord(ls[ls.length - 1]));
    return { met: !!a && a === b && wordsOf(v).length > 2, detail: `"${a}" … "${b}"` };
  }),
  invocation: d('invocation', 'Invocation', 'Call on a character by name.', (v, ctx) => {
    const said = new Set(wordsOf(v).map(fold));
    const hit = (ctx.names ?? []).find((n) => said.has(fold(n)));
    return { met: !!hit, detail: hit ? `invoked ${hit}` : 'no character named' };
  }),
  grandeur: d('grandeur', 'Grandeur', 'Use two words of nine letters or more.', (v) => {
    const big = [...new Set(wordsOf(v).filter((w) => [...w.replace(/['’\-]/g, '')].length >= 9))];
    return { met: big.length >= 2, detail: big.length ? big.slice(0, 3).join(', ') : 'no long words' };
  }),
  monorhyme: d('monorhyme', 'One Rhyme', 'End every line on the same rhyme.', (v) => {
    const ends = linesOf(v).map(lastWord);
    const met = ends.length >= 2 && ends.every((w, i) => i === 0 || rhymes(ends[0], w));
    return { met, detail: ends.map((w) => `"${w}"`).join(', ') };
  }),
};

/** Which device each house fights with, and the line from the plays behind it. */
export const HOUSE_DEVICE: Record<string, { device: string; why: string }> = {
  'Danish Court': { device: 'question', why: '"To be, or not to be, that is the question."' },
  Capulet: { device: 'exclaim', why: '"O Romeo, Romeo!"' },
  Montague: { device: 'internal-rhyme', why: "Mercutio's quick tongue rhymes mid-line." },
  'Forest of Arden': { device: 'alliteration', why: '"Whereat, with blade, with bloody blameful blade."' },
  'Verona Court': { device: 'riposte', why: 'The court weighs every word said against you.' },
  'The Tempest': { device: 'swell', why: 'The storm builds until it breaks.' },
  'Scottish Court': { device: 'repetition', why: '"Tomorrow, and tomorrow, and tomorrow."' },
  Illyria: { device: 'brevity', why: '"Brevity is the soul of wit."' },
  Rome: { device: 'invocation', why: '"Friends, Romans, countrymen."' },
  Legendary: { device: 'monorhyme', why: 'The Sonnet Man rides one rhyme all the way down.' },
  'Lake District': { device: 'balance', why: 'The Romantics measured every line.' },
  'Gothic Circle': { device: 'ring', why: 'The tale ends where it began.' },
  Olympus: { device: 'grandeur', why: 'The gods speak in thunderous words.' },
  Underworld: { device: 'riposte', why: 'The dead remember everything you said.' },
};

export function deviceForHouse(house: House | string): Device {
  const entry = HOUSE_DEVICE[house];
  return DEVICES[entry?.device ?? 'question'];
}

// --- Signature: echo the card's famous line without quoting it ---

/** Words too common to count as an echo of a quotation. */
const COMMON = new Set(
  'that this with from have what when where which thou thee thy your their there these those shall will would should could been were upon into then than them they more most some such very much come here hath doth lord'.split(' '),
);

export function signatureWords(card: Card): string[] {
  return [...new Set(contentWords(card.quote).map(fold).filter((w) => !COMMON.has(w)))];
}

/**
 * The signature lands when the verse uses a telling word from the card's line
 * but does not simply recite it: four words running from the quote is a quotation.
 */
export function checkSignature(card: Card, verse: string): DeviceResult {
  const sig = signatureWords(card);
  if (!sig.length) return { met: false, detail: 'this card has no signature line' };
  const said = wordsOf(verse).map(fold);
  const echoed = sig.filter((w) => said.includes(w));
  if (!echoed.length) return { met: false, detail: `echo one of: ${sig.slice(0, 4).join(', ')}` };
  const quote = wordsOf(card.quote).map(fold);
  for (let i = 0; i + 4 <= quote.length; i++) {
    const run = quote.slice(i, i + 4).join(' ');
    if (said.join(' ').includes(run)) return { met: false, detail: 'quoted outright; an echo must be your own line' };
  }
  return { met: true, detail: `echoed "${echoed[0]}"` };
}

// --- Curses (potions) ---

export interface Curse {
  id: string;
  name: string;
  brief: (param: string) => string;
  /** Number of times the verse breaks the curse. */
  violations: (verse: string, param: string) => number;
}

export const CURSES: Record<string, Curse> = {
  'forbidden-letter': {
    id: 'forbidden-letter',
    name: 'Forbidden Letter',
    brief: (p) => `Your verse may not contain the letter ${p.toUpperCase()}.`,
    violations: (v, p) => wordsOf(v).filter((w) => fold(w).includes(fold(p))).length,
  },
  'short-words': {
    id: 'short-words',
    name: 'Tongue-Tied',
    brief: () => 'No word may be longer than six letters.',
    violations: (v) => wordsOf(v).filter((w) => [...w.replace(/['’\-]/g, '')].length > 6).length,
  },
  'no-repeats': {
    id: 'no-repeats',
    name: 'No Echoes',
    brief: () => 'No word of four letters or more may be used twice.',
    violations: (v) => {
      const seen = new Set<string>();
      let n = 0;
      for (const w of contentWords(v).map(fold)) {
        if (seen.has(w)) n++;
        seen.add(w);
      }
      return n;
    },
  },
  'short-lines': {
    id: 'short-lines',
    name: 'Short Breath',
    brief: () => 'No line may be longer than five words.',
    violations: (v) => linesOf(v).filter((l) => wordsOf(l).length > 5).length,
  },
};

/** Craft lost per time a curse is broken, and the most one curse can cost. */
export const CURSE_PENALTY = 4;
export const CURSE_PENALTY_CAP = 12;

/** Letters a Forbidden Letter curse can name: common enough to bite, never impossible. */
export const FORBIDDEN_LETTERS: Record<string, string[]> = {
  en: ['s', 't', 'r', 'n', 'o', 'i'],
};

/** Which curse each potion card casts. */
export const POTION_CURSE: Record<string, string> = {
  'PT-001': 'no-repeats',
  'PT-002': 'forbidden-letter',
  'PT-003': 'short-lines',
  'PT-004': 'short-words',
  'PT-005': 'no-repeats',
  'PT-006': 'forbidden-letter',
  'PT-007': 'short-lines',
  'PT-008': 'short-words',
  'PT-009': 'forbidden-letter',
};

// --- Power words (relics) ---

/** Craft earned for working in at least POWER_WORDS_NEEDED of a relic's words. */
export const POWER_WORD_BONUS = 6;
export const POWER_WORDS_NEEDED = 2;

/** Each relic's words come from its own story. */
export const RELIC_WORDS: Record<string, Record<string, string[]>> = {
  en: {
    'RL-001': ['skull', 'jest', 'grave', 'laugh', 'dust'],
    'RL-002': ['storm', 'spell', 'staff', 'island', 'drown'],
    'RL-003': ['dagger', 'blood', 'sleep', 'vision', 'hand'],
    'RL-004': ['ring', 'vow', 'night', 'banished', 'kiss'],
    'RL-005': ['gold', 'choice', 'mercy', 'lead', 'casket'],
    'RL-006': ['crown', 'throne', 'ambition', 'witch', 'king'],
    'RL-007': ['book', 'tempest', 'magic', 'page', 'drown'],
    'RL-008': ['tears', 'truth', 'daughter', 'nothing', 'heart'],
    'RL-009': ['mask', 'dream', 'fool', 'play', 'moon'],
  },
};

export function checkPowerWords(words: string[], verse: string): { used: string[]; met: boolean } {
  const said = new Set(wordsOf(verse).map(fold));
  const used = words.filter((w) => said.has(fold(w)));
  return { used, met: used.length >= POWER_WORDS_NEEDED };
}
