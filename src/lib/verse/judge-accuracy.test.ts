/**
 * How often the rule judge prefers the better verse, on labelled pairs, in every language.
 *
 * The pairs (./judge-pairs/pairs.json, scripts/judge-pairs.mjs) are the decision-judge spike's
 * for en, es, ja, ar and hi (a pack verse against a weak verse; a pack verse against itself with
 * its neighbouring words swapped) and the swapped pairs for the other eleven languages. Each pair
 * labels the criteria on which one verse is plainly the better (the spike's README says what each
 * label rests on). The score is the spike's "forced accuracy": a criterion given to the better
 * verse counts 1, a split 1/2, a criterion given to the worse verse 0.
 *
 * The spike measured main (3015db5) at 0.73 / 0.73 / 0.58 / 0.69 / 0.74 in en/es/ja/ar/hi, and the
 * first fix of the rules at 0.68 / 0.70 / 0.32 / 0.63 / 0.64: it preferred the weaker Japanese
 * verse. MAIN below is main's judge on this file, measured with the spike's own harness
 * (scripts/decide/rules.measure.ts run in a checkout of 3015db5); the rule judge must not fall below
 * it in any language.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { rulesJudge, CRITERIA } from './judge';
import { PACK_LANGS, loadAllPacks } from './packs';
import { loadPronunciation } from './pronounce';
import { allusionLexicon } from './referee';
import { loadSound } from './sound';
import PAIRS from './judge-pairs/pairs.json';

type Item = { id: string; lang: string; set: string; x: string; y: string; labels: Record<string, 'x' | 'y' | null> };
const ITEMS = (PAIRS as { items: Item[] }).items;

/**
 * Main's judge on this file, per language: criteria given to the better verse, split, given to the
 * worse (see the header); its forced accuracy is (correct + split / 2) / all.
 */
export const MAIN: Record<string, [number, number, number]> = {
  en: [115, 79, 19], es: [108, 78, 15], ja: [31, 40, 17], ar: [77, 60, 17], hi: [82, 63, 9],
  fr: [13, 20, 3], de: [6, 30, 0], it: [6, 30, 0], pt: [7, 29, 0], pl: [9, 27, 0], ru: [9, 27, 0], zh: [0, 40, 0], ko: [9, 27, 0], vi: [10, 30, 0], th: [4, 23, 1], id: [6, 28, 2],
};
const mainForced = (l: string) => {
  const [c, s, w] = MAIN[l];
  return (c + s / 2) / (c + s + w);
};

beforeAll(async () => {
  await loadAllPacks();
  await Promise.all(PACK_LANGS.map((l) => loadSound(l)));
  expect(await loadPronunciation()).toBe(true);
}, 300_000);

/** Forced accuracy and its tally, per language and per criterion. */
export function scoreRules(items: Item[], judge: (it: Item) => Record<string, string>) {
  const by: Record<string, { n: number; correct: number; split: number; wrong: number; perCriterion: Record<string, [number, number, number]> }> = {};
  const verdicts: Record<string, Record<string, string>> = {};
  for (const it of items) {
    if (it.set !== 'A' && it.set !== 'B') continue;
    const v = (verdicts[it.id] = judge(it));
    const row = (by[it.lang] ??= { n: 0, correct: 0, split: 0, wrong: 0, perCriterion: {} });
    for (const c of CRITERIA) {
      const label = it.labels[c];
      if (!label) continue;
      const got = v[c] === 'player' ? 'x' : v[c] === 'opponent' ? 'y' : 'split';
      const pc = (row.perCriterion[`${it.set}:${c}`] ??= [0, 0, 0]);
      row.n++;
      if (got === 'split') {
        row.split++;
        pc[1]++;
      } else if (got === label) {
        row.correct++;
        pc[0]++;
      } else {
        row.wrong++;
        pc[2]++;
      }
    }
  }
  const forced = Object.fromEntries(Object.entries(by).map(([l, r]) => [l, (r.correct + r.split / 2) / r.n]));
  return { by, forced, verdicts };
}

describe('the rule judge on labelled pairs', () => {
  it('is at least as accurate as main in every language', () => {
    const lexicon = allusionLexicon();
    const { by, forced, verdicts } = scoreRules(ITEMS, (it) => rulesJudge(it.x, it.y, it.lang, lexicon).criteria);
    if (process.env.JUDGE_ACC_OUT) writeFileSync(process.env.JUDGE_ACC_OUT, JSON.stringify({ forced, by, verdicts }));
    console.log(`MEASURE rule judge forced accuracy ${JSON.stringify(Object.fromEntries(Object.entries(forced).map(([l, a]) => [l, +a.toFixed(3)])))}`);
    console.log(`MEASURE rule judge tallies (correct/split/wrong by set:criterion) ${JSON.stringify(Object.fromEntries(Object.entries(by).map(([l, r]) => [l, r.perCriterion])))}`);
    expect(Object.keys(forced).sort()).toEqual([...PACK_LANGS].sort());
    console.log(`MEASURE main's forced accuracy ${JSON.stringify(Object.fromEntries(PACK_LANGS.map((l) => [l, +mainForced(l).toFixed(3)])))}`);
    for (const l of PACK_LANGS) {
      // The same pairs were judged: the counts must match main's before the shares can be compared.
      expect([l, by[l].n]).toEqual([l, MAIN[l][0] + MAIN[l][1] + MAIN[l][2]]);
      expect([l, forced[l] >= mainForced(l) - 1e-12]).toEqual([l, true]);
    }
  });
});
