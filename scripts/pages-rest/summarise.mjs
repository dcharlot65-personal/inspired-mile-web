#!/usr/bin/env node
// What the language tools said about the page areas, language by language:
//
//   node scripts/pages-rest/summarise.mjs <dir with spell.json, grammar.json, bt.json> [--low N]
//
// Prints a Markdown table (words Hunspell rejected, LanguageTool matches, back-translation
// scores and whether they tell a right English sentence from a wrong one), then the strings a
// person should read: every LanguageTool match, and the N back-translations furthest from
// their English in each language. It decides nothing; docs/language/pages-rest.md records
// what was read and what was changed.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const [dir, ...rest] = process.argv.slice(2);
if (!dir) {
  console.error('usage: node scripts/pages-rest/summarise.mjs <dir> [--low N]');
  process.exit(2);
}
const low = rest.includes('--low') ? Number(rest[rest.indexOf('--low') + 1]) : 8;
const read = (f) => (existsSync(path.join(dir, f)) ? JSON.parse(readFileSync(path.join(dir, f), 'utf8')) : null);
const spell = read('spell.json');
const grammar = read('grammar.json');
const bt = read('bt.json');
const LOCALES = ['es', 'fr', 'de', 'it', 'pt', 'pl', 'ru', 'ar', 'hi', 'zh', 'ja', 'ko', 'vi', 'th', 'id'];
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
};

console.log('| | Hunspell: words rejected | LanguageTool: matches | back-translations | median cos (right English) | median cos (wrong English) | right > wrong | median chrF |');
console.log('|---|---|---|---|---|---|---|---|');
for (const l of LOCALES) {
  const s = spell?.languages?.[l];
  const g = grammar?.languages?.[l];
  const rows = (bt ?? []).filter((p) => p.lang === l && typeof p.cos === 'number');
  const sp = !s ? 'not run' : s.checked ? `${Object.keys(s.rejected).length} of ${s.words}` : 'no dictionary';
  const gr = !g ? 'not run' : g.checked ? `${g.hits.length} in ${g.strings} strings` : 'no rules for the language';
  const better = rows.filter((p) => p.cos > p.controlCos).length;
  const b = rows.length
    ? `${rows.length} | ${median(rows.map((p) => p.cos)).toFixed(2)} | ${median(rows.map((p) => p.controlCos)).toFixed(2)} | ${better} of ${rows.length} | ${median(rows.map((p) => p.chrf ?? NaN)).toFixed(0)}`
    : 'not run | | | |';
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
  console.log(`\n## The ${low} back-translations furthest from their English, per language\n`);
  for (const l of LOCALES) {
    const rows = bt.filter((p) => p.lang === l && typeof p.cos === 'number').sort((a, b) => a.cos - b.cos).slice(0, low);
    if (!rows.length) continue;
    console.log(`### ${l}`);
    for (const p of rows) console.log(`- ${p.id} cos ${p.cos.toFixed(2)} chrF ${p.chrf ?? '?'}\n  text: ${p.text}\n  back: ${p.back}\n  en:   ${p.english}`);
  }
}
