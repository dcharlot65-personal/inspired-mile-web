// Reads the back-translation scores (bt-<lang>.json, from qa/bt.py) and says which strings to read.
//   node scripts/lang-content/qa/report.mjs <dir with bt-*.json> [--list <lang>] [--threshold 0.6]
// A string is FLAGGED when the cosine similarity between its back-translation and the English
// source is under the threshold. A flag is a request to read the string, not a verdict.
// The controls (pairs whose English is deliberately the wrong sentence) must be flagged: the
// summary says how many were. Writes docs/language/data/play-bt-summary.json.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, LANGS } from '../lib.mjs';
const dir = process.argv[2];
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const T = Number(arg('--threshold', '0.6'));
const list = arg('--list', '');
const summary = { model: 'google/madlad400-3b-mt (CTranslate2 int8), embedder all-MiniLM-L6-v2', threshold: T, languages: {} };
for (const l of LANGS) {
  const f = join(dir, `bt-${l}.json`);
  if (!existsSync(f)) { summary.languages[l] = { status: 'not run' }; continue; }
  const rows = JSON.parse(readFileSync(f, 'utf8'));
  const real = rows.filter((r) => !r.id.startsWith('control:'));
  const controls = rows.filter((r) => r.id.startsWith('control:'));
  const flagged = real.filter((r) => r.cos < T).sort((a, b) => a.cos - b.cos);
  summary.languages[l] = { strings: real.length, flagged: flagged.length, flaggedTrivia: flagged.filter((r) => r.id.startsWith('trivia.')).length, controlsCaught: controls.filter((r) => r.cos < T).length, controls: controls.length, medianCos: real.map((r) => r.cos).sort()[Math.floor(real.length / 2)], flaggedIds: flagged.map((r) => r.id) };
  if (list === l) for (const r of flagged) console.log(`${r.cos.toFixed(2)} ${r.id}\n   ${r.text}\n   BACK: ${r.back}\n   EN:   ${r.english}`);
}
if (!list) {
  for (const [l, s] of Object.entries(summary.languages)) console.log(l, s.status ?? `${s.strings} strings, ${s.flagged} flagged (${s.flaggedTrivia} trivia), controls caught ${s.controlsCaught}/${s.controls}, median cos ${s.medianCos}`);
  mkdirSync(join(ROOT, 'docs/language/data'), { recursive: true });
  writeFileSync(join(ROOT, 'docs/language/data/play-bt-summary.json'), JSON.stringify(summary, null, 1) + '\n');
}
