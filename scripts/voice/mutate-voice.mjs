#!/usr/bin/env node
/**
 * Proves the voice's unit tests can fail: plants one fault at a time in the G2P, the letter
 * rules, the voice and the build check, runs the voice tests, and expects each run to fail.
 * Every file is put back after each fault. Run on the build host (it runs vitest once per fault):
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
/**
 * The unit tests each fault must turn red. Not measurement.test.ts: it fails on almost any change
 * to the G2P (the measurement is then of other code) and would hide a fault the unit tests miss.
 */
const UNIT_TESTS = [
  'src/lib/voice/g2p-en.test.ts', 'src/lib/voice/no-espeak.test.ts', 'src/lib/thespian-voice.test.ts', 'src/lib/voice/held-out.test.ts',
  'src/lib/voice/measure-host.test.ts',
];

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
  ['the rules\' h unread', LTS, '|NG|CH|WH|[pbtdkgfvszmnlwyrjh]/g;', '|NG|CH|WH|[pbtdkgfvszmnlwyrj]/g;'],
  ['a stem taken apart before one the table has whole', G2P, '  for (const s of candidates) {\n    const whole = known(s);\n    if (whole) return whole;\n  }\n', ''],
  ['"etc" read inside "etch"', G2P, "[/\\betc\\b\\.?/gi, 'et cetera']", "[/\\betc\\.?/gi, 'et cetera']"],
  ['letters and digits not read together (mp3)', G2P, 't = t.replace(/(?<![\\p{L}\\p{M}\\d])(?=[A-Za-z\\d]*\\d)(?=[A-Za-z\\d]*[A-Za-z])[A-Za-z\\d]+(?![\\p{L}\\p{M}\\d])/gu, gluedWord);', ''],
  ['digits left beside other marks dropped', G2P, 't = t.replace(/\\d+/g, (m: string) => ` ${numberSaid(m)} `);', ''],
  ['no decades after an apostrophe', G2P, "t = t.replace(/(?<![\\p{L}\\p{M}\\d])'?(\\d+)s(?![\\p{L}\\p{M}\\d])/gu, (_, n: string) => pluralOf(numberSaid(n)));", ''],
  ['no am and pm', G2P, "    return `${m ? clock(h, m).replace(\" o'clock\", '') : clock(h)} ${ap.toUpperCase()} M${dot}`;", '    return all;'],
  ['the A of a time said as "a"', G2P, "const spelt = t.text === 'A' && capitalLetter(i + 1);", 'const spelt = false;'],
  ['text-speak in capitals ("G8" as gate)', G2P, '/^[A-Z]?[a-z]+$/.test(letters)', '/^[A-Za-z]+$/.test(letters)'],
  ['text-speak without the table ("2pac" as topac)', G2P, 'if (lexicon.has(word)) return word;', 'return word;'],
  ['a minus sign dropped', G2P, "t = t.replace(/(^|[\\s(\\[{\"“'])-(?=\\d)/g, '$1minus ')", 't = t'],
  ['no Roman numerals', G2P, 't = romanNumerals(t);', ''],
  ['a lone I after a king\'s name always his number', G2P, '      if (loneI && !endsPhrase()) return all;\n', ''],
  ['kisses after a king\'s name read as his number (Mary XX)', G2P, " || /^X+$/.test(num)) return all;", ') return all;'],
  ['the pronoun\'s contractions read as a numeral (Mary I\'m)', G2P, "if (/^'\\p{L}/u.test(rest) && (loneI || !/^'s(?![\\p{L}\\p{M}\\d])/u.test(rest))) return all;", ''],
  ['any word after a lone I ends its phrase (MARY I LOVE YOU)', G2P, '      if (/^[ \\t]*(?:$|\\n|[.,;:!?…)\\]"”])/.test(rest)) return true;', '      return true;'],
  ['a lone I before "of" not a number (Henry I of England)', G2P, "return next === 'of' || next === 'and' ||", 'return'],
  ['one letter C, D, L or M after a part\'s name a number (Part C)', G2P, 'if (/^[LCDM]$/.test(num) || n >= 400) return all;', 'if (n >= 400) return all;'],
  ['a long numeral after a part\'s name always a number (Part MIX)', G2P, 'if (/^[LCDM]$/.test(num) || n >= 400) return all;', 'if (/^[LCDM]$/.test(num)) return all;'],
  ['a numeral after a little word (an IV)', G2P, ' && !NOT_A_TITLE.has(lower)', ''],
  ['am and pm across a line break', G2P, '(?::(\\d{2}))?([ \\t]?)([AaPp])(\\.?)[ \\t]?([Mm])', '(?::(\\d{2}))?(\\s?)([AaPp])(\\.?)\\s?([Mm])'],
  ['the verb am after a count read as a time (Round 2 am I)', G2P, '    if (!m && sp && !dot1 && !dot && verbAm(', '    if (false && verbAm('],
  ['every am before I after a number the verb (at 7 am I woke)', G2P, 'return !!word && !TIME_BEFORE.has(word.toLowerCase());', 'return true;'],
  ['an hour past 12 read as a time (13pm)', G2P, '    if (Number(h) > 12) return all;\n', ''],
  ['emoji silent', G2P, 'return said ? ` ${said} ` : e;', 'return e;'],
  ['an emoji with a skin tone in a joined one not named whole', G2P, " ?? emojiNames.get(plain.replace(/[\\u{1F3FB}-\\u{1F3FF}]/gu, ''))", ''],
  ['joined emoji CLDR has no name for not named by parts', G2P, "if (plain.includes('\\u200D')) return plain.split('\\u200D').map(emojiSaid).filter(Boolean).join(' ');", ''],
  ['the keycap # row taken for the notice', G2P, "if (tab > 0 && !line.startsWith('# '))", "if (tab > 0 && !line.startsWith('#'))"],
  ['one letter after any capitalised word a numeral (Malcolm X)', G2P, 'num.length >= 2 && /^[IVX]+$/.test(num)', 'num.length >= 1 && /^[IVX]+$/.test(num)'],
  ['kisses read as a number', G2P, ' && !/^X+$/.test(num)', ''],
  ['text with nothing to say played as silence', 'src/lib/thespian-voice.ts', 'if (!phonemes.length) return speakFallback(text, lang);', ''],
  ['held-out words named in the sources not found', 'scripts/voice/corpus.mjs', 'if (files.length) found.set(w, files);', ''],
  ['the measurement host check passes any host', 'scripts/voice/host.mjs', 'return readdirSync(bin).some(', 'return true || readdirSync(bin).some('],
  ['check reads no base64', CHECK, 'for (const m of text.matchAll(BASE64_RUN)) {', 'for (const m of []) {'],
  ['check does not gunzip', CHECK, 'if (bytes[0] === 0x1f && bytes[1] === 0x8b) {', 'if (false) {'],
  ['check runs only when called by its real path (silent through a symlink)', CHECK, 'return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));', 'return process.argv[1] === fileURLToPath(import.meta.url);'],
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
    execFileSync('npx', ['vitest', 'run', ...UNIT_TESTS], { cwd: ROOT, stdio: 'pipe' });
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
