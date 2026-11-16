// Every quotation in challenges/<lang>.tsv must be, character for character, part of a line that
// wikisource.py took from a fetched page (challenges/evidence/<source>.txt). Exits 1 otherwise.
// Also: the translator of every source must have died more than 100 years ago, or the status must say why it is free.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HERE, LANGS, readTsv } from './lib.mjs';
const sources = new Map(readTsv(join(HERE, 'challenges', 'sources.tsv')).map((r) => [r[0], { lang: r[1], translator: r[3], died: Number(r[4]), url: r[5], status: r[6] }]));
const evidence = (id) => (existsSync(join(HERE, 'challenges', 'evidence', `${id}.txt`)) ? readFileSync(join(HERE, 'challenges', 'evidence', `${id}.txt`), 'utf8').split('\n').filter(Boolean).map((l) => l.split('\t')) : []);
let bad = 0, n = 0;
for (const [id, s] of sources) {
  // Free everywhere a hundred years after the translator's death; sooner only where the status names the
  // basis: public domain at home on 1 January 1996, hence not restored in the US under the URAA.
  if (!(new Date().getFullYear() - s.died > 100) && !/at home on 1 January 1996.*not restored under the URAA/.test(s.status ?? '')) { bad++; console.log(`${id}: translator died in ${s.died}, not more than 100 years ago, and the status names no other basis`); }
  if (!/^Public domain/.test(s.status ?? '')) { bad++; console.log(`${id}: no public-domain statement`); }
  // A Wikisource page revision, or an Aozora Bunko file with the hash of the bytes that were read.
  const revision = (url) => (url.startsWith(`https://${s.lang}.wikisource.org/`) && /oldid=\d+/.test(url)) || (s.lang === 'ja' && url.startsWith('https://www.aozora.gr.jp/cards/') && /#sha256=[0-9a-f]{64}$/.test(url));
  for (const [url] of evidence(id)) if (!revision(url)) { bad++; console.log(`${id}: evidence line without a revision URL on ${s.lang}.wikisource.org or a hashed Aozora Bunko file`); }
}
for (const lang of LANGS) {
  for (const [num, line, , sid] of readTsv(join(HERE, 'challenges', `${lang}.tsv`))) {
    n++;
    const lines = evidence(sid).map((e) => e[2]);
    const ok = lines.some((l) => l.includes(line) || l.replace(/ — /g, ' ').includes(line));
    if (!ok) { bad++; console.log(`${lang} ${num}: not found in the evidence of ${sid}: ${line}`); }
  }
}
console.log(`${n} quotations checked against their sources; ${bad} problems`);
process.exit(bad ? 1 : 0);
