/**
 * English text to the phonemes Kokoro reads, without eSpeak NG.
 *
 * kokoro-js turns text into phonemes with the npm package "phonemizer", an Emscripten build of
 * eSpeak NG (GPL-3.0-or-later). The voice no longer uses it (the bundler gives kokoro-js a stub
 * for it: no-espeak.ts, astro.config.mjs). This module does that work instead, from sources that
 * are not GPL:
 *
 *   1. the text is normalised: numbers, ordinals, years, decades, money, times (10pm, 3:30 a.m.),
 *      a minus sign, Roman numerals after a king's name or a part's (Henry VIII, Act III) and
 *      common abbreviations become words; letters and digits written as one word are read
 *      together before any digit is read alone (mp3 "M P three", B2K, the 90s "nineties",
 *      text-speak like gr8 or 4ever when the table has the word it spells), so no digit is ever
 *      dropped; dashes and ellipses become the marks Kokoro knows, and a line of verse that
 *      ends without punctuation ends with a comma (a pause, as a reader takes one);
 *   2. each word is looked up in the CMU Pronouncing Dictionary (lexicon-en.ts, BSD-style
 *      licence; built by scripts/build-voice-lexicon.mjs from the same pinned file as the verse
 *      rules' table), the reading chosen by the words beside it for the few that need it;
 *   3. a word it lacks is taken apart first (runnin' is running with n for ng, moonbeams is
 *      moonbeam + s, nightlong is night + long), and only then read by the letter-to-sound rules
 *      of NRL Report 7948 (1976, US government work: lts-en.ts); a word with no vowel letter is a
 *      held sound (skrrt, brrr, shhh, hmm) or, in capitals, letters said one by one;
 *   4. the dictionary's American ARPAbet becomes the symbols Kokoro v1.0 was trained on, the
 *      conventions of its own G2P, misaki (Apache-2.0; its EN_PHONES.md): stress marks before the
 *      vowel, A I W Y for the diphthongs of hey, high, how, soy, and for a British voice Q for
 *      the vowel of go, ɒ, a, length marks, and no r after a vowel unless a vowel follows (the
 *      next word's too: "for ever" keeps its r). Misaki's dictionaries are not used: nothing in
 *      its repository says where they come from.
 *
 * The output uses only symbols of Kokoro's vocabulary (kokoro-vocab.ts; any other character
 * would be deleted by its tokenizer, silently).
 */
import { letterToSound } from './lts-en';

// ---------------------------------------------------------------------------
// The pronunciation table
// ---------------------------------------------------------------------------

/** The table's characters (scripts/build-pronunciation.mjs SOUND), back to ARPAbet. */
const SOUND_TO_CMU: Record<string, string> = {
  A: 'AA', a: 'AE', u: 'AH', O: 'AO', W: 'AW', Y: 'AY', e: 'EH', R: 'ER', E: 'EY', i: 'IH', I: 'IY', o: 'OW', y: 'OY', U: 'UH', w: 'UW',
  b: 'B', C: 'CH', d: 'D', D: 'DH', f: 'F', g: 'G', h: 'HH', j: 'JH', k: 'K', l: 'L', m: 'M', n: 'N', G: 'NG', p: 'P', r: 'R',
  s: 'S', S: 'SH', t: 'T', T: 'TH', v: 'V', '9': 'W', '8': 'Y', z: 'Z', Z: 'ZH',
};
const VOWEL_CHARS = 'AauOWYeREiIoyUw';

/** word -> its line's pronunciations, "^" first when SCOWL does not list it as a word. */
let lexicon: Map<string, string> | null = null;
let loading: Promise<boolean> | null = null;

/** Read the table (lexicon-en.ts's text). Tests and Node scripts call this; the page calls loadVoiceLexicon. */
export function installVoiceLexicon(data: string): void {
  const map = new Map<string, string>();
  for (const line of data.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const sp = line.indexOf(' ');
    if (sp < 1) continue;
    const head = line.slice(0, sp);
    const unlisted = head.endsWith('^');
    map.set(unlisted ? head.slice(0, -1) : head, (unlisted ? '^' : '') + line.slice(sp + 1));
  }
  lexicon = map;
}

/** Load the table (its own chunk, about 0.8 MB gzip), once. */
export function loadVoiceLexicon(): Promise<boolean> {
  if (lexicon) return Promise.resolve(true);
  loading ??= import('./lexicon-en')
    .then((m) => {
      installVoiceLexicon(m.default);
      return true;
    })
    .catch((err) => {
      console.error('[voice] the pronunciation table could not be loaded', err);
      loading = null;
      return false;
    });
  return loading;
}

export function voiceLexiconLoaded(): boolean {
  return lexicon !== null;
}

interface Entry {
  prons: string[];
  /** In SCOWL's word lists (or the game's own): a word, not a name or a fragment. */
  listed: boolean;
}

function entry(word: string): Entry | null {
  const raw = lexicon?.get(word);
  if (raw === undefined) return null;
  const listed = !raw.startsWith('^');
  return { prons: (listed ? raw : raw.slice(1)).split(','), listed };
}

/** One pronunciation of the table as ARPAbet phones, stress digits on the vowels. */
export function decode(code: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    const p = SOUND_TO_CMU[c];
    if (!p) throw new Error(`Not a sound of the table: ${JSON.stringify(c)} in ${code}`);
    if (VOWEL_CHARS.includes(c)) {
      const s = code[i + 1] === '1' || code[i + 1] === '2' ? code[++i] : '0';
      out.push(p + s);
    } else out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------------------
// ARPAbet to Kokoro's symbols
// ---------------------------------------------------------------------------

const CONSONANT: Record<string, string> = {
  B: 'b', CH: 'ʧ', D: 'd', DH: 'ð', F: 'f', G: 'ɡ', HH: 'h', JH: 'ʤ', K: 'k', L: 'l', M: 'm', N: 'n', NG: 'ŋ', P: 'p', R: 'ɹ',
  S: 's', SH: 'ʃ', T: 't', TH: 'θ', V: 'v', W: 'w', Y: 'j', Z: 'z', ZH: 'ʒ',
};
const isVowel = (p: string | undefined): boolean => !!p && /\d$/.test(p);
const bare = (p: string): string => p.replace(/\d$/, '');

interface Spelling {
  text: string;
  start: number;
  end: number;
}

/** The vowel letters of a spelling in groups (a "y" that starts a word before a vowel is a consonant). */
function vowelGroups(w: string): Spelling[] {
  const groups: Spelling[] = [];
  for (const m of w.matchAll(/[aeiouy]+/g)) {
    let start = m.index ?? 0;
    let text = m[0];
    if (start === 0 && text[0] === 'y') {
      if (text.length === 1) continue;
      start = 1;
      text = text.slice(1);
    }
    groups.push({ text, start, end: start + text.length });
  }
  return groups;
}

/**
 * Which letters spell each vowel sound, where that can be told: the vowel groups, less silent
 * e's (a final one after a consonant, or one before -s, -d, -ly, -ment, -ness, -ful, -less), paired
 * in order when there are as many as there are vowel sounds. Otherwise nothing is paired and the
 * callers decide from the whole word.
 */
function spellings(w: string, phones: string[]): Array<Spelling | null> {
  const vowels = phones.flatMap((p, i) => (isVowel(p) ? [i] : []));
  let groups = vowelGroups(w);
  for (let k = groups.length - 1; k > 0 && groups.length > vowels.length; k--) {
    const g = groups[k];
    // "gone", "makes", "loved", "lovely", "statement": an e after a consonant, before nothing or a suffix.
    if (g.text === 'e' && /[^aeiouy]$/.test(w.slice(0, g.start)) && /^(|s|d|ly|ment|ness|ful|less)$/.test(w.slice(g.end))) {
      groups = groups.filter((_, j) => j !== k);
    }
  }
  const out: Array<Spelling | null> = phones.map(() => null);
  if (groups.length === vowels.length) vowels.forEach((pi, k) => (out[pi] = groups[k]));
  return out;
}

/** Inflected forms that keep a stem's vowel: bath, baths, bathed, dancing, glassy. */
function stemIn(set: ReadonlySet<string>, w: string): boolean {
  if (set.has(w)) return true;
  for (const suffix of ['s', 'es', 'ed', 'd', 'ing', 'er', 'ers', 'est', 'ly', 'y', 'ful']) {
    if (!w.endsWith(suffix) || w.length - suffix.length < 3) continue;
    const stem = w.slice(0, -suffix.length);
    if (set.has(stem) || set.has(`${stem}e`) || (stem.endsWith('i') && set.has(`${stem.slice(0, -1)}y`))) return true;
  }
  return false;
}

/**
 * Words whose stressed "a" is the long vowel of "bath" in the south of England (Wells's BATH
 * set), where the dictionary, being American, has the short vowel of "trap". Common words only.
 */
const BATH = new Set([
  'advance', 'advantage', 'after', 'afternoon', 'afterward', 'afterwards', 'aghast', 'answer', 'ask', 'aunt', 'banana', 'basket', 'bath', 'blast',
  'branch', 'brass', 'calf', 'calves', "can't", 'cast', 'castle', 'chaff', 'chance', 'chancellor', 'chant', 'class', 'clasp', 'command', 'commander',
  'contrast', 'craft', 'dance', 'demand', 'disaster', 'draft', 'draught', 'enhance', 'example', 'fast', 'fasten', 'flask', 'france', 'gasp',
  'ghastly', 'glance', 'glass', 'graft', 'grant', 'grasp', 'grass', 'half', 'halves', 'lance', 'last', 'laugh', 'laughter', 'mask', 'mast',
  'master', 'nasty', 'pass', 'past', 'pastor', 'path', 'plant', 'plaster', 'prance', 'raft', 'rafter', 'rascal', 'rasp', 'rather', 'sample',
  'shaft', "shan't", 'slant', 'staff', 'task', 'vast',
]);

/** Words whose stressed vowel before r and a vowel is that of "hurry" (ʌɹ), not of "furry" (ɜːɹ). */
const HURRY = new Set([
  'borough', 'burrow', 'courage', 'curry', 'currant', 'current', 'currency', 'discourage', 'encourage', 'flourish', 'flurry', 'furrow',
  'hurry', 'nourish', 'scurry', 'surrey', 'thorough', 'turret', 'worry',
]);

/** "au" said as in "because", not as in "caught". */
const CLOTH_AU = new Set(['because', 'sausage', 'sausages', 'laurel', 'laurels', 'austria', 'australia', 'australian', 'cauliflower', 'laurence', 'lawrence', 'maurice']);

/** Is the a of this vowel group written after w, wh or qu ("want", "what", "quality")? */
function afterW(w: string, g: Spelling): boolean {
  return /(w|wh|qu)$/.test(w.slice(0, g.start + g.text.indexOf('a')));
}

/**
 * Spelt au, aw or ought: the dictionary sometimes writes these AA (it merges "caught" and "cot",
 * as much of America does); British speech keeps the vowel of "thought" (bought, caught, dawn).
 */
function thoughtSpelling(g: Spelling | null, w: string): boolean {
  if (CLOTH_AU.has(w)) return false;
  if (g) return /au|aw/.test(g.text) || (g.text.startsWith('ou') && w.slice(g.end).startsWith('ght'));
  return /au|aw|ought/.test(w);
}

/** The vowel the dictionary writes AA: that of "lot" (ɒ) when spelt with o, or a after w or qu; otherwise that of "father". */
function lotVowel(g: Spelling | null, w: string): boolean {
  if (g) {
    if (g.text.includes('o')) return true;
    if (g.text.includes('a')) return afterW(w, g);
    return true;
  }
  return w.includes('o') || /(w|qu)a/.test(w);
}

/** The vowel the dictionary writes AO: that of "lot" (dog, cross, gone, cough), not of "thought" (law, caught, all, water, thought). */
function clothVowel(g: Spelling | null, w: string): boolean {
  if (CLOTH_AU.has(w)) return true;
  if (g) {
    // An a after w or qu is the vowel of "lot" ("want", "wash", "squad"), except before l
    // ("walk", "wall") and in "water".
    if (g.text === 'a' && afterW(w, g)) return !/^l(k|l|ls|t)?$|^l(k|t)/.test(w.slice(g.end)) && !w.startsWith('water');
    if (g.text.includes('a')) return false;
    if (g.text.startsWith('ou')) return !w.slice(g.end).startsWith('ght');
    return g.text.startsWith('o');
  }
  return !w.includes('a') && !w.includes('ought');
}

/**
 * The reduced vowel of the endings -ed after t or d ("blunted"), -es after a hissing sound
 * ("verses") and -est ("comest"): the dictionary writes AH0, British speech says ɪ.
 */
function britishIEnding(phones: string[], i: number): boolean {
  const tail = phones.slice(i + 1).join(' ');
  const prev = bare(phones[i - 1] ?? '');
  if (tail === 'D') return prev === 'T' || prev === 'D';
  if (tail === 'Z') return SIBILANT.has(prev);
  return tail === 'S T';
}

/** A reduced vowel that is only the sound of the l or n after it: "little" lˈɪtᵊl, "button" bˈʌtᵊn. */
function syllabicSchwa(phones: string[], i: number): boolean {
  const prev = phones[i - 1];
  const next = phones[i + 1];
  if (!prev || isVowel(prev) || !next) return false;
  const after = phones[i + 2];
  if (next === 'L') return !after || (!isVowel(after) && after !== 'Y');
  if (next === 'N' && (prev === 'T' || prev === 'D')) return !after || (phones.length === i + 3 && (after === 'Z' || after === 'D' || after === 'T'));
  return false;
}

export interface Said {
  /** In Kokoro's symbols. */
  ps: string;
  /** Ends where an r was left unsaid: the next word, if it starts with a vowel, brings it back ("for ever"). */
  endsR: boolean;
}

/** ARPAbet phones (with stress) to a British reading in Kokoro's symbols. `w` is the spelling, for the vowels the dictionary does not tell apart. */
export function britishFromCmu(phones: string[], w: string): Said {
  const spelt = spellings(w, phones);
  const bath = stemIn(BATH, w);
  const hurry = stemIn(HURRY, w);
  let out = '';
  let endsR = false;
  for (let i = 0; i < phones.length; i++) {
    const p = phones[i];
    if (!isVowel(p)) {
      if (p === 'R') {
        if (isVowel(phones[i + 1])) out += 'ɹ';
        else if (i === phones.length - 1) endsR = true;
        continue;
      }
      out += CONSONANT[p] ?? '';
      continue;
    }
    const v = bare(p);
    const s = Number(p.slice(-1));
    const mark = s === 1 ? 'ˈ' : s === 2 ? 'ˌ' : '';
    const next = phones[i + 1];
    const after = phones[i + 2];
    const rColoured = next === 'R' && !isVowel(after);
    const rVowel = next === 'R' && isVowel(after);
    const g = spelt[i];
    let sym: string;
    switch (v) {
      case 'AA':
        sym = rColoured ? 'ɑː' : thoughtSpelling(g, w) ? 'ɔː' : lotVowel(g, w) ? 'ɒ' : 'ɑː';
        break;
      case 'AO':
        sym = rColoured ? 'ɔː' : rVowel ? (g && w.slice(g.end).startsWith('rr') ? 'ɒ' : 'ɔː') : clothVowel(g, w) ? 'ɒ' : 'ɔː';
        break;
      case 'AE':
        sym = rColoured ? 'ɑː' : s > 0 && bath ? 'ɑː' : 'a';
        break;
      case 'AH':
        if (s === 0 && britishIEnding(phones, i)) {
          sym = 'ɪ';
          break;
        }
        // Stressed and spelt a after w ("what", "was"): the vowel of "lot" in British speech.
        if (s > 0 && !rColoured && (CLOTH_AU.has(w) || (g?.text === 'a' && afterW(w, g)))) sym = 'ɒ';
        else sym = rColoured ? 'ɜː' : s > 0 ? 'ʌ' : syllabicSchwa(phones, i) ? 'ᵊ' : 'ə';
        break;
      case 'AW':
        sym = rColoured ? 'Wə' : 'W';
        break;
      case 'AY':
        sym = rColoured ? 'Iə' : 'I';
        break;
      case 'EH':
        sym = rColoured ? 'ɛː' : rVowel && g && g.text.includes('a') ? 'ɛː' : 'ɛ';
        break;
      case 'ER':
        if (isVowel(next)) sym = s > 0 ? (hurry ? 'ʌɹ' : 'ɜːɹ') : 'əɹ';
        else {
          sym = s > 0 ? 'ɜː' : 'ə';
          if (i === phones.length - 1) endsR = true;
        }
        break;
      case 'EY':
        sym = rColoured ? 'ɛː' : 'A';
        break;
      case 'IH':
        sym = rColoured ? 'ɪə' : rVowel && g && g.text.includes('e') ? 'ɪə' : 'ɪ';
        break;
      case 'IY':
        sym = rColoured || rVowel ? 'ɪə' : s > 0 ? 'iː' : 'i';
        break;
      case 'OW':
        sym = rColoured ? 'ɔː' : 'Q';
        break;
      case 'OY':
        sym = rColoured ? 'Yə' : 'Y';
        break;
      case 'UH':
        sym = rColoured || rVowel ? 'ʊə' : 'ʊ';
        break;
      case 'UW':
        sym = rColoured || rVowel ? 'ʊə' : s > 0 ? 'uː' : 'u';
        break;
      default:
        sym = 'ə';
    }
    out += mark + sym;
    if (rColoured) {
      if (i + 1 === phones.length - 1) endsR = true;
      i++;
    }
  }
  return { ps: out, endsR };
}

/** The same for an American voice: misaki's American symbols (æ, O, ɑ, ɔ), r always said. */
export function americanFromCmu(phones: string[]): Said {
  const V: Record<string, string> = { AA: 'ɑ', AE: 'æ', AO: 'ɔ', AW: 'W', AY: 'I', EH: 'ɛ', EY: 'A', IH: 'ɪ', IY: 'i', OW: 'O', OY: 'Y', UH: 'ʊ', UW: 'u' };
  let out = '';
  for (let i = 0; i < phones.length; i++) {
    const p = phones[i];
    if (!isVowel(p)) {
      out += CONSONANT[p] ?? '';
      continue;
    }
    const v = bare(p);
    const s = Number(p.slice(-1));
    const mark = s === 1 ? 'ˈ' : s === 2 ? 'ˌ' : '';
    if (v === 'ER') out += mark + (s > 0 ? 'ɜɹ' : 'əɹ');
    else if (v === 'AH') out += mark + (s > 0 ? 'ʌ' : syllabicSchwa(phones, i) ? 'ᵊ' : 'ə');
    else out += mark + V[v];
  }
  return { ps: out, endsR: false };
}

// ---------------------------------------------------------------------------
// Words that depend on the words around them
// ---------------------------------------------------------------------------

/**
 * Little words said weak, as running speech says them ("the" ðə, "of" əv), and strong at the end
 * of a phrase ("what art thou?"). British forms; [weak, strong, ends with an unsaid r].
 * Measured (docs/voice/G2P-MEASUREMENT.md, the development verses): thy, thou, thee and thine
 * said with no stress were heard as "the", "they're", "then"; "and" as ənd was heard as "in".
 * So the old pronouns keep a stress and "and" its vowel.
 */
const FUNCTION_GB: Record<string, [string, string, boolean?]> = {
  a: ['ɐ', 'ˈA'], an: ['ɐn', 'ˈan'], the: ['ðə', 'ðˈiː'], and: ['and', 'ˈand'], of: ['əv', 'ˈɒv'], to: ['tə', 'tˈuː'],
  at: ['ɐt', 'ˈat'], as: ['ɐz', 'ˈaz'], for: ['fɔː', 'fˈɔː', true], from: ['fɹɒm', 'fɹˈɒm'], or: ['ɔː', 'ˈɔː', true],
  nor: ['nɔː', 'nˈɔː', true], in: ['ɪn', 'ˈɪn'], on: ['ɒn', 'ˈɒn'], is: ['ɪz', 'ˈɪz'], it: ['ɪt', 'ˈɪt'], its: ['ɪts', 'ˈɪts'],
  "it's": ['ɪts', 'ˈɪts'], was: ['wɒz', 'wˈɒz'], were: ['wɜː', 'wˈɜː', true], are: ['ɑː', 'ˈɑː', true], am: ['am', 'ˈam'],
  be: ['biː', 'bˈiː'], been: ['biːn', 'bˈiːn'], but: ['bʌt', 'bˈʌt'], by: ['bI', 'bˈI'], with: ['wɪð', 'wˈɪð'],
  than: ['ðan', 'ðˈan'], that: ['ðat', 'ðˈat'], his: ['hɪz', 'hˈɪz'], her: ['hɜː', 'hˈɜː', true], him: ['hɪm', 'hˈɪm'],
  he: ['hiː', 'hˈiː'], she: ['ʃiː', 'ʃˈiː'], we: ['wiː', 'wˈiː'], me: ['miː', 'mˈiː'], you: ['juː', 'jˈuː'],
  your: ['jɔː', 'jˈɔː', true], my: ['mI', 'mˈI'], thy: ['ðˌI', 'ðˈI'], thee: ['ðˌiː', 'ðˈiː'], thou: ['ðˈW', 'ðˈW'],
  thine: ['ðˌIn', 'ðˈIn'], our: ['Wə', 'ˈWə', true], us: ['ʌs', 'ˈʌs'], them: ['ðɛm', 'ðˈɛm'], they: ['ðA', 'ðˈA'],
  their: ['ðɛː', 'ðˈɛː', true], can: ['kan', 'kˈan'], could: ['kʊd', 'kˈʊd'], will: ['wɪl', 'wˈɪl'], would: ['wʊd', 'wˈʊd'],
  shall: ['ʃal', 'ʃˈal'], should: ['ʃʊd', 'ʃˈʊd'], must: ['mʌst', 'mˈʌst'], do: ['duː', 'dˈuː'], does: ['dʌz', 'dˈʌz'],
  did: ['dɪd', 'dˈɪd'], has: ['haz', 'hˈaz'], have: ['hav', 'hˈav'], had: ['had', 'hˈad'], hath: ['haθ', 'hˈaθ'],
  doth: ['dʌθ', 'dˈʌθ'], i: ['ˌI', 'ˈI'], o: ['ˈQ', 'ˈQ'], if: ['ɪf', 'ˈɪf'],
};

const MODALS = ['to', 'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must', 'not', "don't", "didn't", "won't", 'cannot', "can't", 'i', 'we', 'they', 'you', 'thou'];
const SUBJECTS = ['he', 'she', 'it', 'who', 'that', 'which', 'one', 'there'];
const DETERMINERS = ['a', 'an', 'the', 'no', 'of', 'any', 'what', 'its', 'my', 'thy', 'his', 'her', 'their', 'our', 'your', 'some', 'much', 'good', 'little', 'this', 'that'];

/**
 * The few words whose two readings differ in sound and are both common in verse. The dictionary
 * lists its commonest reading first; these choose by the word before or after. Returns a pattern
 * the chosen pronunciation (table notation) must match, or null for the dictionary's first.
 */
function heteronym(w: string, prev: string, next: string): RegExp | null {
  switch (w) {
    case 'wind':
    case 'winds':
      return MODALS.includes(prev) || ['up', 'down', 'round', 'around'].includes(next) ? /Y1/ : /i1/;
    case 'tear':
    case 'tears':
      return MODALS.includes(prev) || SUBJECTS.includes(prev) || ['up', 'down', 'apart', 'off', 'out', 'away', 'open', 'through', 'into', 'asunder'].includes(next) ? /e1/ : /i1/;
    case 'live':
      return ['a', 'the', 'is', 'are', 'was', 'were'].includes(prev) ? /Y1/ : /i1/;
    case 'lives':
      return SUBJECTS.includes(prev) ? /i1/ : /Y1/;
    case 'read':
      return ['had', 'have', 'has', 'having', 'was', 'were', 'been', 'be', 'is', 'are'].includes(prev) ? /e1/ : /I1/;
    case 'lead':
      return ['of', 'like', 'as'].includes(prev) ? /e1/ : /I1/;
    case 'use':
      return DETERMINERS.includes(prev) ? /w1s$/ : /w1z$/;
    case 'wound':
      return ['had', 'have', 'has', 'was', 'were', 'is', 'are', 'be', 'been', 'got'].includes(prev) || ['up', 'down', 'round', 'around', 'tight'].includes(next) ? /W1/ : /w1/;
    case 'close':
      return MODALS.includes(prev) || ['the', 'thy', 'my', 'his', 'her', 'your', 'their', 'our', 'its', 'thine', 'mine'].includes(next) ? /z$/ : /s$/;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Words the table lacks
// ---------------------------------------------------------------------------

const LETTER_NAMES: Record<string, string[]> = {
  a: ['EY1'], b: ['B', 'IY1'], c: ['S', 'IY1'], d: ['D', 'IY1'], e: ['IY1'], f: ['EH1', 'F'], g: ['JH', 'IY1'], h: ['EY1', 'CH'],
  i: ['AY1'], j: ['JH', 'EY1'], k: ['K', 'EY1'], l: ['EH1', 'L'], m: ['EH1', 'M'], n: ['EH1', 'N'], o: ['OW1'], p: ['P', 'IY1'],
  q: ['K', 'Y', 'UW1'], r: ['AA1', 'R'], s: ['EH1', 'S'], t: ['T', 'IY1'], u: ['Y', 'UW1'], v: ['V', 'IY1'],
  w: ['D', 'AH1', 'B', 'AH0', 'L', 'Y', 'UW0'], x: ['EH1', 'K', 'S'], y: ['W', 'AY1'], z: ['Z', 'EH1', 'D'],
};

/** The sounds of consonant letters, for a held sound with no vowel letter (skrrt, pssst, shhh). */
const HELD_CONSONANTS: Array<[string, string[]]> = [
  ['sh', ['SH']], ['ch', ['CH']], ['th', ['TH']], ['ng', ['NG']], ['ck', ['K']], ['ph', ['F']], ['x', ['K', 'S']], ['c', ['K']], ['q', ['K']], ['j', ['JH']],
  ['b', ['B']], ['d', ['D']], ['f', ['F']], ['g', ['G']], ['h', ['HH']], ['k', ['K']], ['l', ['L']], ['m', ['M']], ['n', ['N']], ['p', ['P']],
  ['s', ['S']], ['t', ['T']], ['v', ['V']], ['w', ['W']], ['z', ['Z']],
];

/**
 * A word with no vowel letter and no y: the r's of brrr and skrrt are the vowel of "her" (ɜː);
 * hmm and mmm are a hum on m; anything else is its consonants, a held one lengthened (shhh ʃː).
 */
export function heldSound(w: string): string {
  // A drawn-out letter counts once or twice (shhh is sh held, not s and three h's).
  const letters = w.replace(/([sct])h+/g, '$1h').replace(/(.)\1+/g, '$1$1');
  const r = letters.indexOf('r');
  const read = (s: string): string[] => {
    const out: string[] = [];
    for (let i = 0; i < s.length; ) {
      if (s[i] === 'r') {
        i++;
        continue;
      }
      const hit = HELD_CONSONANTS.find(([k]) => s.startsWith(k, i));
      if (hit) {
        if (out[out.length - 1] !== hit[1][hit[1].length - 1]) out.push(...hit[1]);
        i += hit[0].length;
      } else i++;
    }
    return out;
  };
  const sym = (ps: string[]): string => ps.map((p) => CONSONANT[p] ?? '').join('');
  if (r >= 0) return `${sym(read(letters.slice(0, r)))}ˈɜː${sym(read(letters.slice(r).replace(/^r+/, '')))}`;
  const ps = read(letters);
  const hum = ps.findIndex((p) => p === 'M' || p === 'N' || p === 'L');
  if (hum >= 0) return `${sym(ps.slice(0, hum))}ˈᵊ${sym(ps.slice(hum))}`;
  const s = sym(ps);
  return /(.)\1/.test(w) && s.length <= 2 ? `${s}ː` : s;
}

const PREFIXES: Array<[string, string[]]> = [
  ['counter', ['K', 'AW2', 'N', 'T', 'ER0']], ['under', ['AH2', 'N', 'D', 'ER0']], ['super', ['S', 'UW2', 'P', 'ER0']],
  ['inter', ['IH2', 'N', 'T', 'ER0']], ['over', ['OW2', 'V', 'ER0']], ['anti', ['AE2', 'N', 'T', 'IY0']], ['fore', ['F', 'AO2', 'R']],
  ['out', ['AW2', 'T']], ['mis', ['M', 'IH2', 'S']], ['dis', ['D', 'IH2', 'S']], ['non', ['N', 'AA2', 'N']], ['pre', ['P', 'R', 'IY2']],
  ['un', ['AH2', 'N']], ['re', ['R', 'IY2']], ['up', ['AH2', 'P']], ['be', ['B', 'IH0']], ['en', ['IH0', 'N']],
];

/** Suffixes that add sounds of their own to a stem the table has. */
const SUFFIXES: Array<[string, string[]]> = [
  ['ness', ['N', 'AH0', 'S']], ['less', ['L', 'AH0', 'S']], ['ment', ['M', 'AH0', 'N', 'T']], ['ful', ['F', 'AH0', 'L']],
  ['able', ['AH0', 'B', 'AH0', 'L']], ['ers', ['ER0', 'Z']], ['est', ['AH0', 'S', 'T']], ['ish', ['IH0', 'SH']], ['ly', ['L', 'IY0']],
  ['er', ['ER0']], ['ing', ['IH0', 'NG']], ['dom', ['D', 'AH0', 'M']], ['hood', ['HH', 'UH2', 'D']], ['ship', ['SH', 'IH2', 'P']],
  ['like', ['L', 'AY2', 'K']], ['wise', ['W', 'AY2', 'Z']], ['wards', ['W', 'ER0', 'D', 'Z']], ['ward', ['W', 'ER0', 'D']], ['y', ['IY0']],
];

const VOICELESS = new Set(['P', 'T', 'K', 'F', 'TH']);
const SIBILANT = new Set(['S', 'Z', 'SH', 'ZH', 'CH', 'JH']);

/** -s: s after a voiceless sound, ɪz after a hissing one, z otherwise. */
function plural(phones: string[]): string[] {
  const last = bare(phones[phones.length - 1] ?? '');
  if (SIBILANT.has(last)) return [...phones, 'IH0', 'Z'];
  return [...phones, VOICELESS.has(last) ? 'S' : 'Z'];
}

/** -ed: ɪd after t or d, t after a voiceless sound, d otherwise. */
function past(phones: string[]): string[] {
  const last = bare(phones[phones.length - 1] ?? '');
  if (last === 'T' || last === 'D') return [...phones, 'IH0', 'D'];
  return [...phones, VOICELESS.has(last) || (SIBILANT.has(last) && last !== 'Z' && last !== 'ZH' && last !== 'JH') ? 'T' : 'D'];
}

/** A second part's main stress becomes secondary: in "nightlong" the stress is on night. */
const demote = (phones: string[]): string[] => phones.map((p) => p.replace(/1$/, '2'));

function known(w: string): string[] | null {
  const e = entry(w) ?? entry(w.replace(/^'+/, ''));
  return e ? decode(e.prons[0]) : null;
}

/** Stems a suffix may have been added to: as written, with a doubled consonant undone, with e put back, y for i. */
function stems(stem: string): string[] {
  const out = [stem];
  if (/([bdfgklmnprstvz])\1$/.test(stem)) out.push(stem.slice(0, -1));
  out.push(`${stem}e`);
  if (stem.endsWith('i')) out.push(`${stem.slice(0, -1)}y`);
  return out;
}

/**
 * The stem a suffix was added to, of `stems(stem)`: one the table has whole before any it can
 * only take apart. In that order "loveli(ness)" is lovely, not "lovelie", love and lie.
 */
function stemReading(stem: string, depth: number): string[] | null {
  const candidates = stems(stem);
  for (const s of candidates) {
    const whole = known(s);
    if (whole) return whole;
  }
  for (const s of candidates) {
    const parts = morphology(s, depth + 1);
    if (parts) return parts;
  }
  return null;
}

/** A word the table lacks, taken apart into words it has. Depth-limited: a part may itself be taken apart once. */
export function morphology(w: string, depth = 0): string[] | null {
  if (depth > 1 || w.length < 3) return null;
  const sub = (x: string): string[] | null => known(x) ?? morphology(x, depth + 1);
  // Dropped g: runnin', bussin -> running, bussing, with n for ng.
  for (const tail of ["in'", 'in']) {
    if (w.endsWith(tail) && w.length > tail.length + 2) {
      const full = sub(`${w.slice(0, -tail.length)}ing`);
      if (full && full[full.length - 1] === 'NG') return [...full.slice(0, -1), 'N'];
    }
  }
  // Juliet's, players' (the apostrophe after the s: the plural's own s).
  if (w.endsWith("'s")) {
    const base = sub(w.slice(0, -2));
    if (base) return plural(base);
  }
  if (w.endsWith("s'")) {
    const base = sub(w.slice(0, -1));
    if (base) return base;
  }
  if (w.endsWith("'em")) {
    const base = sub(w.slice(0, -3));
    if (base) return [...base, 'AH0', 'M'];
  }
  if (w.endsWith('es') && /(s|x|z|ch|sh)es$/.test(w)) {
    const base = sub(w.slice(0, -2));
    if (base) return plural(base);
  }
  if (w.endsWith('s') && !w.endsWith('ss')) {
    const base = stemReading(w.slice(0, -1), depth);
    if (base) return plural(base);
  }
  if (w.endsWith('ed')) {
    const base = stemReading(w.slice(0, -2), depth);
    if (base) return past(base);
  }
  for (const [suffix, sounds] of SUFFIXES) {
    if (!w.endsWith(suffix) || w.length - suffix.length < 3) continue;
    const base = stemReading(w.slice(0, -suffix.length), depth);
    if (base) return [...base, ...sounds];
  }
  for (const [prefix, sounds] of PREFIXES) {
    if (!w.startsWith(prefix) || w.length - prefix.length < 3) continue;
    const rest = sub(w.slice(prefix.length));
    if (rest) return [...sounds, ...rest];
  }
  // Two words, each in SCOWL's lists and three letters or more: the longest first part wins.
  for (let i = w.length - 3; i >= 3; i--) {
    const a = entry(w.slice(0, i));
    const b = entry(w.slice(i));
    if (a?.listed && b?.listed) return [...decode(a.prons[0]), ...demote(decode(b.prons[0]))];
  }
  return null;
}

// ---------------------------------------------------------------------------
// One word
// ---------------------------------------------------------------------------

export type Source = 'table' | 'little' | 'parts' | 'rules' | 'held' | 'letters';

export interface WordReading extends Said {
  word: string;
  source: Source;
}

const stripMarks = (w: string): string => w.normalize('NFD').replace(/\p{M}+/gu, '');

/**
 * How one word is said. `prev` and `next` are the words beside it in the same phrase (lower
 * case, '' at a phrase's edge); `phraseEnd` says nothing follows it before a pause.
 */
export function sayWord(word: string, { prev = '', next = '', phraseEnd = false, british = true, spelt = false } = {}): WordReading {
  const w = stripMarks(word).toLowerCase();
  const map = (phones: string[]): Said => (british ? britishFromCmu(phones, w) : americanFromCmu(phones));
  // One of a row of capital letters said one by one ("A M" of a time, "A B C"): the letter's name, not "a".
  if (spelt) return { word, ...spellOut(w, british), source: 'letters' };
  // Own keys only: "constructor" is a word too.
  const little = Object.hasOwn(FUNCTION_GB, w) ? FUNCTION_GB[w] : undefined;
  if (little && british) {
    const [weak, strong, r] = little;
    return { word, ps: phraseEnd ? strong : weak, endsR: !!r, source: 'little' };
  }
  const e = entry(w) ?? entry(w.replace(/^'+/, '')) ?? entry(w.replace(/'+$/, ''));
  if (e) {
    const pattern = heteronym(w, prev, next);
    const pron = (pattern && e.prons.find((p) => pattern.test(p))) || unflapped(w, e.prons);
    const said = map(decode(pron));
    if (!british && Object.hasOwn(FUNCTION_GB, w)) said.ps = said.ps.replace(/[ˈˌ]/g, '');
    return { word, ...said, source: 'table' };
  }
  // Capitals of three letters or fewer that the table lacks are an abbreviation, said letter by
  // letter; a longer word in capitals is shouted ("BUSSIN", "SKRRT") and read as a word.
  const caps = word === word.toUpperCase() && /^[A-Z]+$/.test(stripMarks(word));
  if (w.length === 1 || (caps && w.length <= 3)) return { word, ...spellOut(w, british), source: 'letters' };
  if (!/[aeiouy]/.test(w)) return { word, ps: heldSound(w), endsR: false, source: 'held' };
  const parts = morphology(w);
  if (parts) return { word, ...map(parts), source: 'parts' };
  return { word, ...map(letterToSound(w.replace(/[^a-z']/g, ''))), source: 'rules' };
}

/**
 * The dictionary's first reading, unless it is an American one that says a written t as d or
 * drops it ("thirty" TH ER1 D IY0, "twenty" T W EH1 N IY0) and another reading keeps the t: a
 * British voice says the t.
 */
function unflapped(w: string, prons: string[]): string {
  const first = prons[0];
  const ts = (p: string): number => (p.match(/t/g) ?? []).length;
  const letters = (w.match(/t(?!h)/g) ?? []).length;
  if (prons.length < 2 || ts(first) >= letters) return first;
  const keeps = prons.find((p) => ts(p) > ts(first) && Math.abs(p.length - first.length) <= 1);
  return keeps ?? first;
}

/** Letters said one by one, each with its own stress. */
function spellOut(w: string, british: boolean): Said {
  const ps = [...w]
    .map((ch) => (Object.hasOwn(LETTER_NAMES, ch) ? LETTER_NAMES[ch] : undefined))
    .filter(Boolean)
    .map((phones) => (british ? britishFromCmu(phones, 'x') : americanFromCmu(phones)).ps)
    .join(' ');
  return { ps, endsR: false };
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const SCALES: Array<[number, string]> = [[1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']];

/** A whole number in words, British style ("one hundred and five"). */
export function numberWords(n: number): string {
  if (!Number.isFinite(n)) return '';
  if (n < 0) return `minus ${numberWords(-n)}`;
  n = Math.floor(n);
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : '');
  if (n < 1000) return `${ONES[Math.floor(n / 100)]} hundred${n % 100 ? ` and ${numberWords(n % 100)}` : ''}`;
  for (const [size, name] of SCALES) {
    if (n >= size) {
      const rest = n % size;
      return `${numberWords(Math.floor(n / size))} ${name}${rest ? (rest < 100 ? ' and ' : ' ') + numberWords(rest) : ''}`;
    }
  }
  return String(n);
}

const ORDINAL_WORDS: Record<string, string> = {
  one: 'first', two: 'second', three: 'third', five: 'fifth', eight: 'eighth', nine: 'ninth', twelve: 'twelfth',
};
export function ordinalWords(n: number): string {
  const words = numberWords(n);
  const m = /([a-z]+)$/.exec(words);
  if (!m) return words;
  const last = m[1];
  const ord = ORDINAL_WORDS[last] ?? (last.endsWith('y') ? `${last.slice(0, -1)}ieth` : `${last}th`);
  return words.slice(0, -last.length) + ord;
}

/** A year as said: 1599 "fifteen ninety-nine", 1900 "nineteen hundred", 1605 "sixteen oh five", 2026 "twenty twenty-six". */
function yearWords(y: number): string {
  if (y >= 2000 && y < 2010) return numberWords(y);
  const hi = Math.floor(y / 100);
  const lo = y % 100;
  if (lo === 0) return `${numberWords(hi)} hundred`;
  return `${numberWords(hi)} ${lo < 10 ? `oh ${ONES[lo]}` : numberWords(lo)}`;
}

/** A run of digits as said: a year in a year's range, a whole number, or digit by digit after a leading 0. */
function numberSaid(m: string): string {
  const n = Number(m.replace(/,/g, ''));
  if (/^0\d/.test(m)) return [...m].map((d) => (d === '0' ? 'oh' : ONES[Number(d)])).join(' ');
  if (/^\d{4}$/.test(m) && ((n >= 1100 && n < 2000) || (n >= 2010 && n < 2100))) return yearWords(n);
  return numberWords(n);
}

/** A number's words made plural, as decades and counts are said: nineties, nineteen hundreds, sixes, tens. */
function pluralOf(words: string): string {
  if (words.endsWith('x')) return `${words}es`;
  if (words.endsWith('y')) return `${words.slice(0, -1)}ies`;
  return `${words}s`;
}

/**
 * A digit written for its sound inside a word ("gr8", "4ever", "2day", "any1"): the spellings it
 * stands for. Taken only when the whole word that results is in the table, so "2pac" stays two
 * and pac, and a code in capitals ("G8", "B2K") is never read this way.
 */
const DIGIT_SOUNDS: Record<string, string[]> = { '1': ['one', 'won'], '2': ['to', 'too'], '4': ['for', 'fore'], '8': ['ate', 'ait'] };

/** Letters and digits written as one word: "mp3", "B2K", "4ever", "1e9", "MP3s". */
function gluedWord(token: string): string {
  const digits = token.match(/\d/g) ?? [];
  const letters = token.replace(/\d/g, '');
  // Text-speak is written in small letters (a capital to start a line at most).
  if (lexicon && digits.length === 1 && /^[A-Z]?[a-z]+$/.test(letters) && (letters.length >= 2 || digits[0] === '8')) {
    for (const sound of DIGIT_SOUNDS[digits[0]] ?? []) {
      const word = token.replace(/\d/, sound).toLowerCase();
      if (lexicon.has(word)) return word;
    }
  }
  const runs = token.match(/\d+|[A-Za-z]+/g) ?? [];
  const out: string[] = [];
  for (let i = 0; i < runs.length; i++) {
    const r = runs[i];
    if (/^\d/.test(r)) {
      // "MP3s", "K9s": an s straight after the number is its plural.
      if (runs[i + 1] === 's') {
        out.push(pluralOf(numberSaid(r)));
        i++;
      } else out.push(numberSaid(r));
    } else if (!/[aeiouy]/i.test(r) && r.length <= 3) {
      // No vowel letter: letters said one by one ("mp" in "mp3" is M P, not a hum).
      out.push(r.toUpperCase());
    } else out.push(r);
  }
  return out.join(' ');
}

/** Given names kings, queens and popes are numbered under (not "Malcolm": Malcolm X is not the tenth). */
const REGNAL = new Set([
  'alexander', 'alfonso', 'amenhotep', 'anne', 'antiochus', 'benedict', 'boniface', 'carlos', 'casimir', 'charles', 'christian', 'clement',
  'constantine', 'cyrus', 'darius', 'david', 'duncan', 'edgar', 'edmund', 'edward', 'elizabeth', 'ferdinand', 'francis', 'frederick',
  'george', 'gregory', 'gustav', 'gustavus', 'harald', 'harold', 'henri', 'henry', 'innocent', 'isabella', 'ivan', 'james', 'john',
  'joseph', 'juan', 'leo', 'leopold', 'louis', 'manuel', 'mary', 'napoleon', 'nicholas', 'olaf', 'otto', 'paul', 'pedro', 'peter',
  'philip', 'pius', 'ptolemy', 'rama', 'rameses', 'ramesses', 'richard', 'robert', 'rudolf', 'selim', 'sigismund', 'stephen',
  'suleiman', 'thutmose', 'umberto', 'urban', 'victor', 'wilhelm', 'william', 'xerxes',
]);
/** Words a numbered part follows: Act III, Scene ii, Part I, Sonnet XVIII, World War II. */
const SECTION = new Set(['act', 'scene', 'part', 'book', 'chapter', 'canto', 'psalm', 'sonnet', 'volume', 'vol', 'episode', 'round', 'war', 'level', 'stage', 'phase', 'article', 'section']);

/** The value of a Roman numeral (strict form, 1 to 3999), or 0. */
function romanValue(s: string): number {
  const u = s.toUpperCase();
  if (!u || !/^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/.test(u)) return 0;
  const V: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let n = 0;
  for (let i = 0; i < u.length; i++) n += V[u[i]] < (V[u[i + 1]] ?? 0) ? -V[u[i]] : V[u[i]];
  return n;
}

/**
 * Roman numerals where they are numbers: after a king's or a pope's name an ordinal ("Henry VIII"
 * Henry the Eighth), after a part's name a cardinal ("Act III" act three, "Scene ii"), and after
 * another capitalised word a cardinal when it is two letters or more of I, V and X ("Rocky II";
 * not X's alone, which are kisses). A lone I is the pronoun unless the word before is a name of
 * that kind or a capitalised part's name and no small word follows ("Elizabeth I.", "Act I," but
 * "Henry I saw", "the war I fought"). Only on one line: a line's last word and the next line's
 * "I" are not a king and his number.
 */
function romanNumerals(t: string): string {
  return t.replace(/(^|[^\p{L}\p{M}'’])(\p{L}+)([ \t]+)([IVXLCDM]+|[ivx]+)(?![\p{L}\p{M}\d])(?=([ \t]+[a-z]+)?)/gmu, (all, pre: string, word: string, sp: string, num: string, after?: string) => {
    const n = romanValue(num);
    if (!n) return all;
    const lower = word.toLowerCase();
    const capital = /^\p{Lu}/u.test(word);
    const small = num === num.toLowerCase();
    const loneI = num.toUpperCase() === 'I';
    const smallWordNext = !!after && !/^[ \t]+(of|and)$/.test(after);
    if (capital && REGNAL.has(lower) && !small && n < 40) {
      if (loneI && smallWordNext) return all;
      if (num.length === 1 && !loneI && num !== 'V') return all;
      return `${pre}${word}${sp}the ${ordinalWords(n)}`;
    }
    if (SECTION.has(lower) && (n < 40 || !small)) {
      if (loneI && (!capital || smallWordNext)) return all;
      return `${pre}${word}${sp}${numberWords(n)}`;
    }
    if (capital && !small && num.length >= 2 && /^[IVX]+$/.test(num) && !/^X+$/.test(num) && n < 40) return `${pre}${word}${sp}${numberWords(n)}`;
    return all;
  });
}

const ABBREVIATIONS: Array<[RegExp, string]> = [
  [/\bMrs\.?(?=\s+[A-Z])/g, 'Missus'], [/\bMr\.?(?=\s+[A-Z])/g, 'Mister'], [/\bMs\.?(?=\s+[A-Z])/g, 'Miz'], [/\bDr\.(?=\s+[A-Z])/g, 'Doctor'],
  [/\bSt\.(?=\s+[A-Z])/g, 'Saint'], [/\bProf\.(?=\s+[A-Z])/g, 'Professor'], [/\bCapt\.(?=\s+[A-Z])/g, 'Captain'], [/\bSgt\.(?=\s+[A-Z])/g, 'Sergeant'],
  [/\bJr\.?(?=\W|$)/g, 'Junior'], [/\bvs\.?(?=\s)/gi, 'versus'], [/\betc\b\.?/gi, 'et cetera'], [/&c\./g, 'et cetera'], [/\be\.g\.(?=\s|$)/gi, 'for example'],
  [/\bi\.e\.(?=\s|$)/gi, 'that is'], [/\bNo\.(?=\s*\d)/g, 'number'],
];

/** Text as the voice should read it: words, and only the punctuation Kokoro knows. */
export function normalise(text: string): string {
  let t = text.normalize('NFKC');
  t = t.replace(/[‘’ʼʻ`]/g, "'").replace(/[«„]/g, '“').replace(/»/g, '”');
  t = t.replace(/\.{3,}/g, '…').replace(/\s*(?:--+|[–—―]|\s-\s)\s*/g, ' — ');
  for (const [re, to] of ABBREVIATIONS) t = t.replace(re, to);
  // An initial ("J. K.") is a letter, not the end of a sentence.
  t = t.replace(/\b([A-Z])\.(?=\s*[A-Z][.\s])/g, '$1 ');
  t = romanNumerals(t);
  t = t.replace(/[$£€](\d+(?:,\d{3})*)(?:\.(\d{1,2}))?/g, (_, whole: string, cents?: string) => {
    const n = Number(whole.replace(/,/g, ''));
    const unit = _.startsWith('$') ? 'dollar' : _.startsWith('£') ? 'pound' : 'euro';
    const main = `${numberWords(n)} ${unit}${n === 1 ? '' : 's'}`;
    if (!cents || Number(cents) === 0) return main;
    const c = Number(cents.padEnd(2, '0'));
    return `${main} and ${numberWords(c)} ${unit === 'pound' ? (c === 1 ? 'penny' : 'pence') : c === 1 ? 'cent' : 'cents'}`;
  });
  const clock = (h: string, m?: string): string => {
    const mm = Number(m ?? 0);
    if (!m) return numberWords(Number(h));
    return mm === 0 ? `${numberWords(Number(h))} o'clock` : `${numberWords(Number(h))} ${mm < 10 ? `oh ${ONES[mm]}` : numberWords(mm)}`;
  };
  // "10pm", "3am", "3:30 p.m.", "7 AM": the time, then the two letters.
  t = t.replace(/\b(\d{1,2})(?::(\d{2}))?\s?([AaPp])\.?\s?[Mm](\.?)(?![\p{L}\p{M}\d])/gu, (_, h: string, m: string | undefined, ap: string, dot: string) => `${m ? clock(h, m).replace(" o'clock", '') : clock(h)} ${ap.toUpperCase()} M${dot}`);
  t = t.replace(/\b(\d{1,2}):(\d{2})\b/g, (_, h: string, m: string) => clock(h, m));
  t = t.replace(/\b(\d+)(st|nd|rd|th)\b/gi, (_, n: string) => ordinalWords(Number(n)));
  t = t.replace(/(\d)-(?=\d)/g, '$1 to ');
  // A minus sign: "-5" at the start of a number, and the sign "−" wherever it is.
  t = t.replace(/(^|[\s(\[{"“'])-(?=\d)/g, '$1minus ').replace(/−/g, ' minus ');
  t = t.replace(/\b(\d+)%/g, '$1 percent');
  t = t.replace(/\b(\d+)\.(\d+)(?!\d)(?=([A-Za-z])?)/g, (_, a: string, b: string, letter?: string) => `${numberWords(Number(a))} point ${[...b].map((d) => ONES[Number(d)]).join(' ')}${letter ? ' ' : ''}`);
  // Decades and counts: "the 90s", "the '60s", "the 1990s", "top 10s".
  t = t.replace(/(?<![\p{L}\p{M}\d])'?(\d+)s(?![\p{L}\p{M}\d])/gu, (_, n: string) => pluralOf(numberSaid(n)));
  // Letters and digits written as one word, read before the digits alone so none is lost.
  t = t.replace(/(?<![\p{L}\p{M}\d])(?=[A-Za-z\d]*\d)(?=[A-Za-z\d]*[A-Za-z])[A-Za-z\d]+(?![\p{L}\p{M}\d])/gu, gluedWord);
  t = t.replace(/\b\d{1,3}(?:,\d{3})+\b|\b\d+\b/g, numberSaid);
  // Any digits still left (next to a letter of another script, or an underscore) are said too.
  t = t.replace(/\d+/g, (m: string) => ` ${numberSaid(m)} `);
  t = t.replace(/&/g, ' and ').replace(/\+/g, ' plus ').replace(/@/g, ' at ').replace(/%/g, ' percent ');
  t = t.replace(/[()[\]{}]/g, ', ');
  return t;
}

/** Kokoro's punctuation (its vocabulary has these and no others). */
const PUNCT = ';:,.!?—…"“”';
const CLOSING = ',.!?;:…”';
const ELIDED_START = /^'(tis|twas|twere|twill|twould|gainst|em|cause|til|neath|bout|round|fore|scuse|sup|nuff|n)$/i;

type Token = { kind: 'word'; text: string } | { kind: 'punct'; text: string };

/** Words and punctuation of one line of normalised text. */
function tokens(line: string): Token[] {
  const out: Token[] = [];
  const re = /[\p{L}\p{M}]+(?:'[\p{L}\p{M}]+)*'?|'[\p{L}]+|[;:,.!?—…"“”]|-/gu;
  for (const m of line.matchAll(re)) {
    let text = m[0];
    if (text === '-') continue;
    if (/^[\p{L}\p{M}']+$/u.test(text)) {
      if (text.startsWith("'") && !ELIDED_START.test(text.replace(/'$/, '')) && !(lexicon?.has(text.toLowerCase()) ?? false)) text = text.slice(1);
      if (text.endsWith("'") && !/(in|s)'$/i.test(text)) text = text.slice(0, -1);
      if (!text || text === "'") continue;
      out.push({ kind: 'word', text });
    } else out.push({ kind: 'punct', text });
  }
  return out;
}

/** The first symbol a reading starts with is a vowel (for "the" ði and "to" tʊ before one, and a kept r). */
const startsWithVowel = (ps: string): boolean => /^[ˈˌ]?[AIOQWYaeiouæɐɑɒɔəɛɜɪʊʌᵊ]/.test(ps);

export interface Phrase {
  /** The whole text in Kokoro's symbols. */
  ps: string;
  /** Each word as read. */
  words: WordReading[];
}

/**
 * English text to Kokoro's phonemes. Needs the table (loadVoiceLexicon or installVoiceLexicon):
 * without it every word would go to the letter rules, so this refuses.
 */
export function phonemizeEnglish(text: string, { british = true } = {}): Phrase {
  if (!lexicon) throw new Error('The voice pronunciation table is not loaded (loadVoiceLexicon).');
  const lines = normalise(text)
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    // A line of verse that ends with no punctuation ends with a pause.
    .map((l) => (/[;:,.!?—…"”]$/.test(l) ? l : `${l},`));
  if (lines.length) lines[lines.length - 1] = lines[lines.length - 1].replace(/,$/, '.');
  const toks = lines.flatMap((l) => tokens(l));
  const words: WordReading[] = [];
  const readings: Array<WordReading | null> = toks.map(() => null);
  const wordAt = (i: number): string => (toks[i]?.kind === 'word' ? toks[i].text.toLowerCase() : '');
  const capitalLetter = (i: number): boolean => toks[i]?.kind === 'word' && /^[A-Z]$/.test(toks[i].text);
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.kind !== 'word') continue;
    const phraseEnd = i + 1 >= toks.length || (toks[i + 1].kind === 'punct' && CLOSING.includes(toks[i + 1].text)) || toks[i + 1].text === '—';
    const spelt = t.text === 'A' && capitalLetter(i + 1);
    readings[i] = sayWord(t.text, { prev: wordAt(i - 1), next: wordAt(i + 1), phraseEnd, british, spelt });
  }
  // "the" and "to" before a vowel; an r kept before a vowel.
  for (let i = 0; i < toks.length; i++) {
    const r = readings[i];
    const n = readings[i + 1];
    if (!r || !n) continue;
    const lower = r.word.toLowerCase();
    if (british && startsWithVowel(n.ps)) {
      if (lower === 'the' && r.ps === 'ðə') r.ps = 'ði';
      if (lower === 'to' && r.ps === 'tə') r.ps = 'tʊ';
      if (r.endsR) r.ps += 'ɹ';
    }
  }
  let out = '';
  let quoteOpen = false;
  for (let i = 0; i < toks.length; i++) {
    const r = readings[i];
    if (r) {
      words.push(r);
      if (!r.ps) continue;
      if (out && !/[\s“]$/.test(out)) out += ' ';
      out += r.ps;
      continue;
    }
    const p = toks[i].text;
    if (!PUNCT.includes(p)) continue;
    if (p === '"') {
      if (quoteOpen) out = out.trimEnd() + '”';
      else out += `${out && !out.endsWith(' ') ? ' ' : ''}“`;
      quoteOpen = !quoteOpen;
    } else if (p === '“') out += `${out && !out.endsWith(' ') ? ' ' : ''}“`;
    else if (p === '”') out = `${out.trimEnd()}”`;
    else if (p === '—') out = `${out.trimEnd()} —`;
    else {
      // Closing marks hold to the word before. Of two in a row the stronger stays: "word,." is
      // "word.", "word?," is "word?"; "?!" stays as written.
      const trimmed = out.trimEnd();
      const last = trimmed.slice(-1);
      if (!trimmed) out = '';
      else if (',;:'.includes(last)) out = trimmed.slice(0, -1) + p;
      else if ('.!?…'.includes(last) && ',;:'.includes(p)) out = trimmed;
      else out = trimmed + p;
    }
  }
  return { ps: out.replace(/\s+/g, ' ').replace(/^[\s,;:]+/, '').trim(), words };
}

/**
 * Kokoro reads at most 510 symbols at once (its tokenizer truncates at 512 with the two "$").
 * Long text is cut at the end of a sentence, else of a clause, else of a word, into pieces of
 * at most `max` symbols, each read on its own.
 */
export function splitForKokoro(ps: string, max = 400): string[] {
  const pieces: string[] = [];
  let rest = ps.trim();
  while (rest.length > max) {
    const head = rest.slice(0, max + 1);
    let cut = -1;
    for (const re of [/[.!?…]\s/g, /[,;:—]\s/g, /\s/g]) {
      for (const m of head.matchAll(re)) cut = (m.index ?? 0) + m[0].length - 1;
      if (cut > max / 4) break;
      cut = -1;
    }
    if (cut <= 0) cut = max;
    pieces.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) pieces.push(rest);
  return pieces;
}
