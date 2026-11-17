#!/usr/bin/env node
/**
 * Fetch English Wiktionary's translation tables for the game's single words: the relics' power words,
 * the judge's criteria and the core terms of the glossary. They are what scripts/lang/lib/words.mjs
 * checks each language's word against: a published dictionary, not a model's reading.
 *
 *   node scripts/lang/fetch-wiktionary-words.mjs     writes docs/language/sources/wiktionary-words.json
 *
 * Why: back-translation scores a lone word badly whatever its quality, so the meaning check flags a
 * string only when two signals agree, and a wrong word with one good score passed (Hindi लालसा, greed,
 * for "ambition"; Russian гордыня, pride, before it). A word is a dictionary question.
 *
 * A page whose translations are on a subpage ({{see translation subpage}}, as on "king") is followed
 * there. Each table keeps its sense ({{trans-top}}), so a reader can tell which sense matched. The
 * English words are read from the English pack and locale (the same code the checks use), so a new
 * relic word is fetched the next time this runs. Wiktionary's text is CC BY-SA 4.0; one word per
 * language is recorded as evidence of a translation.
 */
import './lib/ts-hooks.mjs';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tables } from './fetch-wiktionary.mjs';
import { readFileSync } from 'node:fs';
import { GLOSS_WORDS, LANGUAGE_NAMES, WORD_PAGES, lookUp, wordsToCheck } from './lib/words.mjs';

const { loadPack } = await import('../../src/lib/verse/packs/index.ts');
const { LOCALES, loadMessages } = await import('../../src/i18n/index.ts');
const UA = 'language-qa-script/1.0 (terminology lookup)';

async function raw(title) {
  const url = `https://en.wiktionary.org/w/index.php?${new URLSearchParams({ title: title.replace(/ /g, '_'), action: 'raw' })}`;
  for (let attempt = 1; ; attempt++) {
    const r = await fetch(url, { headers: { 'user-agent': UA } });
    if (r.status === 404) return { url, text: null };
    if (r.ok) return { url, text: await r.text() };
    if (![429, 500, 502, 503, 504].includes(r.status) || attempt >= 8) throw new Error(`${r.status} ${url}`);
    await new Promise((res) => setTimeout(res, 5000 * attempt));
  }
}

/** The English section only: a page also holds other languages' words spelled the same ("gold" in Dutch). */
function englishSection(text) {
  const start = text.search(/^==English==\s*$/m);
  if (start < 0) return '';
  const rest = text.slice(start + 12);
  const next = rest.search(/^==[^=].*==\s*$/m);
  return next < 0 ? rest : rest.slice(0, next);
}

const en = await loadPack('en');
const words = new Set(Object.values(en.relics).flat());
for (const w of Object.values(WORD_PAGES)) words.add(w);
const result = {
  source: 'English Wiktionary, the Translations sections of the English entry (wikitext through index.php?action=raw), following translation subpages',
  licence: 'CC BY-SA 4.0 (Wiktionary text); one word per language quoted as evidence of a translation',
  fetched: new Date().toISOString().slice(0, 10),
  words: {},
};
for (const word of [...words].sort()) {
  const page = await raw(word);
  let section = page.text ? englishSection(page.text) : '';
  const urls = [page.url];
  const sub = /\{\{see translation subpage/.test(section);
  if (sub) {
    const s = await raw(`${word}/translations`);
    urls.push(s.url);
    section += '\n' + (s.text ?? '');
  }
  let t = section ? tables(section) : [];
  // An inflected form ("tears", "banished") or a page that sends its translations elsewhere
  // ({{trans-see}}) is followed one step, to the page that holds the tables.
  let via = null;
  if (!t.length && section) {
    const m = section.match(/\{\{(?:plural of|past participle of|inflection of|past participle and simple past of|simple past and past participle of)\|en\|([^|}]+)/) ?? section.match(/\{\{trans-see\|[^|}]*\|([^|}]+)\}\}/);
    if (m) {
      via = m[1];
      const p = await raw(via);
      urls.push(p.url);
      let s = p.text ? englishSection(p.text) : '';
      if (/\{\{see translation subpage/.test(s)) {
        const sp = await raw(`${via}/translations`);
        urls.push(sp.url);
        s += '\n' + (sp.text ?? '');
      }
      t = s ? tables(s) : [];
    }
  }
  result.words[word] = { exists: page.text !== null, urls, ...(via ? { via } : {}), tables: t };
  const langs = new Set(t.flatMap((x) => Object.keys(x.langs)));
  console.log(`${word}: ${page.text === null ? 'no page' : `${t.length} tables, ${langs.size} of our languages${sub ? ' (subpage)' : ''}`}`);
  await new Promise((res) => setTimeout(res, 400));
}
// The other way round: a foreign word's own entry, and the English glosses of its definitions, for
// every word whose English word's table does not cover its language, and the words in GLOSS_WORDS.
const glossary = JSON.parse(readFileSync(new URL('../../docs/language/glossary.json', import.meta.url), 'utf8'));
const ts = JSON.parse(readFileSync(new URL('../../docs/language/sources/opencc-ts.json', import.meta.url), 'utf8')).map;
const packs = {};
const ui = {};
for (const l of LOCALES) {
  packs[l] = await loadPack(l);
  ui[l] = await loadMessages(l);
}
const wanted = Object.fromEntries(Object.entries(GLOSS_WORDS).map(([l, ws]) => [l, new Set(ws)]));
for (const x of wordsToCheck(LOCALES, packs, ui, glossary)) if (x.word && lookUp(result, x.english, x.lang, x.word, ts).state === 'not-covered') (wanted[x.lang] ??= new Set()).add(x.word);
const plain = (line) => line.replace(/^#\s*/, '').replace(/\{\{(?:lb|lbl)\|[^}]*\}\}\s*/g, '').replace(/\{\{gloss\|([^}]*)\}\}/g, '($1)').replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1').replace(/\{\{[^}]*\}\}/g, '').trim();
result.glosses = {};
const sectionOf = (text, name) => {
  const start = text ? text.search(new RegExp(`^==${name}==\\s*$`, 'm')) : -1;
  if (start < 0) return '';
  const rest = text.slice(start + name.length + 4);
  const next = rest.search(/^==[^=].*==\s*$/m);
  return next < 0 ? rest : rest.slice(0, next);
};
for (const [lang, ws] of Object.entries(wanted)) {
  for (const w of [...ws].sort()) {
    const name = LANGUAGE_NAMES[lang];
    let section = sectionOf((await raw(w)).text, name);
    // A simplified Chinese page that sends the reader to the traditional one ({{zh-see|骷髏}}).
    const see = section.match(/\{\{zh-see\|([^|}]+)/);
    if (see) section = sectionOf((await raw(see[1])).text, name);
    const lines = section.split('\n').filter((l) => /^# /.test(l)).map(plain).filter(Boolean);
    (result.glosses[lang] ??= {})[w] = lines.slice(0, 12);
    console.log(`${lang} ${w}: ${lines.slice(0, 3).join(' / ') || 'no entry'}`);
    await new Promise((res) => setTimeout(res, 400));
  }
}
const out = fileURLToPath(new URL('../../docs/language/sources/wiktionary-words.json', import.meta.url));
writeFileSync(out, JSON.stringify(result, null, 1) + '\n');
console.log(out);
