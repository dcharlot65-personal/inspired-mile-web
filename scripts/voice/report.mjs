#!/usr/bin/env node
/**
 * The tables of docs/voice/G2P-MEASUREMENT.md, drawn from docs/voice/measurement.json
 * (scripts/voice/measure.mjs). Prints Markdown; the doc keeps them between the markers
 * <!-- tables --> and <!-- /tables -->, and `--write` puts them there.
 *
 *   node scripts/voice/report.mjs [--in results.json] [--write]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { align, scoreWords } from './score.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const DOC = join(ROOT, 'docs/voice/G2P-MEASUREMENT.md');
const inArg = process.argv.indexOf('--in');
const m = JSON.parse(readFileSync(inArg > 0 ? process.argv[inArg + 1] : join(ROOT, 'docs/voice/measurement.json'), 'utf8'));

/** The margins, fixed before the full run (G2P-MEASUREMENT.md, "Margin"). */
export const MARGIN = { runningTextPoints: 1.0, wordsLost: 6 };

const pct = (x) => `${(x * 100).toFixed(1)}%`;
const pp = (x) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}`;
const out = [];
const NAMES = { verse: 'verses (written opponent)', acrostic: 'acrostic lines', quote: 'card quotations', model: 'verses the models wrote', word: '200 words, in "I say … again."', 'running text': '**running text (all but the words)**', all: 'everything' };

out.push(`Run of ${m.date.slice(0, 10)} on ${m.node}, ${m.results.length} texts, ${Math.round(m.seconds / 60)} minutes. Kokoro ${m.kokoro.model} (${m.kokoro.dtype}, ${m.kokoro.voice}, speed ${m.kokoro.speed}, ${m.kokoro.runtime}); Whisper ${m.whisper.model} (${m.whisper.dtype}, Transformers.js ${m.whisper.transformers}).`);
out.push('');
out.push('| Texts | Items | Words | WER old (eSpeak) | WER new | New − old (points) | 95% interval (paired bootstrap) |');
out.push('|---|---:|---:|---:|---:|---:|---|');
for (const [k, s] of Object.entries(m.summary)) {
  out.push(`| ${NAMES[k] ?? k} | ${s.items} | ${s.words} | ${pct(s.old)} | ${pct(s.new)} | ${pp(s.difference)} | ${pp(s.interval95.low)} to ${pp(s.interval95.high)} |`);
}
const w = m.summary.word?.targetsHeard;
if (w) {
  out.push('');
  out.push(`The word itself heard (every part of it, spelt as written or a known variant): old ${w.old} of ${w.of}, new ${w.new} of ${w.of}.`);
}
const rt = m.summary['running text'];
const verdict = [];
if (rt) verdict.push(`running text ${pp(rt.difference)} points against a margin of +${MARGIN.runningTextPoints.toFixed(1)}: ${rt.difference * 100 <= MARGIN.runningTextPoints ? 'within' : '**outside**'}`);
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

const md = out.join('\n');
if (process.argv.includes('--write')) {
  const doc = readFileSync(DOC, 'utf8');
  const start = doc.indexOf('<!-- tables -->');
  const end = doc.indexOf('<!-- /tables -->');
  if (start < 0 || end < 0) throw new Error(`${DOC} has no <!-- tables --> ... <!-- /tables --> markers`);
  writeFileSync(DOC, `${doc.slice(0, start)}<!-- tables -->\n${md}\n${doc.slice(end)}`);
  console.log(`wrote the tables into ${DOC}`);
} else console.log(md);
