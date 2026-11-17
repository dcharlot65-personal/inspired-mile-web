// Record, in each judging cell that lacks it, which judging code the cell ran: the digest of
// scripts/model-eval/lib.mjs `judgingCode` taken from the git objects of the cell's own snapshot
// (its `commit`, which rb created in this repository).
//
//   node scripts/model-eval/judge-code.mjs
//
// Git and hashing only: light enough for the dev Mac. Cells written by run.mjs since this script
// exists carry the digest already. Then, on a build host:
//   MEVAL_FINGERPRINT=1 npx vitest run src/lib/model-eval.judge.test.ts
// records the judge's prompts for each cell whose digest matches the code now.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { judgingCode } from './lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CELLS = join(ROOT, 'docs', 'language', 'model-eval', 'cells');
const git = (...a) => execFileSync('git', ['-C', ROOT, ...a], { encoding: 'utf8', maxBuffer: 64 << 20 });

let wrote = 0;
const missing = [];
for (const f of readdirSync(CELLS).filter((x) => x.endsWith('.judge.json')).sort()) {
  const file = join(CELLS, f);
  const cell = JSON.parse(readFileSync(file, 'utf8'));
  if (cell.code) continue;
  try { git('cat-file', '-e', `${cell.commit}^{commit}`); } catch { missing.push(`${f}: snapshot ${cell.commit} is not in this repository`); continue; }
  const paths = git('ls-tree', '-r', '--name-only', cell.commit, '--', 'src/lib/verse').split('\n').filter((p) => p.endsWith('.ts'));
  const files = paths.map((path) => ({ path, text: git('show', `${cell.commit}:${path}`) }));
  cell.code = { ...judgingCode(files, git('show', `${cell.commit}:src/lib/brain.ts`)), from: `git objects of snapshot ${cell.commit}, by scripts/model-eval/judge-code.mjs` };
  writeFileSync(file, JSON.stringify(cell, null, 1) + '\n');
  wrote++;
}
console.log(`${wrote} judging cell(s) given the digest of the code they ran`);
if (missing.length) { console.error(missing.join('\n')); process.exit(1); }
