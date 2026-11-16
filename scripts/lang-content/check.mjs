// Mechanical checks on a language's trivia source, beyond what build.mjs refuses:
//   - a name the English question mentions should be in the translated question, as the names table
//     has it (exactly; for inflecting languages, by its stem). Each miss is printed for a human look:
//     it is either a wrong name, or a name the table needs a pick for.
//   - a quotation in the English question (straight double quotes, 3+ words) must be in the translation verbatim.
//   - numbers in the English question must be in the translation.
// Run: node scripts/lang-content/check.mjs [lang...]       exit 1 if a quotation or a number is lost
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { HERE, ROOT, LANGS, gameNames, nameOf } from './lib.mjs';
const { TRIVIA_BANK } = await import(join(ROOT, 'src/lib/trivia.ts'));
const langs = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const quiet = process.argv.includes('-q');
const STEM = { ru: 0.6, pl: 0.6, de: 0.8, hi: 0.7, ar: 0.7, ko: 0.8, ja: 0.8, th: 0.8, it: 0.8, es: 0.85, fr: 0.85, pt: 0.85, vi: 0.9, id: 0.85, zh: 0.8 };
// English names in a question, longest first, so "King Lear" is found before "Lear".
const names = Object.entries(gameNames).flatMap(([key, ns]) => ns.map((n, which) => ({ key, which, n }))).sort((a, b) => b.n.length - a.n.length);
const nameList = [...new Set(names.map((x) => x.n))];
// In double quotes in the English, but a nickname or a critic's term, not Shakespeare's words: translated.
const NOT_A_QUOTATION = new Set(['The Scottish Play', 'Seven Ages of Man']);
let hard = 0;
for (const lang of langs.length ? langs : LANGS) {
  const file = join(HERE, 'trivia', `${lang}.txt`);
  if (!existsSync(file)) continue;
  const rows = new Map(readFileSync(file, 'utf8').split('\n').filter((l) => l.trim() && !l.startsWith('#')).map((l) => { const p = l.split(' | ').map((x) => x.trim()); return [Number(p[0]), p]; }));
  const soft = [];
  TRIVIA_BANK.forEach((en, n) => {
    const row = rows.get(n);
    if (!row) return;
    const text = row[1];
    for (const m of en.question.matchAll(/"([^"]+)"/g)) {
      const quote = m[1].replace(/[?!.,]+$/, '');
      if (quote.split(' ').length >= 3 && !NOT_A_QUOTATION.has(quote) && !text.includes(quote)) { hard++; console.log(`${lang} ${n}: quotation changed or lost: "${quote}"`); }
    }
    for (const num of en.question.match(/\d+/g) ?? []) if (!text.includes(num)) { hard++; console.log(`${lang} ${n}: number ${num} lost`); }
    let rest = en.question.replace(/"[^"]+"/g, ' ');
    const want = new Map();
    for (const name of nameList) {
      const re = new RegExp(`(^|[^A-Za-z])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z])`);
      if (!re.test(rest)) continue;
      rest = rest.replace(re, ' ');
      // Every entity the game calls by this name: the play and its hero, the two Portias.
      want.set(name, names.filter((x) => x.n === name).map((x) => nameOf(x.key, lang, x.which).name));
    }
    for (const [name, cands] of want) {
      const low = text.toLocaleLowerCase(lang);
      // Word by word, each by its stem: "Kupcu weneckim" is "Kupiec wenecki", "Гамлета" is "Гамлет".
      const stem = (w) => (w.length <= 3 ? w : w.slice(0, Math.max(3, Math.ceil(w.length * (STEM[lang] ?? 1)))));
      const ok = cands.some((c) => c.toLocaleLowerCase(lang).split(/[\s,]+/u).filter(Boolean).every((w) => low.includes(stem(w))));
      if (!ok) soft.push(`${n}:${name}→${[...new Set(cands)].join('/')}`);
    }
  });
  console.log(`${lang}: ${soft.length} names to look at`);
  if (!quiet && soft.length) console.log('  ' + soft.join('; '));
}
process.exit(hard ? 1 : 0);
