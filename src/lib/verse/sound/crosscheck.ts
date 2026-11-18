/**
 * The engine against espeak-ng: an independent check of the sound tables.
 *
 * The tables (./data) and most test sets come from Wiktionary. corpus/espeak.json
 * comes from neither: the commonest words of each language in subtitles, and the
 * phonemes espeak-ng (its own rules and dictionaries) gives them
 * (scripts/sound/espeak-check.py). Here both are read the same way: how many
 * syllables a word has, and which of them, counted from the start, is stressed.
 *
 * Agreement is not accuracy. Where the two differ, either may be wrong, and
 * some differences are by design: verse joins vowels that speech and espeak
 * split ("mio" is one syllable in Italian verse, two in espeak). PHONETICS.md
 * reports the figures with a reading of the disagreements. Used by the tests
 * and scripts only; nothing in the game imports it.
 */
import { stressedSyllable } from '../rhyme';
import { syllablesInLine } from '../text';

export interface EspeakWord {
  syllables: number;
  /** The syllable carrying the main stress, counted from the start and from the end (1 is the first, or the last); null when none is marked. */
  stress: { fromStart: number; fromEnd: number } | null;
}

const VOWEL = /[aeiouyæɑɒɐəɘɜɛɪɨʉʊʌɔøœɶɯɤʏɵɞɚɝ]/;
const HIGH = /^[iuyɪʊɨʉ]/;
/** Languages whose glides espeak-ng writes as full vowels. Elsewhere (Indonesian "si-a-pa", Hindi "भा-ई", Russian, Polish) two vowels side by side are two syllables. */
const GLIDES_AS_VOWELS = ['it', 'fr', 'pt'];

/**
 * One espeak-ng transcription (phonemes separated by "_") as syllables and stress.
 *
 * Read as espeak-ng writes it, with three of its habits taken into account (each seen in the
 * transcriptions, see PHONETICS.md): it writes the glide of a diphthong as a full vowel ("s_ˈɛ_i"
 * for Italian "sei", "s_y_ˈi" for French "suis") and marks a real hiatus with an empty phoneme
 * between the two vowels ("m_ˈi__o"), so an unstressed i, u or y joined to a vowel by a single
 * separator is a glide (in Italian, French and Portuguese only); a phoneme followed by "^" is a consonant's release, not a vowel (Russian
 * "дверь", "d_vʲ_ˈe_r_ɪ^"); and in Brazilian Portuguese the schwa it writes after a tap is the tap's
 * release ("certo", "s_ˈɛ_ɾ_ə_t_ʊ").
 */
export function readEspeak(ipa: string, lang = ''): EspeakWord {
  // Phonemes with the separators kept, so that "__" (hiatus) can be told from "_".
  const parts = ipa.replace(/\s+/g, '_').split('_');
  type Phone = { p: string; vowel: boolean; stressed: boolean; hiatusBefore: boolean };
  const phones: Phone[] = [];
  let empty = false;
  for (const raw of parts) {
    const p = raw.replace(/[-.]/g, '');
    if (!p) {
      empty = true;
      continue;
    }
    const bare = p.replace(/[ˈˌ]/g, '');
    const prev = phones[phones.length - 1];
    let vowel = (VOWEL.test(bare) && !bare.includes('^')) || /\u0329/.test(bare);
    if (lang === 'pt' && bare === 'ə' && prev?.p.replace(/[ˈˌ]/g, '') === 'ɾ') vowel = false;
    phones.push({ p, vowel, stressed: p.includes('ˈ'), hiatusBefore: empty });
    empty = false;
  }
  // A glide: an unstressed high vowel next to a vowel, with no hiatus between them.
  for (let i = 0; i < phones.length; i++) {
    const ph = phones[i];
    if (!GLIDES_AS_VOWELS.includes(lang) || !ph.vowel || ph.stressed || !HIGH.test(ph.p.replace(/[ˈˌ]/g, ''))) continue;
    const before = phones[i - 1];
    const after = phones[i + 1];
    if ((before?.vowel && !ph.hiatusBefore) || (after?.vowel && !after.hiatusBefore)) ph.vowel = false;
  }
  let syllables = 0;
  let stressedAt = -1;
  for (const ph of phones) {
    if (!ph.vowel) continue;
    if (ph.stressed) stressedAt = syllables;
    syllables++;
  }
  return { syllables, stress: stressedAt < 0 ? null : { fromStart: stressedAt + 1, fromEnd: syllables - stressedAt } };
}

/** Languages whose rules place a stress that can be compared (see stressedSyllable). */
export const STRESSED = ['es', 'it', 'pt', 'ru'];

export interface CrossReport {
  lang: string;
  words: number;
  /** Words whose syllable count the engine gives as espeak-ng does. */
  syllablesAgree: number;
  /** Words of two syllables or more (by espeak-ng) on which both name a stressed syllable. */
  stressCompared: number;
  /** Of those, the words where espeak-ng's stressed syllable is one the engine allows, counted from the start or from the end. */
  stressAgree: number;
  /** Words of two syllables or more on which the engine names no stress (a Russian word its table lacks). */
  stressUnknown: number;
  syllableMisses: Array<[string, number | null, number]>;
  stressMisses: Array<[string, string, string]>;
}

export function crossCheck(lang: string, words: Array<[string, string]>): CrossReport {
  const r: CrossReport = { lang, words: words.length, syllablesAgree: 0, stressCompared: 0, stressAgree: 0, stressUnknown: 0, syllableMisses: [], stressMisses: [] };
  for (const [word, ipa] of words) {
    const e = readEspeak(ipa, lang);
    const n = syllablesInLine(word, lang);
    if (n === e.syllables) r.syllablesAgree++;
    else r.syllableMisses.push([word, n, e.syllables]);
    if (!STRESSED.includes(lang) || e.syllables < 2 || e.stress === null) continue;
    const mine = stressedSyllable(word, lang);
    if (!mine || !mine.length) {
      r.stressUnknown++;
      continue;
    }
    r.stressCompared++;
    const s = e.stress;
    if (mine.some((m) => m.fromStart === s.fromStart || m.fromEnd === s.fromEnd)) r.stressAgree++;
    else r.stressMisses.push([word, mine.map((m) => `${m.fromStart}:${m.fromEnd}`).join('/'), `${s.fromStart}:${s.fromEnd}`]);
  }
  return r;
}
