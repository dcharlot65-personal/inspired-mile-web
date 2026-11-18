/**
 * The little words of each language other than English: articles, pronouns, particles,
 * auxiliaries (./function-words/<lang>.ts, generated from stopwords-iso by
 * scripts/build-function-words.mjs). English has its own list (text.ts STOP_WORDS).
 *
 * Used where a rule must count only the words that carry meaning: the copy measure and
 * the substance a multiplier multiplies (text.ts isContentWord). Each list is a separate
 * module loaded with its language's pack (packs/index.ts loadPack); until it is in, those
 * rules fall back to the length a content word needs in its language (lang.ts).
 *
 * This file imports nothing from the rest of the engine.
 */
const LOADERS: Record<string, () => Promise<{ default: string[] }>> = {
  es: () => import('./function-words/es'),
  fr: () => import('./function-words/fr'),
  de: () => import('./function-words/de'),
  it: () => import('./function-words/it'),
  pt: () => import('./function-words/pt'),
  pl: () => import('./function-words/pl'),
  ru: () => import('./function-words/ru'),
  ar: () => import('./function-words/ar'),
  hi: () => import('./function-words/hi'),
  zh: () => import('./function-words/zh'),
  ja: () => import('./function-words/ja'),
  ko: () => import('./function-words/ko'),
  vi: () => import('./function-words/vi'),
  th: () => import('./function-words/th'),
  id: () => import('./function-words/id'),
};

const lists = new Map<string, Set<string>>();

const base = (lang: string) => lang.toLowerCase().split('-')[0];

/** A word as the lists compare it: lower case, composed. */
export function functionKey(word: string): string {
  return word.normalize('NFC').toLowerCase();
}

/** Install a language's list, or remove it with null. For tests and for loadFunctionWords. */
export function installFunctionWords(lang: string, words: string[] | null): void {
  if (words === null) lists.delete(base(lang));
  else lists.set(base(lang), new Set(words.map(functionKey)));
}

/** The language's little words, or undefined when it has no list loaded. */
export function functionWords(lang: string): Set<string> | undefined {
  return lists.get(base(lang));
}

/** Load a language's list. Resolves false (after saying why) if it could not be fetched. */
export async function loadFunctionWords(lang: string): Promise<boolean> {
  const b = base(lang);
  if (lists.has(b) || !LOADERS[b]) return true;
  try {
    installFunctionWords(b, (await LOADERS[b]()).default);
    return true;
  } catch (err) {
    console.error(`[verse] the little words of "${b}" could not be loaded; content words are told by their length`, err);
    return false;
  }
}
