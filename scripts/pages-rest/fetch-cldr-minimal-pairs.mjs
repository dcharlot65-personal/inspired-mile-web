#!/usr/bin/env node
// Unicode CLDR's plural minimal pairs: for each language and each plural category, a short
// phrase that shows how a noun reads after a number of that category ("{0} jour", "{0} de
// jours", "{0} jours" in French). The categories themselves come from Intl.PluralRules (ICU's
// copy of CLDR); the wording a category needs does not, and this file is where it comes from.
// French, Spanish, Italian and Portuguese join an exact million to its noun with de/di
// ("1 000 000 de jours"): a 'many' form written as a copy of 'other' is wrong there.
//
//   node scripts/pages-rest/fetch-cldr-minimal-pairs.mjs
//     -> docs/language/sources/pages-rest-cldr-minimal-pairs.json
//
// Read from the CLDR repository at the release-49 tag, pinned to its commit, so a later CLDR
// cannot change the file under the same name. Unicode License v3.
import { writeFileSync } from 'node:fs';

const TAG = 'release-49';
const COMMIT = '96e54b273d2da4ec6fbad350ba19ff23fa24a588';
const LANGS = ['en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'ru', 'ar', 'hi', 'zh', 'ja', 'ko', 'vi', 'th', 'id'];
const decode = (s) => s.replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");

const out = {
  source: `https://github.com/unicode-org/cldr/blob/${COMMIT}/common/main/<lang>.xml, <numbers><minimalPairs><pluralMinimalPairs>`,
  tag: TAG,
  commit: COMMIT,
  fetched: new Date().toISOString(),
  licence: 'Unicode License v3 (https://www.unicode.org/license.txt)',
  pairs: {},
};
for (const lang of LANGS) {
  const url = `https://raw.githubusercontent.com/unicode-org/cldr/${COMMIT}/common/main/${lang}.xml`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  const xml = await r.text();
  const pairs = {};
  for (const m of xml.matchAll(/<pluralMinimalPairs count="([a-z]+)">([^<]*)<\/pluralMinimalPairs>/g)) pairs[m[1]] = decode(m[2]);
  if (Object.keys(pairs).length === 0) throw new Error(`${lang}: no pluralMinimalPairs in ${url}`);
  out.pairs[lang] = pairs;
  console.log(lang, JSON.stringify(pairs));
}
writeFileSync(new URL('../../docs/language/sources/pages-rest-cldr-minimal-pairs.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
