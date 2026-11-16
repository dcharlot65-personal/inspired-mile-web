/**
 * How words sound, per language: the data behind rhyme and syllable counts.
 *
 * Spelling alone decides rhyme and syllables fairly in some languages (Spanish,
 * Polish, Korean, Vietnamese, Indonesian). In the others something that is not
 * written has to be looked up: where the stress falls (Russian, Italian), how a
 * word is said at all (French, German), how a character is read (Chinese,
 * Japanese), where a syllable ends (Thai). That knowledge ships here as one
 * table per language, built by scripts/sound/build.mjs from published
 * dictionaries (docs/language/PHONETICS.md names each source, its version and
 * its licence), or, for Japanese, as a morphological analyser with its
 * dictionary (./ja).
 *
 * Nothing here is part of a page's first load. A table is a separate module,
 * fetched once by loadSound(lang) before a duel in that language begins, and
 * only that language's. Until it is in, and if it cannot be fetched, every
 * lookup answers "not known" and the rules in ../rhyme and ../text carry on
 * from spelling, exactly as they did before there were tables.
 *
 * The same input gives the same answer on every device: a table is data, the
 * lookups are exact string matches, and no platform segmenter or speech
 * service is asked anything.
 *
 * This file imports nothing from the rest of the engine, so ../text and
 * ../rhyme can both use it.
 */

/** Languages that have a table module in ./data. */
const TABLE_LOADERS: Record<string, () => Promise<{ default: string }>> = {
  es: () => import('./data/es'),
  it: () => import('./data/it'),
  pt: () => import('./data/pt'),
  fr: () => import('./data/fr'),
  de: () => import('./data/de'),
  ru: () => import('./data/ru'),
  hi: () => import('./data/hi'),
  id: () => import('./data/id'),
  th: () => import('./data/th'),
  zh: () => import('./data/zh'),
};

/** Other things a language needs loaded: an engine rather than a table. Returns whether it is ready. */
const ENGINE_LOADERS: Record<string, () => Promise<boolean>> = {
  ja: () => import('./ja').then((m) => m.loadJapanese()),
};

/** Languages whose rhyme and syllable rules need nothing loaded. */
const RULES_ONLY = new Set(['pl', 'ko', 'vi', 'ar']);

const tables = new Map<string, Map<string, string>>();
const ready = new Set<string>();
const loading = new Map<string, Promise<boolean>>();

function base(lang: string): string {
  return lang.toLowerCase().split('-')[0];
}

/**
 * Parse a table in the generated format. One entry per line, `word<TAB>value`,
 * sorted, each word written as one character giving how many leading characters
 * it shares with the word before (code point 48 + count) and then the rest.
 */
export function parseTable(data: string): Map<string, string> {
  const t = new Map<string, string>();
  let prev = '';
  for (const line of data.split('\n')) {
    const tab = line.indexOf('\t');
    if (tab < 1) continue;
    const word = prev.slice(0, line.charCodeAt(0) - 48) + line.slice(1, tab);
    t.set(word, line.slice(tab + 1));
    prev = word;
  }
  return t;
}

/** Install a language's table from generated text, or remove it with null. For tests and for loadSound. */
export function installSound(lang: string, data: string | null): void {
  const b = base(lang);
  if (data === null) {
    tables.delete(b);
    ready.delete(b);
    loading.delete(b);
    return;
  }
  tables.set(b, parseTable(data));
  ready.add(b);
}

/** Mark an engine-backed language (Japanese) as ready or not. */
export function markSound(lang: string, isReady: boolean): void {
  if (isReady) ready.add(base(lang));
  else {
    ready.delete(base(lang));
    loading.delete(base(lang));
  }
}

/** Is everything this language's rules can use loaded? True at once for languages that need nothing. */
export function soundReady(lang: string): boolean {
  const b = base(lang);
  return RULES_ONLY.has(b) || ready.has(b);
}

/** Does this language have data to load at all? */
export function hasSound(lang: string): boolean {
  const b = base(lang);
  return b in TABLE_LOADERS || b in ENGINE_LOADERS;
}

/**
 * Load what a language's rhyme and syllable rules need. Safe to call often.
 * Resolves true once it is in, and false (after saying why on the console) if
 * it could not be loaded; the spelling rules then carry on alone.
 */
export function loadSound(lang: string): Promise<boolean> {
  const b = base(lang);
  if (soundReady(b)) return Promise.resolve(true);
  const table = TABLE_LOADERS[b];
  const engine = ENGINE_LOADERS[b];
  if (!table && !engine) return Promise.resolve(true);
  let p = loading.get(b);
  if (!p) {
    p = (table ? table().then((m) => (installSound(b, m.default), true)) : engine().then((ok) => (markSound(b, ok), ok))).catch((err) => {
      console.error(`[verse] sound data for "${b}" could not be loaded; using spelling rules`, err);
      loading.delete(b);
      return false;
    });
    loading.set(b, p);
  }
  return p;
}

/** The table's value for a word exactly as given, or undefined: no table, or not in it. */
export function soundOf(lang: string, word: string): string | undefined {
  return tables.get(base(lang))?.get(word);
}

/** Number of entries in a language's table (0 when not loaded). */
export function soundSize(lang: string): number {
  return tables.get(base(lang))?.size ?? 0;
}

/**
 * The longest ending of `text` that is an entry of the table, at most `max`
 * characters long and at least `min`. Used where words are written without
 * spaces (Chinese, Thai) and for the last part of a German compound.
 */
export function longestEnding(lang: string, text: string, max: number, min = 1): { word: string; value: string } | null {
  const t = tables.get(base(lang));
  if (!t) return null;
  const cs = [...text];
  for (let n = Math.min(max, cs.length); n >= min; n--) {
    const word = cs.slice(cs.length - n).join('');
    const value = t.get(word);
    if (value !== undefined) return { word, value };
  }
  return null;
}

/** The longest opening of `cs` from index `from` that is an entry of the table. */
export function longestOpening(lang: string, cs: string[], from: number, max: number): { length: number; value: string } | null {
  const t = tables.get(base(lang));
  if (!t) return null;
  for (let n = Math.min(max, cs.length - from); n >= 1; n--) {
    const value = t.get(cs.slice(from, from + n).join(''));
    if (value !== undefined) return { length: n, value };
  }
  return null;
}
