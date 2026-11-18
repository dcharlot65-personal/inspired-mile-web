// Proves the tests that guard where a model is used, and which one is loaded, can fail: each
// mutation below breaks one thing in the game's code, and the suite named beside it must go red.
// The checker of 2026-11-17 found the pages' own gates (the verdict line, the badge, the theatre's
// judging line), the fallback to a model used in no language and the auto-summon of a bigger model
// all untested, and the way a model's answer is read (SPLIT_BELOW) unguarded by the evaluation.
// On a build host, with the ports and browsers the main suite uses:
//   node scripts/model-eval/mutate-gates.mjs [name-filter]
// Each file is put back after its mutation; exit status 1 if any mutation survived or did not apply.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const vitest = (...files) => ['npx', ['vitest', 'run', ...files]];
const pw = (file, grep) => ['npx', ['playwright', 'test', file, '-g', grep, '--workers=2', '--reporter=line']];
const GATE = vitest('src/lib/model-eval.judge.test.ts');
const LOAD = vitest('src/lib/brain.load.test.ts');
const READ = vitest('src/lib/model-eval.judge.test.ts');
const DUEL = pw('tests/duel.spec.ts', "Who writes and who judges|a stored choice reloads");
const THEATRE = pw('tests/theatre.spec.ts', 'Theatre: who judges');

const MUTATIONS = [
  // Where the model is used (src/lib/verse): the session and the referee.
  ['session: the model writes in every language', 'src/lib/verse/session.ts', 'isBrainLoaded() && modelWrites(brainInfo(), this.duel.lang)', 'isBrainLoaded()', [GATE, DUEL]],
  ['session: the checklist reads as the grader in every language', 'src/lib/verse/session.ts', 'return this.opts.useModel && judgedByModel(this.duel.lang);', 'return this.opts.useModel && isBrainLoaded();', [GATE]],
  ['referee: the model judges in every language', 'src/lib/verse/referee.ts', 'if (judgedByModel(lang)) {', 'if (isBrainLoaded()) {', [GATE, DUEL]],
  // What the pages say.
  ['battle: the verdict says no model is running where it does not judge', 'src/pages/battle.astro', ': useModel && info && !modelJudges(info, s.duel.lang)', ': false', [DUEL]],
  ['battle: the badge says the model writes wherever one is loaded', 'src/pages/battle.astro', "$('ai-model-badge').textContent = !info || (!modelWrites(info, lang) && !modelJudges(info, lang))", "$('ai-model-badge').textContent = !info", [DUEL]],
  ['battle: the badge reads the interface language, not the duel\'s', 'src/pages/battle.astro', 'const lang = duelLang();\n      // Who the player meets', "const lang = 'en';\n      // Who the player meets", [DUEL]],
  ['theatre: the judging line claims the model judges every language', 'src/pages/theatre.astro', ': modelJudges(info, session.duel.lang)', ': true', [THEATRE]],
  // Which model is loaded.
  ['brain: a model used in no language is a fallback again', 'src/lib/brain.ts', 'return [chain[0], ...chain.slice(1).filter(usedAnywhere)];', 'return chain;', [LOAD]],
  ['brain: a stored choice reloads the first model offered, whatever was chosen', 'src/lib/brain.ts', 'return modelsToOffer(cap).find((m) => m.tier === chosen)?.tier ?? null;', "return chosen && chosen !== 'rules' ? modelsToOffer(cap)[0]?.tier ?? null : null;", [LOAD]],
  ['battle: auto-summons the device\'s tier, not the stored choice', 'src/pages/battle.astro', 'const again = rememberedModel(cap, localStorage.getItem(BRAIN_KEY));', "const again = localStorage.getItem(BRAIN_KEY) ? rememberedModel(cap, 'standard') : null;", [DUEL]],
  ['theatre: auto-summons LFM3 for any stored choice', 'src/pages/theatre.astro', "const want = rememberedModel(cap, localStorage.getItem('inspired-mile-brain'));", "const want = localStorage.getItem('inspired-mile-brain') ? rememberedModel(cap, 'standard') : null;", [THEATRE]],
  // How a model's answer is read: the judging cells' stored readings must disagree.
  ['judge: a margin under 0.2 read as a split (SPLIT_BELOW 0.1 -> 0.2)', 'src/lib/verse/judge.ts', 'export const SPLIT_BELOW = 0.1;', 'export const SPLIT_BELOW = 0.2;', [READ]],
  ['judge: the verdict sides swapped', 'src/lib/verse/judge.ts', "lean > 0 ? 'player' : 'opponent'", "lean > 0 ? 'opponent' : 'player'", [READ]],
  ['judge: the grade margin halved (GRADE_MARGIN 0.5 -> 0.25)', 'src/lib/verse/judge.ts', 'export const GRADE_MARGIN = 0.5;', 'export const GRADE_MARGIN = 0.25;', [READ]],
];

const only = process.argv[2];
const green = ([cmd, args]) => { try { execFileSync(cmd, args, { stdio: 'pipe', timeout: 1_800_000 }); return true; } catch { return false; } };
const suites = [...new Set(MUTATIONS.flatMap((m) => m[4]))];
for (const s of suites) if (!green(s)) { console.error(`red before any mutation: ${s[1].join(' ')}; nothing proved`); process.exit(1); }
console.log(`baseline green: ${suites.map((s) => s[1].slice(0, 3).join(' ')).join('; ')}`);
let bad = 0;
for (const [name, file, find, put, runs] of MUTATIONS) {
  if (only && !name.includes(only)) continue;
  const before = readFileSync(file, 'utf8');
  if (!before.includes(find)) { console.log(`NOT APPLIED  ${name}`); bad++; continue; }
  writeFileSync(file, before.replace(find, put));
  let res;
  try { res = runs.map((s) => `${s[1].slice(0, 3).join(' ')}: ${green(s) ? 'green' : 'RED'}`); } finally { writeFileSync(file, before); }
  const caught = res.some((r) => r.endsWith('RED'));
  if (!caught) bad++;
  console.log(`${caught ? 'caught      ' : 'SURVIVED    '} ${name}  [${res.join('; ')}]`);
}
console.log(bad ? `${bad} mutation(s) not caught or not applied` : 'every mutation was caught');
process.exit(bad ? 1 : 0);
