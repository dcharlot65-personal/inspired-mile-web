#!/usr/bin/env node
/**
 * Fetch, from Wikidata, each language's own name for the verse forms and the
 * technical words of prosody the game uses: the title of that language's
 * Wikipedia article (the sitelink), and Wikidata's label and aliases.
 *
 *   node scripts/lang/fetch-wikidata.mjs            writes docs/language/sources/wikidata-terms.json
 *
 * The concepts are named by their English Wikipedia titles; Wikidata resolves
 * each to an item. Nothing is invented here: a language with no article and no
 * label gets null, and the locale then needs a human decision (recorded in
 * docs/language/GLOSSARY.md).
 *
 * Wikidata is CC0; Wikipedia titles are facts taken through its sitelinks.
 */
import { writeFileSync } from 'node:fs';

const LANGS = ['en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'ru', 'ar', 'hi', 'zh', 'ja', 'ko', 'vi', 'th', 'id'];
// our id -> English Wikipedia title
const CONCEPTS = {
  couplet: 'Couplet',
  quatrain: 'Quatrain',
  tercet: 'Tercet',
  haiku: 'Haiku',
  anaphora: 'Anaphora (rhetoric)',
  epistrophe: 'Epistrophe',
  acrostic: 'Acrostic',
  'heroic-couplet': 'Heroic couplet',
  jueju: 'Jueju',
  'luc-bat': 'Lục bát',
  alliteration: 'Alliteration',
  'internal-rhyme': 'Internal rhyme',
  monorhyme: 'Monorhyme',
  syllable: 'Syllable',
  rhyme: 'Rhyme',
  stanza: 'Stanza',
  verse: 'Verse (poetry)',
  line: 'Line (poetry)',
  sonnet: 'Sonnet',
  kana: 'Kana',
  poetry: 'Poetry',
  'william-shakespeare': 'William Shakespeare',
  climax: 'Climax (rhetoric)',
  'enclosed-rhyme': 'Enclosed rhyme',
  'rhyme-scheme': 'Rhyme scheme',
};

const UA = 'language-qa-script/1.0 (terminology lookup)';
/** One request, retried when the API says it is busy (it rate-limits by address, and this machine shares one). */
async function api(params) {
  const url = 'https://www.wikidata.org/w/api.php?' + new URLSearchParams({ format: 'json', origin: '*', ...params });
  for (let attempt = 1; ; attempt++) {
    const r = await fetch(url, { headers: { 'user-agent': UA } });
    if (r.ok) return r.json();
    if (r.status !== 429 || attempt >= 12) throw new Error(`${r.status} ${url}`);
    const wait = Math.min(120, Number(r.headers.get('retry-after') ?? 30) + 3);
    console.error(`429 from Wikidata; waiting ${wait}s (attempt ${attempt})`);
    await new Promise((res) => setTimeout(res, wait * 1000));
  }
}

const out = { fetched: new Date().toISOString(), source: 'https://www.wikidata.org/w/api.php (wbgetentities)', licence: 'CC0 1.0 (Wikidata)', concepts: {} };
// All the titles in one request: the API takes up to 50, and one request is kinder to a shared rate limit.
const j = await api({ action: 'wbgetentities', sites: 'enwiki', titles: Object.values(CONCEPTS).join('|'), props: 'sitelinks|labels|aliases|descriptions', languages: LANGS.join('|'), sitefilter: LANGS.map((l) => `${l}wiki`).join('|') });
const byTitle = new Map();
for (const ent of Object.values(j.entities ?? {})) if (ent.sitelinks?.enwiki) byTitle.set(ent.sitelinks.enwiki.title, ent);
for (const [id, title] of Object.entries(CONCEPTS)) {
  const ent = byTitle.get(title);
  if (!ent) {
    out.concepts[id] = { enwiki: title, qid: null };
    console.error(`no item for "${title}"`);
    continue;
  }
  const row = { enwiki: title, qid: ent.id, description: ent.descriptions?.en?.value ?? null, langs: {} };
  for (const l of LANGS) {
    row.langs[l] = {
      sitelink: ent.sitelinks?.[`${l}wiki`]?.title ?? null,
      label: ent.labels?.[l]?.value ?? null,
      aliases: (ent.aliases?.[l] ?? []).map((a) => a.value),
    };
  }
  out.concepts[id] = row;
}
const path = new URL('../../docs/language/sources/wikidata-terms.json', import.meta.url);
writeFileSync(path, JSON.stringify(out, null, 2) + '\n');
console.log(`wrote ${Object.keys(out.concepts).length} concepts`);
