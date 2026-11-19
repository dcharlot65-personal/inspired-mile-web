// Proves the language-picker tests in tests/duel.spec.ts can fail: each mutation below breaks one
// thing they are there to catch in src/pages/battle.astro, and the picker tests must go red. On a
// build host, with the ports and browsers the main suite uses:
//   node scripts/model-eval/mutate-picker.mjs
// The file is put back after each mutation; exit status 1 if any mutation survived.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = 'src/pages/battle.astro';
const MUTATIONS = [
  ['the note inside the picker\'s label again', [
    ['</select>\n              </label>\n', '</select>\n'],
    ['<div id="language-note" class="hidden mt-1 text-xs text-obsidian-400" role="status"></div>\n', '<div id="language-note" class="hidden mt-1 text-xs text-obsidian-400" role="status"></div>\n              </label>\n'],
  ]],
  ['the note no longer describes the picker', [['<select id="language" aria-describedby="language-note" ', '<select id="language" ']]],
  ['the two lines joined with a space again', [['note.replaceChildren(...lines.map((line) => el(\'span\', \'block\', line)));', 'note.textContent = lines.join(\' \');']]],
  ['the languages no longer grouped by who writes', [['(groups ? groups[writer] : langSelect).appendChild(o);', 'langSelect.appendChild(o);']]],
  ['"Written opponent" put back beside the language', [['o.textContent = languageName(code);', 'o.textContent = info && writer === \'written\' ? `${languageName(code)} · ${t(\'badge.written\')}` : languageName(code);']]],
  ['a language listed under the wrong heading', [['o.dataset.opponent = writer;\n        (groups ? groups[writer] : langSelect).appendChild(o);', 'o.dataset.opponent = writer;\n        (groups ? groups[writer === \'model\' ? \'written\' : \'model\'] : langSelect).appendChild(o);']]],
];

const run = () => {
  try { execFileSync('npx', ['playwright', 'test', 'tests/duel.spec.ts', '-g', 'Language picker|without a model every language', '--workers=1', '--reporter=line'], { stdio: 'pipe' }); return true; } catch { return false; }
};
if (!run()) { console.error('the picker tests are red before any mutation; nothing proved'); process.exit(1); }
const before = readFileSync(FILE, 'utf8');
let survived = 0;
for (const [name, edits] of MUTATIONS) {
  let after = before;
  for (const [find, put] of edits) after = after.replace(find, put);
  if (edits.some(([find]) => !before.includes(find))) { console.log(`NOT APPLIED  ${name}`); survived++; continue; }
  writeFileSync(FILE, after);
  const green = run();
  writeFileSync(FILE, before);
  console.log(`${green ? 'SURVIVED     ' : 'caught       '}${name}`);
  if (green) survived++;
}
console.log(survived ? `${survived} of ${MUTATIONS.length} mutations were not caught` : `all ${MUTATIONS.length} mutations were caught`);
process.exit(survived ? 1 : 0);
