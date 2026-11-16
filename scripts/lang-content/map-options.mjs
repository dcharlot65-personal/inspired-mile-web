// Which trivia options are simply the name of a play, a character, a person or a place?
// Prints the mapping (option -> entity key) for review and writes trivia-options.json.
// An option that is a name is filled from the names table in every language; only the
// others are translated by hand. Overrides: trivia-option-overrides.tsv (n, option index, key or -).
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { HERE, ROOT, gameNames, readTsv } from './lib.mjs';
const { TRIVIA_BANK } = await import(join(ROOT, 'src/lib/trivia.ts'));

const index = new Map();
for (const [key, names] of Object.entries(gameNames)) names.forEach((n, which) => {
  for (const form of new Set([n, n.replace(/^The /, ''), 'The ' + n])) {
    if (!index.has(form)) index.set(form, []);
    if (!index.get(form).some((x) => x.key === key)) index.get(form).push({ key, which });
  }
});
const overrides = new Map(readTsv(join(HERE, 'trivia-option-overrides.tsv')).map(([n, i, key]) => [`${n}/${i}`, key]));
const kind = (k) => k[0];
const out = {};
const unmapped = [];
TRIVIA_BANK.forEach((q, n) => {
  const cands = q.options.map((o) => index.get(o) ?? []);
  // The kinds every mapped option of this question could be: a question's options are of one kind.
  const playish = /which (shakespeare )?play|is from which play|opens which play|which of (these|shakespeare's plays)|which of shakespeare's (plays|works)|in which play/i.test(q.question) || cands.some((c) => c.length && c.every((x) => kind(x.key) === 'p'));
  out[n] = q.options.map((o, i) => {
    const ov = overrides.get(`${n}/${i}`);
    if (ov) return ov === '-' ? null : { key: ov.split('#')[0], which: Number(ov.split('#')[1] ?? 0) };
    let c = cands[i];
    if (c.length > 1) {
      const want = c.filter((x) => (kind(x.key) === 'p') === playish);
      if (want.length) c = want;
    }
    if (c.length > 1) { unmapped.push(`${n}/${i} AMBIGUOUS "${o}": ${c.map((x) => x.key).join(', ')}`); return null; }
    if (c.length === 0) { unmapped.push(`${n}/${i} "${o}"`); return null; }
    if ((kind(c[0].key) === 'p') !== playish && 'pc'.includes(kind(c[0].key)) && /^[pc]/.test(c[0].key)) unmapped.push(`${n}/${i} KIND? "${o}" -> ${c[0].key}`);
    return c[0];
  });
});
writeFileSync(join(HERE, 'trivia-options.json'), JSON.stringify(out, null, 0).replace(/\],"/g, '],\n"') + '\n');
const total = Object.values(out).flat();
console.log(`${total.filter(Boolean).length} of ${total.length} options are names`);
if (process.argv.includes('-v')) console.log(unmapped.join('\n'));
