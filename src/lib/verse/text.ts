/**
 * Text measurement for verse: lines, words, letters, syllables, alliteration.
 * Rhyme lives in ./rhyme.
 *
 * Everything here is deterministic and runs without a model. Each measure takes
 * the language of the verse, because what a "word", a "letter" or a "syllable"
 * is depends on the script:
 *
 * - Words are runs of Unicode letters where the script puts spaces between
 *   them. Chinese, Japanese and Thai do not, so their words come from the
 *   platform's dictionary segmenter (Intl.Segmenter). Different browsers can
 *   split a rare phrase differently; the form checks for Chinese and Japanese
 *   therefore count characters, not words, and only bonus devices lean on the
 *   segmenter. Thai has no such alternative and uses segmenter words throughout.
 * - Syllables are counted from the sound: by a spelling rule where the spelling
 *   shows it, corrected by that language's dictionary table where it does not
 *   (./sound), and not at all where neither can say (unvocalised Arabic).
 *   English is read from the pronunciation table built from the CMU
 *   Pronouncing Dictionary (./pronounce), by spelling only for a word the
 *   table does not have.
 */
import { baseLang, rulesFor } from './lang';
import { CARD_CATALOG } from '../cards';
import { functionKey, functionWords } from './function-words';
import { getPack } from './packs';
import { pronounce, pronunciationLoaded, spellingTrigrams } from './pronounce';
import { soundOf, soundReady } from './sound';
import { japaneseMorae, japaneseWords } from './sound/kana';
import { countOverride, frenchSound, germanSound, hindiSyllablesByRule, thaiSyllables } from './sound/lookup';
import CONFUSABLE_PAIRS from './confusables';

/** Longest verse the game accepts. Also bounds what a judge prompt can carry. */
export const MAX_VERSE_CHARS = 600;
export const MAX_VERSE_LINES = 8;

// --- Cleaning ---
//
// A verse is normalised once, here, before anything measures it, so that what
// the rules read is what a person sees:
//   1. every kind of line break becomes "\n";
//   2. compatibility forms become the plain character (NFKC): full-width letters,
//      ligatures, the long s. Thai and Lao are left as typed: NFKC would respell
//      their "am" vowel, and nothing in those scripts poses as another letter;
//   3. characters that draw nothing but are not white space (Hangul fillers, the Braille
//      blank) become a space, so they can neither pose as words nor glue two together;
//   4. characters that draw nothing at all are removed: controls, format characters
//      (soft hyphen, zero-width and direction marks, tag characters), private-use code
//      points, variation selectors and the other default-ignorables;
//   5. combining marks with no letter under them are removed, and a pile of them is cut short;
//   6. inside a word that mixes alphabets, a letter of another alphabet that is drawn
//      like one of the word's own is read as that letter ("r" + Cyrillic "o" + "se" is "rose").
//      Which letters are drawn alike is Unicode's data (UTS #39 confusables, ./confusables).
// Cleaning a clean verse changes nothing: cleanVerse(cleanVerse(x)) === cleanVerse(x).

const LINE_BREAKS = /\r\n?|[\u000b\u000c\u0085\u2028\u2029]/g;
const BLANKS = /[\t\u115f\u1160\u3164\uffa0\u2800\p{Zs}]/gu;
const INVISIBLE = /[\p{Cc}\p{Cf}\p{Co}\p{Cs}\p{Default_Ignorable_Code_Point}]/gu;
const ORPHAN_MARKS = /(^|[^\p{L}\p{N}\p{M}])\p{M}+/gu;
/** Most combining marks one letter may carry. Real writing needs two or three; stacked "zalgo" text uses dozens. */
const MAX_MARKS = 4;
const MARK_PILE = new RegExp(`(\\p{M}{${MAX_MARKS}})\\p{M}+`, 'gu');
const NOT_THAI_LAO = /[^\u0e00-\u0eff]+/g;

// --- Letters drawn alike (UTS #39) ---

/** Each letter of ./confusables and the Latin letter Unicode gives as its prototype. */
const PROTOTYPE = new Map<string, string>();
{
  const cs = [...CONFUSABLE_PAIRS];
  for (let i = 0; i + 1 < cs.length; i += 2) PROTOTYPE.set(cs[i], cs[i + 1]);
}

/** The prototype of a letter: what Unicode says it is drawn like (itself, for most letters). */
export function prototypeOf(letter: string): string {
  return PROTOTYPE.get(letter) ?? letter;
}

/** Scripts a letter can be in, for telling a word that mixes alphabets. The rest are "Other". */
const SCRIPTS = [
  'Latin', 'Cyrillic', 'Greek', 'Armenian', 'Coptic', 'Georgian', 'Cherokee', 'Hebrew', 'Arabic', 'Lisu', 'Canadian_Aboriginal',
  'Tifinagh', 'Vai', 'Ethiopic', 'Han', 'Hiragana', 'Katakana', 'Hangul', 'Bopomofo', 'Thai', 'Lao', 'Devanagari', 'Bengali',
  'Gurmukhi', 'Gujarati', 'Oriya', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Sinhala', 'Myanmar', 'Khmer', 'Tibetan', 'Mongolian',
  'Syriac', 'Thaana', 'Nko', 'Osage', 'Adlam', 'Deseret', 'Glagolitic', 'Gothic', 'Runic', 'Ogham', 'Old_Italic', 'Javanese', 'Yi',
] as const;
const SCRIPT_RES = SCRIPTS.map((name) => [name, new RegExp(`^\\p{Script=${name}}$`, 'u')] as const);
const scriptCache = new Map<string, string>();

/** The script of one character: a name from SCRIPTS, 'Mark' for a combining mark, 'Other' for anything else. */
export function scriptOf(ch: string): string {
  let s = scriptCache.get(ch);
  if (s === undefined) {
    s = /^\p{M}$/u.test(ch) ? 'Mark' : (SCRIPT_RES.find(([, re]) => re.test(ch))?.[0] ?? 'Other');
    scriptCache.set(ch, s);
  }
  return s;
}

/** Letters by prototype and script: which letter of a given alphabet is drawn like a given one. */
const BY_PROTOTYPE = new Map<string, Map<string, string[]>>();
{
  const add = (letter: string) => {
    const proto = prototypeOf(letter);
    let byScript = BY_PROTOTYPE.get(proto);
    if (!byScript) BY_PROTOTYPE.set(proto, (byScript = new Map()));
    const script = scriptOf(letter);
    const list = byScript.get(script) ?? [];
    if (!list.includes(letter)) list.push(letter);
    byScript.set(script, list);
  };
  for (let c = 0x41; c <= 0x7a; c++) if (/[A-Za-z]/.test(String.fromCharCode(c))) add(String.fromCharCode(c));
  for (const letter of PROTOTYPE.keys()) add(letter);
  // The plainest first: ASCII, then the lowest code point (the basic block of each alphabet).
  for (const byScript of BY_PROTOTYPE.values()) for (const list of byScript.values()) list.sort((a, b) => a.codePointAt(0)! - b.codePointAt(0)!);
}

/** The letter of `script` that is drawn like `letter`, in the same case where there is a choice; or undefined. */
function twinIn(letter: string, script: string): string | undefined {
  const list = BY_PROTOTYPE.get(prototypeOf(letter))?.get(script);
  if (!list?.length) return undefined;
  const upper = letter !== letter.toLowerCase();
  return list.find((l) => (l !== l.toLowerCase()) === upper) ?? list[0];
}

/**
 * In a word that mixes alphabets, read the strays as letters of the word's own
 * alphabet. Which alphabet that is, is told by the letters that could not be
 * strays: those with no look-alike in the other alphabets present ("r" and "s"
 * in "rose", the Cyrillic m, l and k of "moloko"). Where those do not settle it,
 * the alphabet most of the word's letters are in; and Latin if that is even. A
 * stray with no look-alike in the word's alphabet is left as it is.
 */
function unmixScripts(line: string): string {
  return line.replace(/[\p{L}\p{M}]+/gu, (word) => {
    const letters = [...word];
    const scripts = letters.map(scriptOf);
    const present = [...new Set(scripts.filter((s) => s !== 'Mark' && s !== 'Other'))];
    if (present.length < 2) return word;
    let main = present[0];
    let best = [-1, -1, -1];
    for (const s of present) {
      const mine = letters.filter((_, i) => scripts[i] === s);
      const own = mine.filter((ch) => present.every((t) => t === s || !twinIn(ch, t))).length;
      const score = [own, mine.length, s === 'Latin' ? 1 : 0];
      if (score[0] > best[0] || (score[0] === best[0] && (score[1] > best[1] || (score[1] === best[1] && score[2] > best[2])))) [main, best] = [s, score];
    }
    return letters.map((ch, i) => (scripts[i] === main || scripts[i] === 'Mark' || scripts[i] === 'Other' ? ch : (twinIn(ch, main) ?? ch))).join('');
  });
}

function cleanOnce(raw: string, unmix: boolean): string {
  const lines = raw
    .replace(LINE_BREAKS, '\n')
    .replace(NOT_THAI_LAO, (run) => run.normalize('NFKC'))
    .replace(BLANKS, ' ')
    .split('\n')
    .map((l) => {
      let line = l.replace(INVISIBLE, '').replace(ORPHAN_MARKS, '$1').replace(MARK_PILE, '$1');
      if (unmix) line = unmixScripts(line);
      // Removing a character can bring a letter and its mark together; compose them as NFKC would.
      return line.replace(NOT_THAI_LAO, (run) => run.normalize('NFKC')).replace(/\s+/g, ' ').trim();
    })
    .filter((l) => l.length > 0)
    .slice(0, MAX_VERSE_LINES);
  let out = lines.join('\n');
  if (out.length > MAX_VERSE_CHARS) {
    // Cut between characters, never inside a surrogate pair, and drop marks left without their letter's company.
    const cs = [...out];
    let n = 0;
    let keep = 0;
    while (keep < cs.length && n + cs[keep].length <= MAX_VERSE_CHARS) n += cs[keep++].length;
    out = cs.slice(0, keep).join('');
  }
  return out;
}

/**
 * Normalise a verse (see above), collapse blank lines, cap the length. With
 * `unmix: false` the letters of other alphabets are left as typed: that is how a
 * curse reads a verse (wordsAsRead), since a word that mixes alphabets is itself
 * the trick.
 */
export function cleanVerse(raw: string, opts: { unmix?: boolean } = {}): string {
  const unmix = opts.unmix ?? true;
  // A cut at the length cap, or a mark brought next to a letter, can leave something the next
  // pass would change; pass again until nothing changes (two passes in practice).
  let v = cleanOnce(raw, unmix);
  for (let i = 0; i < 4; i++) {
    const again = cleanOnce(v, unmix);
    if (again === v) break;
    v = again;
  }
  return v;
}

export function linesOf(verse: string): string[] {
  return verse.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
}

const WORD_RE = /[\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*/gu;
const HAS_LETTER = /\p{L}/u;

/** Scripts written without spaces between words. */
const UNSPACED = new Set(['zh', 'ja', 'th']);

type Segmenter = { segment(text: string): Iterable<{ segment: string; isWordLike?: boolean }> };
const segmenters = new Map<string, Segmenter | null>();

function segmenter(lang: string, granularity: 'word' | 'grapheme'): Segmenter | null {
  const k = `${lang}:${granularity}`;
  if (!segmenters.has(k)) {
    let s: Segmenter | null = null;
    try {
      const I = Intl as unknown as { Segmenter?: new (l: string, o: { granularity: string }) => Segmenter };
      if (I.Segmenter) s = new I.Segmenter(lang, { granularity });
    } catch {
      s = null;
    }
    segmenters.set(k, s);
  }
  return segmenters.get(k) ?? null;
}

/**
 * Lower-cased words of a line or verse. Apostrophes and hyphens stay inside a word.
 * For Chinese, Japanese and Thai the words are the segmenter's; where there is no
 * segmenter (a very old browser) a run of letters between punctuation is one word.
 */
export function wordsOf(text: string, lang = 'en'): string[] {
  const b = baseLang(lang);
  if (UNSPACED.has(b)) {
    const seg = segmenter(b, 'word');
    if (seg) {
      const out: string[] = [];
      for (const s of seg.segment(text)) if (s.isWordLike && HAS_LETTER.test(s.segment)) out.push(s.segment.toLowerCase());
      return out;
    }
  }
  return (text.match(WORD_RE) ?? []).map((w) => w.toLowerCase());
}

export function lastWord(line: string, lang = 'en'): string {
  const w = wordsOf(line, lang);
  return w.length ? w[w.length - 1] : '';
}

export function firstWord(line: string, lang = 'en'): string {
  const w = wordsOf(line, lang);
  return w.length ? w[0] : '';
}

/**
 * Fold a word for comparison: lower case, and without the accents of Latin and
 * Greek letters or the optional vowel marks of Arabic, so "café" and "cafe", or
 * a vocalised and a bare Arabic word, compare equal. Spellings people type
 * either way are merged too: œ and oe, ß and ss, Russian ё and е, and the
 * Devanagari dot (nukta) that Hindi keyboards often leave off. Every kind of
 * apostrophe becomes the plain one.
 *
 * Marks that are part of the spelling are kept: Devanagari vowel signs, Thai
 * vowels and tones, Japanese voicing marks, the breve of Russian й. Stripping
 * those would make different words equal.
 */
export function fold(word: string): string {
  return word
    .normalize('NFD')
    .replace(/([\p{Script=Latin}\p{Script=Greek}])[\u0300-\u036f]+/gu, '$1')
    .replace(/[\u0640\u064b-\u065f\u0670\u093c]/g, '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/ß/g, 'ss')
    // One apostrophe, however it was typed: phones insert the typographic one.
    .replace(/[\u2019\u2018\u02bc]/g, "'");
}

/** Katakana to hiragana, so the two kana spellings of a sound compare equal. */
export function hiragana(text: string): string {
  return text.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

/** Letters in a word: vowel signs, tone marks, apostrophes and hyphens are not letters. */
export function letterCount(word: string): number {
  let n = 0;
  for (const ch of word.normalize('NFC')) if (HAS_LETTER.test(ch)) n++;
  return n;
}

/**
 * A word's length as the "of N letters or more" rules have always counted it in
 * English: every character of the word, an inner apostrophe or hyphen included
 * ("don't" is five). Marks that sit on a letter (Devanagari vowel signs, Thai
 * tones) are not counted, so the measure also holds for scripts that use them.
 */
export function wordSpan(word: string): number {
  let n = 0;
  for (const ch of word.normalize('NFC')) if (!/\p{M}/u.test(ch)) n++;
  return n;
}

/** The letters of a text, in order, without spaces, punctuation or marks. */
function lettersOf(text: string): string[] {
  return [...text.normalize('NFC')].filter((ch) => HAS_LETTER.test(ch));
}

/** Words for the rules that count them: a hyphenated chain ("one-two-three") is as many words as it has parts. */
export function wordParts(text: string, lang = 'en'): string[] {
  return wordsOf(text, lang).flatMap((w) => w.split('-').filter((part) => HAS_LETTER.test(part)));
}

/** A line's length in the unit its language counts in: words, or characters for Chinese and Japanese. */
export function lineLength(line: string, lang = 'en'): number {
  return rulesFor(lang).unit === 'char' ? letterCount(line) : wordParts(line, lang).length;
}

/**
 * What a line opens or closes with, for anaphora and its mirror: the first or
 * last word, or the first or last character where lines are counted in characters.
 */
export function edgeUnit(line: string, lang: string, edge: 'first' | 'last'): string {
  if (rulesFor(lang).unit === 'char') {
    const letters = lettersOf(hiragana(fold(line)));
    return (edge === 'first' ? letters[0] : letters[letters.length - 1]) ?? '';
  }
  return fold(edge === 'first' ? firstWord(line, lang) : lastWord(line, lang));
}

/** User-perceived characters: a base letter with its marks. */
export function graphemes(text: string, lang = 'en'): string[] {
  const seg = segmenter(baseLang(lang), 'grapheme');
  if (seg) return [...seg.segment(text)].map((s) => s.segment);
  return text.match(/\P{M}\p{M}*/gu) ?? [];
}

/** Words that carry meaning: long enough for their language (four letters in English). */
export function contentWords(text: string, lang = 'en'): string[] {
  const min = rulesFor(lang).content;
  return wordsOf(text, lang).filter((w) => wordSpan(w) >= min);
}

/**
 * The sound a word starts on, for alliteration.
 * Korean: the opening consonant of the first syllable block. Thai: the first
 * consonant, skipping a vowel written before it. Arabic: after the article.
 */
export function initial(word: string, lang = 'en'): string {
  const b = baseLang(lang);
  let w = fold(word);
  if (b === 'ar') {
    w = w.replace(/[أإآٱ]/g, 'ا');
    if ([...w].length > 3 && w.startsWith('ال')) w = w.slice(2);
  }
  if (b === 'th') w = w.replace(/^[เแโใไ]/, '');
  if (b === 'ko') return [...w.normalize('NFD')][0] ?? '';
  if (b === 'ja') w = hiragana(w);
  return [...w][0] ?? '';
}

// --- Syllables ---

const LATIN_VOWELS = 'aeiouy';

function isLatin(word: string): boolean {
  return /^[\p{Script=Latin}'’\-]+$/u.test(word);
}

/** Vowel groups: close for German, Dutch, Catalan, Romanian; the base of the English and French counts. */
function vowelGroups(w: string): number {
  let groups = 0;
  let inVowel = false;
  for (const ch of w) {
    const v = LATIN_VOWELS.includes(ch);
    if (v && !inVowel) groups++;
    inVowel = v;
  }
  return groups;
}

/**
 * German by spelling, for a word the table lacks: each vowel or vowel pair
 * that is one sound ("ie", "ei", "au", "eu", "äu", a doubled vowel) is a
 * syllable, so "Treue" and "bauen" are two.
 */
function germanSyllablesByRule(word: string): number {
  const w = word.toLowerCase().normalize('NFC');
  return Math.max(1, (w.match(/ie|ei|ai|au|eu|äu|aa|ee|oo|[aeiouyäöü]/g) ?? []).length);
}

/**
 * English syllables by spelling: the fallback for a word the pronunciation
 * table does not have (a name, a coinage, a misspelling). It is a guess, which
 * is why a syllable form allows such a line one syllable either way.
 */
function englishSyllables(w: string): number {
  // A "y" between two vowels starts a syllable ("playing", "beyond"); elsewhere it is a vowel.
  const s = w.replace(/([aeiou])y(?=[aeiou])/g, '$1j');
  let groups = vowelGroups(s);
  // Two vowels that are both sounded: "li-on", "Rome-o", "qui-et", "po-em", "cry-ing", "be-ing".
  groups += (s.match(/i[ao]|eo|iet|oe[mt]|[yei]ing|uou/g) ?? []).length;
  // ...but not in "-tion", "-cious", "-cial", "-gion": there the i only softens the consonant.
  if (/[^aeiou](?:ion|ious|ial|ian)s?$/.test(s) && /[cst]i[ao]|[^aeiou]gi[ao]/.test(s)) groups--;
  // Silent final e ("stage"), but not "-le" after a consonant ("candle").
  if (w.length > 2 && w.endsWith('e') && !w.endsWith('le') && !LATIN_VOWELS.includes(w[w.length - 2])) groups--;
  if (w.endsWith('le') && w.length > 2 && LATIN_VOWELS.includes(w[w.length - 3])) groups--;
  // "-es" is silent after most consonants ("leaves", "takes") but not after a hiss ("roses", "wishes")
  // nor after a consonant and l ("tables", "candles").
  if (w.length > 3 && w.endsWith('es') && !LATIN_VOWELS.includes(w[w.length - 3]) && !/(s|x|z|ch|sh|c|g)es$/.test(w) && !/[^aeiouy]les$/.test(w)) groups--;
  // "-ed" is silent except after t or d ("wanted").
  if (w.length > 3 && w.endsWith('ed') && !/[td]ed$/.test(w) && !LATIN_VOWELS.includes(w[w.length - 3])) groups--;
  return Math.max(1, groups);
}

/**
 * Spanish, Italian, Portuguese: a syllable has one strong vowel (a, e, o); an
 * unstressed i or u leans on its neighbour ("cie-lo"), a written accent on i or
 * u breaks the pair ("dí-a"), and two strong vowels are two syllables ("po-e-ta").
 * Not modelled: the merging of vowels across words that these traditions count
 * in metre (synalepha). The count shown is per word, summed.
 */
function romanceSyllables(word: string, lang: string): number {
  const nfd = word.toLowerCase().normalize('NFD');
  let count = 0;
  let inGroup = false;
  let hasStrong = false;
  let nasal = false;
  let prev = '';
  let anyAccent = false;
  /** The last vowel of the open vowel group was an unaccented i or u. */
  let afterWeak = false;
  const chars = [...nfd];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (/[\u0300-\u036f]/.test(ch)) continue;
    let marks = '';
    for (let j = i + 1; j < chars.length && /[\u0300-\u036f]/.test(chars[j]); j++) marks += chars[j];
    const next = chars.slice(i + 1).find((c) => !/[\u0300-\u036f]/.test(c)) ?? '';
    const isY = ch === 'y' && next === '';
    const vowel = 'aeiou'.includes(ch) || isY;
    // The u of "que" and "gue" is only a spelling.
    const silentU = ch === 'u' && !marks && ((prev === 'q' && 'aeio'.includes(next)) || (prev === 'g' && 'ei'.includes(next)));
    if (vowel && !silentU) {
      const strong = 'aeo'.includes(ch);
      const accented = /[\u0300\u0301\u0302]/.test(marks);
      const tilde = marks.includes('\u0303');
      if (accented || tilde) anyAccent = true;
      const stressedWeak = !strong && accented;
      // Spanish and Portuguese write an accent on i or u to part it from the vowel beside it
      // ("dí-a", "pa-ís"); Italian writes one only for the stress, so "più" and "giù" stay one syllable.
      const parts = stressedWeak && !(lang === 'it' && afterWeak);
      if (!inGroup) {
        count++;
        hasStrong = strong || stressedWeak;
      } else if (nasal) {
        // Portuguese "ão", "õe": one syllable.
      } else if (parts || (strong && hasStrong)) {
        count++;
        hasStrong = true;
      } else if (strong || stressedWeak) hasStrong = true;
      inGroup = true;
      nasal = tilde;
      afterWeak = !strong && !accented;
    } else if (!silentU) {
      inGroup = false;
      nasal = false;
      afterWeak = false;
    }
    prev = ch;
  }
  // Portuguese writes an accent when "-ia" is one syllable ("história"); without one it is two ("di-a", "ale-gri-a").
  if (lang === 'pt' && !anyAccent && /(?<![qg])[iu][aeo]s?$/.test(nfd)) count++;
  return Math.max(1, count);
}

function polishSyllables(word: string): number {
  // An i before another vowel only softens the consonant ("nie-bo").
  const w = word.toLowerCase().normalize('NFC').replace(/i(?=[aąeęoóuy])/g, '');
  // No floor of one: "w" and "z" are words with no syllable of their own.
  return (w.match(/[aąeęioóuy]/g) ?? []).length;
}

function indonesianSyllables(word: string): number {
  const w = fold(word);
  const vowels = (w.match(/[aiueo]/g) ?? []).length;
  // "ai", "au", "oi" closing a word are one sound ("pan-tai"); elsewhere each vowel is a syllable ("la-ut").
  return Math.max(1, vowels - (/(ai|au|oi)$/.test(w) && vowels > 1 ? 1 : 0));
}

/**
 * Languages in which a line's syllables can be counted fairly. Thai is counted
 * only with its table loaded (a Thai syllable cannot be found by rule alone);
 * Arabic is not counted: its short vowels are not written.
 */
export function countsSyllables(lang: string): boolean {
  const b = baseLang(lang);
  if (b === 'th') return THAI_COUNTED && soundReady('th');
  return /^(en|es|it|pt|de|nl|fr|ca|ro|pl|ru|id|ko|zh|ja|vi|hi)$/.test(b);
}

/**
 * Whether Thai syllable forms are offered. Off: the table covers too little of
 * free Thai text for a fair count (the measured figure is in PHONETICS.md).
 */
const THAI_COUNTED = false;

/**
 * Syllables in a word by its language's spelling rule alone, with no table:
 * what the tables are measured against and corrected from. Null when the
 * script is not one the rule can count.
 */
export function syllablesByRule(word: string, lang = 'en'): number | null {
  const b = baseLang(lang);
  const letters = lettersOf(word);
  if (b === 'ko' && letters.length && letters.every((c) => /[가-힣]/.test(c))) return letters.length;
  if (b === 'zh' && letters.length && letters.every((c) => /\p{Script=Han}/u.test(c))) return letters.length;
  if (b === 'ja') return japaneseMorae(word);
  if (b === 'hi') {
    const n = hindiSyllablesByRule(word);
    if (n !== null) return n;
  }
  if (b === 'ru' && letters.length && letters.every((c) => /\p{Script=Cyrillic}/u.test(c))) {
    // No floor of one: "в", "к", "с" are words with no syllable of their own.
    return (word.toLowerCase().match(/[аеёиоуыэюя]/g) ?? []).length;
  }
  if (!isLatin(word)) return letters.length ? null : 0;
  if (b === 'vi') return 1;
  if (b === 'pl') return polishSyllables(word);
  if (b === 'id') return indonesianSyllables(word);
  if (b === 'es' || b === 'it' || b === 'pt') return romanceSyllables(word, b);
  if (b === 'de') return germanSyllablesByRule(word);
  const w = fold(word).replace(/œ/g, 'oe').replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (b === 'en') return englishSyllables(w);
  return Math.max(1, vowelGroups(w));
}

/**
 * Syllables in a word, or null when the script is not one we can count.
 *
 * A dictionary's count where the language has a table and the word is in it:
 * English from the CMU table (the commonest pronunciation; see syllableCounts
 * for the others); French and German as spoken; Spanish, Italian, Portuguese,
 * Indonesian and Hindi where the dictionary disagrees with the spelling rule.
 * Otherwise the rule: English gets silent-e handling; Spanish, Italian and
 * Portuguese count strong vowels; Polish, Russian and Indonesian are spelled
 * nearly as spoken, so their vowels are counted; Hindi counts the vowels that
 * are said; a Hangul block, a Chinese character and a Vietnamese word are each
 * one syllable by definition; Japanese counts sounds (morae) from the reading.
 * Other Latin-script languages get plain vowel groups.
 */
export function syllablesInWord(word: string, lang = 'en'): number | null {
  const b = baseLang(lang);
  if (b === 'en' && isLatin(word)) {
    const w = fold(word).replace(/[^a-z]/g, '');
    return w ? englishCounts(word, w)[0] : 0;
  }
  if (b === 'fr' && isLatin(word)) {
    const s = frenchSound(word);
    if (s) return s.n + (s.mute ? 1 : 0);
  }
  if (b === 'de' && isLatin(word)) {
    const s = germanSound(word);
    if (s && s.n !== null) return s.n + (s.rest ? germanSyllablesByRule(s.rest) : 0);
  }
  if (b === 'es' || b === 'it' || b === 'pt' || b === 'id' || b === 'hi') {
    const n = countOverride(b, word);
    if (n !== null) return n;
  }
  return syllablesByRule(word, lang);
}

/** Every count an English word can have: from the table, else the sum of a hyphenated word's parts, else by spelling. */
function englishCounts(word: string, w: string): number[] {
  const known = pronounce(word);
  if (known) return known.counts;
  const parts = word.split('-').filter((part) => HAS_LETTER.test(part));
  if (parts.length > 1) return [parts.reduce((n, part) => n + englishCounts(part, fold(part).replace(/[^a-z]/g, ''))[0], 0)];
  return [englishSyllables(w)];
}

/** Is this English word (or every part of a hyphenated one) in the pronunciation table? */
function englishKnown(word: string): boolean {
  if (pronounce(word)) return true;
  const parts = word.split('-').filter((part) => HAS_LETTER.test(part));
  return parts.length > 1 && parts.every((part) => !!pronounce(part));
}

/**
 * Every syllable count a word can have, the commonest first, or null when the
 * script cannot be counted. Only English words have more than one: "fire" is
 * said in two syllables or in one, "every" in three or two, and verse uses both.
 */
export function syllableCounts(word: string, lang = 'en'): number[] | null {
  const n = syllablesInWord(word, lang);
  if (n === null) return null;
  if (baseLang(lang) !== 'en' || !isLatin(word)) return [n];
  const w = fold(word).replace(/[^a-z]/g, '');
  return w ? englishCounts(word, w) : [n];
}

export interface SyllableSpan {
  /** Fewest and most syllables the line can be read with. */
  min: number;
  max: number;
  /** English words counted by spelling because the pronunciation table does not have them. */
  guessed: number;
}

/**
 * The range of syllables a line can be read with, or null when it cannot be
 * counted. Outside English the range is a single number, the line's count.
 */
export function syllableSpan(line: string, lang = 'en'): SyllableSpan | null {
  const n = syllablesInLine(line, lang);
  if (n === null) return null;
  if (baseLang(lang) !== 'en') return { min: n, max: n, guessed: 0 };
  const span = { min: 0, max: 0, guessed: 0 };
  for (const w of wordsOf(line, lang)) {
    const counts = syllableCounts(w, lang) ?? [0];
    span.min += Math.min(...counts);
    span.max += Math.max(...counts);
    if (isLatin(w) && !englishKnown(w)) span.guessed++;
  }
  return span;
}

/** A French word that ends in a mute e: "porte", "portes", and with the table "parlent"; not "été", "vie" or "moment". */
function frenchMuteE(word: string): boolean {
  const s = frenchSound(word);
  if (s) return s.mute;
  return /[^aeiouyàâäéèêëîïôöùûü]es?$/.test(word.toLowerCase().normalize('NFC')) && vowelGroups(fold(word)) > 1;
}

export function syllablesInLine(line: string, lang = 'en'): number | null {
  const b = baseLang(lang);
  if (b === 'ja') return japaneseMorae(line);
  if (b === 'th') return thaiSyllables(line);
  if (b === 'zh') {
    const letters = lettersOf(line);
    return letters.every((c) => /\p{Script=Han}/u.test(c)) ? letters.length : null;
  }
  const words = wordsOf(line, lang);
  let total = 0;
  for (let i = 0; i < words.length; i++) {
    const n = syllablesInWord(words[i], lang);
    if (n === null) return null;
    total += n;
    // French, as its verse counts: a mute e is silent at the end of the line and
    // before a vowel, and sounded elsewhere. Not modelled: diaeresis ("li-on").
    if (b === 'fr' && frenchMuteE(words[i])) {
      const next = words[i + 1];
      if (next === undefined || (/e$/i.test(words[i]) && /^[aeiouyhàâäéèêëîïôöùûüœ]/.test(next))) total--;
    }
  }
  return total;
}

// --- What a verse is made of ---

/**
 * English words that carry grammar rather than meaning. Landing one of these is
 * not a feat: they do not alliterate, do not echo a famous line, and are not
 * "variety". Other languages have no list here; their rules count every word.
 */
export const STOP_WORDS = new Set(
  (
    'a an the and or but nor so yet for of to in on at by with from into upon onto over under up down out off as ' +
    'is am are was were be been being have has had having do does did done will would shall should can could may might must ' +
    'not no none this that these those there here where when what which who whom whose why how ' +
    'i me my mine we us our ours you your yours he him his she her hers it its they them their theirs thou thee thy thine ye ' +
    'all any both each every few more most much many some such only own same than then too very just also even ever again once ' +
    'if because while though although about above after before against between through during until unless cannot ' +
    "hath doth art dost hast wilt shalt lord what's that's there's it's i'm i'll don't can't won't tis twas " +
    'come comes came go goes went get gets got make makes made take takes took like look looks thing things'
  ).split(' '),
);

/** Is this one of the little words of the language? Only English has a list. */
export function isStopWord(word: string, lang = 'en'): boolean {
  return baseLang(lang) === 'en' && STOP_WORDS.has(fold(word));
}

/**
 * The units a verse is compared by: its words, or its characters where lines
 * are counted in characters (Chinese, Japanese), folded so case, accents and
 * the two kana spellings do not matter.
 */
function unitsOf(line: string, lang: string): string[] {
  if (rulesFor(lang).unit === 'char') return lettersOf(hiragana(fold(line)));
  return wordParts(line, lang).map(fold);
}

/** A single letter of an alphabet standing as a word: "a", "I", "O", but also the "w", "i", "t" of a fake acrostic. */
function loneLetter(unit: string, lang: string): boolean {
  return rulesFor(lang).unit !== 'char' && letterCount(unit) === 1 && /^[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Greek}]/u.test(unit);
}

// --- Is it a word? ---
//
// The substance floor and the rule judge count words, not strings, so they ask the
// language's own lexicon, where the engine has one loaded for the duel's language: for
// English the CMU table (./pronounce) less what a dictionary of words does not list (its
// names, abbreviations and fragments, marked from SCOWL when the table is built:
// Pronunciation.unlisted), the readings of Chinese characters (Unihan and CC-CEDICT,
// ./sound), and kuromoji's dictionary for Japanese, where a word in katakana counts when a word of
// the dictionary's written otherwise stands beside it, whether the dictionary has the katakana word
// or not (the script loanwords are written in, which a dictionary cannot keep up with: スマホの,
// インフルエンサーは), and not among other katakana ("ヤラナ セスルリ", the second check's probe).
// In English a word the table lacks counts toward the floor inside a phrase (PHRASE_SPAN).
// Nothing extra is fetched: these are the data the duel's rhyme and syllable rules already loaded. The other tables are not
// lexicons: Spanish, Italian, Portuguese, Hindi and Indonesian list only the words their
// spelling rule gets wrong, and the French, German and Russian tables, measured against the
// published verse of the phonetics corpora (review.test.ts), lack too many inflected and old
// forms: a couplet of Pushkin's had a third of its words in the Russian table, one of Busch's
// half of them in the German. There every word counts, as before. Names from the cards and
// the game's own words (each pack's acrostic and power words) always count.

/** Languages whose sound data is a lexicon: a word it lacks is, as far as the engine knows, not a word. */
const LEXICON_LANGS = new Set(['en', 'zh', 'ja']);

let cardNames: Set<string> | null = null;
const packWords = new Map<string, Set<string>>();

/** Words that count whatever the lexicon says: the parts of every card's name, and the language's acrostic and power words. */
function gameWords(lang: string): Set<string> {
  cardNames ??= new Set(CARD_CATALOG.flatMap((c) => wordParts(c.name, 'en').map(fold)));
  const b = baseLang(lang);
  let words = packWords.get(b);
  if (!words) {
    words = new Set(cardNames);
    try {
      const pack = getPack(b);
      for (const w of [...pack.acrostic, ...Object.values(pack.relics).flat()]) for (const part of wordParts(w, b)) words.add(fold(part));
      packWords.set(b, words);
    } catch {
      // The pack is not loaded yet: card names alone, and ask again next time.
    }
  }
  return words;
}

/**
 * Is this a word of the language, as far as the engine's data can say? True or false where
 * the duel's language has a lexicon loaded (see above); null where it has none, and then
 * every word counts. A hyphenated word is a word when each part is.
 */
export function lexiconHas(word: string, lang = 'en'): boolean | null {
  const b = baseLang(lang);
  // Chinese and Japanese are measured in characters (knownUnits); only English has a word list here.
  if (b !== 'en' || !pronunciationLoaded()) return null;
  const w = fold(word);
  if (gameWords(b).has(w)) return true;
  const parts = w.split('-').filter((part) => HAS_LETTER.test(part));
  if (parts.length > 1) return parts.every((part) => lexiconHas(part, b) === true);
  // An abbreviation the dictionary only spells out ("cd", "tv") is not a word, nor a string of two or
  // three letters that a dictionary of words does not list: an abbreviation said as a word or a
  // fragment ("dr", "oz", "ul"). Longer strings the table has are words though SCOWL lacks them:
  // names (Toussaint, Haiti, Antonio), the stage's old forms, words newer than its lists.
  const p = pronounce(w);
  return !!p && !p.spelled && (!p.unlisted || wordSpan(w) >= UNLISTED_SPAN);
}

/**
 * Letters a string of the English table needs to count as a word when SCOWL does not list it
 * (lexiconHas). Below it the unlisted strings are abbreviations and fragments (of the table's 147
 * strings of two letters SCOWL lists 37); from it, names and old or new words (the second check's
 * lists: Toussaint, Christophe, Haiti, Antonio, Regan). Measured in review.test.ts.
 */
export const UNLISTED_SPAN = 4;

/**
 * Letters a word the lexicon lacks needs to count toward the substance floor inside a phrase (a
 * line that holds one of the language's little words): the vernacular, the stage's English, the
 * ad-libs of a rap and names no word list keeps up with ("Shawty, I'm finna flex", "Sirrah, thou
 * varlet", "Skrrt skrrt, brrr, the bass go boom", "Mwangi, Njeri, Wanjiru and Kamau"), used as words
 * in a sentence. It still tells nothing (isTellingWord asks the lexicon). Such a word must be one
 * that can be said (sayable): keyboard mash between "the" and one real word ("The qwrt sdfg zxcv
 * night", the third check's probe) is not a phrase of the language, and letter pairs, with no little
 * word between them, stay what they are.
 */
export const PHRASE_SPAN = 4;

/** The vowel letters of English spelling, y among them ("rhythm", "Thuy"). */
const VOWEL_LETTER = /[aeiouy]/;
/**
 * A word without a vowel letter that is said as one held sound, the way ad-libs and hushes are
 * written: an m, r, s or z written two or more times, after at most a b, g, h, k, p or t or one of
 * sk, ps, ts, bz and mh, and before at most a closing k or t ("brrr", "grrr", "skrrt", "pssst",
 * "tsss", "bzzzt", "zzzz", "hmmm", "mhmm"); or "pfft" and "shhh" (an f or an h held). Keyboard mash
 * ("qwrt", "sdfg", "zxcv", "hjkl") holds no sound; of the 160,000 strings of four consonants 107 have
 * this shape. A wider first version (f, h, l, n and v held after any consonant, h closing) let one
 * such string in about three hundred count, and the checker's MASH earned full form in 17 rounds of
 * 280 (review3.test.ts).
 */
const HELD_SOUND = /^(?:(?:[bghkpt]|sk|ps|ts|bz|mh)?([mrsz])\1+[kt]?|p?ff+t?|shh+t?)$/;

/**
 * Can this string the lexicon lacks be said as a word? A string with a vowel letter is spelled as
 * the pronunciation table's words and names spell (every run of three of its letters, its start and
 * end marked, found in one of them: pronounce.ts spellingTrigrams), as written or with a letter a
 * player drew out said once ("ayyy", "brrrap", "yuhh"); a string without one is a held sound
 * (HELD_SOUND). "finna", "shawty", "varlet", "Mwangi", "Tlaloc", "skrrt" and "pssst" can; "qwrt",
 * "sdfg", "asdf" and "zxcv" cannot. Apostrophes are left out ("trippin'", "y'all").
 */
export function sayable(word: string): boolean {
  const t = spellingTrigrams();
  if (!t) return true;
  const w = fold(word).replace(/[^a-z]/g, '');
  if (!VOWEL_LETTER.test(w)) return HELD_SOUND.test(w);
  for (const v of new Set([w, w.replace(/(.)\1{2,}/g, '$1$1'), w.replace(/(.)\1+/g, '$1')])) {
    const s = `^${v}$`;
    let ok = s.length >= 3;
    for (let i = 0; ok && i + 3 <= s.length; i++) ok = t.has(s.slice(i, i + 3));
    if (ok) return true;
  }
  return false;
}

/**
 * For each unit of a line (unitsOf), whether it is a word of the language: null where the
 * language has no lexicon loaded. Chinese and Japanese are measured in characters: a
 * character counts when the reading tables know it (Chinese) or when the dictionary
 * recognises the word it is part of (Japanese). `japaneseVerse`: in Japanese, whether the verse
 * the line belongs to is read as Japanese (japaneseLine on one of its lines at least).
 */
function knownUnits(line: string, lang: string, japaneseVerse = false): boolean[] | null {
  const b = baseLang(lang);
  const units = unitsOf(line, lang).filter((u) => letterCount(u) > 0);
  if (b === 'zh') {
    if (!soundReady('zh')) return null;
    return units.map((ch) => !/\p{Script=Han}/u.test(ch) || soundOf('zh', ch) !== undefined || gameWords(b).has(ch));
  }
  if (b === 'ja') {
    const words = japaneseWords(line);
    if (!words) return null;
    const flags: boolean[] = [];
    // A word in katakana is a loanword or a name when the sentence uses it as one: a word of the
    // dictionary's written otherwise (a particle, an auxiliary, a verb, a noun in kanji) stands beside
    // it (スマホの, インフルエンサーは, ガチで, …のフロー), whether the dictionary has the katakana word
    // or not; or the dictionary has it and it is the whole line (サクラ). In a verse read as Japanese
    // (japaneseVerse), the dictionary's words of two characters or more in a run of katakana are
    // loanwords when the run holds two of them or more, or is one of them: a line of them alone
    // (サッカーボール, ジェットコースター, ヒップホップ ドリーム) or a compound inside a sentence
    // (コーヒーカップに); the rest of such a run counts only as the other rules let it (in
    // マイクチェック ワンツー, ワンツー, which the dictionary lacks). Elsewhere a run of katakana among
    // other katakana is letters, not words, even where the dictionary finds one of its nouns inside
    // (ココア, テツ): a verse of katakana alone is not read as Japanese, and one noun found by chance
    // in random katakana is not a run of loanwords.
    const anchor = (w: (typeof words)[number] | undefined) => !!w && w.known && !KATAKANA_ONLY.test(w.surface);
    const loanword = (w: (typeof words)[number]) => w.known && [...w.surface].length >= 2;
    const inLoanRun = new Array<boolean>(words.length).fill(false);
    if (japaneseVerse) {
      for (let i = 0; i < words.length; ) {
        if (!KATAKANA_ONLY.test(words[i].surface)) {
          i++;
          continue;
        }
        let j = i;
        while (j < words.length && KATAKANA_ONLY.test(words[j].surface)) j++;
        const found = words.slice(i, j).filter(loanword).length;
        if (found >= 2 || (found === 1 && j - i === 1)) for (let k = i; k < j; k++) inLoanRun[k] = loanword(words[k]);
        i = j;
      }
    }
    words.forEach((w, i) => {
      const word = KATAKANA_ONLY.test(w.surface) ? anchor(words[i - 1]) || anchor(words[i + 1]) || (w.known && words.length === 1) || inLoanRun[i] : w.known;
      flags.push(...lettersOf(hiragana(fold(w.surface))).map(() => word));
    });
    return flags.length === units.length ? flags : null;
  }
  if (!LEXICON_LANGS.has(b)) return null;
  // A phrase: the line holds a little word, or it is a roll call, every word of it written with a
  // capital as names are ("Nkechi, Ngozi, Chiamaka, Oluwaseun"). Either way its words must be sayable;
  // a little word is no harder to put in than a capital, so the second costs the floor nothing.
  // The words as written (wordParts lowers their case), hyphenated ones in their parts.
  const parts = (line.match(WORD_RE) ?? []).flatMap((w) => w.split('-')).filter((w) => letterCount(fold(w)) > 0);
  const phrase = units.some((u) => isStopWord(u, b)) || (parts.length > 0 && parts.every(writtenAsName));
  const flags = units.map((u) => {
    const has = lexiconHas(u, b);
    return has === false && phrase && wordSpan(u) >= PHRASE_SPAN && sayable(u) ? true : has;
  });
  return flags.some((f) => f === null) ? null : (flags as boolean[]);
}

/** Does the word open with a capital letter, as a name is written? (Its first alphabetic character is uppercase.) */
function writtenAsName(word: string): boolean {
  const first = [...word].find((c) => /\p{Alphabetic}/u.test(c));
  return !!first && /\p{Uppercase}/u.test(first);
}

/** A word written in katakana alone (long-vowel marks included): the script of loanwords and names. */
const KATAKANA_ONLY = /^[ァ-ヺー]+$/u;
/** Is this line read as Japanese: does the dictionary find a word in it not written in katakana? */
function japaneseLine(line: string): boolean {
  return !!japaneseWords(line)?.some((w) => w.known && !KATAKANA_ONLY.test(w.surface));
}

/** Chinese particles that make a word a modifier or mark its aspect: "我的" is "my", "不过" is "but". */
const ZH_PARTICLE_END = /[的地得了着过]$/u;

/**
 * A word that carries meaning, for the copy measure and the substance a multiplier
 * multiplies: one that is not among the language's little words (English: STOP_WORDS;
 * the others: ./function-words, from stopwords-iso). A Japanese word in kana alone must be
 * two characters or more (the particles are one); a letter alone is not a content word in
 * an alphabet; Chinese words must be two characters or
 * more and not end in a structural or aspect particle. A language whose list is not loaded falls back to the length a content
 * word needs in it (lang.ts `content`).
 */
export function isContentWord(word: string, lang = 'en'): boolean {
  if (!HAS_LETTER.test(word)) return false;
  const b = baseLang(lang);
  // A letter alone is a letter ("w", "t"), not a word that means something; "I" and "a" are little words anyway.
  if (!UNSPACED.has(b) && rulesFor(b).unit === 'word' && letterCount(word) < 2) return false;
  if (b === 'en') return !STOP_WORDS.has(fold(word));
  // The language's little words (./function-words), compared as written and, outside
  // Vietnamese (whose accents tell words apart), also without accents, as players type them.
  const list = functionWords(b);
  if (list && (list.has(functionKey(word)) || (b !== 'vi' && list.has(fold(word))))) return false;
  if (b === 'ja') return /[\p{Script=Han}\p{Script=Katakana}]/u.test(word) ? !/^[ー]+$/.test(word) : [...word].length >= 2;
  if (b === 'zh') return [...word].length >= 2 && !ZH_PARTICLE_END.test(word);
  return list ? true : wordSpan(word) >= rulesFor(lang).content;
}

/**
 * A word that tells: one that carries meaning (isContentWord) and is a word of the language where
 * it has a lexicon (lexiconHas). In English it must also be long enough to tell (lang.ts `content`,
 * four letters, as the devices count a strong word), or SHORT_TELLING letters inside a phrase
 * (`inPhrase`: its line holds a little word), because the English list of little words is short and
 * made by hand: "the", "ab" and "ed" never tell, "pig" tells in "the pig is fat" and not in "gum bet
 * pig"; "rise", "night" and "Romeo" always do.
 * The other languages' lists (stopwords-iso) are long enough to say alone what does not tell; a
 * length rule there would take honest words ("मंच", stage, is two letters and two marks).
 */
export function isTellingWord(word: string, lang = 'en', inPhrase = false): boolean {
  if (!isContentWord(word, lang) || lexiconHas(word, lang) === false) return false;
  if (baseLang(lang) !== 'en') return true;
  const span = wordSpan(word);
  return span >= rulesFor(lang).content || (inPhrase && span >= SHORT_TELLING);
}

/**
 * Letters an English word needs to tell inside a phrase (isTellingWord): "cat", "sad", "God" and
 * "son" say something in "My cat is fat" or "I am a son"; strung together with nothing to join them
 * ("gum bet pig", "sun lad vat") they are a list of tokens. A phrase is a line that holds one of the
 * language's little words (STOP_WORDS). Two letters never tell ("ox", "ah", "ab"). Measured in
 * review.test.ts (finding 25 and the second check's short-word verses).
 */
export const SHORT_TELLING = 3;

/** The engine's words of a line: its word parts, or where words run together the best segmentation (segmentedWords). */
function readWords(line: string, lang: string): string[] {
  return UNSPACED.has(baseLang(lang)) ? segmentedWords(line, lang) : wordParts(line, lang);
}

/** The different telling words of a text (isTellingWord, each line read as a phrase when it holds a little word), folded. */
export function tellingWords(text: string, lang = 'en'): Set<string> {
  const out = new Set<string>();
  for (const line of linesOf(text)) {
    const ws = readWords(line, lang);
    const phrase = ws.some((w) => isStopWord(w, lang));
    for (const w of ws) if (isTellingWord(w, lang, phrase)) out.add(fold(w));
  }
  return out;
}

export interface Substance {
  ok: boolean;
  /** Different words (or characters) found that are words of the language, and how many the verse needs. */
  distinct: number;
  needed: number;
  /** Share of the verse's words (or characters) that are words of its language: 1 where it has no lexicon. */
  known: number;
  /** Different telling words (isTellingWord): what the verse says, as against how it is laid out. */
  telling: number;
}

/** Fewest different words anything that calls itself a verse can have. */
export const MIN_DISTINCT_WORDS = 3;

/**
 * Below this share of real words a verse is tokens, not verse, and is void. Set from
 * measurement (findings.test.ts "substance"): every honest verse of the banks, the packs and
 * the test fixtures is at or above FULL_KNOWN_SHARE; random letter pairs, keyboard mash and
 * two-letter tokens fall below this.
 */
export const MIN_KNOWN_SHARE = 0.6;
/** At and above this share of real words a verse keeps its full form points; between the two they scale down. */
export const FULL_KNOWN_SHARE = 0.7;
/**
 * Different telling words (isTellingWord) a verse needs per line before it keeps its full form
 * points (forms.ts scoreForm), where lines are counted in words: below, they scale down with them.
 * A form is laid out by anything ("ab ed ma ti", "oh ha lo", a chant of one word); what the lines
 * say is the verse. Set from measurement (review.test.ts, finding 25): the honest verse closest to
 * it is "I rise / I rise again / I rise again and louder", two telling words in three lines. Where
 * lines are counted in characters (Chinese, Japanese) the segmenter cuts classical verse into
 * single characters, which tell nothing on their own, so there only the lexicon's share counts.
 */
export const TELLING_PER_LINE = 0.5;

/**
 * Is this a verse, or tokens arranged to satisfy a checker? The floor every
 * form, device and judge shares, counting only words of the language (see
 * lexiconHas: where the language has no lexicon, every word):
 *   - every line holds at least one word, and
 *   - the verse has at least as many different words as it has lines, and never
 *     fewer than MIN_DISTINCT_WORDS. Lone letters, however many different ones,
 *     count as one word between them: "I" and "a" are words, but an alphabet is
 *     not a vocabulary;
 *   - more than half of its lines are different lines: a line said again (same
 *     words, whatever the case and punctuation) counts once. A refrain may come
 *     back; a verse that is one line said over and over is one line;
 *   - at least MIN_KNOWN_SHARE of what it is made of are words.
 * "Never / Never / Never", "a / a a / a a a", "w / i / t", "wa / ib / tc",
 * "ab cd ga / ef gh ha" and "Never the night falls" said three times fail it; the
 * shortest honest verses ("I rise / I rise again / I rise again and louder", an
 * acrostic of one word to a line, a quatrain whose first line returns as its
 * third) keep it. Where lines are counted in characters, "words" here are characters.
 */
export function substance(verse: string, lang = 'en'): Substance {
  const ls = linesOf(verse);
  const perLine = ls.map((l) => unitsOf(l, lang).filter((u) => letterCount(u) > 0));
  // A verse is read as Japanese when one of its lines holds a word the dictionary has that is not
  // written in katakana; then its lines of loanwords count (knownUnits). One line, not half of them:
  // a haiku of two loanword lines and one line of Japanese (ニューヨーク / ブルックリン ブリッジ / 雨の朝)
  // is as Japanese as one of two, and random katakana is kept out by the run rule, not by this.
  const japaneseVerse = baseLang(lang) === 'ja' && ls.some(japaneseLine);
  const flags = ls.map((l, i) => knownUnits(l, lang, japaneseVerse) ?? perLine[i].map(() => true));
  const real = perLine.flatMap((units, i) => units.filter((_, k) => flags[i][k]));
  const all = perLine.flat();
  const distinct = new Set(real.filter((u) => !loneLetter(u, lang))).size + (real.some((u) => loneLetter(u, lang)) ? 1 : 0);
  const needed = Math.max(ls.length, MIN_DISTINCT_WORDS);
  const differentLines = new Set(perLine.map((units) => units.join(' '))).size;
  const known = all.length ? real.length / all.length : 0;
  const ok =
    ls.length > 0 && flags.every((f) => f.some(Boolean)) && distinct >= needed && differentLines * 2 > ls.length && known >= MIN_KNOWN_SHARE;
  return { ok, distinct, needed, known, telling: tellingWords(verse, lang).size };
}

/**
 * Distinct telling words of the verse (isTellingWord) that are not among `used`: what the verse
 * says beyond the words that land its device and signature. duel.ts scales a multiplier by it,
 * so a verse that is only its device, or tokens too short to say anything, cannot multiply itself.
 */
export function ownContent(verse: string, lang: string, used: Iterable<string>): number {
  const taken = new Set([...used].flatMap((u) => [fold(u), ...fold(u).split(' ')]));
  let n = 0;
  for (const w of tellingWords(verse, lang)) if (!taken.has(w)) n++;
  return n;
}

// --- Copying ---

/**
 * The words of a line, in order, for the copy measure: its content words (or, with `all`,
 * every word), folded. Where words are written without spaces (Chinese, Japanese, Thai) a
 * line is read in the words of the verse it is compared with first (`known`: the longest of
 * them that starts at each point), and the rest by the engine's segmentation: a segmenter
 * cuts a line differently once two of its words have changed places, and a copy must not
 * escape by that.
 */
function copyWords(line: string, lang: string, known: Set<string>, all = false): string[] {
  const keep = (w: string) => HAS_LETTER.test(w) && (all || isContentWord(w, lang));
  if (!UNSPACED.has(baseLang(lang))) return wordParts(line, lang).filter(keep).map(fold);
  if (!known.size) return segmentedWords(line, lang).filter(keep).map(fold);
  const cs = [...line];
  const out: string[] = [];
  let rest = '';
  const flush = () => {
    if (rest) out.push(...segmentedWords(rest, lang));
    rest = '';
  };
  for (let i = 0; i < cs.length; ) {
    let hit = '';
    for (let n = Math.min(8, cs.length - i); n >= 2 && !hit; n--) if (known.has(cs.slice(i, i + n).join(''))) hit = cs.slice(i, i + n).join('');
    if (hit) {
      flush();
      out.push(hit);
      i += [...hit].length;
    } else rest += cs[i++];
  }
  flush();
  return out.filter(keep).map(fold);
}

/**
 * English endings a copy can change without making a word its own: the plural and the
 * third person ("hears"), the past ("turned"), "-ing", the stage's "-eth" and "-est", the
 * possessive, and the "e" or doubled consonant they leave ("hoped", "stopped").
 */
function englishStem(w: string): string {
  // Endings come off one at a time until none is left ("limpings", "limping", "limp").
  let s = w.replace(/'s$/, '');
  for (let pass = 0; pass < 3; pass++) {
    const before = s;
    if (s.length > 5 && /ies$/.test(s)) s = `${s.slice(0, -3)}y`;
    else if (s.length > 5 && /(?:eth|est)$/.test(s)) s = s.slice(0, -3);
    else if (s.length > 5 && /ing$/.test(s)) s = s.slice(0, -3);
    else if (s.length > 4 && /ed$/.test(s)) s = s.slice(0, -2);
    else if (s.length > 4 && /(?:ss|x|z|ch|sh)es$/.test(s)) s = s.slice(0, -2);
    else if (s.length > 3 && /[^su]s$/.test(s)) s = s.slice(0, -1);
    if (s === before) break;
  }
  if (/([^aeiouls])\1$/.test(s)) s = s.slice(0, -1);
  return s.length > 3 ? s.replace(/e$/, '') : s;
}

/**
 * Do two folded words of a copy measure count as the same word? The same spelling; in English
 * the same stem (englishStem); in the other languages written with spaces, the same word with
 * another ending: both of five letters or more, alike but for the last two letters of the
 * shorter or less ("noche" and "noches", "dorado" and "dorada", "Nacht" and "Nächte").
 */
function sameWordFor(lang: string): (a: string, b: string) => boolean {
  const b0 = baseLang(lang);
  if (UNSPACED.has(b0) || rulesFor(b0).unit === 'char') return (a, b) => a === b;
  if (b0 === 'en') {
    const stems = new Map<string, string>();
    const st = (w: string) => {
      let v = stems.get(w);
      if (v === undefined) stems.set(w, (v = englishStem(w)));
      return v;
    };
    return (a, b) => a === b || st(a) === st(b);
  }
  return (a, b) => {
    if (a === b) return true;
    const x = [...a];
    const y = [...b];
    const n = Math.min(x.length, y.length);
    if (n < 5 || Math.abs(x.length - y.length) > 3) return false;
    let k = 0;
    while (k < n && x[k] === y[k]) k++;
    return k >= n - 2;
  };
}

/**
 * The longest common subsequence of `a` in `b`, where two neighbours of `a` swapped
 * ("night dark" for "dark night") still match both: which items of `a` it takes, and which
 * items of `b` they are. Items of `b` already in `used` are not available. `eq` says which
 * items are the same word (sameWordFor).
 */
function takenInOrder(a: string[], b0: string[], used: boolean[], eq: (x: string, y: string) => boolean): { taken: boolean[]; at: number[] } {
  // The source without what earlier lines took, remembering where each item came from.
  const at0 = b0.map((_, j) => j).filter((j) => !used[j]);
  const b = at0.map((j) => b0[j]);
  const n = a.length;
  const m = b.length;
  const E = a.map((x) => b.map((y) => eq(x, y)));
  const swap = (i: number, j: number) => i > 1 && j > 1 && E[i - 1][j - 2] && E[i - 2][j - 1] && a[i - 1] !== a[i - 2];
  const L: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      let v = Math.max(L[i - 1][j], L[i][j - 1]);
      if (E[i - 1][j - 1]) v = Math.max(v, L[i - 1][j - 1] + 1);
      if (swap(i, j)) v = Math.max(v, L[i - 2][j - 2] + 2);
      L[i][j] = v;
    }
  }
  const taken = new Array<boolean>(n).fill(false);
  const at: number[] = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (E[i - 1][j - 1] && L[i][j] === L[i - 1][j - 1] + 1) {
      taken[i - 1] = true;
      at.push(at0[j - 1]);
      i--;
      j--;
    } else if (swap(i, j) && L[i][j] === L[i - 2][j - 2] + 2) {
      taken[i - 1] = taken[i - 2] = true;
      at.push(at0[j - 1], at0[j - 2]);
      i -= 2;
      j -= 2;
    } else if (L[i - 1][j] >= L[i][j - 1]) i--;
    else j--;
  }
  return { taken, at };
}

export interface CopyMeasure {
  /** Content words of the verse that follow the source's in its order (counted per line, against the whole source). */
  taken: number;
  /** Different content words of the verse's own: words the source does not have, each counted once however often said. */
  own: number;
  /** taken / (taken + own): 0 when the verse takes nothing, 1 when it adds nothing. */
  share: number;
  /** Content words of the source. */
  source: number;
  /** taken / source: how much of the source the verse carries, in its order; 1 when all of it, whatever was added. */
  coverage: number;
  /**
   * Content words of the source the verse says in any order (each at most as often as the source
   * does), as a share of them; in Chinese, the share of their characters the verse holds.
   */
  anyOrder: number;
  /**
   * For each line of the source with two content words or more: the largest share of them that
   * one line of the verse says (in any order). A copy carries the source's lines over, each
   * into a line of its own, however much it adds around them; an answer throws words back
   * from one line or two.
   */
  lines: number[];
  /** Words each line of the verse takes in order (taken, line by line). */
  perLine: number[];
  /**
   * Lines of the verse that end on the word the source's line in the same place ends on. Kept as a
   * measure; isCopy no longer reads it (moving the lines set it to 0, and it voided flips): `carry`.
   */
  ends: number;
  /**
   * Each line of the source, every word counted (the little ones too), against the line of the
   * verse that says most of it in its order, one line of the verse to a line of the source
   * whatever order the verse puts its lines in: the source line's words (`source`), how many of
   * them that verse line says in order (`said`), that verse line's words (`verse`), whether it
   * says the source line's last word (`end`: the word a rhyme stands on), and which line of the
   * verse it is (`line`, an index into linesOf(verse); -1 when no line says any of it). A copy
   * carries each line over into a line of its own, rhyme and all, with a word dropped and a few
   * put in; an answer throws words back into one line or two, and its little words seldom fall in
   * the other's order.
   */
  carry: Array<{ source: number; said: number; verse: number; end: boolean; line: number }>;
  /** Lines of the verse (linesOf), to tell a verse that adds lines of its own from one that has only the source's. */
  verseLines: number;
}

/**
 * The words of a line by the engine's best segmentation: for Japanese the dictionary's
 * (kuromoji, the same on every device) when it is loaded, otherwise wordsOf.
 */
export function segmentedWords(line: string, lang = 'en'): string[] {
  if (baseLang(lang) === 'ja') {
    const ws = japaneseWords(line);
    if (ws) return ws.map((w) => w.surface.toLowerCase()).filter((w) => HAS_LETTER.test(w));
  }
  return wordsOf(line, lang);
}

/**
 * How much of `verse` is taken from `source`, seen from both sides: its content words
 * (isContentWord) that follow the source's content words in order, as a share of the verse's
 * own content words (`share`) and of the source's (`coverage`).
 *
 * Each line of the verse is matched against the whole source, its lines run together, so
 * a copy is found however its lines are reordered or re-broken; each word of the source
 * can be taken once; two neighbours swapped still match; a dropped word only leaves the
 * rest matched; case, accents and punctuation are folded away, a changed ending does not
 * make a word new (sameWordFor), and the little words are not counted at all. A word of the
 * verse's own counts once however often it is said, so a filler put between every two copied
 * words adds one word, not half the verse; and words added to every line of a copy leave its
 * coverage whole. Words of the source said out of its order count on neither side of `share`,
 * and in `anyOrder`. Where words are written without spaces (Chinese, Japanese, Thai) the
 * words are the engine's segmentation (wordsOf), the verse read in the source's words
 * (copyWords). With `all: true` every word counts, the little ones too: for a verse that
 * keeps too few content words to tell (duel.ts isCopy).
 */
export function copyOf(verse: string, source: string, lang = 'en', opts: { all?: boolean } = {}): CopyMeasure {
  const all = opts.all ?? false;
  const known = new Set(UNSPACED.has(baseLang(lang)) ? linesOf(source).flatMap((l) => segmentedWords(l, lang)).filter((w) => [...w].length >= 2) : []);
  const mine = linesOf(verse).map((l) => copyWords(l, lang, known, all)).filter((ws) => ws.length > 0);
  const theirs = linesOf(source).flatMap((l) => copyWords(l, lang, new Set(), all));
  const eq = sameWordFor(lang);
  const carry = lineCarry(verse, source, lang, known, eq);
  const verseLines = linesOf(verse).length;
  if (!mine.length || !theirs.length) return { taken: 0, own: 0, share: 0, source: theirs.length, coverage: 0, anyOrder: 0, lines: [], perLine: [], ends: 0, carry, verseLines };
  const inSource = (w: string) => theirs.some((t) => eq(w, t));
  // Each word of the source is taken once: a verse that says the opponent's "stage" in every line took one word.
  const used = new Array<boolean>(theirs.length).fill(false);
  let taken = 0;
  const own = new Set<string>();
  const perLine: number[] = [];
  for (const line of mine) {
    const t = takenInOrder(line, theirs, used, eq);
    for (const j of t.at) used[j] = true;
    perLine.push(t.at.length);
    line.forEach((w, k) => {
      if (t.taken[k]) taken++;
      else if (!inSource(w)) own.add(w);
    });
  }
  // In any order: each word of the source is matched by one word of the verse at most. In Chinese,
  // by its characters: shuffled and filled out, a line is cut into other words, and a character is
  // a word or the root of one. (Not in Japanese or Thai, whose kana and letters spell sounds: two
  // honest verses of those share most of them, measured.)
  let said = 0;
  if (baseLang(lang) === 'zh') {
    const pool = new Map<string, number>();
    for (const ch of mine.flat().join('')) pool.set(ch, (pool.get(ch) ?? 0) + 1);
    const chars = [...theirs.join('')];
    let hit = 0;
    for (const ch of chars) {
      const n = pool.get(ch) ?? 0;
      if (n > 0) {
        pool.set(ch, n - 1);
        hit++;
      }
    }
    said = chars.length ? (hit / chars.length) * theirs.length : 0;
  } else {
    const free = new Array<boolean>(theirs.length).fill(true);
    for (const w of mine.flat()) {
      const j = theirs.findIndex((t, k) => free[k] && eq(w, t));
      if (j >= 0) {
        free[j] = false;
        said++;
      }
    }
  }
  // Line by line: how much of each line of the source one line of the verse says.
  const said1 = (src: string[], line: string[]) => {
    const open = new Array<boolean>(line.length).fill(true);
    let n = 0;
    for (const w of src) {
      const k = line.findIndex((x, i) => open[i] && eq(x, w));
      if (k >= 0) {
        open[k] = false;
        n++;
      }
    }
    return n / src.length;
  };
  const sourceLines = linesOf(source).map((l) => copyWords(l, lang, new Set(), all));
  const lines = sourceLines.filter((ws) => ws.length >= 2).map((ws) => Math.max(...mine.map((line) => said1(ws, line))));
  // Line ends: a copy keeps the other verse's rhymes, line for line; an answer seldom ends its
  // lines on the other's in the same places. A line's end is its last word; in Chinese and
  // Japanese, a line that ends on a Han character ends on that character, however the words
  // around it are cut.
  const b = baseLang(lang);
  const lineEnd = (l: string, k: Set<string>) => {
    if (b === 'zh' || b === 'ja') {
      const ch = lettersOf(l).at(-1);
      if (ch && /\p{Script=Han}/u.test(ch)) return ch;
    }
    return copyWords(l, lang, k, true).at(-1);
  };
  const theirEnds = linesOf(source).map((l) => lineEnd(l, new Set()));
  let ends = 0;
  linesOf(verse).forEach((l, i) => {
    const w = lineEnd(l, known);
    const e = theirEnds[i];
    if (w && e && eq(w, e)) ends++;
  });
  return {
    taken,
    own: own.size,
    share: taken + own.size ? taken / (taken + own.size) : 0,
    source: theirs.length,
    coverage: taken / theirs.length,
    anyOrder: said / theirs.length,
    lines,
    perLine,
    ends,
    carry,
    verseLines,
  };
}

/**
 * CopyMeasure.carry: every line of `source`, all its words, matched one to one with the lines of
 * `verse` that say most of each in order (the longest common subsequence, two neighbours swapped
 * still matching both: takenInOrder), the largest first and, among equals, the earlier lines first,
 * so the result does not depend on how the verse orders its lines.
 */
function lineCarry(verse: string, source: string, lang: string, known: Set<string>, eq: (a: string, b: string) => boolean): CopyMeasure['carry'] {
  const theirs = linesOf(source).map((l) => copyWords(l, lang, new Set(), true));
  const mine = linesOf(verse)
    .map((l, at) => ({ at, ws: copyWords(l, lang, known, true) }))
    .filter((m) => m.ws.length > 0);
  const pairs: Array<[number, number, number]> = [];
  theirs.forEach((s, i) =>
    mine.forEach((v, j) => {
      const said = takenInOrder(v.ws, s, new Array<boolean>(s.length).fill(false), eq).at.length;
      if (said > 0) pairs.push([said, i, j]);
    }),
  );
  pairs.sort((x, y) => y[0] - x[0] || x[1] - y[1] || x[2] - y[2]);
  const out = theirs.map((s) => ({ source: s.length, said: 0, verse: 0, end: false, line: -1 }));
  const taken = new Set<number>();
  for (const [said, i, j] of pairs) {
    if (out[i].said || taken.has(j)) continue;
    const last = theirs[i].at(-1)!;
    out[i] = { source: theirs[i].length, said, verse: mine[j].ws.length, end: mine[j].ws.some((w) => eq(w, last)), line: mine[j].at };
    taken.add(j);
  }
  return out;
}

/** copyOf(verse, source, lang).share: how much of `verse` is taken from `source`, from 0 to 1. */
export function similarity(verse: string, source: string, lang = 'en'): number {
  return copyOf(verse, source, lang).share;
}

// --- Words as a curse reads them ---

/** Digits and signs that stand in for a Latin letter inside a word ("r0se", "ro$e"). */
const STAND_INS: Record<string, string> = { '0': 'o', '1': 'l', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', $: 's', '@': 'a', '€': 'e', '£': 'l', '!': 'i', '|': 'l', '+': 't' };
const DISGUISED_RE = /[\p{L}\p{M}\p{N}$@€£|+]+(?:['’\-!][\p{L}\p{M}\p{N}$@€£|+]+)*/gu;
/** A number with a short ending of letters: "2nd", "6pm", "1990s", "3D", "1er", "3ème", "1-й", "5km", "2번". */
const NUMBER_THEN_LETTERS = /^\p{N}+(?:[.,:]\p{N}+)*['’\-]?\p{L}{1,3}$/u;
/** Letters, then a number: "ke-2" (Indonesian ordinals), "No.5" read as "no" and "5". */
const LETTERS_THEN_NUMBER = /^\p{L}{1,3}['’\-]\p{N}+$/u;

/**
 * Is this token an honest number (digits with an ordinal, unit or plural ending, in any
 * language), not a word with digits standing in for its letters? One digit that reads as a
 * letter (STAND_INS) and so spells a word of four letters or more the lexicon knows ("1ove")
 * is a disguise; "1st", "2nd", "10th" and "3D" spell nothing and are numbers.
 */
function honestNumber(token: string, lang: string): boolean {
  if (LETTERS_THEN_NUMBER.test(token)) return true;
  if (!NUMBER_THEN_LETTERS.test(token)) return false;
  const digits = /^\p{N}+/u.exec(token)![0];
  if (digits.length > 1 || !STAND_INS[digits]) return true;
  const read = STAND_INS[digits] + token.slice(digits.length).replace(/^['’\-]/, '');
  return !(letterCount(read) >= 4 && lexiconHas(read, lang) === true);
}

const nativeCache = new Map<string, Set<string>>();

/** The letters of the duel's alphabet: every letter its pack is written in, folded. */
function nativeLetters(lang: string): Set<string> {
  const b = baseLang(lang);
  let set = nativeCache.get(b);
  if (!set) {
    set = new Set<string>();
    let pack;
    try {
      pack = getPack(b);
    } catch {
      pack = getPack('en');
    }
    const texts = [...pack.acrostic, ...pack.forbidden, ...Object.values(pack.relics).flat(), ...Object.values(pack.written).flat(), ...Object.values(pack.spare ?? {}).flat(), ...Object.values(pack.acrosticLines).flat()];
    for (const t of texts) for (const ch of fold(t)) if (HAS_LETTER.test(ch)) set.add(ch);
    if (pack.lang === b) nativeCache.set(b, set);
  }
  return set;
}

/** A folded letter as it reads in the duel's alphabet: itself, or the letter of the alphabet it is drawn like (UTS #39). */
function readLetter(ch: string, native: Set<string>): string {
  if (native.has(ch)) return ch;
  const proto = prototypeOf(ch);
  const lower = proto.toLowerCase();
  if (native.has(proto)) return proto;
  if (native.has(lower)) return lower;
  for (const byScript of [BY_PROTOTYPE.get(proto), BY_PROTOTYPE.get(lower)]) {
    for (const list of byScript?.values() ?? []) for (const l of list) if (native.has(l)) return l;
  }
  return ch;
}

/** Scripts written together within one word in these languages: no mix, only their writing. */
const SAME_WRITING: Record<string, string[]> = { ja: ['Han', 'Hiragana', 'Katakana'], ko: ['Hangul', 'Han'], zh: ['Han', 'Bopomofo'] };

/** Does a word mix alphabets (beyond what its language writes together)? */
function mixesScripts(word: string, lang: string): boolean {
  const together = SAME_WRITING[baseLang(lang)] ?? [];
  const scripts = new Set([...word].filter((ch) => HAS_LETTER.test(ch)).map(scriptOf).map((s) => (together.includes(s) ? together[0] : s)));
  return scripts.size > 1;
}

/**
 * Words as a curse reads them: what a word looks like, not which code points spell it.
 * `text` is the verse as typed (cleanVerse with `unmix: false`). Each word comes back folded,
 * each letter read in the duel's alphabet: itself, or the letter of the alphabet that Unicode
 * says it is drawn like (UTS #39 confusables), so a Cyrillic "о", an Armenian "օ", a small
 * capital "ᴏ" and "ø" are all "o" in an English duel, and a Latin "o" is "о" in a Russian one.
 *   - A word that mixes alphabets is a disguise, and a curse takes it at its worst: it gets
 *     a "?", which every forbidden letter counts.
 *   - A digit or sign written inside a word in place of a letter is read as the Latin letter
 *     it stands for ("r0se", "ro$e"); one that stands for nothing we know, or one inside a
 *     word not in Latin letters, is "?".
 *   - An honest number is not a disguise: "2nd", "6pm", "1990s", "3D", "1er", "1-й", "ke-2"
 *     keep their digits as digits, and only their letters are read.
 *
 * For Chinese, Japanese and Thai the words are the segmenter's, as everywhere else.
 */
export function wordsAsRead(text: string, lang = 'en'): string[] {
  const native = nativeLetters(lang);
  const read = (w: string) => [...fold(w)].map((ch) => (HAS_LETTER.test(ch) ? readLetter(ch, native) : ch)).join('') + (mixesScripts(w, lang) ? '?' : '');
  if (UNSPACED.has(baseLang(lang))) return wordsOf(text, lang).map(read);
  const out: string[] = [];
  for (const token of text.match(DISGUISED_RE) ?? []) {
    if (!HAS_LETTER.test(token)) continue;
    if (honestNumber(token, lang)) {
      out.push(read(token));
      continue;
    }
    const seen = [...read(token)];
    const latin = seen.every((ch) => !HAS_LETTER.test(ch) || /\p{Script=Latin}/u.test(ch));
    out.push(seen.map((ch) => (/[\p{L}\p{M}'\-?]/u.test(ch) ? ch : (latin && STAND_INS[ch]) || '?')).join(''));
  }
  return out;
}

/**
 * The length of each word as a curse reads it: its letters, and any digit or
 * sign written inside it in place of one ("w0nd3rful" is nine letters long). An
 * honest number ("1990s") is as long as its letters.
 */
export function wordLengthsAsRead(text: string, lang = 'en'): number[] {
  if (UNSPACED.has(baseLang(lang))) return wordsOf(text, lang).map(letterCount);
  return (text.match(DISGUISED_RE) ?? [])
    .filter((token) => HAS_LETTER.test(token))
    .map((token) => (honestNumber(token, lang) ? letterCount(token) : [...token.normalize('NFC')].filter((ch) => /[\p{L}\p{N}$@€£|+!]/u.test(ch)).length));
}

/** A letter as a curse compares it: folded and read in the duel's alphabet (see wordsAsRead). */
export function letterAsRead(letter: string, lang = 'en'): string {
  return [...fold(letter)].map((ch) => (HAS_LETTER.test(ch) ? readLetter(ch, nativeLetters(lang)) : ch)).join('');
}
