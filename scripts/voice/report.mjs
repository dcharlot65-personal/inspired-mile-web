#!/usr/bin/env node
/**
 * The tables of docs/voice/G2P-MEASUREMENT.md, drawn from docs/voice/measurement.json
 * (scripts/voice/measure.mjs). Prints Markdown; the doc keeps them between the markers
 * <!-- tables --> and <!-- /tables -->, and `--write` puts them there.
 *
 *   node scripts/voice/report.mjs [--in results.json] [--write]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { align, bootstrap, scoreWords, wer } from './score.mjs';
import { HELD_OUT_SEEN } from './corpus.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const DOC = join(ROOT, 'docs/voice/G2P-MEASUREMENT.md');
const inArg = process.argv.indexOf('--in');
const m = JSON.parse(readFileSync(inArg > 0 ? process.argv[inArg + 1] : join(ROOT, 'docs/voice/measurement.json'), 'utf8'));

/** The margins, fixed before the full run (G2P-MEASUREMENT.md, "Margin"). */
export const MARGIN = { runningTextPoints: 1.0, wordsLost: 6 };

const pct = (x) => `${(x * 100).toFixed(2)}%`;
const pp = (x) => `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(2)}`;
const out = [];
const NAMES = { verse: 'verses (written opponent)', acrostic: 'acrostic lines', quote: 'card quotations', model: 'verses the models wrote', word: '200 words, in "I say … again."', 'running text': '**running text (all but the words)**', all: 'everything' };

out.push(`Run of ${m.date.slice(0, 10)} on ${m.node}, ${m.results.length} texts, ${Math.round(m.seconds / 60)} minutes. Kokoro ${m.kokoro.model} (${m.kokoro.dtype}, ${m.kokoro.voice}, speed ${m.kokoro.speed}, ${m.kokoro.runtime}); Whisper ${m.whisper.model} (${m.whisper.dtype}, Transformers.js ${m.whisper.transformers}).`);
out.push('');
out.push('| Texts | Items | Words | WER old (eSpeak) | WER new | New − old (points) | 95% interval (paired bootstrap) |');
out.push('|---|---:|---:|---:|---:|---:|---|');
for (const [k, s] of Object.entries(m.summary)) {
  out.push(`| ${NAMES[k] ?? k} | ${s.items} | ${s.words} | ${pct(s.old)} | ${pct(s.new)} | ${pp(s.difference)} | ${pp(s.interval95.low)} to ${pp(s.interval95.high)} |`);
}
// The six verses the G2P was tuned on before any full run (G2P-MEASUREMENT.md), left out.
const DEVELOPMENT = new Set(['verse-1', 'verse-2', 'verse-3', 'verse-4', 'verse-5', 'verse-6']);
const heldOut = m.results.filter((r) => r.category !== 'word' && !DEVELOPMENT.has(r.id));
{
  const o = wer(heldOut, 'old');
  const n = wer(heldOut, 'new');
  const ci = bootstrap(heldOut);
  out.push(`| running text without the six development verses | ${heldOut.length} | ${o.words} | ${pct(o.wer)} | ${pct(n.wer)} | ${pp(n.wer - o.wer)} | ${pp(ci.low)} to ${pp(ci.high)} |`);
}
const w = m.summary.word?.targetsHeard;
if (w) {
  out.push('');
  out.push(`The word itself heard (every part of it, spelt as written or a known variant): old ${w.old} of ${w.of}, new ${w.new} of ${w.of}.`);
  // Not all 200 are unseen by the voice (corpus.mjs HELD_OUT_SEEN): the same measure without them.
  const named = new Set(HELD_OUT_SEEN.named);
  const additions = new Set(HELD_OUT_SEEN.additions);
  const words = m.results.filter((r) => r.category === 'word');
  const heard = (rows) => [rows.filter((r) => r.old.targetHeard).length, rows.filter((r) => r.new.targetHeard).length, rows.length];
  out.push('');
  out.push('| The words | Words | Heard, old | Heard, new | New − old |');
  out.push('|---|---:|---:|---:|---:|');
  for (const [what, rows] of [
    ['all 200', words],
    [`not named in the voice's code, tests or notes (less ${named.size})`, words.filter((r) => !named.has(r.target))],
    [`also not in the game's own pronunciation additions (less ${additions.size} more): never seen by the voice`, words.filter((r) => !named.has(r.target) && !additions.has(r.target))],
  ]) {
    const [o, n, of] = heard(rows);
    out.push(`| ${what} | ${of} | ${o} | ${n} | ${n - o >= 0 ? '+' : '−'}${Math.abs(n - o)} |`);
  }
}
const rt = m.summary['running text'];
const verdict = [];
if (rt) verdict.push(`running text ${pp(rt.difference)} points (95% interval ${pp(rt.interval95.low)} to ${pp(rt.interval95.high)}) against a margin of +${MARGIN.runningTextPoints.toFixed(1)}: ${rt.difference * 100 <= MARGIN.runningTextPoints ? 'within' : '**outside**'}`);
if (w) verdict.push(`words heard ${w.new - w.old >= 0 ? '+' : ''}${w.new - w.old} against a margin of −${MARGIN.wordsLost}: ${w.old - w.new <= MARGIN.wordsLost ? 'within' : '**outside**'}`);
out.push('');
out.push(`**Against the margins:** ${verdict.join('; ')}.`);

out.push('');
out.push('### The new reading heard against the old');
out.push('');
out.push('The new transcript scored against the old one instead of the text: how often the two readings are heard differently at all, whichever is right.');
out.push('');
out.push('| Texts | Words heard in the old reading | New transcript against the old (word error rate) | Texts heard word for word alike |');
out.push('|---|---:|---:|---:|');
const groups = [...new Set(m.results.map((r) => r.category))].map((c) => [c, m.results.filter((r) => r.category === c)]);
groups.push(['running text', m.results.filter((r) => r.category !== 'word')]);
for (const [k, rows] of groups) {
  let edits = 0;
  let words = 0;
  let alike = 0;
  for (const r of rows) {
    const a = align(scoreWords(r.old.heard), scoreWords(r.new.heard));
    edits += a.edits;
    words += scoreWords(r.old.heard).length;
    alike += a.edits === 0 ? 1 : 0;
  }
  out.push(`| ${NAMES[k] ?? k} | ${words} | ${pct(words ? edits / words : 0)} | ${alike} of ${rows.length} |`);
}

out.push('');
out.push('### Phonemes against eSpeak NG, word by word');
out.push('');
out.push('Each distinct word of the corpus alone (citation form, both sides), eSpeak NG `en` written in misaki\'s symbols, stress marks set aside for the phoneme error rate.');
out.push('');
out.push('| How the new reading found the word | Words | Same phonemes | Phoneme error rate | Same main stress | A fair reference? |');
out.push('|---|---:|---:|---:|---:|---|');
const FAIR = { table: 'yes: both are dictionary readings of British English', little: 'yes, in citation form', parts: 'partly: the parts are dictionary words, eSpeak guesses the whole', rules: 'no: both guess', held: 'no: both guess', letters: 'yes' };
const SOURCE = { table: 'in the CMU table', little: 'a little word (weak/strong forms)', parts: 'taken apart into table words', rules: 'NRL letter rules', held: 'a held sound (no vowel letter)', letters: 'letters said one by one' };
for (const [k, s] of Object.entries(m.phonemesAgainstEspeak).sort((a, b) => b[1].words - a[1].words)) {
  out.push(`| ${SOURCE[k] ?? k} | ${s.words} | ${pct(s.identical)} | ${pct(s.phonemeErrorRate)} | ${pct(s.stressAgreement)} | ${FAIR[k] ?? ''} |`);
}

out.push('');
out.push('### Target words heard by the old reading and not by the new');
out.push('');
const lostWords = m.results.filter((r) => r.target && r.old.targetHeard && !r.new.targetHeard);
const wonWords = m.results.filter((r) => r.target && !r.old.targetHeard && r.new.targetHeard);
out.push(lostWords.length ? lostWords.map((r) => `- **${r.target}**: old heard "${r.old.heard}", new heard "${r.new.heard}" (new phonemes \`${r.new.phonemes}\`, old \`${r.old.phonemes}\`)`).join('\n') : 'None.');
out.push('');
out.push(`And the other way (heard by the new reading, not the old): ${wonWords.length ? wonWords.map((r) => r.target).join(', ') : 'none'}.`);

out.push('');
out.push('### Running texts the new reading is heard worse in');
out.push('');
const worse = m.worse.filter((x) => !x.id.startsWith('word-'));
out.push(`${worse.length} of ${m.results.filter((r) => r.category !== 'word').length} texts. The words of the text it loses that the old reading kept:`);
out.push('');
for (const x of worse) out.push(`- ${x.id} (${x.old} → ${x.new} errors): ${x.lost.length ? x.lost.join('; ') : '(the same words, heard differently)'}`);
const better = m.results.filter((r) => r.category !== 'word' && r.new.edits < r.old.edits).length;
const same = m.results.filter((r) => r.category !== 'word' && r.new.edits === r.old.edits).length;
out.push('');
out.push(`Better in ${better}, the same in ${same}.`);

/** The edge texts (measure.mjs --texts scripts/voice/edge-texts.txt), when they have been measured. */
function edgeTables(file) {
  const e = JSON.parse(readFileSync(file, 'utf8'));
  const s = e.summary.edge;
  const lines = [];
  lines.push(`Run of ${e.date.slice(0, 10)} on ${e.node}, ${e.results.length} texts (\`${e.texts}\`), ${Math.round(e.seconds / 60)} minutes; the same models and settings as above.`);
  lines.push('');
  lines.push('| Scored | Words | WER old (eSpeak) | WER new | New − old (points) | 95% interval (paired bootstrap) |');
  lines.push('|---|---:|---:|---:|---:|---|');
  lines.push(`| as written (Whisper's "10pm" against "ten p.m." counts as an error) | ${s.words} | ${pct(s.old)} | ${pct(s.new)} | ${pp(s.difference)} | ${pp(s.interval95.low)} to ${pp(s.interval95.high)} |`);
  lines.push(`| **in spoken form** (text and both transcripts through the same normaliser) | ${s.spoken.words} | ${pct(s.spoken.old)} | ${pct(s.spoken.new)} | ${pp(s.spoken.difference)} | ${pp(s.spoken.interval95.low)} to ${pp(s.spoken.interval95.high)} |`);
  lines.push('');
  const worse = e.results.filter((r) => r.spoken.new > r.spoken.old);
  const better = e.results.filter((r) => r.spoken.new < r.spoken.old);
  lines.push(`In spoken form the new reading is heard better in ${better.length} texts, worse in ${worse.length}, the same in ${e.results.length - better.length - worse.length}. Every text, with what Whisper heard (errors in spoken form, old → new):`);
  lines.push('');
  lines.push('| Text | Old (eSpeak) heard | New heard | Errors |');
  lines.push('|---|---|---|---:|');
  const cell = (t) => t.replace(/\|/g, '\\|').replace(/\n/g, ' / ');
  for (const r of e.results) lines.push(`| ${cell(r.text)} | ${cell(r.old.heard)} | ${cell(r.new.heard)} | ${r.spoken.old} → ${r.spoken.new}${r.spoken.new > r.spoken.old ? ' **worse**' : ''} |`);
  return lines.join('\n');
}

const md = out.join('\n');
const EDGE = join(ROOT, 'docs/voice/measurement-edge.json');
const edge = existsSync(EDGE) ? edgeTables(EDGE) : null;
if (process.argv.includes('--write')) {
  let doc = readFileSync(DOC, 'utf8');
  const put = (name, body) => {
    const start = doc.indexOf(`<!-- ${name} -->`);
    const end = doc.indexOf(`<!-- /${name} -->`);
    if (start < 0 || end < 0) throw new Error(`${DOC} has no <!-- ${name} --> ... <!-- /${name} --> markers`);
    doc = `${doc.slice(0, start)}<!-- ${name} -->\n${body}\n${doc.slice(end)}`;
  };
  put('tables', md);
  if (edge) put('edge', edge);
  writeFileSync(DOC, doc);
  console.log(`wrote the tables${edge ? ' and the edge tables' : ''} into ${DOC}`);
} else console.log(edge ? `${md}\n\n${edge}` : md);
