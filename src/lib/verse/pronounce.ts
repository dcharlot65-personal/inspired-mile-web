/**
 * How English words sound: syllable counts and rhyme keys from a table reduced
 * from the CMU Pronouncing Dictionary (./pron-en.ts, built by
 * scripts/build-pronunciation.mjs).
 *
 * English spelling does not show its sound ("go" and "so" rhyme and so do
 * "sky" and "high"; "poem" has two syllables and "naked" has two), so English
 * is measured from this table, and spelling rules (./text for syllables,
 * ./rhyme for rhyme) are only the fallback for a word the table lacks.
 *
 * The table is about 1.5 MB (some 0.5 MB compressed) and is never part of a
 * page's first load: it is a separate module, fetched once by loadPronunciation()
 * before an English duel begins. Until it is in, and if it cannot be fetched,
 * every lookup answers "not known" and the spelling rules carry on.
 *
 * This file imports nothing from the rest of the engine, so both ./text and
 * ./rhyme can use it.
 */

/** The characters that are vowels in a rhyme key (the same string as in scripts/build-pronunciation.mjs). */
const KEY_VOWELS = 'AauOWYeREiIoyUw';

export interface Pronunciation {
  /** Syllable counts, the commonest pronunciation first. "fire" is [2, 1]: verse uses both. */
  counts: number[];
  /** Rhyme keys: the sounds from the last stressed vowel on, one per pronunciation. */
  keys: string[];
  /** The dictionary only says it letter by letter ("cd", "tv"): an abbreviation, not a word. */
  spelled?: boolean;
}

let table: Map<string, Pronunciation> | null = null;
let loading: Promise<boolean> | null = null;

/** Install a table in the generated format, or remove it with null. */
export function installPronunciation(data: string | null): void {
  if (data === null) {
    table = null;
    loading = null;
    return;
  }
  const t = new Map<string, Pronunciation>();
  for (const line of data.split('\n')) {
    const tab = line.indexOf('\t');
    if (tab < 1) continue;
    const key = line.slice(0, tab);
    for (const entry of line.slice(tab + 1).split(' ')) {
      const m = /^(.*?)(\d+)(\*?)$/.exec(entry);
      if (!m) continue;
      const p = t.get(m[1]);
      if (p) p.keys.push(key);
      else t.set(m[1], { counts: [...m[2]].map(Number), keys: [key], ...(m[3] ? { spelled: true } : {}) });
    }
  }
  table = t;
}

export function pronunciationLoaded(): boolean {
  return table !== null;
}

/**
 * Load the English table. Safe to call often; resolves true once it is in, and
 * false (after saying why on the console) if it could not be fetched.
 */
export function loadPronunciation(): Promise<boolean> {
  if (table) return Promise.resolve(true);
  loading ??= import('./pron-en')
    .then((m) => {
      installPronunciation(m.default);
      return true;
    })
    .catch((err) => {
      console.error('[verse] the pronunciation table could not be loaded; using spelling rules', err);
      loading = null;
      return false;
    });
  return loading;
}

/** A word as the table spells it: lower case, no accents, straight apostrophes, letters only. */
function plain(word: string): string {
  return word
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\u2019\u2018\u02bc]/g, "'")
    .replace(/[^a-z']/g, '');
}

/** What the table knows of an English word, or null: not loaded, not English, or not in it. */
export function pronounce(word: string, lang = 'en'): Pronunciation | null {
  if (!table || lang.toLowerCase().split('-')[0] !== 'en') return null;
  const w = plain(word);
  return table.get(w) ?? table.get(w.replace(/'/g, '')) ?? null;
}

/** Is this English word in the pronunciation table (and the table loaded)? */
export function knownWord(word: string, lang = 'en'): boolean {
  return pronounce(word, lang) !== null;
}

/** The last syllable of a rhyme key: from its last vowel on. */
function lastSyllable(key: string): string {
  for (let i = key.length - 1; i >= 0; i--) if (KEY_VOWELS.includes(key[i])) return key.slice(i);
  return key;
}

/**
 * Do two rhyme keys rhyme? Either they are the same, or their last syllables
 * are and one of the two words is stressed there: "destiny" rhymes with "free"
 * and "running" with "king", as verse has always allowed, but "candle" does
 * not rhyme with "apple", nor "running" with "morning".
 */
function keysRhyme(a: string, b: string): boolean {
  if (a === b) return true;
  const ta = lastSyllable(a);
  return ta === lastSyllable(b) && (ta === a || ta === b);
}

/**
 * Do two English words rhyme by sound, in any of their pronunciations? Null
 * when either is not in the table: the caller falls back to spelling.
 */
export function soundRhyme(a: string, b: string, lang = 'en'): boolean | null {
  const pa = pronounce(a, lang);
  const pb = pronounce(b, lang);
  if (!pa || !pb) return null;
  return pa.keys.some((x) => pb.keys.some((y) => keysRhyme(x, y)));
}
