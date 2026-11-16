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
 */
import { baseLang, rulesFor } from './lang';

/** Longest verse the game accepts. Also bounds what a judge prompt can carry. */
export const MAX_VERSE_CHARS = 600;
export const MAX_VERSE_LINES = 8;

// Control characters, zero-width characters and direction overrides: none belong in a verse,
// and some can hide text from a reader while a model still sees it.
const CONTROL_CHARS = new RegExp(
  '[\\u0000-\\u0008\\u000b-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u2028-\\u202e\\u2066-\\u2069]',
  'g',
);

/** Strip control characters, collapse blank lines, cap the length. */
export function cleanVerse(raw: string): string {
  const noControl = raw.replace(CONTROL_CHARS, '');
  const lines = noControl
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
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
 * Devanagari dot (nukta) that Hindi keyboards often leave off.
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
    .replace(/ß/g, 'ss');
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

/** The letters of a text, in order, without spaces, punctuation or marks. */
function lettersOf(text: string): string[] {
  return [...text.normalize('NFC')].filter((ch) => HAS_LETTER.test(ch));
}

/** A line's length in the unit its language counts in: words, or characters for Chinese and Japanese. */
export function lineLength(line: string, lang = 'en'): number {
  return rulesFor(lang).unit === 'char' ? letterCount(line) : wordsOf(line, lang).length;
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
  return wordsOf(text, lang).filter((w) => letterCount(w) >= min);
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

function englishSyllables(w: string): number {
  let groups = vowelGroups(w);
  // Silent final e ("stage"), but not "-le" after a consonant ("candle").
  if (w.length > 2 && w.endsWith('e') && !w.endsWith('le') && !LATIN_VOWELS.includes(w[w.length - 2])) groups--;
  if (w.endsWith('le') && w.length > 2 && LATIN_VOWELS.includes(w[w.length - 3])) groups--;
  // "-es" is silent after most consonants ("leaves", "takes") but not after a hiss ("roses", "wishes").
  if (w.length > 3 && w.endsWith('es') && !LATIN_VOWELS.includes(w[w.length - 3]) && !/(s|x|z|ch|sh|c|g)es$/.test(w)) groups--;
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
 * English gets silent-e handling. Spanish, Italian and Portuguese count strong
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
  if (b === 'en') return englishSyllables(w);
  return Math.max(1, vowelGroups(w));
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
