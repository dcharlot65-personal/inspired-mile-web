#!/usr/bin/env node
/**
 * Read the back-translation scores (scripts/lang/backtranslate.py) and say
 * which strings may have drifted from the English.
 *
 *   node scripts/lang/meaning.mjs --bt .langqa/bt.json [--threshold 0.6] [--json]
 *
 * A string is flagged when the cosine similarity between its back-translation
 * and the English source is under the threshold. A flag is a question, not a
 * verdict: short labels and idioms back-translate loosely. Every flagged string
 * is either fixed or listed in docs/language/allow/meaning.json with the reason
 * a reader accepted it. A string whose text has changed since it was scored is
 * reported as not scored: an old score is not evidence about new text.
 *
 * The control column is the proof the measure can tell right from wrong: the
 * share of deliberately mismatched pairs (each back-translation against the
 * next key's English) that fall under the same threshold.
 */
import { allStrings, renderSamples, readJson, ROOT, HOUSE_QUOTES, LOCALES } from './lib/strings.mjs';

const args = process.argv.slice(2);
const opt = (name, dflt) => (args.includes(name) ? args[args.indexOf(name) + 1] : dflt);
const bt = readJson(opt('--bt', `${ROOT}.langqa/bt.json`));
const T = Number(opt('--threshold', '0.6'));
const allow = readJson(`${ROOT}docs/language/allow/meaning.json`, { entries: [] }).entries;
const strings = await allStrings();
const summary = {};
const open = [];
const used = new Set();
for (const lang of LOCALES) {
  if (lang === 'en') continue;
  const scored = bt.languages?.[lang];
  const row = (summary[lang] = { strings: 0, scored: 0, flagged: 0, allowed: 0, open: 0, notScored: 0, controlCaught: null });
  if (!scored) {
    row.notScored = Object.keys(strings[lang].ui).length - Object.keys(HOUSE_QUOTES).length;
    open.push({ lang, key: '*', why: 'this language has not been back-translated' });
    continue;
  }
  let control = 0;
  for (const [key, template] of Object.entries(strings[lang].ui)) {
    if (key in HOUSE_QUOTES) continue;
    row.strings++;
    const s = scored[key];
    const now = (await renderSamples(lang, template, { typical: true, key }))[0].text;
    if (!s || s.text !== now) {
      row.notScored++;
      open.push({ lang, key, why: 'changed since it was scored; run the back-translation again', text: now });
      continue;
    }
    row.scored++;
    if (s.controlCos < T) control++;
    if (s.cos >= T) continue;
    row.flagged++;
    const i = allow.findIndex((a) => a.lang === lang && a.key === key && a.text === now);
    if (i >= 0) {
      used.add(i);
      row.allowed++;
    } else {
      row.open++;
      open.push({ lang, key, why: `cos ${s.cos}, chrF ${s.chrf}`, text: s.text, english: s.english, back: s.back });
    }
  }
  row.controlCaught = row.scored ? Math.round((100 * control) / row.scored) : null;
}
const stale = allow.filter((_, i) => !used.has(i));
if (args.includes('--json')) console.log(JSON.stringify({ threshold: T, summary, open, stale }, null, 1));
else {
  console.log('lang\tstrings\tscored\tflagged\taccepted\topen\tnot scored\tcontrol caught');
  for (const [l, r] of Object.entries(summary)) console.log(`${l}\t${r.strings}\t${r.scored}\t${r.flagged}\t${r.allowed}\t${r.open}\t${r.notScored}\t${r.controlCaught === null ? '—' : r.controlCaught + '%'}`);
  for (const o of open.slice(0, 400)) console.log(`${o.lang}\t${o.key}\t${o.why}${o.back ? `\n\t  now:  ${o.text}\n\t  en:   ${o.english}\n\t  back: ${o.back}` : ''}`);
  for (const s of stale) console.log(`STALE allowlist entry: ${s.lang} ${s.key}`);
}
process.exit(open.length || stale.length ? 1 : 0);
