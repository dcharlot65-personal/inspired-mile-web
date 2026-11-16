#!/usr/bin/env node
/**
 * Fetch English Wiktionary's translation tables for the verse forms and
 * devices, for the languages of the game: a second published source for a
 * form's name where that language's Wikipedia has no article (see
 * fetch-wikidata.mjs for the first).
 *
 *   node scripts/lang/fetch-wiktionary.mjs      writes docs/language/sources/wiktionary-translations.json
 *
 * Each translation table is kept with the sense it translates (its
 * {{trans-top}} gloss), so a word given for another sense of the English
 * (anaphora in linguistics, acrostic the puzzle) is not mistaken for the
 * poetic one. Wiktionary's text is CC BY-SA 4.0; a single word per language is
 * recorded, with the page it came from.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Our language code -> the code Wiktionary's {{t}} templates use (Chinese translations are given per variety).
const LANGS = { es: 'es', fr: 'fr', de: 'de', it: 'it', pt: 'pt', pl: 'pl', ru: 'ru', ar: 'ar', hi: 'hi', zh: 'cmn', ja: 'ja', ko: 'ko', vi: 'vi', th: 'th', id: 'id' };
// concept -> English Wiktionary page
const PAGES = {
  couplet: 'couplet',
  distich: 'distich',
  quatrain: 'quatrain',
  tercet: 'tercet',
  anaphora: 'anaphora',
  epistrophe: 'epistrophe',
  acrostic: 'acrostic',
  alliteration: 'alliteration',
  'heroic-couplet': 'heroic couplet',
  'internal-rhyme': 'internal rhyme',
  jueju: 'jueju',
  'luc-bat': 'lục bát',
  haiku: 'haiku',
};
const UA = 'language-qa-script/1.0 (terminology lookup)';

async function raw(title) {
  const url = `https://en.wiktionary.org/w/index.php?${new URLSearchParams({ title: title.replace(/ /g, '_'), action: 'raw' })}`;
  for (let attempt = 1; ; attempt++) {
    const r = await fetch(url, { headers: { 'user-agent': UA } });
    if (r.status === 404) return { url, text: null };
    if (r.ok) return { url, text: await r.text() };
    if (r.status !== 429 || attempt >= 8) throw new Error(`${r.status} ${url}`);
    await new Promise((res) => setTimeout(res, 20000));
  }
}

/** Every translation table on a page: [{ sense, langs: { ourCode: [word, …] } }]. */
export function tables(text) {
  const out = [];
  let cur = null;
  for (const line of text.split('\n')) {
    const top = line.match(/\{\{trans-top\|([^}]*)\}\}/);
    if (top) {
      cur = { sense: top[1].replace(/''/g, ''), langs: {} };
      out.push(cur);
      continue;
    }
    if (/\{\{trans-bottom\}\}/.test(line)) {
      cur = null;
      continue;
    }
    if (!cur) continue;
    for (const m of line.matchAll(/\{\{t(?:\+|-check)?\|([a-z-]+)\|([^|}]+)/g)) {
      const ours = Object.entries(LANGS).find(([, w]) => w === m[1])?.[0];
      // Wiktionary marks stress in Russian with a combining acute; the word as written has none.
      // Only there: in Spanish or Vietnamese the acute is part of the spelling (anáfora, bốn).
      const word = ours === 'ru' ? m[2].normalize('NFD').replace(/́/g, '').normalize('NFC') : m[2].normalize('NFC');
      if (ours) (cur.langs[ours] ??= []).push(word);
    }
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = {
    source: 'English Wiktionary, the Translations section of each page (wikitext through index.php?action=raw)',
    licence: 'CC BY-SA 4.0 (Wiktionary text); one word per language quoted as evidence of a term',
    fetched: new Date().toISOString().slice(0, 10),
    note: 'A page with no translation table, or none for a language, is recorded as such. A word under another sense of the English word is kept with that sense, and is not evidence for the poetic one.',
    concepts: {},
  };
  for (const [concept, page] of Object.entries(PAGES)) {
    const { url, text } = await raw(page);
    result.concepts[concept] = { page, url, exists: text !== null, tables: text ? tables(text) : [] };
    console.log(`${concept}: ${text === null ? 'no page' : `${result.concepts[concept].tables.length} tables`}`);
  }
  const out = fileURLToPath(new URL('../../docs/language/sources/wiktionary-translations.json', import.meta.url));
  writeFileSync(out, JSON.stringify(result, null, 1) + '\n');
  console.log(out);
}
