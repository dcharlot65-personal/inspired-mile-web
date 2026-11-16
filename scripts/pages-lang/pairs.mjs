#!/usr/bin/env node
/**
 * The page areas as pairs for back-translation: [{ id, lang, text, english }].
 *
 *   node scripts/pages-lang/pairs.mjs out.json [--min-words 2] [--lang ar,hi]
 *
 * Single words are left out by default (an element's name back-translates to a synonym as
 * often as to the word itself, which measures nothing); so are the names taken from CLDR and
 * Wikidata.
 */
import { writeFileSync } from 'node:fs';
import { LOCALES, SOURCED, areas, readArea, rendered } from './strings.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const minWords = Number(opt('--min-words', '2'));
const only = opt('--lang', '').split(',').filter(Boolean);
const out = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
const pairs = [];
for (const a of areas()) {
  const en = readArea(a, 'en');
  for (const lang of LOCALES) {
    if (lang === 'en' || (only.length && !only.includes(lang))) continue;
    const m = readArea(a, lang);
    for (const [key, value] of Object.entries(en)) {
      if (SOURCED.test(key) || rendered(value).split(/\s+/).length < minWords) continue;
      pairs.push({ id: key, lang, text: rendered(m[key]), english: rendered(value) });
    }
  }
}
writeFileSync(out, JSON.stringify(pairs, null, 1) + '\n');
console.log(`${out}: ${pairs.length} pairs in ${new Set(pairs.map((p) => p.lang)).size} languages`);
