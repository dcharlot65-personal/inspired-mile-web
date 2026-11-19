// Read the page-area message modules (src/i18n/pages/<area>/<locale>.ts) without a TypeScript
// toolchain: each is one object literal of string keys and string values.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const LOCALES = ['en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'ru', 'ar', 'hi', 'zh', 'ja', 'ko', 'vi', 'th', 'id'];
const PAGES = join(ROOT, 'src/i18n/pages');

/**
 * The areas these tools check: the pages of lang/pages-core and the data they show. The other areas
 * have pipelines of their own (classroom, marketplace, tournaments, season, viewer, shared, pwa:
 * scripts/pages-rest; playground, story, trivia, challenges: scripts/lang-content), and some of them
 * are not plain data (challenges/en.ts computes a value), which stopped every script here once they
 * were merged beside these.
 */
export const CORE_AREAS = ['about', 'achievements', 'card-terms', 'collection', 'home', 'profile', 'rules', 'variants', 'world-map'];

export function areas() {
  const present = new Set(readdirSync(PAGES).filter((d) => statSync(join(PAGES, d)).isDirectory()));
  const missing = CORE_AREAS.filter((a) => !present.has(a));
  if (missing.length) throw new Error(`page areas missing: ${missing.join(', ')}`);
  return [...CORE_AREAS];
}

export function readArea(area, locale) {
  const src = readFileSync(join(PAGES, area, `${locale}.ts`), 'utf8');
  const body = src.slice(src.indexOf('= {') + 2, src.lastIndexOf('};') + 1);
  // The files hold nothing but string literals and comments; this evaluates data, not code of anyone else's.
  return new Function(`return (${body});`)();
}

/** Every area of a language in one object. */
export function readAll(locale, only = areas()) {
  return Object.assign({}, ...only.map((a) => readArea(a, locale)));
}

/** Names taken from CLDR or Wikidata: not ours to spell-check or back-translate. */
export const SOURCED = /^(variants\.(city|region)\.|card-terms\.(work\.|house\.(rome|illyria|the-tempest|lake-district|olympus)$))/;

/** A message as a reader meets it: marks removed, placeholders filled with something plausible. */
export function rendered(value) {
  const fill = { n: '3', total: '12', owned: '5', min: '3', max: '5', relics: '2', potions: '2', characters: '3', year: '2025', bonus: '6', date: '2025-03-14', email: 'ana@example.com', id: 'XX-000', name: 'Hamlet', card: 'Hamlet', cards: 'Hamlet', city: 'London', house: 'Montague', device: 'Hamlet', words: 'alas, jest', rule: '…' };
  return value.replace(/<\/?[ab]>/g, '').replace(/\{([a-zA-Z_]+)\}/g, (_, k) => fill[k] ?? '3');
}
