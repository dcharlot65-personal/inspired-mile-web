/**
 * Text measurement for verse: lines, words, syllables, rhyme, alliteration.
 *
 * Everything here is deterministic and runs without a model. The checks are
 * written to work across languages where they can: words are split on Unicode
 * letters, rhyme compares word endings, and syllable counting is offered only
 * for scripts where vowel groups are a fair approximation.
 */

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

/** Lower-cased words of a line or verse. Apostrophes and hyphens stay inside a word. */
export function wordsOf(text: string): string[] {
  return (text.match(WORD_RE) ?? []).map((w) => w.toLocaleLowerCase());
}

export function lastWord(line: string): string {
  const w = wordsOf(line);
  return w.length ? w[w.length - 1] : '';
}

export function firstWord(line: string): string {
  const w = wordsOf(line);
  return w.length ? w[0] : '';
}

/** Remove accents so "café" and "cafe" compare equal. */
export function fold(word: string): string {
  return word.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase();
}

const LATIN_VOWELS = 'aeiouy';

function isLatin(word: string): boolean {
  return /^[a-z'’\-]+$/.test(fold(word));
}

/**
 * Syllables in a word, or null when the script is not one we can count.
 * English gets silent-e handling; other Latin-script languages get plain
 * vowel groups, which is close for Spanish, Italian, Portuguese and German.
 */
export function syllablesInWord(word: string, lang = 'en'): number | null {
  const w = fold(word).replace(/[^a-z]/g, '');
  if (!w) return isLatin(word) ? 0 : null;
  if (!isLatin(word)) return null;
  let groups = 0;
  let inVowel = false;
  for (const ch of w) {
    const v = LATIN_VOWELS.includes(ch);
    if (v && !inVowel) groups++;
    inVowel = v;
  }
  if (lang.startsWith('en')) {
    // Silent final e ("stage"), but not "-le" after a consonant ("candle").
    if (w.length > 2 && w.endsWith('e') && !w.endsWith('le') && !LATIN_VOWELS.includes(w[w.length - 2])) groups--;
    if (w.endsWith('le') && w.length > 2 && LATIN_VOWELS.includes(w[w.length - 3])) groups--;
    // "-ed" is silent except after t or d ("wanted").
    if (w.length > 3 && w.endsWith('ed') && !/[td]ed$/.test(w) && !LATIN_VOWELS.includes(w[w.length - 3])) groups--;
  }
  return Math.max(1, groups);
}

export function syllablesInLine(line: string, lang = 'en'): number | null {
  let total = 0;
  for (const w of wordsOf(line)) {
    const n = syllablesInWord(w, lang);
    if (n === null) return null;
    total += n;
  }
  return total;
}

/**
 * The part of a word that carries its rhyme: from the last vowel group to the
 * end for Latin scripts, otherwise the last two characters.
 */
export function rhymeKey(word: string): string {
  const w = fold(word).replace(/[^\p{L}]/gu, '');
  if (w.length < 2) return w;
  if (!/^[a-z]+$/.test(w)) return w.slice(-2);
  // Spellings that sound alike at the end of a word. Rough, and tuned to be
  // generous: a doubtful rhyme is allowed rather than refused.
  const e = w
    .replace(/ight$/, 'ite')
    .replace(/(ough|ow)$/, 'o')
    .replace(/(ay|eigh)$/, 'ay')
    .replace(/^(me|he|she|we|be|ye)$/, '$1e')
    .replace(/(ee|ea|ey|ie)$/, 'ee')
    .replace(/([^aeiou])y$/, '$1ee');
  // Skip a silent final e so "stage" keys on "age", not on "e".
  const end = e.length > 2 && e.endsWith('e') && !LATIN_VOWELS.includes(e[e.length - 2]) ? e.length - 1 : e.length;
  let i = end - 1;
  while (i >= 0 && !LATIN_VOWELS.includes(e[i])) i--;
  while (i > 0 && LATIN_VOWELS.includes(e[i - 1])) i--;
  if (i < 0) return e.slice(-2);
  return e.slice(i);
}

/** Two different words whose endings match. A word never rhymes with itself. */
export function rhymes(a: string, b: string): boolean {
  const fa = fold(a);
  const fb = fold(b);
  if (!fa || !fb || fa === fb) return false;
  const ka = rhymeKey(fa);
  const kb = rhymeKey(fb);
  if (ka.length < 2 || kb.length < 2) return false;
  if (ka === kb) return true;
  // "corazón" / "canción": one ending contained in the other still rhymes.
  const [short, long] = ka.length <= kb.length ? [ka, kb] : [kb, ka];
  return long.endsWith(short);
}

/** Words that carry meaning: four letters or more. */
export function contentWords(text: string): string[] {
  return wordsOf(text).filter((w) => [...w].length >= 4);
}

/** First letter of a word, folded; used for alliteration and acrostics. */
export function initial(word: string): string {
  return [...fold(word)][0] ?? '';
}
