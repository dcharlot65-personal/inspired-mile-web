// Proves tests/play-i18n.spec.ts can fail. Each mutation breaks one thing the tests exist to
// catch, runs the German tests, and expects them to go RED; then the file is put back.
// Run on the build host (it starts the dev server and the API, like any Playwright run):
//   node scripts/lang-content/mutate-play.mjs
// Exits 1 if any mutation was NOT caught.
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

// Each mutation names the failure it must cause (`expect`): a run that goes red for another reason (a timeout,
// a server that did not start) is not counted as caught (checker, 2026-11-16: the tooltip mutation was "caught"
// only by a 90 s click timeout).
const MUTATIONS = [
  { name: 'English left in a locale file', file: 'src/i18n/pages/playground/de.ts', from: `'pg.packs.title': "Kartenpacks"`, to: `'pg.packs.title': "Card Packs"`, grep: 'playground in de', expect: /English "Card Packs" is still on screen/ },
  { name: 'an unfilled {placeholder}', file: 'src/i18n/pages/playground/de.ts', from: `'pg.trivia.start': "Quiz starten"`, to: `'pg.trivia.start': "Quiz {starten}"`, grep: 'playground in de', expect: /unfilled placeholders/ },
  { name: 'markup that lost its key', file: 'src/pages/playground.astro', from: ` data-i18n="pg.stat.cards">Cards Owned<`, to: `>Cards Owned<`, grep: 'playground in de', expect: /English "Cards Owned" is still on screen/ },
  { name: 'a raw key shown as text', file: 'src/i18n/pages/story/de.ts', from: `'story.act.1.name': "Die Straßen von Verona"`, to: `'story.act.1.name': "story.act.1.name"`, grep: 'story page in de', expect: /message keys shown as text/ },
  { name: 'English trivia served to a German player', file: 'src/lib/play-content.ts', from: `if (l === 'en') return TRIVIA_BANK;`, to: `if (l) return TRIVIA_BANK;`, grep: 'relabels the open playground', expect: /an English trivia question after switching to German/ },
  // The story file writes the isolates as escapes: the text searched for here is a backslash and u2068, not the character.
  { name: 'an English line left bare in an Arabic scene', file: 'src/i18n/pages/story/ar.ts', from: '\\u2068\\"Do you bite your thumb at me, sir?\\"\\u2069', to: '\\"Do you bite your thumb at me, sir?\\"', grep: 'keeps its question mark', expect: /the question mark is drawn right after "sir"/ },
  { name: 'the onboarding tooltip placed in page coordinates again', file: 'src/pages/playground.astro', from: 'tooltip.style.top = `${top}px`;', to: 'tooltip.style.top = `${rect.top + window.scrollY - pad - 140}px`;', grep: 'onboarding at phone width in en', expect: /the tooltip is inside the 390 x 844 viewport|the tooltip does not cover its target|the tooltip stands next to its target/ },
  { name: 'English trivia in the German playground test itself', file: 'src/lib/play-content.ts', from: `if (l === 'en') return TRIVIA_BANK;`, to: `if (l) return TRIVIA_BANK;`, grep: 'playground in de', expect: /an English trivia question is shown in de/ },
  // The checker's finds of 2026-11-16, put back one at a time.
  { name: "a closing bracket inside the isolate (Arabic trivia 140: \"Lord Chamberlain's Men))\")", file: 'src/i18n/pages/trivia/ar.ts', from: "(\\u2068Lord Chamberlain's Men\\u2069)", to: "(\\u2068Lord Chamberlain's Men)\\u2069", grep: 'drawn in reading order', expect: /is drawn outside its pair/ },
  { name: "the sentence's full stop inside the isolate (Arabic story 1-4)", file: 'src/i18n/pages/story/ar.ts', from: '\\u2068Escalus\\u2069."', to: '\\u2068Escalus.\\u2069"', grep: 'drawn in reading order', expect: /is not at the end of the line/ },
  { name: 'an English line in an Arabic scene with its question mark outside the isolate', file: 'src/i18n/pages/story/ar.ts', from: '\\u2068\\"Do you bite your thumb at me, sir?\\"\\u2069', to: '\\"\\u2068Do you bite your thumb at me, sir\\u2069?\\"', grep: 'drawn in reading order', expect: /closing the English line is drawn before its last letter/ },
  { name: 'dir="auto" on the trivia options again', file: 'src/pages/playground.astro', from: '<button dir="${qDir}" class="trivia-option', to: '<button dir="auto" class="trivia-option', grep: 'still laid out right to left', expect: /the question and every option are laid out right to left/ },
  { name: 'the cards owned out of the catalogue with no direction of its own', file: 'src/pages/playground.astro', from: '<span dir="ltr"><span id="stat-cards"', to: '<span><span id="stat-cards"', grep: 'reads count first', expect: /counts out of a total drawn total first/ },
  { name: 'the trivia score at the end of a round with no isolate', file: 'src/pages/playground.astro', from: 'triviaScoreDisplay.textContent = `\\u2066${triviaScore} / ${total}\\u2069`;', to: 'triviaScoreDisplay.textContent = `${triviaScore} / ${total}`;', grep: 'reads count first', expect: /counts out of a total drawn total first/ },
];

// Without any mutation the tests must be green, or a red result below means nothing.
const run = (grep) => spawnSync('npx', ['playwright', 'test', 'tests/play-i18n.spec.ts', '-g', grep, '--reporter=line'], { encoding: 'utf8', env: process.env });
const base = run('in de|reading order|right to left|count first|phone width in en|question mark');
if (base.status !== 0) { console.error('The tests are red before any mutation:\n' + base.stdout.slice(-1500)); process.exit(2); }
console.log('baseline: green');

let missed = 0;
for (const m of MUTATIONS) {
  const original = readFileSync(m.file, 'utf8');
  if (!original.includes(m.from)) { console.error(`MUTATION DOES NOT APPLY (${m.name}): "${m.from}" is not in ${m.file}`); missed++; continue; }
  writeFileSync(m.file, original.replace(m.from, m.to));
  let r;
  try { r = run(m.grep); } finally { writeFileSync(m.file, original); }
  const red = r.status !== 0;
  const caught = red && m.expect.test(r.stdout);
  const why = (r.stdout.match(m.expect) ?? r.stdout.match(/Error: .*/) ?? [''])[0];
  console.log(`${caught ? 'CAUGHT' : red ? 'RED FOR ANOTHER REASON' : 'MISSED'}: ${m.name}  (${why.slice(0, 110)})`);
  if (!caught) missed++;
}
process.exit(missed ? 1 : 0);
