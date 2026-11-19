// Copy the measured language lists from docs/language/model-eval/decisions.json into src/lib/brain.ts.
//
//   node scripts/model-eval/analyze.mjs && node scripts/model-eval/copy-lists.mjs
//
// Rewrites only the `writesIn: [...]` and `judgesIn: [...]` lines inside each model's entry, and
// leaves the comment citing the result files above each line as it is. src/lib/model-eval.test.ts
// fails when the two files differ, so a list typed by hand cannot stay.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const file = join(ROOT, 'src', 'lib', 'brain.ts');
const { models } = JSON.parse(readFileSync(join(ROOT, 'docs', 'language', 'model-eval', 'decisions.json'), 'utf8'));
let src = readFileSync(file, 'utf8');
for (const [tier, lists] of Object.entries(models)) {
  // From the tier's entry to the next closing brace at the same indentation.
  const start = src.indexOf(`\n  ${tier}: {\n`);
  const end = src.indexOf('\n  },', start);
  if (start < 0 || end < 0) throw new Error(`brain.ts has no entry for ${tier}`);
  let entry = src.slice(start, end);
  for (const key of ['writesIn', 'judgesIn']) {
    const re = new RegExp(`(\\n\\s*${key}: )\\[[^\\]]*\\]`);
    if (!re.test(entry)) throw new Error(`brain.ts: ${tier} has no ${key} line`);
    entry = entry.replace(re, `$1[${lists[key].map((l) => `'${l}'`).join(', ')}]`);
  }
  src = src.slice(0, start) + entry + src.slice(end);
}
writeFileSync(file, src);
for (const [tier, lists] of Object.entries(models)) console.log(`${tier}: writes ${lists.writesIn.join(', ') || 'none'}; judges ${lists.judgesIn.join(', ') || 'none'}`);
