#!/usr/bin/env node
// What the language tools said about the page areas, language by language:
//
//   node scripts/pages-rest/summarise.mjs <dir with spell.json, grammar.json, bt.json> [--low N] [--strict]
//
// Prints a Markdown table (words Hunspell rejected, LanguageTool matches, back-translation
// and LaBSE scores, whether they tell a right English sentence from a wrong one, and how many
// strings the meaning check flags), then what a person should read: every LanguageTool match,
// every flagged string, and the N back-translations furthest from their English in each
// language.
//
// The meaning check flags a string when both the back-translation (MADLAD-400, scored with
// MiniLM against the English) and LaBSE (the translation against the English directly) score
// it under 0.6: the rule of branch lang/qa-pipeline (scripts/lang/meaning.mjs). A flag is a
// question, not a verdict. Each flagged string that was read is recorded, with its exact
// text and what was decided, in docs/language/pages-rest-meaning.json; a record whose text no
// longer matches the string is void. --strict exits 1 when a flagged string has no valid
// record, so a changed string is read again.
//
// It decides nothing; docs/language/pages-rest.md says what was read and what was changed.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const [dir, ...rest] = process.argv.slice(2);
if (!dir) {
  console.error('usage: node scripts/pages-rest/summarise.mjs <dir> [--low N] [--strict]');
  process.exit(2);
}
const low = rest.includes('--low') ? Number(rest[rest.indexOf('--low') + 1]) : 8;
const strict = rest.includes('--strict');
const T = 0.6;
const read = (f) => (existsSync(path.join(dir, f)) ? JSON.parse(readFileSync(path.join(dir, f), 'utf8')) : null);
const spell = read('spell.json');
const grammar = read('grammar.json');
const bt = read('bt.json');
const reviewedFile = path.join(ROOT, 'docs/language/pages-rest-meaning.json');
const reviewed = existsSync(reviewedFile) ? JSON.parse(readFileSync(reviewedFile, 'utf8')).reviewed : [];
const LOCALES = ['es', 'fr', 'de', 'it', 'pt', 'pl', 'ru', 'ar', 'hi', 'zh', 'ja', 'ko', 'vi', 'th', 'id'];
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
};
const flagged = (p) => typeof p.cos === 'number' && typeof p.xcos === 'number' && p.cos < T && p.xcos < T;
const record = (p) => reviewed.find((r) => r.lang === p.lang && r.id === p.id && r.text === p.text);

console.log('| | Hunspell: words rejected | LanguageTool: matches | back-translated | median cos (right English) | median cos (wrong English) | right > wrong | median LaBSE (right) | median LaBSE (wrong) | flagged (both < 0.6) | flagged, read |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|');
let open = 0;
for (const l of LOCALES) {
  const s = spell?.languages?.[l];
  const g = grammar?.languages?.[l];
  const rows = (bt ?? []).filter((p) => p.lang === l && typeof p.cos === 'number');
  const sp = !s ? 'not run' : s.checked ? `${Object.keys(s.rejected).length} of ${s.words}` : 'no dictionary';
  const gr = !g ? 'not run' : g.checked ? `${g.hits.length} in ${g.strings} strings` : 'no rules for the language';
  // A row scored again on its own (scoredAlone: after a fix, with bt-pairs) has no real control:
  // its "wrong English" was the next row of a short list, often itself.
  const controlled = rows.filter((p) => !p.scoredAlone);
  const better = controlled.filter((p) => p.cos > p.controlCos).length;
  const x = rows.filter((p) => typeof p.xcos === 'number');
  const xc = x.filter((p) => !p.scoredAlone);
  const flags = rows.filter(flagged);
  const read_ = flags.filter(record).length;
  open += flags.length - read_;
  const b = rows.length
    ? `${rows.length} | ${median(rows.map((p) => p.cos)).toFixed(2)} | ${median(controlled.map((p) => p.controlCos)).toFixed(2)} | ${better} of ${controlled.length} | ${x.length ? median(x.map((p) => p.xcos)).toFixed(2) : 'not run'} | ${xc.length ? median(xc.map((p) => p.controlX)).toFixed(2) : ''} | ${x.length ? flags.length : ''} | ${x.length ? read_ : ''}`
    : 'not run | | | | | | |';
  console.log(`| ${l} | ${sp} | ${gr} | ${b} |`);
}

if (grammar) {
  console.log('\n## LanguageTool matches\n');
  for (const l of LOCALES) {
    const g = grammar.languages?.[l];
    if (!g?.checked || !g.hits.length) continue;
    console.log(`### ${l}`);
    for (const h of g.hits) console.log(`- ${h.key} [${h.rule}] "${h.at}": ${h.message}${h.suggestions.length ? ` (→ ${h.suggestions.join(' / ')})` : ''}\n  ${h.text}`);
  }
}

if (bt) {
  console.log('\n## Flagged by the meaning check (back-translation and LaBSE both under 0.6)\n');
  for (const l of LOCALES) {
    const rows = bt.filter((p) => p.lang === l && flagged(p)).sort((a, b) => a.xcos - b.xcos);
    if (!rows.length) continue;
    console.log(`### ${l}`);
    for (const p of rows) {
      const r = record(p);
      console.log(`- ${p.id} cos ${p.cos.toFixed(2)} LaBSE ${p.xcos.toFixed(2)}${r ? ` READ: ${r.verdict}${r.note ? ` (${r.note})` : ''}` : ' NOT READ'}\n  text: ${p.text}\n  back: ${p.back}\n  en:   ${p.english}`);
    }
  }
  if (low) {
    console.log(`\n## The ${low} back-translations furthest from their English, per language\n`);
    for (const l of LOCALES) {
      const rows = bt.filter((p) => p.lang === l && typeof p.cos === 'number').sort((a, b) => a.cos - b.cos).slice(0, low);
      if (!rows.length) continue;
      console.log(`### ${l}`);
      for (const p of rows) console.log(`- ${p.id} cos ${p.cos.toFixed(2)}${typeof p.xcos === 'number' ? ` LaBSE ${p.xcos.toFixed(2)}` : ''} chrF ${p.chrf ?? '?'}\n  text: ${p.text}\n  back: ${p.back}\n  en:   ${p.english}`);
    }
  }
}

if (strict && bt) {
  // The scores must be of the strings as they are now: a string changed after it was scored,
  // or added since, has not been checked at all.
  const { extract } = await import('./lang-check.mjs');
  const now = (await extract()).locales;
  const scored = new Map(bt.map((p) => [`${p.lang} ${p.id}`, p.text]));
  const stale = [];
  for (const [l, items] of Object.entries(now)) {
    if (l === 'en') continue;
    for (const [id, item] of Object.entries(items)) {
      const was = scored.get(`${l} ${id}`);
      if (was === undefined) stale.push(`${l} ${id}: never scored`);
      else if (was !== item.text) stale.push(`${l} ${id}: changed since it was scored ("${was}" -> "${item.text}")`);
    }
  }
  for (const s of stale) console.error(`STALE ${s}`);
  if (stale.length) console.error(`${stale.length} string(s) not scored as they stand: back-translate them (scripts/pages-rest/lang-host.sh bt-pairs) and merge the rows`);
  if (open) console.error(`${open} flagged string(s) have no record in docs/language/pages-rest-meaning.json (or their text changed since)`);
  process.exit(open || stale.length ? 1 : 0);
}
