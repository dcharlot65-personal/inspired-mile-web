#!/usr/bin/env node
/**
 * Which page strings may have drifted from the English, from a back-translation run
 * (scripts/pages-lang/meaning-run.sh, which uses lang/qa-pipeline's backtranslate.py).
 *
 *   node scripts/pages-lang/meaning.mjs --bt bt.json [--threshold 0.6] [--xthreshold 0.6] [--json out.json]
 *   node scripts/pages-lang/meaning.mjs --selftest
 *
 * The rule is lang/qa-pipeline's (scripts/lang/meaning.mjs): a string is flagged when the MiniLM
 * cosine of its back-translation and the English is under the threshold AND LaBSE, which scores the
 * translation against the English directly, is under its own. MADLAD copies a short label through
 * untranslated, so back-translation alone flags labels by the dozen; both counts are reported.
 *
 * Those two scores are similarities of meaning in bulk: on the probe of 2026-11-16 (RESULTS.md) a
 * German "Hamlet ist ein Relikt" for "Hamlet is not a relic" scored 0.94 and 0.74, and a Spanish
 * "como mínimo 2" for "at most 2" 0.98 and 0.87, though MADLAD's own English said "is a relic" and
 * "at least 2". So the back-translation's words are read as well, by rule (polarity()): a negation,
 * a lower or upper bound ("at least", "at most", "up to"…) or a number that the English has and the
 * back-translation lacks, or the other way round, flags the string too.
 *
 * Every flagged string is either changed or listed in docs/language/pages-core/allow-meaning.json
 * with the reason a reader accepted it. An entry names the exact text, so changing the string voids
 * it. A string whose text is not the text that was scored is "not scored": an old score says nothing
 * about new text. The control column is the share of deliberately wrong pairs (each string against
 * another string's English, bt-control.py) that the same rule flags: the proof it can tell them apart.
 *
 * Exit 1 on an open flag, a string not scored, or an allowlist entry that no longer matches anything.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LOCALES, ROOT, SOURCED, areas, readArea, rendered } from './strings.mjs';

const args = process.argv.slice(2);
const opt = (name, dflt) => (args.includes(name) ? args[args.indexOf(name) + 1] : dflt);
const T = Number(opt('--threshold', '0.6'));
const TX = Number(opt('--xthreshold', '0.6'));
const ALLOW_FILE = join(ROOT, 'docs/language/pages-core/allow-meaning.json');

/** True when both signals doubt the pair. A pair with no score (a control that could not be formed) is not doubted. */
export const doubt = (cos, x, t = T, tx = TX) => typeof cos === 'number' && cos < t && (typeof x !== 'number' || x < tx);

const NUMBER_WORDS = { one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10', eleven: '11', twelve: '12', twenty: '20', fifty: '50', hundred: '100' };
// "rather than" and "instead of" negate what follows as surely as "not": MADLAD writes "not half" for "instead of half".
const NEGATION = /\b(?:not|no|never|none|nothing|nobody|without|cannot|neither|nor|rather than|instead of)\b|n['’]t\b/i;
const LOWER = /\b(?:at least|or more|or higher|or above|minimum|min|more than)\b/i;
const UPPER = /\b(?:at most|or fewer|or less|maximum|max|up to|no more than|less than|fewer than)\b/i;

// Bounds said with a negation ("no more than 3") are bounds, not negations: taken out first.
const NEGATED_UPPER = /\b(?:no|not) (?:more|greater|higher|longer) than\b/gi;
const NEGATED_LOWER = /\b(?:no|not) (?:less|fewer|lower|shorter) than\b/gi;

/** What a sentence says by its words alone: negated or not, its bounds, its numbers. */
function marks(s) {
  // MADLAD's output sometimes carries HTML entities and a split contraction: "doesn &apos;t".
  let words = s.replace(/&apos;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/(\w) '(\w)/g, "$1'$2").toLowerCase().replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|fifty|hundred)\b/g, (w) => NUMBER_WORDS[w]);
  const negatedUpper = words.search(NEGATED_UPPER) >= 0;
  const negatedLower = words.search(NEGATED_LOWER) >= 0;
  words = words.replace(NEGATED_UPPER, ' ').replace(NEGATED_LOWER, ' ');
  // One is left out: back-translations write "one" for an article ("answer one question" for "a question").
  const numbers = (words.replace(/(\d),(\d{3})/g, '$1$2').match(/\d+(?:\.\d+)?/g) ?? []).filter((n) => n !== '1').sort();
  return { negated: NEGATION.test(words), lower: negatedLower || LOWER.test(words), upper: negatedUpper || UPPER.test(words), numbers };
}

/** The ways a back-translation's words disagree with the English: polarity, bounds and numbers. */
export function polarity(english, back) {
  const a = marks(english);
  const b = marks(back);
  const out = [];
  if (a.negated !== b.negated) out.push(a.negated ? 'the English is negated, the back-translation is not' : 'the back-translation is negated, the English is not');
  if (a.lower !== b.lower) out.push(a.lower ? 'lower bound lost' : 'lower bound added');
  if (a.upper !== b.upper) out.push(a.upper ? 'upper bound lost' : 'upper bound added');
  if (a.numbers.join(' ') !== b.numbers.join(' ')) out.push(`numbers ${a.numbers.join(',') || '-'} became ${b.numbers.join(',') || '-'}`);
  return out;
}

/**
 * strings: { lang: { key: rendered text } }, english: { key: rendered text }, rows: the scored pairs,
 * allow: [{ lang, key, text, reason }]. Returns the per-language summary, the open items and the
 * stale allowlist entries.
 */
export function judge(strings, rows, allow, t = T, tx = TX) {
  const scored = new Map(rows.map((r) => [`${r.lang}\u0000${r.id}`, r]));
  const used = new Set();
  const summary = {};
  const open = [];
  for (const [lang, byKey] of Object.entries(strings)) {
    const row = (summary[lang] = { strings: 0, scored: 0, backOnly: 0, flagged: 0, polarity: 0, accepted: 0, open: 0, notScored: 0, control: 0 });
    for (const [key, text] of Object.entries(byKey)) {
      row.strings++;
      const s = scored.get(`${lang}\u0000${key}`);
      if (!s || s.text !== text) {
        row.notScored++;
        open.push({ lang, key, why: s ? 'changed since it was scored' : 'not scored', text });
        continue;
      }
      row.scored++;
      if (doubt(s.controlCos, s.xcontrol, t, tx)) row.control++;
      if (s.cos < t) row.backOnly++;
      const low = doubt(s.cos, s.xcos, t, tx);
      const words = polarity(s.english, s.back);
      if (low) row.flagged++;
      if (words.length) row.polarity++;
      if (!low && !words.length) continue;
      const i = allow.findIndex((a) => a.lang === lang && a.key === key && a.text === text);
      if (i >= 0) {
        used.add(i);
        row.accepted++;
      } else {
        row.open++;
        const why = [low ? `cos ${s.cos}, LaBSE ${s.xcos}, chrF ${s.chrf}` : '', ...words].filter(Boolean).join('; ');
        open.push({ lang, key, why, text, english: s.english, back: s.back });
      }
    }
  }
  const stale = allow.filter((_, i) => !used.has(i));
  return { summary, open, stale };
}

function current() {
  const strings = {};
  for (const a of areas()) {
    const en = readArea(a, 'en');
    for (const lang of LOCALES) {
      if (lang === 'en') continue;
      const m = readArea(a, lang);
      for (const key of Object.keys(en)) {
        if (SOURCED.test(key)) continue;
        (strings[lang] ??= {})[key] = rendered(m[key]);
      }
    }
  }
  return strings;
}

function selftest() {
  const strings = { es: { 'x.ok': 'Bien', 'x.bad': 'Mal', 'x.read': 'Leído', 'x.new': 'Nuevo texto', 'x.label': 'Mazo', 'x.flip': 'a', 'x.limit': 'b', 'x.neg': 'c', 'x.notneg': 'd', 'x.opp': 'e', 'x.num': 'f', 'x.num2': 'g', 'x.up': 'h', 'x.nomore': 'i', 'x.entity': 'j', 'x.instead': 'k' } };
  // What MADLAD really wrote for the planted errors of the probe (RESULTS.md), with its scores: high
  // enough to pass the cosine rule, caught by the words.
  const probe = (id, text, english, back, cos, xcos, controlCos = 0.1) => ({ lang: 'es', id, text, english, back, cos, xcos, controlCos, xcontrol: 0.1 });
  const rows = [
    { lang: 'es', id: 'x.ok', text: 'Bien', english: 'Fine', back: 'Fine', cos: 0.95, xcos: 0.9, controlCos: 0.1, xcontrol: 0.7 },
    { lang: 'es', id: 'x.bad', text: 'Mal', english: 'Fine', back: 'Bad', cos: 0.3, xcos: 0.4, controlCos: 0.1, xcontrol: 0.2 },
    { lang: 'es', id: 'x.read', text: 'Leído', english: 'Read', back: 'Lid', cos: 0.2, xcos: 0.5, controlCos: 0.1, xcontrol: 0.2 },
    { lang: 'es', id: 'x.new', text: 'Texto viejo', english: 'New text', back: 'Old text', cos: 0.7, xcos: 0.8, controlCos: 0.1, xcontrol: 0.7 },
    // back-translation alone doubts a copied-through label; LaBSE does not: not flagged
    { lang: 'es', id: 'x.label', text: 'Mazo', english: 'Deck', back: 'Mazo', cos: 0.2, xcos: 0.8, controlCos: 0.1, xcontrol: 0.1 },
    probe('x.flip', 'a', 'Relics in a deck: at most 2.', 'Relics in a deck: at least 2.', 0.9783, 0.8657),
    // a control that could not be formed (null) is not counted as caught
    probe('x.limit', 'b', 'Relics in a deck: at most 2.', 'Relics in a deck: maximum 2.', 0.9516, 0.86, null),
    probe('x.neg', 'c', 'Hamlet is not a relic.', 'Hamlet is a relic.', 0.9373, 0.7429),
    probe('x.notneg', 'd', 'Hamlet is not a relic.', 'Hamlet is not a relic.', 1, 0.8725),
    probe('x.opp', 'e', 'Delete deck Hamlet', 'Do not delete the deck', 0.767, 0.4469),
    probe('x.num', 'f', 'Ink cost: 3.', 'Ink cost: three.', 0.9, 0.9),
    probe('x.num2', 'g', 'Ink cost: 3.', 'Ink cost: 5.', 0.9, 0.9),
    probe('x.up', 'h', 'Characters: up to 5.', 'Characters: 5.', 0.9, 0.9),
    // MADLAD's words for a Thai "ไม่เกิน 3": a bound, not a negation
    probe('x.nomore', 'i', 'Characters in a deck: at most 3.', 'No more than three characters.', 0.9, 0.9),
    // what MADLAD wrote for the Japanese and Vietnamese pages: negated on both sides
    probe('x.entity', 'j', 'Classroom mode stores no grades or student work', 'Classroom mode doesn &apos;t save grades or student work .', 0.9, 0.9),
    probe('x.instead', 'k', 'Hamlet adds three quarters to your craft instead of half.', 'Hamlet adds three quarters to your skill, not half.', 0.9, 0.9),
  ];
  const allow = [
    { lang: 'es', key: 'x.read', text: 'Leído', reason: 'test' },
    // an entry for the string's earlier text excuses nothing, and is stale
    { lang: 'es', key: 'x.bad', text: 'Malo', reason: 'test' },
    { lang: 'es', key: 'x.gone', text: 'nada', reason: 'test' },
  ];
  const { summary, open, stale } = judge(strings, rows, allow);
  const got = {
    open: open.map((o) => `${o.key}:${o.why.split(' ')[0]}`).sort(),
    stale: stale.map((s) => s.key),
    es: summary.es,
  };
  const want = {
    open: ['x.bad:cos', 'x.flip:lower', 'x.neg:the', 'x.new:changed', 'x.num2:numbers', 'x.opp:the', 'x.up:upper'],
    stale: ['x.bad', 'x.gone'],
    es: { strings: 16, scored: 15, backOnly: 3, flagged: 2, polarity: 5, accepted: 1, open: 6, notScored: 1, control: 13 },
  };
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(ok ? 'selftest: every planted case judged as expected' : `selftest FAILED\n got  ${JSON.stringify(got)}\n want ${JSON.stringify(want)}`);
  process.exit(ok ? 0 : 1);
}

if (args.includes('--selftest')) selftest();
const btPath = opt('--bt', '');
if (!btPath) {
  console.error('usage: meaning.mjs --bt bt.json [--json out.json] | --selftest');
  process.exit(2);
}
const rows = JSON.parse(readFileSync(btPath, 'utf8'));
let allow = [];
try {
  allow = JSON.parse(readFileSync(ALLOW_FILE, 'utf8')).entries;
} catch {}
const { summary, open, stale } = judge(current(), rows, allow);
const jsonOut = opt('--json', '');
if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ threshold: T, xthreshold: TX, summary, open, stale }, null, 1) + '\n');
console.log(`threshold: MiniLM cosine < ${T} and LaBSE < ${TX}`);
console.log('lang\tstrings\tscored\tback-translation alone\tflagged (both)\tpolarity, bounds, numbers\taccepted\topen\tnot scored\tcontrol flagged');
for (const [l, r] of Object.entries(summary)) console.log(`${l}\t${r.strings}\t${r.scored}\t${r.backOnly}\t${r.flagged}\t${r.polarity}\t${r.accepted}\t${r.open}\t${r.notScored}\t${r.control} (${r.scored ? Math.round((100 * r.control) / r.scored) : 0}%)`);
for (const o of open) console.log(`${o.lang}\t${o.key}\t${o.why}${o.back !== undefined ? `\n\t  text: ${o.text}\n\t  en:   ${o.english}\n\t  back: ${o.back}` : ''}`);
for (const s of stale) console.log(`STALE allowlist entry: ${s.lang} ${s.key}`);
process.exit(open.length || stale.length ? 1 : 0);
