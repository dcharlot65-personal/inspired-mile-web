#!/usr/bin/env node
/**
 * The mechanical checks, from the command line (the unit tests run the same).
 *
 *   node scripts/lang/check.mjs            every language; exit 1 if anything is open
 *   node scripts/lang/check.mjs --json     the problems as JSON (allowlisted ones marked)
 */
import { allStrings, readJson, ROOT, HOUSE_QUOTES, LOCALES, parseMessage } from './lib/strings.mjs';
import { applyAllowlist, checkLanguage, untranslated } from './lib/mechanical.mjs';
const { argumentNames, pluralBlocks } = await import('../../src/lib/verse/msg.ts');

const cldr = readJson(`${ROOT}docs/language/sources/cldr.json`);
const allow = readJson(`${ROOT}docs/language/allow/mechanical.json`, { entries: [], extraQuotes: {} });
const same = readJson(`${ROOT}docs/language/allow/untranslated.json`, { entries: [] });
const strings = await allStrings();
const problems = [];
for (const lang of LOCALES) {
  problems.push(...checkLanguage(lang, strings[lang].ui, strings.en.ui, cldr.languages[lang], { parseMessage, argumentNames, pluralBlocks }, { quotations: HOUSE_QUOTES, extraQuotes: allow.extraQuotes }));
  for (const key of untranslated(lang, strings[lang].ui, strings.en.ui, HOUSE_QUOTES)) problems.push({ lang, key, rule: 'same-as-english', detail: strings.en.ui[key] });
}
const { open, used, unused } = applyAllowlist(problems, [...allow.entries, ...same.entries.map((e) => ({ ...e, rule: 'same-as-english' }))]);
if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ open, allowed: used.length, unused }, null, 1));
} else {
  for (const p of open) console.log(`${p.lang}\t${p.rule}\t${p.key}\t${p.detail}`);
  for (const u of unused) console.log(`UNUSED allowlist entry: ${u.lang} ${u.rule} ${u.key}`);
  console.log(`${problems.length} findings, ${used.length} allowlisted, ${open.length} open, ${unused.length} stale allowlist entries`);
}
process.exit(open.length || unused.length ? 1 : 0);
