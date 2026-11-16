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
 * - Syllables are counted only where the spelling makes a fair count possible.
 *   English is the exception to "spelling": it is counted by sound, from the
 *   pronunciation table (./pronounce), and by spelling only for a word the
 *   table does not have.
 */
import { baseLang, rulesFor } from './lang';
import { pronounce } from './pronounce';

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

const LINE_BREAKS = /\r\n?|[\u000b\u000c\u0085\u2028\u2029]/g;
const BLANKS = /[\t\u115f\u1160\u3164\uffa0\u2800\p{Zs}]/gu;
const INVISIBLE = /[\p{Cc}\p{Cf}\p{Co}\p{Cs}\p{Default_Ignorable_Code_Point}]/gu;
const ORPHAN_MARKS = /(^|[^\p{L}\p{N}\p{M}])\p{M}+/gu;
/** Most combining marks one letter may carry. Real writing needs two or three; stacked "zalgo" text uses dozens. */
const MAX_MARKS = 4;
const MARK_PILE = new RegExp(`(\\p{M}{${MAX_MARKS}})\\p{M}+`, 'gu');
const NOT_THAI_LAO = /[^\u0e00-\u0eff]+/g;

/** Cyrillic and Greek letters that are drawn like a Latin letter, by the Latin letter they look like. */
const TO_LATIN: Record<string, string> = {
  а: 'a', е: 'e', о: 'o', р: 'p', с: 'c', х: 'x', у: 'y', і: 'i', ј: 'j', ѕ: 's', ԁ: 'd', һ: 'h', ӏ: 'l', ԛ: 'q', ԝ: 'w',
  А: 'A', В: 'B', Е: 'E', К: 'K', М: 'M', Н: 'H', О: 'O', Р: 'P', С: 'C', Т: 'T', Х: 'X', У: 'Y', Ѕ: 'S', І: 'I', Ј: 'J',
  α: 'a', ο: 'o', ν: 'v', ρ: 'p', ι: 'i', κ: 'k', υ: 'u',
  Α: 'A', Β: 'B', Ε: 'E', Ζ: 'Z', Η: 'H', Ι: 'I', Κ: 'K', Μ: 'M', Ν: 'N', Ο: 'O', Ρ: 'P', Τ: 'T', Υ: 'Y', Χ: 'X',
};
/** The same pairs the other way: the Latin letters a Cyrillic word can be faked with. */
const TO_CYRILLIC: Record<string, string> = {};
for (const [from, to] of Object.entries(TO_LATIN)) if (/\p{Script=Cyrillic}/u.test(from) && !(to in TO_CYRILLIC)) TO_CYRILLIC[to] = from;

/** A word as its look-alike letters read in Latin: the common ground for comparing across alphabets. */
function latinised(word: string): string {
  return [...word].map((ch) => TO_LATIN[ch] ?? ch).join('');
}

/**
 * In a word that mixes alphabets, read the strays as letters of the word's own
 * alphabet. Which alphabet that is, is told by the letters that could not be
 * strays: those with no look-alike ("r" and "s" in "rose", the Cyrillic m, l
 * and k of "moloko"). Where those do not settle it, the alphabet most of the
 * word's letters are in; and Latin if that is even.
 */
function unmixScripts(line: string): string {
  return line.replace(/[\p{L}\p{M}]+/gu, (word) => {
    const letters = [...word];
    const latin = letters.filter((ch) => /\p{Script=Latin}/u.test(ch));
    const cyrillic = letters.filter((ch) => /\p{Script=Cyrillic}/u.test(ch));
    const greek = letters.filter((ch) => /\p{Script=Greek}/u.test(ch));
    if ((latin.length ? 1 : 0) + (cyrillic.length ? 1 : 0) + (greek.length ? 1 : 0) < 2) return word;
    const ownLatin = latin.filter((ch) => !(ch in TO_CYRILLIC)).length;
    const ownCyrillic = cyrillic.filter((ch) => !(ch in TO_LATIN)).length;
    const toCyrillic = ownCyrillic !== ownLatin ? ownCyrillic > ownLatin : cyrillic.length > latin.length;
    if (toCyrillic && cyrillic.length >= greek.length) return letters.map((ch) => TO_CYRILLIC[TO_LATIN[ch] ?? ch] ?? ch).join('');
    if (latin.length >= greek.length || !cyrillic.length) return latin.length ? latinised(word) : word;
    return word;
  });
}

/** Normalise a verse (see above), collapse blank lines, cap the length. */
export function cleanVerse(raw: string): string {
  const lines = raw
    .replace(LINE_BREAKS, '\n')
    .replace(NOT_THAI_LAO, (run) => run.normalize('NFKC'))
    .replace(BLANKS, ' ')
    .split('\n')
    .map((l) => unmixScripts(l.replace(INVISIBLE, '').replace(ORPHAN_MARKS, '$1').replace(MARK_PILE, '$1')).replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0)
    .slice(0, MAX_VERSE_LINES);
  return lines.join('\n').slice(0, MAX_VERSE_CHARS);
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
      if (!inGroup) {
        count++;
        hasStrong = strong || stressedWeak;
      } else if (nasal) {
        // Portuguese "ão", "õe": one syllable.
      } else if (stressedWeak || (strong && hasStrong)) {
        count++;
        hasStrong = true;
      } else if (strong) hasStrong = true;
      inGroup = true;
      nasal = tilde;
    } else if (!silentU) {
      inGroup = false;
      nasal = false;
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

/** Japanese sounds (mora) in a kana string, or null if it holds anything that is not kana. */
function kanaMora(text: string): number | null {
  const letters = lettersOf(hiragana(text));
  if (!letters.length) return 0;
  let n = 0;
  for (const ch of letters) {
    if (!/[ぁ-ゖー]/.test(ch)) return null;
    // Small ya, yu, yo and small vowels ride on the sound before them.
    if (!'ゃゅょぁぃぅぇぉゎ'.includes(ch)) n++;
  }
  return n;
}

/** Languages in which a line's syllables can be counted fairly from its spelling. */
export function countsSyllables(lang: string): boolean {
  return /^(en|es|it|pt|de|nl|fr|ca|ro|pl|ru|id|ko|zh|ja|vi)$/.test(baseLang(lang));
}

/**
 * Syllables in a word, or null when the script is not one we can count.
 *
 * English is read from the pronunciation table (the commonest pronunciation;
 * see syllableCounts for the others), and counted by spelling only when the
 * table does not have the word. Spanish, Italian and Portuguese count strong
 * vowels. Polish, Russian and Indonesian are spelled nearly as spoken, so their
 * vowels are counted. A Hangul block, a Chinese character and a Vietnamese word
 * are each one syllable by definition. Japanese counts sounds, and only in kana:
 * a kanji's reading is not in its spelling. Other Latin-script languages get
 * plain vowel groups.
 */
export function syllablesInWord(word: string, lang = 'en'): number | null {
  const b = baseLang(lang);
  const letters = lettersOf(word);
  if (b === 'ko' && letters.length && letters.every((c) => /[가-힣]/.test(c))) return letters.length;
  if (b === 'zh' && letters.length && letters.every((c) => /\p{Script=Han}/u.test(c))) return letters.length;
  if (b === 'ja') return kanaMora(word);
  if (b === 'ru' && letters.length && letters.every((c) => /\p{Script=Cyrillic}/u.test(c))) {
    // No floor of one: "в", "к", "с" are words with no syllable of their own.
    return (word.toLowerCase().match(/[аеёиоуыэюя]/g) ?? []).length;
  }
  if (!isLatin(word)) return letters.length ? null : 0;
  if (b === 'vi') return 1;
  if (b === 'pl') return polishSyllables(word);
  if (b === 'id') return indonesianSyllables(word);
  if (b === 'es' || b === 'it' || b === 'pt') return romanceSyllables(word, b);
  const w = fold(word).replace(/œ/g, 'oe').replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (b === 'en') return englishCounts(word, w)[0];
  return Math.max(1, vowelGroups(w));
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

/** A French word that ends in a mute e: "porte", "portes", but not "été" or "vie". */
function frenchMuteE(word: string): boolean {
  return /[^aeiouyàâäéèêëîïôöùûü]es?$/.test(word.toLowerCase().normalize('NFC')) && vowelGroups(fold(word)) > 1;
}

export function syllablesInLine(line: string, lang = 'en'): number | null {
  const b = baseLang(lang);
  if (b === 'ja') return kanaMora(line);
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

/** Does a unit count towards a verse having something in it? A lone letter of an alphabet does not. */
function countsAsWord(unit: string, lang: string): boolean {
  if (rulesFor(lang).unit === 'char') return true;
  return letterCount(unit) >= 2 || (letterCount(unit) === 1 && !/^[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Greek}]/u.test(unit));
}

export interface Substance {
  ok: boolean;
  /** Different words (or characters) found, and how many the verse needs. */
  distinct: number;
  needed: number;
}

/** Fewest different words anything that calls itself a verse can have. */
export const MIN_DISTINCT_WORDS = 3;

/**
 * Is this a verse, or tokens arranged to satisfy a checker? The floor every
 * form, device and judge shares:
 *   - every line holds at least one word (a lone letter of an alphabet is not one), and
 *   - the verse has at least as many different words as it has lines, and never
 *     fewer than MIN_DISTINCT_WORDS.
 * "Never / Never / Never", "a / a a / a a a", "w / i / t" and a single word fail
 * it; the shortest honest verses, such as an acrostic of one word to a line,
 * keep it. Where lines are counted in characters, "words" here are characters.
 */
export function substance(verse: string, lang = 'en'): Substance {
  const ls = linesOf(verse);
  const perLine = ls.map((l) => unitsOf(l, lang).filter((u) => countsAsWord(u, lang)));
  const distinct = new Set(perLine.flat()).size;
  const needed = Math.max(ls.length, MIN_DISTINCT_WORDS);
  return { ok: ls.length > 0 && perLine.every((units) => units.length > 0) && distinct >= needed, distinct, needed };
}

/**
 * How much of `verse` is taken from `source`, from 0 (nothing) to 1 (all of it).
 *
 * The measure is the share of the verse's word pairs (two words running, within
 * a line) that also run together somewhere in the source; a whole line of three
 * words or more repeated from the source counts as 1 outright. Word pairs, not
 * single words, so throwing one word back (the Riposte) or quoting a short
 * phrase scores low, while a verse pasted back, reordered or lightly retouched
 * scores high. Case, accents and punctuation are ignored. Where lines are
 * counted in characters, the pairs are pairs of characters.
 */
export function similarity(verse: string, source: string, lang = 'en'): number {
  const seq = (text: string) => linesOf(text).map((l) => unitsOf(l, lang)).filter((u) => u.length > 0);
  const mine = seq(verse);
  const theirs = seq(source);
  if (!mine.length || !theirs.length) return 0;
  const theirLines = new Set(theirs.map((u) => u.join(' ')));
  if (mine.some((u) => u.length >= 3 && theirLines.has(u.join(' ')))) return 1;
  const pairs = (ls: string[][]) => ls.flatMap((u) => u.slice(1).map((x, i) => `${u[i]} ${x}`));
  const myPairs = pairs(mine);
  if (!myPairs.length) {
    // One-word lines have no pairs; fall back to the words themselves.
    const theirWords = new Set(theirs.flat());
    const myWords = mine.flat();
    return myWords.filter((w) => theirWords.has(w)).length / myWords.length;
  }
  const theirPairs = new Set(pairs(theirs));
  return myPairs.filter((p) => theirPairs.has(p)).length / myPairs.length;
}

// --- Words as a curse reads them ---

/** Digits and signs that stand in for a Latin letter inside a word ("r0se", "ro$e"). */
const STAND_INS: Record<string, string> = { '0': 'o', '1': 'l', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', $: 's', '@': 'a', '€': 'e', '£': 'l', '!': 'i', '|': 'l', '+': 't' };
const DISGUISED_RE = /[\p{L}\p{M}\p{N}$@€£|+]+(?:['\u2019\-!][\p{L}\p{M}\p{N}$@€£|+]+)*/gu;

/**
 * Words as a curse reads them: what a word looks like, not which code points
 * spell it. Each comes back folded, with look-alike letters of another alphabet
 * read as Latin (so a Cyrillic "о" and a Latin "o" are the same letter here,
 * whichever the curse names), and with a digit or sign written inside a word in
 * place of a letter read as the Latin letter it stands for. A stand-in that
 * stands for nothing we know, or one inside a word that is not in Latin
 * letters, is kept as "?": a curse takes it for the worst case.
 *
 * For Chinese, Japanese and Thai the words are the segmenter's, as everywhere else.
 */
export function wordsAsRead(text: string, lang = 'en'): string[] {
  if (UNSPACED.has(baseLang(lang))) return wordsOf(text, lang).map((w) => latinised(fold(w)));
  const out: string[] = [];
  for (const token of text.match(DISGUISED_RE) ?? []) {
    if (!HAS_LETTER.test(token)) continue;
    const seen = [...latinised(fold(token))];
    const latin = seen.every((ch) => !HAS_LETTER.test(ch) || /\p{Script=Latin}/u.test(ch));
    out.push(seen.map((ch) => (/[\p{L}\p{M}'\-]/u.test(ch) ? ch : (latin && STAND_INS[ch]) || '?')).join(''));
  }
  return out;
}

/**
 * The length of each word as a curse reads it: its letters, and any digit or
 * sign written inside it in place of one ("w0nd3rful" is nine letters long).
 */
export function wordLengthsAsRead(text: string, lang = 'en'): number[] {
  if (UNSPACED.has(baseLang(lang))) return wordsOf(text, lang).map(letterCount);
  return (text.match(DISGUISED_RE) ?? [])
    .filter((token) => HAS_LETTER.test(token))
    .map((token) => [...token.normalize('NFC')].filter((ch) => /[\p{L}\p{N}$@€£|+!]/u.test(ch)).length);
}

/** A letter as a curse compares it: folded and read as Latin where it has a Latin look-alike. */
export function letterAsRead(letter: string): string {
  return latinised(fold(letter));
}
