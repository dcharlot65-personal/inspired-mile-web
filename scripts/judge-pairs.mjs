// The labelled verse pairs the rule judge is measured on (src/lib/verse/judge-accuracy.test.ts).
//
// en, es, ja, ar and hi are the decision-judge spike's pairs exactly as it built them
// (branch spike/decision-judge 2b6ab28, scripts/decide/build-pairs.mjs, from main 3015db5's
// packs), so the rule judge is compared with main on the same items the spike measured main on:
//   set A  a written verse of the pack against a weak verse (wordplay, flow, wit labelled for the
//          written verse; allusion only where it names a card or a play);
//   set B  a written verse against itself with every two neighbouring words swapped (flow and wit
//          labelled for the written verse: the rhyme words leave the line ends and the insult stops
//          parsing; wordplay and allusion are the same words and are not labelled);
//   set P  probes (lines addressed to the judge, filler copies), not scored for accuracy.
// The spike had weak verses in those five languages only. For the other eleven this script adds
// set B, built the same way from this branch's packs: a pair needs no verse that is not the
// repository's. It keeps the five languages' items as they are and rewrites the eleven.
//
//   node scripts/judge-pairs.mjs        (Node 23.6 or newer: it imports the packs' .ts)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const file = resolve(repo, 'src/lib/verse/judge-pairs/pairs.json');
const SPIKE = ['en', 'es', 'ja', 'ar', 'hi'];
const MORE = ['fr', 'de', 'it', 'pt', 'pl', 'ru', 'zh', 'ko', 'vi', 'th', 'id'];
const UNSPACED = new Set(['zh', 'ja', 'th']);

function segments(line, lang) {
  if (UNSPACED.has(lang)) return [...new Intl.Segmenter(lang, { granularity: 'word' }).segment(line)].map((s) => ({ text: s.segment, word: s.isWordLike }));
  return line.split(/(\s+)/).filter((t) => t.length).map((t) => ({ text: t, word: /\p{L}/u.test(t) }));
}
/** The spike's (and review.test.ts's) `swapped`: every pair of neighbouring words changes places. */
function swapped(verse, lang) {
  return verse.split('\n').map((l) => {
    const s = segments(l, lang);
    const idx = s.map((x, i) => (x.word ? i : -1)).filter((i) => i >= 0);
    const t = s.map((x) => x.text);
    for (let k = 0; k + 1 < idx.length; k += 2) [t[idx[k]], t[idx[k + 1]]] = [t[idx[k + 1]], t[idx[k]]];
    return t.join('');
  }).join('\n');
}

const doc = JSON.parse(readFileSync(file, 'utf8'));
const items = doc.items.filter((i) => SPIKE.includes(i.lang));
for (const lang of MORE) {
  const pack = (await import(resolve(repo, `src/lib/verse/packs/${lang}.ts`))).default;
  const written = Object.entries(pack.written).flatMap(([form, vs]) => vs.map((v, k) => ({ form, k, v })));
  let n = 0;
  for (const w of written) {
    const s = swapped(w.v, lang);
    if (s === w.v) continue;
    const first = n % 2 === 0;
    const [x, y] = first ? [w.v, s] : [s, w.v];
    const better = first ? 'x' : 'y';
    n++;
    items.push({ id: `${lang}-B-${String(n).padStart(3, '0')}`, lang, set: 'B', x, y, better, source: `packs/${lang}.ts written.${w.form}[${w.k}] vs its swapped copy`, labels: { wordplay: null, allusion: null, flow: better, wit: better } });
  }
}
const langs = [...SPIKE, ...MORE];
const out = {
  note: 'en/es/ja/ar/hi: the decision-judge spike (spike/decision-judge 2b6ab28, scripts/decide/build-pairs.mjs). The other eleven: set B from the packs, by scripts/judge-pairs.mjs.',
  criteria: doc.criteria,
  langs,
  counts: Object.fromEntries(langs.map((l) => [l, Object.fromEntries(['A', 'B', 'P'].map((s) => [s, items.filter((i) => i.lang === l && i.set === s).length]))])),
  items,
};
writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
console.log(file, JSON.stringify(out.counts));
