/**
 * What differs between languages when a verse is measured.
 *
 * English counts line length in words and word length in letters, and its
 * thresholds ("a word of four letters or more") were tuned for English. Other
 * scripts need other numbers: a Korean word of two syllable blocks carries as
 * much as an English word of five letters, and Chinese and Japanese are written
 * without spaces, so their lines are measured in characters, as their own
 * verse traditions do (five- and seven-character lines; 5-7-5).
 */

export function baseLang(lang: string): string {
  return lang.toLowerCase().split('-')[0];
}

export interface LangRules {
  /** What a line's length is counted in. */
  unit: 'word' | 'char';
  /** Letters that make a word "strong" enough to count for repetition and echoes. */
  content: number;
  /** Letters a word needs before throwing it back counts as a riposte. */
  riposte: number;
  /** Letters that make a word grand. */
  grand: number;
  /** Longest word the Tongue-Tied curse allows, in letters. */
  shortWord: number;
  /** Longest line Brevity allows, in units. */
  brevity: number;
  /** Longest line the Short Breath curse allows, in units. */
  shortLine: number;
}

const DEFAULT: LangRules = { unit: 'word', content: 4, riposte: 5, grand: 9, shortWord: 6, brevity: 6, shortLine: 5 };
/** Languages whose words run longer than English ones on average. */
const LONGER: LangRules = { ...DEFAULT, grand: 10, shortWord: 7 };

const RULES: Record<string, LangRules> = {
  en: DEFAULT,
  es: LONGER, fr: LONGER, it: LONGER, pt: LONGER, pl: LONGER, ru: LONGER, id: LONGER,
  // German builds compounds: nine letters is an ordinary word.
  de: { ...DEFAULT, grand: 12, shortWord: 8 },
  // Arabic is written without short vowels and with particles attached: words are short, lines hold fewer of them.
  ar: { unit: 'word', content: 3, riposte: 4, grand: 7, shortWord: 5, brevity: 5, shortLine: 4 },
  // Devanagari: vowel signs are marks, not letters, so a word has few letters.
  hi: { unit: 'word', content: 3, riposte: 3, grand: 5, shortWord: 4, brevity: 6, shortLine: 5 },
  // Hangul: a letter is a syllable block; a spaced word carries a noun and its particles.
  ko: { unit: 'word', content: 2, riposte: 3, grand: 5, shortWord: 3, brevity: 4, shortLine: 3 },
  // Vietnamese: every syllable is written apart, so a "word" here is a syllable.
  vi: { unit: 'word', content: 3, riposte: 4, grand: 6, shortWord: 5, brevity: 6, shortLine: 5 },
  // Thai: no spaces; words come from the browser's dictionary segmenter.
  th: { unit: 'word', content: 3, riposte: 4, grand: 7, shortWord: 5, brevity: 7, shortLine: 6 },
  // Chinese and Japanese: lines are measured in characters; words (from the segmenter) are one to four characters.
  zh: { unit: 'char', content: 2, riposte: 2, grand: 3, shortWord: 2, brevity: 7, shortLine: 5 },
  ja: { unit: 'char', content: 2, riposte: 2, grand: 4, shortWord: 3, brevity: 12, shortLine: 10 },
};

export function rulesFor(lang: string): LangRules {
  return RULES[baseLang(lang)] ?? DEFAULT;
}

/** `key` for languages that count words, `key.char` for those that count characters. */
export function unitKey(key: string, lang: string): string {
  return rulesFor(lang).unit === 'char' ? `${key}.char` : key;
}
