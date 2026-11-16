#!/usr/bin/env node
/**
 * Fetch from Unicode CLDR what the checks rely on, for the sixteen languages:
 * the plural categories and their rules, and the quotation marks.
 *
 *   node scripts/lang/fetch-cldr.mjs [version]     writes docs/language/sources/cldr.json
 *
 * The runtime does not read this file: it uses Intl (the browser's own CLDR).
 * The tests read it, to hold each locale to CLDR's categories and to notice
 * when the Intl of the machine running them disagrees with the pinned CLDR.
 */
import { writeFileSync } from 'node:fs';

const VERSION = process.argv[2] ?? '49.0.0';
const LANGS = ['en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'ru', 'ar', 'hi', 'zh', 'ja', 'ko', 'vi', 'th', 'id'];
const base = `https://raw.githubusercontent.com/unicode-org/cldr-json/${VERSION}/cldr-json`;
const get = async (path) => {
  const r = await fetch(`${base}/${path}`);
  if (!r.ok) throw new Error(`${r.status} ${path}`);
  return r.json();
};

const plurals = (await get('cldr-core/supplemental/plurals.json')).supplemental['plurals-type-cardinal'];
const out = {
  source: `${base}/ (cldr-core/supplemental/plurals.json, cldr-misc-full/main/<lang>/delimiters.json)`,
  version: VERSION,
  licence: 'Unicode License v3 (https://www.unicode.org/license.txt)',
  fetched: new Date().toISOString(),
  languages: {},
};
for (const l of LANGS) {
  const rules = {};
  for (const [k, v] of Object.entries(plurals[l])) rules[k.replace('pluralRule-count-', '')] = v.trim();
  const d = (await get(`cldr-misc-full/main/${l}/delimiters.json`)).main[l].delimiters;
  out.languages[l] = {
    pluralCategories: Object.keys(rules),
    pluralRules: rules,
    quotes: [d.quotationStart, d.quotationEnd],
    altQuotes: [d.alternateQuotationStart, d.alternateQuotationEnd],
  };
}
writeFileSync(new URL('../../docs/language/sources/cldr.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
for (const [l, v] of Object.entries(out.languages)) console.log(l, v.pluralCategories.join(','), v.quotes.join(''), v.altQuotes.join(''));
