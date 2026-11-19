#!/usr/bin/env node
/**
 * Proves the voice's unit tests can fail: plants one fault at a time in the G2P, the letter
 * rules, the voice and the build check, runs the voice tests, and expects each run to fail.
 * Every file is put back after each fault. Run on the build host (it runs vitest 25 times):
 *
 *   node scripts/voice/mutate-voice.mjs
 *
 * Exit status 1 if any fault leaves the tests green.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const G2P = 'src/lib/voice/g2p-en.ts';
const LTS = 'src/lib/voice/lts-en.ts';
const CHECK = 'scripts/check-no-espeak.mjs';

/** [what the fault is, file, text to find, what it becomes] */
const FAULTS = [
  ['an r after a vowel is not part of it', G2P, "const rColoured = next === 'R' && !isVowel(after);", 'const rColoured = false;'],
  ['no r kept before the next word', G2P, "if (r.endsR) r.ps += 'ɹ';", ''],
  ['little words always strong', G2P, 'ps: phraseEnd ? strong : weak', 'ps: strong'],
  ['"wind" never read by context', G2P, "case 'wind':\n    case 'winds':", "case 'wind_':\n    case 'winds_':"],
  ['no BATH vowel', G2P, 'const bath = stemIn(BATH, w);', 'const bath = false;'],
  ['ASCII g, which Kokoro deletes', G2P, "G: 'ɡ', HH: 'h'", "G: 'g', HH: 'h'"],
  ['no pause at a line end', G2P, '.map((l) => (/[;:,.!?—…"”]$/.test(l) ? l : `${l},`));', '.map((l) => l);'],
  ['years read as numbers', G2P, 'return yearWords(n);', 'return numberWords(n);'],
  ['no syllabic l or n', G2P, "syllabicSchwa(phones, i) ? 'ᵊ' : 'ə'", "'ə'"],
  ['"the" never ði', G2P, "if (lower === 'the' && r.ps === 'ðə') r.ps = 'ði';", ''],
  ['American flap kept', G2P, 'const keeps = prons.find(', 'const keeps = undefined && prons.find('],
  ['a after w not ɒ', G2P, "return /(w|wh|qu)$/.test(w.slice(0, g.start + g.text.indexOf('a')));", 'return false;'],
  ['no dropped g', G2P, `for (const tail of ["in'", 'in'])`, 'for (const tail of [])'],
  ['held sounds lose their r', G2P, "if (r >= 0) return `${sym(read(letters.slice(0, r)))}ˈɜː", "if (r < 0) return `${sym(read(letters.slice(0, r)))}ˈɜː"],
  ['no splitting for Kokoro', G2P, 'while (rest.length > max) {', 'while (false) {'],
  ['prototype keys taken for little words', G2P, 'const little = Object.hasOwn(FUNCTION_GB, w) ? FUNCTION_GB[w] : undefined;', 'const little = (FUNCTION_GB as any)[w];'],
  ['old pronouns unstressed', G2P, "thy: ['ðˌI', 'ðˈI']", "thy: ['ðI', 'ðˈI']"],
  ['"and" reduced to ənd', G2P, "and: ['and', 'ˈand']", "and: ['ənd', 'ˈand']"],
  ['au/aw/ought read as lot', G2P, "sym = rColoured ? 'ɑː' : thoughtSpelling(g, w) ? 'ɔː' : lotVowel(g, w) ? 'ɒ' : 'ɑː';", "sym = rColoured ? 'ɑː' : lotVowel(g, w) ? 'ɒ' : 'ɑː';"],
  ['-ed and -es said with ə', G2P, "if (s === 0 && britishIEnding(phones, i)) {", 'if (false) {'],
  ['a after w read as thought', G2P, "if (g.text === 'a' && afterW(w, g)) return", "if (false) return"],
  ['# in a left context needs no vowel', LTS, "      case '#':\n        if (!isVowel(text[i])) return false;\n        i--;", "      case '#':\n        i--;"],
  ['% never matches', LTS, "      case '%':\n        // A suffix: ER, E, ES, ED, ING, ELY.", "      case '%':\n        return false;\n        // A suffix"],
  ['rules read in the wrong order', LTS, 'for (const [left, match, right, out] of rules ?? []) {', 'for (const [left, match, right, out] of [...(rules ?? [])].reverse()) {'],
  ['check reads no base64', CHECK, 'for (const m of text.matchAll(BASE64_RUN)) {', 'for (const m of []) {'],
  ['check does not gunzip', CHECK, 'if (bytes[0] === 0x1f && bytes[1] === 0x8b) {', 'if (false) {'],
  ['check finds the name inside other words', CHECK, '(?<![A-Za-z])(?:eSpeak|ESPEAK|espeak[-_]ng)', '(?:eSpeak|ESPEAK|espeak[-_]ng|espeak)'],
  ['voice reads text through kokoro-js', 'src/lib/thespian-voice.ts', 'const audio = await model.generate_from_ids(input_ids, { voice, speed });', 'const audio = await model.generate(ps, { voice, speed });'],
  ['phonemizer not swapped out', 'astro.config.mjs', "resolve: { alias: [{ find: /^phonemizer$/, replacement: noEspeak }] },", ''],
  ['the build does not run the check', 'package.json', '"build": "astro build && node scripts/check-no-espeak.mjs dist",', '"build": "astro build",'],
];

let survived = 0;
for (const [what, file, find, replace] of FAULTS) {
  const path = join(ROOT, file);
  const original = readFileSync(path, 'utf8');
  if (!original.includes(find)) {
    console.log(`NOT PLANTED  ${what}: the text is not in ${file}`);
    survived++;
    continue;
  }
  writeFileSync(path, original.replace(find, replace));
  let failed = false;
  try {
    execFileSync('npx', ['vitest', 'run', 'src/lib/voice'], { cwd: ROOT, stdio: 'pipe' });
  } catch {
    failed = true;
  } finally {
    writeFileSync(path, original);
  }
  console.log(`${failed ? 'red      ' : 'SURVIVED '}  ${what} (${file})`);
  if (!failed) survived++;
}
console.log(survived ? `${survived} of ${FAULTS.length} faults left the tests green or could not be planted.` : `All ${FAULTS.length} faults turn the voice tests red.`);
process.exit(survived ? 1 : 0);
