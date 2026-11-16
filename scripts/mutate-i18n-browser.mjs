// Proves the browser tests of the translated interface can fail. Run on the build host, in a
// checkout that can be thrown away, with the E2E_* ports of your own run:
//
//   node scripts/mutate-i18n-browser.mjs
//
// It breaks three things at once, runs tests/i18n.spec.ts, and expects exactly the tests that
// look at them to go red: an English string left in the Spanish locale, a placeholder that is
// never filled in Japanese, and Arabic no longer turning the page right to left.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const MUTATIONS = [
  ['src/i18n/locales/es.ts', "'round.whoAnswers': '¿Quién responde?'", "'round.whoAnswers': 'Who answers?'"],
  ['src/i18n/locales/ja.ts', "'verdict.roundScore': 'ラウンドの得点'", "'verdict.roundScore': 'ラウンドの得点 {points}'"],
  ['src/i18n/index.ts', "isRtl(next) ? 'rtl' : 'ltr'", "'ltr'"],
];
const EXPECT_RED = ['Spanish:', 'Arabic:', 'Japanese:', 'every one of the sixteen'];
const EXPECT_GREEN = ['the choice is remembered', 'a French browser'];

const originals = MUTATIONS.map(([file]) => [file, readFileSync(file, 'utf8')]);
let out = '';
try {
  for (const [file, find, replace] of MUTATIONS) {
    const text = readFileSync(file, 'utf8');
    if (!text.includes(find)) throw new Error(`${file}: "${find}" is no longer there; update this mutation`);
    writeFileSync(file, text.replace(find, replace));
  }
  try {
    out = execSync('npx playwright test tests/i18n.spec.ts --reporter=list 2>&1', { encoding: 'utf8', maxBuffer: 64e6 });
  } catch (err) {
    out = String(err.stdout ?? '');
  }
} finally {
  for (const [file, text] of originals) writeFileSync(file, text);
}

const line = (name) => out.split('\n').find((l) => l.includes(name) && /[✓✘×]|\bok\b|failed/.test(l)) ?? '';
let wrong = 0;
for (const name of EXPECT_RED) {
  const red = /✘|×/.test(line(name));
  console.log(`${red ? 'CAUGHT ' : 'MISSED '} ${name}`);
  if (!red) wrong++;
}
for (const name of EXPECT_GREEN) {
  const green = /✓/.test(line(name));
  console.log(`${green ? 'STILL GREEN' : 'UNEXPECTED RED'} ${name}`);
  if (!green) wrong++;
}
console.log(out.split('\n').filter((l) => /passed|failed/.test(l)).slice(-3).join('\n'));
process.exit(wrong ? 1 : 0);
