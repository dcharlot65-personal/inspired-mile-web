/**
 * Reading the per-language sound tables (./index) and the script-level sound
 * rules that both ../text (syllables) and ../rhyme (rhyme) need.
 *
 * What a table's value means, per language (scripts/sound/build.mjs writes them):
 *
 * - es, it, pt: two characters, base 36. The syllable count, and the number of
 *   letters from the stressed vowel to the end of the word. "0" means "as the
 *   spelling rule says". Only words on which the rule and the dictionary
 *   disagree are in the table.
 * - id, hi: one character, the syllable count, for words on which the rule and
 *   the dictionary disagree.
 * - ru: digits; each is a stressed vowel, counted from the end of the word.
 * - fr: the syllable count as spoken, "+" if the word closes on a mute e that
 *   verse sounds before a consonant, then its rhyme keys joined by "|".
 * - de, th: the syllable count, then the rhyme keys joined by "|".
 * - zh: for one character, its readings, two characters each (rhyme group a-p,
 *   tone 1-5); for a word, the reading of its last character.
 */
import { longestEnding, longestOpening, soundOf, soundReady } from './index';
import { thaiPlain, thaiRimeBySpelling } from './th';

export interface Spoken {
  /** Syllables, or null when only the rhyme is known. */
  n: number | null;
  keys: string[];
}

function plainWord(word: string): string {
  return word.toLowerCase().normalize('NFC').replace(/[’ʼ]/g, "'");
}

/** The count a dictionary gives where it disagrees with the spelling rule (es, it, pt, id, hi), or null. */
export function countOverride(lang: string, word: string): number | null {
  const v = soundOf(lang, plainWord(word));
  if (!v || v[0] === '0') return null;
  return parseInt(v[0], 36);
}

/** Letters from the stressed vowel to the end where a dictionary disagrees with the spelling rule (es, it, pt), or null. */
export function tailOverride(lang: string, word: string): number | null {
  const v = soundOf(lang, plainWord(word));
  if (!v || v.length < 2 || v[1] === '0') return null;
  return parseInt(v[1], 36);
}

// --- French ---

export interface FrenchSpoken extends Spoken {
  n: number;
  /** Closes on a mute e ("porte", "parlent"): one more syllable in verse before a consonant. */
  mute: boolean;
}

export function frenchSound(word: string): FrenchSpoken | null {
  const w = plainWord(word).replace(/^(l|d|j|m|t|s|n|c|qu|jusqu|lorsqu|puisqu)'/, '');
  const v = soundOf('fr', w);
  if (!v) return null;
  const mute = v[1] === '+';
  return { n: parseInt(v[0], 36), mute, keys: v.slice(mute ? 2 : 1).split('|') };
}

// --- German ---

export interface GermanSpoken extends Spoken {
  /** For a compound the table lacks: the part before the last element, to be counted by rule. */
  rest: string;
}

/**
 * A German word from the table, or, for a compound the table lacks, its last
 * element ("Sternenlicht" is read as "…licht"): a compound rhymes on its last
 * element, and German makes new compounds freely.
 */
export function germanSound(word: string): GermanSpoken | null {
  const w = plainWord(word).replace(/['\-]/g, '');
  const v = soundOf('de', w);
  if (v) return { n: parseInt(v[0], 36), keys: v.slice(1).split('|'), rest: '' };
  const e = longestEnding('de', w, [...w].length - 2, 4);
  if (!e) return null;
  return { n: parseInt(e.value[0], 36), keys: e.value.slice(1).split('|'), rest: w.slice(0, w.length - e.word.length) };
}

// --- Russian ---

/** Stressed vowels of a Russian word, each as its place among the word's vowels counted from the end; null if unknown. */
export function russianStress(word: string): number[] | null {
  const w = plainWord(word).replace(/['\-]/g, '');
  const vowels = w.match(/[аеёиоуыэюя]/g) ?? [];
  if (!vowels.length) return null;
  if (vowels.length === 1) return [1];
  // ё is always stressed.
  const yo = vowels.lastIndexOf('ё');
  if (yo >= 0) return [vowels.length - yo];
  const v = soundOf('ru', w);
  if (!v) return null;
  return [...v].map((d) => parseInt(d, 36)).filter((k) => k >= 1 && k <= vowels.length);
}

// --- Hindi ---

const DEV_SIGNS: Record<string, string> = { 'ा': 'A', 'ि': 'i', 'ी': 'I', 'ु': 'u', 'ू': 'U', 'े': 'e', 'ै': 'E', 'ो': 'o', 'ौ': 'O', 'ृ': 'r', 'ॉ': 'o', 'ॅ': 'e' };
const DEV_VOWELS: Record<string, string> = { 'अ': 'a', 'आ': 'A', 'इ': 'i', 'ई': 'I', 'उ': 'u', 'ऊ': 'U', 'ए': 'e', 'ऐ': 'E', 'ओ': 'o', 'औ': 'O', 'ऋ': 'r', 'ऑ': 'o', 'ऍ': 'e' };

export interface Akshara {
  /** The consonant, or '' for a syllable that is a bare vowel. */
  c: string;
  /** The vowel in Latin letters ('a' is the unwritten one), or '' when the consonant has none. */
  v: string;
  /** The vowel is the unwritten "a". */
  inherent: boolean;
  /** Followed by a nasal dot (anusvara): the syllable is closed. */
  nasal: boolean;
}

/**
 * A Devanagari word as it is said: its consonants and vowels, with the
 * unwritten "a" taken out where Hindi does not say it (schwa deletion). Null if
 * the word is not Devanagari.
 *
 * The rule is the standard one: the "a" of the last consonant is silent
 * ("रात" is raat), and an "a" between a vowel-consonant and a consonant-vowel
 * is silent too, working from the end of the word ("लड़का" is lar-kaa, "समझना"
 * is sa-majh-naa). It is not kept after a nasal dot or in the first syllable.
 */
export function hindiAksharas(word: string): Akshara[] | null {
  const w = word.normalize('NFC').replace(/[़ँः‌‍]/g, '');
  if (!w || !/^[ऄ-ॣॱ-ॿं]+$/.test(w)) return null;
  const cs = [...w];
  const out: Akshara[] = [];
  for (let i = 0; i < cs.length; i++) {
    const ch = cs[i];
    if (ch === 'ं') {
      if (out.length) out[out.length - 1].nasal = true;
    } else if (DEV_VOWELS[ch]) out.push({ c: '', v: DEV_VOWELS[ch], inherent: false, nasal: false });
    else if (/[क-ह]/.test(ch)) {
      const next = cs[i + 1];
      if (next && DEV_SIGNS[next]) {
        out.push({ c: ch, v: DEV_SIGNS[next], inherent: false, nasal: false });
        i++;
      } else if (next === '्') {
        out.push({ c: ch, v: '', inherent: false, nasal: false });
        i++;
      } else out.push({ c: ch, v: 'a', inherent: true, nasal: false });
    }
  }
  if (!out.length) return null;
  const voiced = () => out.filter((a) => a.v).length;
  const last = out[out.length - 1];
  if (last.inherent && !last.nasal && voiced() > 1) last.v = '';
  for (let i = out.length - 2; i >= 1; i--) {
    const a = out[i];
    if (a.inherent && a.v && !a.nasal && a.c && out[i - 1].v && !out[i - 1].nasal && out[i + 1].v && out[i + 1].c) a.v = '';
  }
  return out;
}

/** Syllables of a Hindi word by the script rule: one for each vowel that is said. */
export function hindiSyllablesByRule(word: string): number | null {
  const a = hindiAksharas(word);
  return a ? a.filter((x) => x.v).length : null;
}

// --- Chinese ---

/** Readings of the last character of a stretch of Chinese: [rhyme group, tone] pairs. Null with no table or no character. */
export function chineseReadings(text: string): Array<[string, number]> | null {
  if (!soundReady('zh')) return null;
  const han = [...text.normalize('NFC')].filter((c) => /\p{Script=Han}/u.test(c));
  if (!han.length) return null;
  const tail = han.slice(-4).join('');
  // A word decides which reading a character with several takes: 银行 is háng, 行 alone may be xíng.
  const word = han.length > 1 ? longestEnding('zh', tail, 4, 2) : null;
  const codes = word ? word.value : (soundOf('zh', han[han.length - 1]) ?? '');
  const out: Array<[string, number]> = [];
  for (let i = 0; i + 1 < codes.length; i += 2) out.push([codes[i], Number(codes[i + 1])]);
  return out;
}

// --- Thai ---

export interface ThaiEnd {
  /** The dictionary word the text ends on, or its last few letters when the table does not have it. */
  word: string;
  /** Rimes of its last syllable. */
  keys: string[];
  /** Read from the table (true) or by spelling patterns (false). */
  known: boolean;
}

const THAI_RUN = /[ก-๎]+/g;

/** What a stretch of Thai ends on: the longest dictionary word at its end, else the last syllable by spelling. */
export function thaiEnd(text: string): ThaiEnd | null {
  const runs = text.normalize('NFC').match(THAI_RUN);
  if (!runs) return null;
  const run = runs[runs.length - 1].replace(/[ๆฯ]+$/, '');
  if (!run) return null;
  const cs = [...run];
  for (let n = Math.min(24, cs.length); n >= 2; n--) {
    const start = cs.length - n;
    // A word does not start on a mark, and the letter before it is not a vowel that belongs to it.
    if (/[ะ-ฺๅ็-๎]/.test(cs[start]) || (start > 0 && /[เแโใไ]/.test(cs[start - 1]))) continue;
    const word = cs.slice(start).join('');
    const v = soundOf('th', word);
    if (v) return { word, keys: v.slice(1).split('|'), known: true };
  }
  const rime = thaiRimeBySpelling(run);
  if (rime === null) return null;
  return { word: cs.slice(-6).join(''), keys: [rime], known: false };
}

/**
 * Syllables in a stretch of Thai, or null when part of it is not in the table.
 * The text is cut into dictionary words, longest first from the left; that is
 * a fixed rule, not the platform's segmenter, so every device cuts alike.
 */
export function thaiSyllables(text: string): number | null {
  if (!soundReady('th')) return null;
  let total = 0;
  for (const run of text.normalize('NFC').match(THAI_RUN) ?? []) {
    const cs = [...run.replace(/[ๆฯ]/g, '')];
    let i = 0;
    while (i < cs.length) {
      const m = longestOpening('th', cs, i, 24);
      if (!m) return null;
      total += parseInt(m.value[0], 36);
      i += m.length;
    }
  }
  return total;
}

export { thaiPlain };
