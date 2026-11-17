#!/usr/bin/env node
/**
 * Are the tool results about the strings as they are now?
 *
 *   node scripts/lang/fresh.mjs [--grammar docs/language/results/grammar.json] [--review docs/language/results/review.json]
 *
 * grammar.json keeps every sentence LanguageTool and Hunspell read (`checked`, per string). This
 * rebuilds the same sentences from the locale files and the packs (lib/strings.mjs, grammarItems)
 * and lists every string whose sentences differ from what was checked, or that was not checked at
 * all. Exit 1 if there is one: a grammar result older than the strings is no evidence about them.
 * (On 2026-11-16 a grammar run finished 30 s before a commit changed a Russian power word, and the
 * result file could not say whether it had seen the change. meaning.mjs makes the same comparison
 * for the back-translation, which keeps its text.)
 *
 * The second model's review is reported too, as information: how many interface strings have changed
 * since it read them. It is a proposal, not a check, so it does not fail the run.
 */
import { allStrings, grammarItems, checkedTexts, readJson, ROOT, LOCALES, HOUSE_QUOTES } from './lib/strings.mjs';

const args = process.argv.slice(2);
const opt = (name, dflt) => (args.includes(name) ? args[args.lastIndexOf(name) + 1] : dflt);
const grammar = readJson(opt('--grammar', `${ROOT}docs/language/results/grammar.json`));
const review = readJson(opt('--review', `${ROOT}docs/language/results/review.json`), null);
const strings = await allStrings();
let stale = 0;
const rows = [];
for (const lang of LOCALES) {
  const g = grammar.languages?.[lang];
  const now = checkedTexts(await grammarItems(lang, strings[lang]));
  const ids = Object.keys(now);
  if (!g?.checked) {
    rows.push({ lang, strings: ids.length, stale: ids.length, why: g ? 'the result keeps no text (made before 2026-11-16)' : 'not checked' });
    stale += ids.length;
    continue;
  }
  const changed = ids.filter((id) => JSON.stringify(g.checked[id] ?? null) !== JSON.stringify(now[id]));
  for (const id of changed.slice(0, 20)) console.log(`${lang}\t${id}\t${g.checked[id] ? 'changed since it was checked' : 'never checked'}: ${now[id][0]}`);
  rows.push({ lang, strings: ids.length, stale: changed.length });
  stale += changed.length;
  let since = '';
  if (review?.languages?.[lang]) {
    const r = review.languages[lang].reviewed;
    const ui = Object.keys(strings[lang].ui).filter((k) => !(k in HOUSE_QUOTES));
    since = ` ${ui.filter((k) => r[k]?.translation !== strings[lang].ui[k]).length} of ${ui.length} interface strings changed or unread since the second model's review.`;
  }
  rows[rows.length - 1].review = since;
}
for (const r of rows) console.log(`${r.lang}\tgrammar: ${r.stale} of ${r.strings} strings not checked as they are now${r.why ? ` (${r.why})` : ''}.${r.review ?? ''}`);
console.log(`${stale} strings whose grammar result is not about their current text`);
process.exit(stale ? 1 : 0);
