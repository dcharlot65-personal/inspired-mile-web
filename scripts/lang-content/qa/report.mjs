// Reads what the checks on the build host wrote (copied into one directory) and says which strings to read.
//   node scripts/lang-content/qa/report.mjs <dir> [--list <lang> [--engine madlad|opus]] [--threshold 0.6]
// <dir> holds bt-*.json (MADLAD), bto-*.json (OPUS-MT), align.json (qa/align.py), spell-<lang>.txt (Hunspell).
// A string is FLAGGED when the cosine similarity between its back-translation and the English source is
// under the threshold. A flag is a request to read the string, not a verdict. The controls (a translation
// paired with the wrong English) must be flagged: the summary says how many were.
// Writes docs/language/data/play-bt-summary.json, play-align-summary.json, play-spell-summary.json.
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, LANGS, readTsv, HERE } from '../lib.mjs';
const dir = process.argv[2];
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const T = Number(arg('--threshold', '0.6'));
const list = arg('--list', '');
const only = arg('--engine', '');
const DATA = join(ROOT, 'docs/language/data');
mkdirSync(DATA, { recursive: true });
const reviewed = new Set(readTsv(join(HERE, 'qa', 'review.tsv')).map((r) => `${r[0]}/${r[1]}`));

const ENGINES = { madlad: 'bt', opus: 'bto' };
const summary = { models: 'google/madlad400-3b-mt (CTranslate2 int8); Helsinki-NLP OPUS-MT <lang>-en, Portuguese through opus-mt-ROMANCE-en (CTranslate2 int8); embedder sentence-transformers/all-MiniLM-L6-v2', threshold: T, engines: {} };
for (const [engine, prefix] of Object.entries(ENGINES)) {
  summary.engines[engine] = {};
  for (const l of LANGS) {
    const files = existsSync(dir) ? readdirSync(dir).filter((f) => new RegExp(`^${prefix}-\\d-\\d+-${l}\\.json$`).test(f)).sort() : [];
    if (!files.length) { summary.engines[engine][l] = { status: 'not run' }; continue; }
    const rows = files.flatMap((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));
    const real = rows.filter((r) => !r.id.includes('control:') && !r.id.startsWith('alignctl:'));
    const controls = rows.filter((r) => r.id.startsWith('control:'));
    const flagged = real.filter((r) => r.cos < T).sort((a, b) => a.cos - b.cos);
    const cos = real.map((r) => r.cos).sort((a, b) => a - b);
    summary.engines[engine][l] = { covered: files.length === 2 ? 'all strings' : files[0].includes('-1-') ? 'trivia only' : 'all but trivia', strings: real.length, flagged: flagged.length, flaggedTrivia: flagged.filter((r) => r.id.startsWith('trivia.')).length, controlsCaught: controls.filter((r) => r.cos < T).length, controls: controls.length, medianCos: cos[Math.floor(cos.length / 2)], beams: [...new Set(rows.map((r) => r.beam ?? 4))], flaggedIds: flagged.map((r) => r.id) };
    if (list === l && (!only || only === engine)) for (const r of flagged) console.log(`${reviewed.has(`${l}/${r.id}`) ? '  ' : '* '}${engine} ${r.cos.toFixed(2)} ${r.id}\n   ${r.text}\n   BACK: ${r.back}\n   EN:   ${r.english}`);
  }
}
const alignFile = join(dir, 'align.json');
const align = { rows: [] };
if (existsSync(alignFile)) {
  const rows = JSON.parse(readFileSync(alignFile, 'utf8'));
  for (const engine of Object.keys(ENGINES)) for (const l of LANGS) {
    const mine = rows.filter((r) => r.engine === engine && r.lang === l);
    if (!mine.length) continue;
    const real = mine.filter((r) => !r.control), ctl = mine.filter((r) => r.control);
    const bad = real.filter((r) => r.misplaced);
    align.rows.push({ lang: l, engine, options: real.length, misplaced: bad.length, controlsCaught: ctl.filter((r) => r.misplaced).length, controls: ctl.length, misplacedIds: bad.map((r) => `trivia.${r.q}.o${r.option}`) });
    if (list === l && (!only || only === engine)) for (const r of bad) console.log(`${reviewed.has(`${l}/trivia.${r.q}.o${r.option}`) ? '  ' : '* '}${engine} MISPLACED trivia.${r.q}.o${r.option} (own ${r.own}, option ${r.best} ${r.bestSim})\n   ${r.text}\n   BACK: ${r.back}\n   EN:   ${r.english}`);
  }
}
const spell = { hunspell: '1.7 (the shared pipeline build)', languages: {} };
for (const l of LANGS) {
  const f = join(dir, `spell-${l}.txt`);
  if (!existsSync(f)) { spell.languages[l] = { dictionary: null }; continue; }
  const words = readFileSync(f, 'utf8').split('\n').filter(Boolean).map((x) => x.trim().split(/\s+/)[1]).filter(Boolean);
  // Names are most of what a dictionary does not know; a word with a capital (where the script has them) is set aside.
  const lower = words.filter((w) => w === w.toLocaleLowerCase(l));
  spell.languages[l] = { dictionary: l === 'pt' ? 'pt-BR' : l, unknown: lower.length, errors: readTsv(join(HERE, 'qa', 'review.tsv')).filter((r) => r[0] === l && r[1].startsWith('spell:') && r[2] === 'fixed').length };
  if (list === l && !only) console.log(`spelling, ${l}: ` + lower.map((w) => (reviewed.has(`${l}/spell:${w}`) ? w : `*${w}`)).join(' '));
}
if (!list) {
  for (const [e, langs] of Object.entries(summary.engines)) for (const [l, s] of Object.entries(langs)) console.log(e, l, s.status ?? `${s.covered}: ${s.strings} strings, ${s.flagged} flagged (${s.flaggedTrivia} trivia), controls caught ${s.controlsCaught}/${s.controls}, median cos ${s.medianCos}`);
  for (const r of align.rows) console.log('align', r.engine, r.lang, `${r.options} options, ${r.misplaced} misplaced, controls ${r.controlsCaught}/${r.controls}`);
  writeFileSync(join(DATA, 'play-bt-summary.json'), JSON.stringify(summary, null, 1) + '\n');
  writeFileSync(join(DATA, 'play-align-summary.json'), JSON.stringify(align, null, 1) + '\n');
  writeFileSync(join(DATA, 'play-spell-summary.json'), JSON.stringify(spell, null, 1) + '\n');
}
