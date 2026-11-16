// Proves tests/play-i18n.spec.ts can fail. Each mutation breaks one thing the tests exist to
// catch, runs the German tests, and expects them to go RED; then the file is put back.
// Run on the build host (it starts the dev server and the API, like any Playwright run):
//   node scripts/lang-content/mutate-play.mjs
// Exits 1 if any mutation was NOT caught.
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const MUTATIONS = [
  { name: 'English left in a locale file', file: 'src/i18n/pages/playground/de.ts', from: `'pg.packs.title': "Kartenpacks"`, to: `'pg.packs.title': "Card Packs"`, grep: 'playground in de' },
  { name: 'an unfilled {placeholder}', file: 'src/i18n/pages/playground/de.ts', from: `'pg.trivia.start': "Quiz starten"`, to: `'pg.trivia.start': "Quiz {starten}"`, grep: 'playground in de' },
  { name: 'markup that lost its key', file: 'src/pages/playground.astro', from: ` data-i18n="pg.stat.cards">Cards Owned<`, to: `>Cards Owned<`, grep: 'playground in de' },
  { name: 'a raw key shown as text', file: 'src/i18n/pages/story/de.ts', from: `'story.act.1.name': "Die Straßen von Verona"`, to: `'story.act.1.name': "story.act.1.name"`, grep: 'story page in de' },
  { name: 'English trivia served to a German player', file: 'src/lib/play-content.ts', from: `if (l === 'en') return TRIVIA_BANK;`, to: `if (l) return TRIVIA_BANK;`, grep: 'relabels the open playground', control: false },
];

// Without any mutation the tests must be green, or a red result below means nothing.
const run = (grep) => spawnSync('npx', ['playwright', 'test', 'tests/play-i18n.spec.ts', '-g', grep, '--reporter=line'], { encoding: 'utf8', env: process.env });
const base = run('in de');
if (base.status !== 0) { console.error('The German tests are red before any mutation:\n' + base.stdout.slice(-1500)); process.exit(2); }
console.log('baseline: green');

let missed = 0;
for (const m of MUTATIONS) {
  const original = readFileSync(m.file, 'utf8');
  if (!original.includes(m.from)) { console.error(`MUTATION DOES NOT APPLY (${m.name}): "${m.from}" is not in ${m.file}`); missed++; continue; }
  writeFileSync(m.file, original.replace(m.from, m.to));
  let r;
  try { r = run(m.grep); } finally { writeFileSync(m.file, original); }
  const caught = r.status !== 0;
  const why = (r.stdout.match(/Error: .*|English ".*?" is still on screen.*|unfilled placeholders|message keys shown as text/) ?? [''])[0];
  console.log(`${caught ? 'CAUGHT' : 'MISSED'}: ${m.name}${caught ? '  (' + why.slice(0, 110) + ')' : ''}`);
  if (!caught) missed++;
}
process.exit(missed ? 1 : 0);
