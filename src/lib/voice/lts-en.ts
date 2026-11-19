/**
 * English letter-to-sound rules, for a word the voice's pronunciation table does not hold.
 *
 * The rules are NRL Report 7948's (1976; a US government work, in nrl-rules.ts with its
 * source), applied as that report describes: the word is padded with a space each side; each
 * letter not yet read is matched against the rules of its letter in order, and the first rule
 * whose letters, left context and right context all match gives the sounds and says how many
 * letters were read. This is a reading of the procedure in Wasser's public-domain C version
 * (PHONEME.C), not a copy of it. The rules give no stress, so `stressRules` below places it.
 *
 * Output: ARPAbet phones with stress digits on the vowels (the CMU dictionary's notation), so
 * a word read here goes through the same mapping to the voice's symbols as a word from the
 * table (g2p-en.ts).
 */
import { NRL_RULES } from './nrl-rules';

const VOWEL_LETTERS = 'AEIOU';
const isVowel = (c: string | undefined): boolean => !!c && VOWEL_LETTERS.includes(c);
const isConsonant = (c: string | undefined): boolean => !!c && c >= 'A' && c <= 'Z' && !VOWEL_LETTERS.includes(c);
const VOICED = 'BDVGJLMNRWZ';
const FRONT = 'EIY';
const literal = (p: string): boolean => (p >= 'A' && p <= 'Z') || p === "'" || p === ' ';

/** Does `pattern` match the text that ends at `at` (inclusive), read right to left? */
export function leftMatch(pattern: string, text: string, at: number): boolean {
  let i = at;
  for (let k = pattern.length - 1; k >= 0; k--) {
    const p = pattern[k];
    if (literal(p)) {
      if (text[i] !== p) return false;
      i--;
      continue;
    }
    switch (p) {
      case '#':
        if (!isVowel(text[i])) return false;
        i--;
        while (isVowel(text[i])) i--;
        break;
      case ':':
        while (isConsonant(text[i])) i--;
        break;
      case '^':
        if (!isConsonant(text[i])) return false;
        i--;
        break;
      case '.':
        if (!text[i] || !VOICED.includes(text[i])) return false;
        i--;
        break;
      case '+':
        if (!text[i] || !FRONT.includes(text[i])) return false;
        i--;
        break;
      default:
        return false;
    }
  }
  return true;
}

/** Does `pattern` match the text that starts at `at`, read left to right? */
export function rightMatch(pattern: string, text: string, at: number): boolean {
  let i = at;
  for (const p of pattern) {
    if (literal(p)) {
      if (text[i] !== p) return false;
      i++;
      continue;
    }
    switch (p) {
      case '#':
        if (!isVowel(text[i])) return false;
        i++;
        while (isVowel(text[i])) i++;
        break;
      case ':':
        while (isConsonant(text[i])) i++;
        break;
      case '^':
        if (!isConsonant(text[i])) return false;
        i++;
        break;
      case '.':
        if (!text[i] || !VOICED.includes(text[i])) return false;
        i++;
        break;
      case '+':
        if (!text[i] || !FRONT.includes(text[i])) return false;
        i++;
        break;
      case '%':
        // A suffix: ER, E, ES, ED, ING, ELY.
        if (text[i] === 'E') {
          i++;
          if (text[i] === 'L' && text[i + 1] === 'Y') i += 2;
          else if (text[i] === 'R' || text[i] === 'S' || text[i] === 'D') i++;
          break;
        }
        if (text[i] === 'I' && text[i + 1] === 'N' && text[i + 2] === 'G') {
          i += 3;
          break;
        }
        return false;
      default:
        return false;
    }
  }
  return true;
}

/** The rules' phoneme codes in an output string ("AXgEHn" is AX g EH n; the table writes "how" as h, not HH). */
const CODE = /IY|IH|EY|EH|AE|AA|AO|OW|UH|UW|ER|AX|AH|AY|AW|OY|TH|DH|SH|ZH|HH|NG|CH|WH|[pbtdkgfvszmnlwyrjh]/g;

/** The codes of one rule's output, in order. */
export function codesOf(out: string): string[] {
  return [...out.matchAll(CODE)].map((m) => m[0]);
}
/** Rule code -> CMU phone. AX (a reduced vowel) becomes an unstressed AH; WH is said "w" (the voice is British). */
const TO_CMU: Record<string, string> = {
  AX: 'AH', WH: 'W', h: 'HH', p: 'P', b: 'B', t: 'T', d: 'D', k: 'K', g: 'G', f: 'F', v: 'V', s: 'S', z: 'Z', m: 'M', n: 'N',
  l: 'L', w: 'W', y: 'Y', r: 'R', j: 'JH',
};
const CMU_VOWELS = new Set(['AA', 'AE', 'AH', 'AO', 'AW', 'AY', 'EH', 'ER', 'EY', 'IH', 'IY', 'OW', 'OY', 'UH', 'UW']);

/** The rules' own reading of a word (letters and apostrophes): the codes, before stress. */
export function ruleCodes(word: string): string[] {
  const text = ` ${word.toUpperCase().replace(/[^A-Z']/g, '')} `;
  const codes: string[] = [];
  let i = 1;
  while (i < text.length - 1) {
    const c = text[i];
    const rules = NRL_RULES[c >= 'A' && c <= 'Z' ? c : "'"];
    let read = 1;
    for (const [left, match, right, out] of rules ?? []) {
      if (!match || !text.startsWith(match, i)) continue;
      if (!leftMatch(left, text, i - 1)) continue;
      if (!rightMatch(right, text, i + match.length)) continue;
      codes.push(...codesOf(out));
      read = match.length;
      break;
    }
    i += read;
  }
  return codes;
}

/**
 * Where the stress falls in a word read by the rules. The rules give none; these follow how
 * English speakers say an unknown word:
 *   - one vowel: stressed;
 *   - three syllables or more ending in a vowel letter (names: Okonkwo, Adebayo): the one before last;
 *   - otherwise the first, unless it is a reduced vowel (AX, as in "a-", "be-") with a full one after.
 */
export function stressRules(phones: string[], word: string, reduced: boolean[]): string[] {
  const vowels = phones.map((p, i) => (CMU_VOWELS.has(p) ? i : -1)).filter((i) => i >= 0);
  if (!vowels.length) return phones;
  let stressed = vowels[0];
  if (vowels.length >= 3 && /[aiou]$/i.test(word)) stressed = vowels[vowels.length - 2];
  else if (vowels.length >= 2 && reduced[vowels[0]] && !reduced[vowels[1]]) stressed = vowels[1];
  return phones.map((p, i) => (CMU_VOWELS.has(p) ? `${p}${i === stressed ? 1 : 0}` : p));
}

/** A word the table lacks, read by the rules: CMU phones with stress. A sound doubled by a doubled letter ("finna") is said once. */
export function letterToSound(word: string): string[] {
  const codes = ruleCodes(word);
  const phones: string[] = [];
  const reduced: boolean[] = [];
  for (const c of codes) {
    const p = TO_CMU[c] ?? c;
    if (phones.length && phones[phones.length - 1] === p && !CMU_VOWELS.has(p)) continue;
    phones.push(p);
    reduced.push(c === 'AX');
  }
  return stressRules(phones, word, reduced);
}
