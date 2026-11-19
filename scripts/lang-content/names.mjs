// Prints the names table of one language, compactly, for whoever is writing or reviewing that language.
//   node scripts/lang-content/names.mjs ru          every name
//   node scripts/lang-content/names.mjs ru flags    only those that need a human look
import { gameNames, nameOf } from './lib.mjs';
const [lang, mode] = process.argv.slice(2);
const out = [];
for (const key of Object.keys(gameNames)) gameNames[key].forEach((g, which) => {
  const r = nameOf(key, lang, which);
  const flag = r.how === 'english' ? '~' : r.how === 'unsourced' ? '!' : r.check ? '?' : r.how === 'part' ? '^' : '';
  if (mode === 'flags' && !flag) return;
  if (mode === 'review' && (flag === '~' || r.name === g)) return;
  out.push(`${g}=${r.name}${flag}`);
});
console.log(out.join('; '));
