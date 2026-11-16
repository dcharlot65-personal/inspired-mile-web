#!/usr/bin/env node
// The terms record of the page areas (docs/language/pages-rest-terms.json), held to its
// sources, to the strings and to what the other records say about it:
//
//   node scripts/pages-rest/terms.mjs           list every problem; exit 1 if there is one
//   node scripts/pages-rest/terms.mjs --write   also rewrite the term tables in docs/language/pages-rest.md
//
// src/i18n/pages-rest-terms.test.ts runs the same checks with the unit tests.
//
// For each term the record gives, per language, the word the strings use and how it relates
// to the source: "same" (the source's word, apart from letter case, Arabic vowel marks,
// quotation marks and hyphens), "part" (a part of the source's word), "contains" (the source's
// word with more beside it), "script" (the source's Traditional Chinese word in Simplified
// characters, by a stated character map), "other" (not the source's word; the note says why),
// "none" (the source has nothing in that language: the word is the model's, with no source).
// What is checked here:
//   1. The relation holds against the saved answers of the sources (docs/language/sources).
//   2. Every area string whose English uses the term uses the language's word (or a stated
//      inflected form), unless the record says why it does not.
//   3. A verdict in docs/language/pages-rest-meaning.json that names a source (Wikidata, a
//      Q-id, Apple, Android) names a term of this record, and that term has a source in that
//      language; a verdict on a term the record marks "none" says "no source".
//   4. The term tables of docs/language/pages-rest.md are the ones this file draws.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const LOCALES = ['en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'ru', 'ar', 'hi', 'zh', 'ja', 'ko', 'vi', 'th', 'id'];
const AREAS = ['classroom', 'marketplace', 'tournaments', 'season', 'viewer', 'shared', 'pwa'];
const CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'];
const NAMES = { es: 'Spanish', fr: 'French', de: 'German', it: 'Italian', pt: 'Portuguese', pl: 'Polish', ru: 'Russian', ar: 'Arabic', hi: 'Hindi', zh: 'Chinese', ja: 'Japanese', ko: 'Korean', vi: 'Vietnamese', th: 'Thai', id: 'Indonesian' };
const RELATIONS = ['same', 'part', 'contains', 'script', 'other', 'none'];

const read = (file) => JSON.parse(readFileSync(path.join(ROOT, file), 'utf8'));

/**
 * A word as it is compared: Unicode NFC, Arabic vowel marks dropped, quotation marks and
 * apostrophes dropped, hyphens and dashes read as spaces, spaces of every kind as one, lower case.
 */
export function norm(s, lang = 'en') {
  return s
    .normalize('NFC')
    .replace(/[ً-ْٰ]/g, '')
    .replace(/[«»“”„‟"‘’‚‛'`´「」『』‹›]/g, '')
    .replace(/[-‐-―]/g, ' ')
    .replace(/[\s  ]+/g, ' ')
    .trim()
    .toLocaleLowerCase(lang);
}

// --- Sources ------------------------------------------------------------------

/** Wikidata labels and article titles per item, from the saved API answers. */
export function loadWikidata() {
  const items = {};
  for (const name of ['a', 'b']) {
    const file = `docs/language/sources/pages-rest-wikidata-terms-${name}.json`;
    for (const [q, e] of Object.entries(read(file).entities)) {
      if (!q.startsWith('Q')) continue;
      const labels = {};
      const articles = {};
      for (const l of LOCALES) {
        labels[l] = e.labels?.[l]?.value ?? null;
        articles[l] = e.sitelinks?.[l === 'zh' ? 'zhwiki' : `${l}wiki`]?.title ?? null;
      }
      // The game's Chinese is Simplified: the Simplified label where Wikidata has one (the rule
      // of scripts/pages-rest/fetch-wikidata-terms.mjs).
      for (const v of ['zh-cn', 'zh-hans']) if (e.labels?.[v]?.value) { labels.zh = e.labels[v].value; break; }
      items[q] = { labels, articles, file };
    }
  }
  const c = 'docs/language/sources/pages-rest-wikidata-terms-c.json';
  for (const [q, row] of Object.entries(read(c).items)) items[q] = { labels: row.labels, articles: row.articles, file: c };
  return items;
}

/** The text a vendor's saved page gives in a language, or null where it has none. */
export function loadVendors() {
  const home = read('docs/language/sources/pages-rest-apple-home-screen.json').pages;
  const vision = read('docs/language/sources/pages-rest-apple-vision-gestures.json').pages;
  const android = read('docs/language/sources/pages-rest-android-terms.json').terms;
  return {
    'apple-home': (l) => (home[l]?.steps ? [...(home[l].iconAlts ?? []), ...home[l].steps.flat()].join(' \n ') : null),
    'apple-vision': (l) => (vision[l]?.found ? [vision[l].gesture, vision[l].purpose, vision[l].instruction].join(' \n ') : null),
    aosp: (l, term) => android[term]?.text?.[l] ?? null,
  };
}

const VENDOR_NAMES = { 'apple-home': 'Apple, iPhone User Guide', 'apple-vision': 'Apple, Apple Vision Pro User Guide', aosp: 'Android (AOSP)' };

// --- The strings ----------------------------------------------------------------

/** Every area string of every language, for the command line (the unit test passes its own). */
export async function loadMessages() {
  const out = {};
  for (const l of LOCALES) {
    out[l] = {};
    for (const a of AREAS) Object.assign(out[l], (await import(path.join(ROOT, 'src/i18n/pages', a, `${l}.ts`))).default);
  }
  return out;
}

const pluralBase = (k) => {
  for (const c of CATEGORIES) if (k.endsWith(`.${c}`)) return k.slice(0, -c.length - 1);
  return null;
};
const englishOf = (messages, k) => messages.en[k] ?? (pluralBase(k) ? messages.en[`${pluralBase(k)}.other`] : undefined);

/** The keys whose English uses the term (by its `find` pattern, or its `keys` list). */
function usedIn(term, messages) {
  const keys = new Set();
  const find = term.find ? new RegExp(term.find, 'iu') : null;
  for (const l of LOCALES) {
    for (const k of Object.keys(messages[l])) {
      const english = englishOf(messages, k);
      if (english === undefined) continue;
      if (term.keys ? term.keys.includes(k) : find.test(english)) keys.add(k);
    }
  }
  return [...keys].sort();
}

// --- The checks -------------------------------------------------------------------

/** Where a language's entry of a term is checked against: { kind, … } */
const sourceOf = (term, e) => e.source ?? term.source;

function wikidataForms(items, ids, l) {
  const labels = [];
  const articles = [];
  for (const q of ids) {
    const it = items[q];
    if (!it) continue;
    if (it.labels[l]) labels.push(it.labels[l]);
    if (it.articles[l]) articles.push(it.articles[l]);
  }
  return { labels, articles };
}

export function checkTerms({ record, messages, wikidata = loadWikidata(), vendors = loadVendors(), meaning = read('docs/language/pages-rest-meaning.json') }) {
  const problems = [];
  const bad = (what) => problems.push(what);
  for (const [id, term] of Object.entries(record.terms)) {
    if (!term.find && !term.keys) bad(`${id}: neither "find" nor "keys" says which strings use it`);
    const keys = usedIn(term, messages);
    if (!keys.length) bad(`${id}: no English string uses it any more`);
    for (const l of LOCALES) {
      if (l === 'en') continue;
      const e = term.langs?.[l];
      const at = `${id}/${l}`;
      if (!e) {
        bad(`${at}: no entry`);
        continue;
      }
      if (!RELATIONS.includes(e.rel)) bad(`${at}: relation "${e.rel}" is not one of ${RELATIONS.join(', ')}`);
      if (e.rel === 'other' && !e.note) bad(`${at}: an "other" word needs a note saying why the source's word was not used`);
      const src = sourceOf(term, e);
      const word = norm(e.word, l);
      const theirs = norm(e.sourceForm ?? e.word, l);

      // 1. The relation holds against the saved source.
      if (src.kind === 'wikidata') {
        const ids = e.item ? [e.item] : src.items ?? [src.item];
        for (const q of ids) if (!wikidata[q]) bad(`${at}: ${q} is in no saved Wikidata answer`);
        const { labels, articles } = wikidataForms(wikidata, ids, l);
        const pool = e.from === 'article' ? articles : e.from === 'label' || !e.from ? labels : [];
        if (e.from && !['label', 'article'].includes(e.from)) bad(`${at}: "from" must be label or article`);
        const shown = `label ${labels.map((x) => `"${x}"`).join(', ') || 'none'}, article ${articles.map((x) => `"${x}"`).join(', ') || 'none'}`;
        if (e.rel === 'same' && !pool.some((x) => norm(x, l) === theirs)) bad(`${at}: "${e.sourceForm ?? e.word}" is said to be Wikidata's ${e.from ?? 'label'}, but Wikidata has ${shown}`);
        if (e.rel === 'part' && !pool.some((x) => norm(x, l) !== theirs && norm(x, l).includes(theirs))) bad(`${at}: "${e.sourceForm ?? e.word}" is said to be part of Wikidata's ${e.from ?? 'label'}, but Wikidata has ${shown}`);
        if (e.rel === 'contains' && !pool.some((x) => norm(x, l) !== word && word.includes(norm(x, l)))) bad(`${at}: "${e.word}" is said to contain Wikidata's ${e.from ?? 'label'}, but Wikidata has ${shown}`);
        if (e.rel === 'script') {
          const map = e.script ?? {};
          if (!Object.keys(map).length) bad(`${at}: a "script" word needs its character map`);
          if (!pool.some((x) => [...x].map((ch) => map[ch] ?? ch).join('') === e.word)) bad(`${at}: "${e.word}" is not Wikidata's ${e.from ?? 'label'} (${shown}) through the map ${JSON.stringify(map)}`);
        }
        if (e.rel === 'other') {
          if (!labels.length && !articles.length) bad(`${at}: "other" means Wikidata has a word that was not used, but it has none: write "none"`);
          if ([...labels, ...articles].some((x) => norm(x, l) === word)) bad(`${at}: "${e.word}" is Wikidata's own word (${shown}): write "same"`);
        }
        if (e.rel === 'none' && (labels.length || articles.length)) bad(`${at}: "none" says Wikidata has nothing in this language, but it has ${shown}`);
      } else if (src.kind in vendors) {
        const text = vendors[src.kind](l, src.term);
        const name = `${VENDOR_NAMES[src.kind]}${src.term ? ` "${src.term}"` : ''}`;
        if (e.rel === 'same' && !(text && norm(text, l).includes(theirs))) bad(`${at}: "${e.sourceForm ?? e.word}" is said to be ${name}'s word, but its text ${text ? `does not have it: ${text}` : 'is not there in this language'}`);
        if (e.rel === 'other' && !text) bad(`${at}: "other" means ${name} has a word that was not used, but it has no text in this language: write "none"`);
        if (e.rel === 'none' && text) bad(`${at}: "none" says ${name} has nothing in this language, but it has: ${text}`);
        if (!['same', 'other', 'none'].includes(e.rel)) bad(`${at}: a vendor's word is "same", "other" or "none"`);
      } else if (src.kind === 'model') {
        if (e.rel !== 'none') bad(`${at}: a term with no source can only be "none"`);
      } else {
        bad(`${at}: unknown source kind "${src.kind}"`);
      }
      if (e.sourceForm && !e.note) bad(`${at}: a sourceForm needs a note saying how the word comes from it`);

      // 2. The strings use the word.
      const forms = [e.word, ...(e.spellings ?? [])].map((s) => norm(s, l));
      for (const k of keys) {
        const v = messages[l][k];
        if (v === undefined) continue;
        const uses = forms.some((f) => norm(v, l).includes(f));
        const excused = e.notIn?.[k];
        if (!uses && !excused) bad(`${at}: ${k} does not say "${e.word}"${e.spellings?.length ? ` (or ${e.spellings.map((s) => `"${s}"`).join(', ')})` : ''}: ${v}`);
        if (uses && excused) bad(`${at}: ${k} is excused from saying "${e.word}" but does say it: drop the excuse`);
      }
      for (const k of Object.keys(e.notIn ?? {})) if (!keys.includes(k)) bad(`${at}: the excuse for ${k} is about a string whose English does not use the term`);
    }
  }

  // 3. What the meaning record says about sources agrees with this record.
  for (const r of meaning.reviewed) {
    const at = `pages-rest-meaning.json ${r.lang} ${r.id}`;
    const claims = /Wikidata|\bQ\d{3,}\b|\bApple\b|\bAndroid\b|\bAOSP\b/.test(r.note ?? '');
    const term = r.term ? record.terms[r.term] : null;
    if (r.term && !term) bad(`${at}: names the term "${r.term}", which the terms record does not have`);
    if (claims && !r.term) bad(`${at}: the note names a source, but the verdict names no term of the terms record: ${r.note}`);
    if (!term) continue;
    const e = term.langs[r.lang];
    if (!e) continue;
    const src = sourceOf(term, e);
    if (e.rel === 'none' && claims) bad(`${at}: the note names a source for "${e.word}", which the terms record says is the model's word, with no source: ${r.note}`);
    if (e.rel === 'none' && !/no source/.test(r.note ?? '')) bad(`${at}: the terms record says "${e.word}" has no source, and the note must say so ("no source"): ${r.note}`);
    const ids = src.kind === 'wikidata' ? (e.item ? [e.item] : src.items ?? [src.item]) : [];
    for (const m of (r.note ?? '').matchAll(/\bQ\d{3,}\b/g)) if (!ids.includes(m[0])) bad(`${at}: the note cites ${m[0]}, but the term's item is ${ids.join(', ') || 'not on Wikidata'}`);
    if (/Wikidata|\bQ\d{3,}\b/.test(r.note ?? '') && src.kind !== 'wikidata') bad(`${at}: the note names Wikidata, but the term's source is ${src.kind}`);
  }
  return problems;
}

// --- The tables of the doc ------------------------------------------------------------

const md = (s) => s.replace(/\|/g, '\\|');

function cell(term, l, wikidata, vendors) {
  const e = term.langs[l];
  const src = sourceOf(term, e);
  const w = md(e.word);
  const note = e.note ? ` ${md(e.note)}` : '';
  if (src.kind === 'model') return `${w}${note ? `:${note}` : ''}`;
  if (src.kind !== 'wikidata') {
    const name = src.kind === 'aosp' ? 'Android' : 'Apple';
    if (e.rel === 'same') return `${w} = (${name}${e.sourceForm ? `: *${md(e.sourceForm)}*` : ''})${note ? `.${note}` : ''}`;
    if (e.rel === 'none') return `${w}: **none**.${note}`;
    return `**${w}**: ${name} has another word.${note}`;
  }
  const ids = e.item ? [e.item] : src.items ?? [src.item];
  const { labels, articles } = wikidataForms(wikidata, ids, l);
  const item = src.items && e.item ? ` (${e.item})` : '';
  const pool = e.from === 'article' ? articles : labels;
  const it = (xs) => xs.map((x) => `*${md(x)}*`).join(', ');
  switch (e.rel) {
    case 'same':
      return `${w} =${e.from === 'article' ? ' (article)' : ''}${e.sourceForm ? ` (*${md(e.sourceForm)}*)` : ''}${item}${note ? `.${note}` : ''}`;
    case 'part':
      return `${w} (from ${e.from === 'article' ? 'the article ' : ''}${it(pool.filter((x) => norm(x, l).includes(norm(e.sourceForm ?? e.word, l))))})${item}${note ? `.${note}` : ''}`;
    case 'contains':
      return `${w} (with ${e.from === 'article' ? 'the article ' : ''}${it(pool.filter((x) => norm(e.word, l).includes(norm(x, l))))})${item}${note ? `.${note}` : ''}`;
    case 'script':
      return `${w} (${it(pool)}, Traditional)${item}${note ? `.${note}` : ''}`;
    case 'other':
      return `**${w}**. Wikidata: ${labels.length ? `label ${it(labels)}` : 'no label'}${articles.length ? `, article ${it(articles)}` : ''}.${note}`;
    default:
      return `${w}: **none**.${note}`;
  }
}

/** The Markdown table of one group of terms. */
export function renderGroup(record, groupId, wikidata = loadWikidata(), vendors = loadVendors()) {
  const group = record.groups.find((g) => g.id === groupId);
  if (!group) throw new Error(`no group ${groupId}`);
  const terms = group.terms.map((t) => [t, record.terms[t]]);
  const head = terms.map(([, t]) => {
    const s = t.source;
    const where = s.kind === 'wikidata' ? ` (${(s.items ?? [s.item]).join(', ')})` : s.kind === 'model' ? ' (no source)' : '';
    return md(`${t.en}${where}`);
  });
  const rows = [`| | ${head.join(' | ')} |`, `|---|${terms.map(() => '---|').join('')}`];
  for (const l of LOCALES) if (l !== 'en') rows.push(`| ${l} | ${terms.map(([, t]) => cell(t, l, wikidata, vendors)).join(' | ')} |`);
  return rows.join('\n');
}

const BLOCK = (id) => new RegExp(`<!-- terms:${id} -->\\n[\\s\\S]*?<!-- /terms:${id} -->`);

/** The doc with each group's table drawn again from the record. */
export function renderDoc(doc, record, wikidata = loadWikidata(), vendors = loadVendors()) {
  let out = doc;
  for (const g of record.groups) {
    if (!BLOCK(g.id).test(out)) throw new Error(`docs/language/pages-rest.md has no <!-- terms:${g.id} --> block`);
    out = out.replace(BLOCK(g.id), () => `<!-- terms:${g.id} -->\n${renderGroup(record, g.id, wikidata, vendors)}\n<!-- /terms:${g.id} -->`);
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const record = read('docs/language/pages-rest-terms.json');
  const messages = await loadMessages();
  const problems = checkTerms({ record, messages });
  const docFile = path.join(ROOT, 'docs/language/pages-rest.md');
  const doc = readFileSync(docFile, 'utf8');
  const wanted = renderDoc(doc, record);
  if (process.argv.includes('--write')) {
    if (wanted !== doc) writeFileSync(docFile, wanted);
    console.log(wanted !== doc ? 'rewrote the term tables of docs/language/pages-rest.md' : 'the term tables were up to date');
  } else if (wanted !== doc) {
    problems.push('the term tables of docs/language/pages-rest.md are not the ones the record draws: run node scripts/pages-rest/terms.mjs --write');
  }
  for (const p of problems) console.log(p);
  console.log(`${Object.keys(record.terms).length} terms, ${problems.length} problem(s)`);
  process.exit(problems.length ? 1 : 0);
}
