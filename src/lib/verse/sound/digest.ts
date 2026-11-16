/**
 * One language's rhyme and syllable rules run over its test sets, reduced to
 * counts and a digest of every single answer.
 *
 * The digest is how determinism is checked: the same sets must give the same
 * digest in plain Node (scripts/sound/measure.mjs, which records it in
 * ./corpus/expected.json), under the unit-test runner, and in a real browser
 * (tests/sound.spec.ts). One differing answer anywhere changes it.
 */
import { formsFor, scoreForm } from '../forms';
import { getPack } from '../packs';
import { rhymeEnds, rhymes } from '../rhyme';
import { syllablesInLine } from '../text';

export interface RhymeCorpus {
  lang: string;
  /** The published poem the pairs are taken from. */
  poem: { title: string; author: string; year: number; form: string; source: string; fetched: string; licence: string };
  /** Pairs of lines the poem's form rhymes. */
  yes: Array<[string, string]>;
  /** Pairs of lines the poem's form keeps on different rhymes. */
  no: Array<[string, string]>;
}

export interface SyllableSet {
  source: string;
  /** What is counted: syllables, or morae for Japanese. */
  unit: string;
  words: Array<[string, number]>;
}

export interface SoundReport {
  /** Real rhymes the rule hears, of `yes`. */
  heard: number;
  yes: number;
  /** Non-rhymes the rule refuses, of `no`. */
  refused: number;
  no: number;
  /** Words counted as the dictionary counts them, of `words`. */
  counted: number;
  words: number;
  /** Written verses of the language's pack that keep their form, of `verses` (acrostics apart). */
  kept: number;
  verses: number;
  digest: string;
}

/** FNV-1a, 32 bits, over UTF-16 code units. */
export function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Run a language's rules over its sets. The language's sound data and pack must be loaded first. */
export function soundReport(lang: string, corpus?: RhymeCorpus, set?: SyllableSet): SoundReport {
  const verdict = ([a, b]: [string, string]) => {
    const [wa, wb] = rhymeEnds(a, b, lang);
    return rhymes(wa, wb, lang);
  };
  const yes = (corpus?.yes ?? []).map(verdict);
  const no = (corpus?.no ?? []).map(verdict);
  const counts = (set?.words ?? []).map(([w]) => syllablesInLine(w, lang));
  const pack = getPack(lang);
  const kept: boolean[] = [];
  for (const form of formsFor(lang)) {
    if (form.id === 'acrostic') continue;
    for (const verse of pack.written[form.id] ?? []) kept.push(scoreForm(form, verse, { lang }).kept);
  }
  const bits = (xs: boolean[]) => xs.map((x) => (x ? '1' : '0')).join('');
  const all = [lang, bits(yes), bits(no), counts.map((c) => c ?? '?').join(','), bits(kept)].join('|');
  return {
    heard: yes.filter(Boolean).length,
    yes: yes.length,
    refused: no.filter((x) => !x).length,
    no: no.length,
    counted: counts.filter((c, i) => c === set!.words[i][1]).length,
    words: counts.length,
    kept: kept.filter(Boolean).length,
    verses: kept.length,
    digest: fnv1a(all),
  };
}
