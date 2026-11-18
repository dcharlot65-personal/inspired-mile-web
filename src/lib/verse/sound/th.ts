/**
 * Thai: the sound a stretch of text ends on, read from the spelling.
 *
 * Thai is written without spaces, a vowel may be written before, above, below
 * or around its consonant, and some vowels are not written at all. A word in
 * the pronunciation table (../sound, built from Wiktionary) is read from the
 * table. This file is the fallback for an ending the table does not have: it
 * reads the last syllable by the regular spelling patterns, tried from the
 * most specific to the least.
 *
 * It answers with a rime in the table's own notation: the vowel, long vowels
 * marked "ː", the three diphthongs as "ia", "ɯa", "ua", then the closing sound
 * as one of k t p n m ŋ j w (Thai has only these eight closing sounds, however
 * the consonant is spelled). Tone is not part of the rime: Thai rhyme (สัมผัสสระ)
 * does not ask for it.
 *
 * What it cannot know: where an unwritten vowel sits in a word it has never
 * seen ("ขนม" is kha-nom, not khon-m), and loanwords spelled against the
 * patterns. scripts/sound/build.mjs measures it against the dictionary; the
 * figure is in docs/language/PHONETICS.md.
 */

const C = '[ก-ฮ]';
const TONES = /[่-๋]/g;

/** The closing sound a final consonant letter stands for. */
function fin(c: string | undefined): string {
  if (!c) return '';
  if ('กขฃคฅฆ'.includes(c)) return 'k';
  if ('จฉชซฌฎฏฐฑฒดตถทธศษส'.includes(c)) return 't';
  if ('บปผฝพฟภ'.includes(c)) return 'p';
  if ('นณญรลฬ'.includes(c)) return 'n';
  if (c === 'ม') return 'm';
  if (c === 'ง') return 'ŋ';
  if (c === 'ย') return 'j';
  if (c === 'ว') return 'w';
  return '';
}

type Pattern = [RegExp, (m: RegExpExecArray) => string];

const p = (body: string, out: (m: RegExpExecArray) => string): Pattern => [new RegExp(`${body}$`), out];

const PATTERNS: Pattern[] = [
  p(`เ${C}{1,2}ีย(${C})`, (m) => `ia${fin(m[1])}`),
  p(`เ${C}{1,2}ียะ?`, () => 'ia'),
  p(`เ${C}{1,2}ือ(${C})`, (m) => `ɯa${fin(m[1])}`),
  p(`เ${C}{1,2}ือะ?`, () => 'ɯa'),
  p(`${C}ัวะ?`, () => 'ua'),
  p(`เ${C}{1,2}าะ`, () => 'ɔ'),
  p(`เ${C}{1,2}า`, () => 'aw'),
  p(`เ${C}{1,2}อะ`, () => 'ɤ'),
  p(`เ${C}{1,2}อ`, () => 'ɤː'),
  p(`เ${C}{1,2}ิ(${C})`, (m) => `ɤː${fin(m[1])}`),
  p(`เ${C}{1,2}ย`, () => 'ɤːj'),
  p(`เ${C}{1,2}็(${C})`, (m) => `e${fin(m[1])}`),
  p(`เ${C}{1,2}ะ`, () => 'e'),
  p(`แ${C}{1,2}็(${C})`, (m) => `ɛ${fin(m[1])}`),
  p(`แ${C}{1,2}ะ`, () => 'ɛ'),
  p(`โ${C}{1,2}ะ`, () => 'o'),
  p(`[ไใ]${C}{1,2}ย?`, () => 'aj'),
  p(`${C}ำ`, () => 'am'),
  p(`${C}ั(${C})`, (m) => `a${fin(m[1])}`),
  p(`${C}า(${C})`, (m) => `aː${fin(m[1])}`),
  p(`${C}า`, () => 'aː'),
  p(`${C}ิ(${C})?`, (m) => `i${fin(m[1])}`),
  p(`${C}ี(${C})?`, (m) => `iː${fin(m[1])}`),
  p(`${C}ึ(${C})?`, (m) => `ɯ${fin(m[1])}`),
  p(`${C}ือ`, () => 'ɯː'),
  p(`${C}ื(${C})`, (m) => `ɯː${fin(m[1])}`),
  p(`${C}ุ(${C})?`, (m) => `u${fin(m[1])}`),
  p(`${C}ู(${C})?`, (m) => `uː${fin(m[1])}`),
  p(`${C}็อ(${C})`, (m) => `ɔ${fin(m[1])}`),
  p(`${C}ะ`, () => 'a'),
  // A leading vowel with one or two consonants after it and nothing else: the last consonant closes the syllable.
  p(`เ${C}(${C})`, (m) => `eː${fin(m[1])}`),
  p(`เ${C}`, () => 'eː'),
  p(`แ${C}(${C})`, (m) => `ɛː${fin(m[1])}`),
  p(`แ${C}`, () => 'ɛː'),
  p(`โ${C}(${C})`, (m) => `oː${fin(m[1])}`),
  p(`โ${C}`, () => 'oː'),
  p(`${C}อ(${C})`, (m) => `ɔː${fin(m[1])}`),
  p(`${C}อ`, () => 'ɔː'),
  p(`${C}ว(${C})`, (m) => `ua${fin(m[1])}`),
  p(`รร(${C})`, (m) => `a${fin(m[1])}`),
  p(`${C}รร`, () => 'an'),
  p(`${C}ร`, () => 'ɔːn'),
  p(`${C}(${C})`, (m) => `o${fin(m[1])}`),
  p(`${C}`, () => 'a'),
];

/** Text as the patterns read it: Thai letters only, no tone marks, no silenced letters, no repeat sign. */
export function thaiPlain(text: string): string {
  return text
    .normalize('NFC')
    .replace(/[^ก-๎]/g, '')
    .replace(/(ทร|ตร|ดร)\u0e4c/g, '')
    .replace(/[ก-ฮ][ิ-ู]?์/g, '')
    .replace(TONES, '')
    .replace(/[ๆฯํ๎]/g, '');
}

/** The rime of the last syllable of a stretch of Thai, by spelling patterns; null when there is no Thai in it. */
export function thaiRimeBySpelling(text: string): string | null {
  const t = thaiPlain(text);
  if (!t) return null;
  for (const [re, out] of PATTERNS) {
    const m = re.exec(t);
    if (m) return out(m);
  }
  return null;
}
