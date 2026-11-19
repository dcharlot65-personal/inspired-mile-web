#!/usr/bin/env node
// Wikidata labels (CC0) and the titles of the Wikipedia articles they link to, in the game's
// sixteen languages, for terms the translated pages use that this branch had not yet recorded:
//
//   node scripts/pages-rest/fetch-wikidata-terms.mjs <name> <Qid>=<what> [<Qid>=<what> …]
//     -> docs/language/sources/pages-rest-wikidata-terms-<name>.json
//
// The API limits anonymous clients (HTTP 429): the script waits and asks again. A label that
// is missing in a language is recorded as null, never filled in.
import { writeFileSync } from 'node:fs';

const LANGS = ['en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'ru', 'ar', 'hi', 'zh', 'ja', 'ko', 'vi', 'th', 'id'];
const [name, ...pairs] = process.argv.slice(2);
if (!name || !pairs.length) {
  console.error('usage: node scripts/pages-rest/fetch-wikidata-terms.mjs <name> <Qid>=<what> …');
  process.exit(2);
}
const ITEMS = Object.fromEntries(pairs.map((p) => p.split('=')).map(([q, ...w]) => [q, w.join('=')]));
const want = [...LANGS, 'zh-hans', 'zh-cn', 'pt-br'].join('|');
const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${Object.keys(ITEMS).join('|')}&props=labels|descriptions|sitelinks&languages=${want}&format=json`;
let j;
for (let attempt = 0; attempt < 5; attempt++) {
  const r = await fetch(url, { headers: { 'User-Agent': 'term-fetch/1.0 (generic client)' } });
  if (r.status === 429) {
    await new Promise((done) => setTimeout(done, 20000 * (attempt + 1)));
    continue;
  }
  if (!r.ok) throw new Error(`Wikidata ${r.status}`);
  j = await r.json();
  break;
}
if (!j) throw new Error('Wikidata kept answering 429');
const wiki = (l) => (l === 'zh' ? 'zhwiki' : `${l}wiki`);
const out = { source: url, licence: 'CC0 (Wikidata); article titles are facts', fetched: new Date().toISOString(), items: {} };
for (const [q, what] of Object.entries(ITEMS)) {
  const e = j.entities[q];
  const row = { what, enDescription: e.descriptions?.en?.value ?? null, labels: {}, articles: {} };
  for (const l of LANGS) {
    row.labels[l] = e.labels?.[l]?.value ?? null;
    row.articles[l] = e.sitelinks?.[wiki(l)]?.title ?? null;
  }
  // The game's Chinese is Simplified: take the Simplified label where Wikidata has one.
  for (const v of ['zh-cn', 'zh-hans']) if (e.labels?.[v]?.value) { row.labels.zh = e.labels[v].value; row.zhFrom = v; break; }
  out.items[q] = row;
  console.log(q, what);
  for (const l of LANGS) console.log(`  ${l}: ${row.labels[l]} | ${row.articles[l]}`);
}
writeFileSync(new URL(`../../docs/language/sources/pages-rest-wikidata-terms-${name}.json`, import.meta.url), JSON.stringify(out, null, 1) + '\n');
