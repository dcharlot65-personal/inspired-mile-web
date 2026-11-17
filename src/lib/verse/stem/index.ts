/**
 * Snowball stemmers, for the languages that have a Snowball algorithm: Spanish, French, German, Italian,
 * Portuguese, Polish, Russian, Arabic, Hindi and Indonesian.
 *
 * The files in ./snowball are the Snowball project's generated JavaScript, copied unchanged from
 * jsstemmer-3.2.0.tar.gz (https://snowballstem.org/dist/, sha256 1d3f39267a15d035…a15e5bd), BSD 3-clause
 * (./snowball/COPYING). stem.test.ts checks each file against the sha256 recorded there, so an edit shows.
 *
 * The signature and the invocation use a stemmer to tell that two spellings are forms of one word, the way
 * a search engine does: Russian «Гамлета» and «Гамлет», Spanish «rosas» and «rosa». A stemmer is loaded with
 * a language's card text (loadCardText), only for the duel's language, and then used synchronously.
 */
type Stemmer = { stemWord(word: string): string };
type StemmerModule = { default: new () => Stemmer };

const LOADERS: Record<string, () => Promise<StemmerModule>> = {
  es: () => import('./snowball/spanish-stemmer.js') as Promise<StemmerModule>,
  fr: () => import('./snowball/french-stemmer.js') as Promise<StemmerModule>,
  de: () => import('./snowball/german-stemmer.js') as Promise<StemmerModule>,
  it: () => import('./snowball/italian-stemmer.js') as Promise<StemmerModule>,
  pt: () => import('./snowball/portuguese-stemmer.js') as Promise<StemmerModule>,
  pl: () => import('./snowball/polish-stemmer.js') as Promise<StemmerModule>,
  ru: () => import('./snowball/russian-stemmer.js') as Promise<StemmerModule>,
  ar: () => import('./snowball/arabic-stemmer.js') as Promise<StemmerModule>,
  hi: () => import('./snowball/hindi-stemmer.js') as Promise<StemmerModule>,
  id: () => import('./snowball/indonesian-stemmer.js') as Promise<StemmerModule>,
};

/** Languages with a Snowball stemmer. */
export const STEM_LANGS = Object.keys(LOADERS);

const loaded = new Map<string, (word: string) => string>();
const base = (lang: string) => lang.toLowerCase().split('-')[0];

/** Load a language's stemmer; a language without one resolves and has none. */
export async function loadStemmer(lang: string): Promise<void> {
  const b = base(lang);
  if (loaded.has(b) || !LOADERS[b]) return;
  const S = (await LOADERS[b]()).default;
  const s = new S();
  // Snowball expects lower case in composed form (its README).
  loaded.set(b, (word) => s.stemWord(word.normalize('NFC').toLowerCase()));
}

/** The stemmer of a language if it has one and it is loaded; null otherwise. */
export function stemmerFor(lang: string): ((word: string) => string) | null {
  return loaded.get(base(lang)) ?? null;
}
