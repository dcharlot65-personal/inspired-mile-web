#!/usr/bin/env node
// Keeping docs/language/results/pages-rest/bt.json up to date after strings change, without
// translating all of them back again:
//
//   node scripts/pages-rest/bt-merge.mjs stale <bt.json> <pairs.json>
//       the strings (as lang-check.mjs extract reads them now) that bt.json has not scored as
//       they stand, as [{id, lang, text, english}] for lang-host.sh bt-pairs
//   node scripts/pages-rest/bt-merge.mjs merge <bt.json> <scored.json> [<out.json>]
//       bt.json with each row of scored.json in place of the row it replaces (same lang and id),
//       rows of strings that no longer exist dropped; written to out.json (default: bt.json),
//       one row per line. The ranks (bitext.py --rank) are dropped too: run lang-host.sh rank
//       on the result, because a changed string changes the field every other one is ranked in.
import { readFileSync, writeFileSync } from 'node:fs';
import { extract } from './lang-check.mjs';

const [step, btFile, other, outFile] = process.argv.slice(2);
const read = (f) => JSON.parse(readFileSync(f, 'utf8'));
const now = async () => {
  const pairs = [];
  for (const [lang, items] of Object.entries((await extract()).locales)) {
    if (lang === 'en') continue;
    for (const [id, item] of Object.entries(items)) pairs.push({ id, lang, text: item.text, english: item.english });
  }
  return pairs;
};
/** One row per line: a re-scored string shows as a one-line change. */
const writeRows = (f, rows) => writeFileSync(f, `[\n${rows.map((r) => JSON.stringify(r)).join(',\n')}\n]\n`);

if (step === 'stale' && btFile && other) {
  const scored = new Map(read(btFile).map((p) => [`${p.lang} ${p.id}`, p]));
  const stale = (await now()).filter((p) => {
    const was = scored.get(`${p.lang} ${p.id}`);
    return !was || was.text !== p.text || was.english !== p.english;
  });
  writeFileSync(other, JSON.stringify(stale, null, 1) + '\n');
  console.log(`${stale.length} string(s) to score again`);
} else if (step === 'merge' && btFile && other) {
  const fresh = new Map(read(other).map((p) => [`${p.lang} ${p.id}`, { ...p, scoredAlone: true }]));
  const keep = new Set((await now()).map((p) => `${p.lang} ${p.id}`));
  const rows = [];
  let replaced = 0;
  let dropped = 0;
  for (const p of read(btFile)) {
    const k = `${p.lang} ${p.id}`;
    if (!keep.has(k)) {
      dropped++;
      continue;
    }
    const row = fresh.get(k) ?? p;
    if (fresh.has(k)) {
      replaced++;
      fresh.delete(k);
    }
    const { xrank, xbest, xbestCos, controlRank, ...rest } = row;
    rows.push(rest);
  }
  for (const p of fresh.values()) {
    const { xrank, xbest, xbestCos, controlRank, ...rest } = p;
    rows.push(rest);
  }
  writeRows(outFile ?? btFile, rows);
  console.log(`${replaced} row(s) replaced, ${fresh.size} added, ${dropped} dropped; ${rows.length} rows`);
} else {
  console.error('usage: node scripts/pages-rest/bt-merge.mjs stale <bt.json> <pairs.json> | merge <bt.json> <scored.json> [<out.json>]');
  process.exit(2);
}
