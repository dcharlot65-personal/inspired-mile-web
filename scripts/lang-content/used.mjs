// The names a language's trivia takes from the names table ("=" options), with how each was arrived at.
//   node scripts/lang-content/used.mjs es          all of them, one per line
//   node scripts/lang-content/used.mjs es flags    only those not taken whole from a label or article title
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HERE, nameOf, ucfirst, LATIN } from './lib.mjs';
const [lang, mode] = process.argv.slice(2);
const optionKeys = JSON.parse(readFileSync(join(HERE, 'trivia-options.json'), 'utf8'));
const seen = new Map();
for (const line of readFileSync(join(HERE, 'trivia', `${lang}.txt`), 'utf8').split('\n')) {
  if (!line.trim() || line.startsWith('#')) continue;
  const parts = line.split(' | ').map((p) => p.trim());
  parts.slice(2).forEach((o, i) => {
    if (o !== '=') return;
    const ent = optionKeys[parts[0]][i];
    const r = nameOf(ent.key, lang, ent.which);
    const flag = r.how === 'english' ? (LATIN.has(lang) ? '' : '~') : r.how === 'unsourced' ? '!' : r.check ? '?' : r.how === 'part' ? '^' : '';
    seen.set(`${ent.key}#${ent.which}`, `${ent.key}=${ucfirst(r.name)}${flag}`);
  });
}
const all = [...seen.values()].filter((v) => mode !== 'flags' || /[~!?^]$/.test(v));
console.log(all.join('; '));
