// Proves src/lib/model-eval.test.ts can fail: each mutation below breaks one thing the tests
// are there to catch, and the test run must go red. Run on the build host:
//   node scripts/model-eval/mutate.mjs
// Each file is put back as it was after its mutation; exit status 1 if any mutation survived.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const MUTATIONS = [
  ['a language slipped into a list by hand', 'src/lib/brain.ts', /writesIn: \[/, "writesIn: ['xx', "],
  ['a judging list emptied by hand', 'src/lib/brain.ts', /judgesIn: \[[^\]]*\]/, "judgesIn: ['zz']"],
  ['the citation of the result files removed', 'src/lib/brain.ts', 'docs/language/model-eval/cells/grand.<lang>.judge.json', 'measured'],
  ['decisions.json edited apart from the results', 'docs/language/model-eval/decisions.json', /"judgesIn": \[/, '"judgesIn": [\n    "qq",'],
  ['the injection rule dropped from the judging decision', 'scripts/model-eval/lib.mjs', 's.injectionPairsLost > t.injectionPairsLostAtMost', 'false'],
  ['the chance rule dropped from the judging decision', 'scripts/model-eval/lib.mjs', '!(s.pairWilson.low > t.pairWinsWilsonLowerAbove)', 'false'],
  ['a split counted as a preference for the better verse', 'scripts/model-eval/lib.mjs', "p.criteria[c] === better ? 'better' : p.criteria[c] === 'split' ? 'split' : 'worse'", "p.criteria[c] === better || p.criteria[c] === 'split' ? 'better' : 'worse'"],
  ['the script check always passing', 'scripts/model-eval/lib.mjs', 'if (!letters) return false;', 'return true;'],
  ['the language identifier ignored', 'scripts/model-eval/lib.mjs', 'return (LID_ACCEPTS[lang] ?? [lang]).includes(lid);', 'return true;'],
  ['commentary never found', 'scripts/model-eval/lib.mjs', "if (first && /[:：]\\s*$/.test(l)) return 'a first line that ends in a colon';", ''],
  ['the form rule dropped from the writing decision', 'scripts/model-eval/lib.mjs', '!(s.formKept / n >= t.formKeptAtLeast)', 'false'],
  ['an unmeasured cell allowed to write', 'scripts/model-eval/lib.mjs', "export function decideWrite(s, t, recall) {\n  if (!s) return { ok: false, why: ['not measured'] };", "export function decideWrite(s, t, recall) {\n  if (!s) return { ok: true, why: [] };"],
  ['a threshold loosened after the fact', 'scripts/model-eval/thresholds.json', '"pairWinsWilsonLowerAbove": 0.5', '"pairWinsWilsonLowerAbove": 0.2'],
  ['a pair whose better verse is not from the corpus', 'docs/language/model-eval/pairs/fr.json', /"text": "/, '"text": "x'],
  ['talk about the task no longer seen', 'scripts/model-eval/lib.mjs', "else if (TASK_TALK.test(l) || INTERRUPTION.test(l) || ANNOUNCE.test(l)) out.push('talk about the task');", ''],
  ['an announcement of the verse no longer seen', 'scripts/model-eval/lib.mjs', '|| ANNOUNCE.test(l)) out.push', ') out.push'],
  ['an echo of the instructions no longer seen', 'scripts/model-eval/lib.mjs', "else if (echoesInstruction(l, instructions)) out.push('repeats the instructions');", ''],
  ['acrostic letters set out as labels no longer seen', 'scripts/model-eval/lib.mjs', ".length >= 2) out.push('letters set out as labels');", ".length >= 99) out.push('letters set out as labels');"],
  ['the challenger\'s quoted verse read as instructions', 'scripts/model-eval/lib.mjs', '.filter((l) => l && !quoted.has(l));', '.filter((l) => l);'],
  ['a reasoning block no longer seen', 'scripts/model-eval/lib.mjs', "else if (REASONING.test(l)) out.push('a reasoning block');", ''],
  ['a title naming the form no longer seen', 'scripts/model-eval/lib.mjs', 'if (form && l === norm(form)) return true;', ''],
  ['a model used in no language offered for download', 'src/lib/brain.ts', 'return runnable.filter(usedAnywhere);', 'return runnable;'],
  // The cells against the game as it is now (the replay test).
  ['a score in a cell edited', 'docs/language/model-eval/cells/grand.en.write.json', '"formKept": true', '"formKept": false'],
  ['a scoring rule changed after the cells ran', 'src/lib/verse/duel.ts', '1 + (device.met ? 0.5 : 0)', '1 + (device.met ? 0.6 : 0)'],
  ['the opponent\'s prompt changed after the cells ran', 'src/lib/verse/opponent.ts', 'No title, no notes, no explanation.', 'No title, no notes.'],
  // A rule the stored drafts use: 34 of them had a note in brackets cut off a kept line ("(needs 5)").
  // (Dropping the backtick from the markup rule changed no stored draft, and survived: the wrong mutation, not a weak test.)
  ['the opponent\'s tidy-up changed after the cells ran', 'src/lib/verse/opponent.ts', ".replace(/\\s*\\([^)]*\\)\\s*$/, '')", ''],
  ['the report edited apart from the decisions', 'docs/language/MODEL-EVAL.md', /\| Gemma 4 E2B \| [^|]*\|/, '| Gemma 4 E2B | xx |'],
];

const run = () => {
  try { execFileSync('npx', ['vitest', 'run', 'src/lib/model-eval.test.ts'], { stdio: 'pipe' }); return true; } catch { return false; }
};
if (!run()) { console.error('the tests are red before any mutation; nothing proved'); process.exit(1); }
let survived = 0;
for (const [name, file, find, put] of MUTATIONS) {
  const before = readFileSync(file, 'utf8');
  const after = before.replace(find, put);
  if (after === before) { console.log(`NOT APPLIED  ${name} (${file})`); survived++; continue; }
  writeFileSync(file, after);
  const green = run();
  writeFileSync(file, before);
  console.log(`${green ? 'SURVIVED     ' : 'caught       '}${name}`);
  if (green) survived++;
}
console.log(survived ? `${survived} of ${MUTATIONS.length} mutations were not caught` : `all ${MUTATIONS.length} mutations were caught`);
process.exit(survived ? 1 : 0);
