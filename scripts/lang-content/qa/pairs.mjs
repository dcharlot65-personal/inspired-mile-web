// Writes the (translation, English) pairs of the play content for the meaning check:
//   node scripts/lang-content/qa/pairs.mjs <out dir>
// -> <out>/pairs-<lang>.json  [{id, lang, text, english}]   and  <out>/words-<lang>.txt for spelling
// Trivia options that are only a name are left out (they come from the names table, not from a translator).
// CONTROLS: for every language, 12 pairs whose English is deliberately the WRONG sentence (id "control:…").
// A run that does not flag most of them proves nothing; qa/report.mjs prints how many it caught.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { register } from 'node:module';
// The English areas import their data without a file extension, as the bundler allows; plain Node needs it spelt out.
register('data:text/javascript,' + encodeURIComponent("export async function resolve(s, c, n) { if (/^\\.\\.?\\//.test(s) && !/\\.\\w+$/.test(s)) { try { return await n(s + '.ts', c); } catch {} } return n(s, c); }"));
import { join } from 'node:path';
import { HERE, ROOT, LANGS } from '../lib.mjs';
const out = process.argv[2];
const ORDER = ['th', 'hi', 'ar', 'vi', 'id', 'ko', 'ja', 'zh', 'ru', 'pl', 'pt', 'it', 'de', 'fr', 'es'];
mkdirSync(out, { recursive: true });
const load = async (area, l) => (await import(join(ROOT, 'src/i18n/pages', area, `${l}.ts`))).default;
const optionKeys = JSON.parse(readFileSync(join(HERE, 'trivia-options.json'), 'utf8'));
const en = { playground: await load('playground', 'en'), story: await load('story', 'en'), trivia: await load('trivia', 'en') };
// Every English option of every question, names included, for qa/align.py.
const { TRIVIA_BANK } = await import(join(ROOT, 'src/lib/trivia.ts'));
writeFileSync(join(out, 'english-options.json'), JSON.stringify(Object.fromEntries(TRIVIA_BANK.map((q, n) => [n, q.options]))));
// Bidirectional isolates (bidi.mjs) are layout, not text: the models read the text without them.
const show = (s) => s.replace(/[\u2066-\u2069]/gu, '').replace(/\{(\w+)\}/g, (_, k) => ({ n: '3', total: '5', city: 'Tokyo', bonus: '2', axis: 'wit', translator: 'A. W. von Schlegel', done: '4', h: '2', m: '15' })[k] ?? k);
for (const l of LANGS) {
  const pairs = [];
  for (const area of ['playground', 'story', 'trivia']) {
    const m = await load(area, l);
    for (const [k, v] of Object.entries(m)) {
      const e = en[area][k];
      if (!e || e.length < 3) continue;
      const opt = k.match(/^trivia\.(\d+)\.o(\d)$/);
      if (opt && (optionKeys[opt[1]][opt[2]] || /^[\dA-Z ]+$/.test(e) || v.replace(/[\u2066-\u2069]/gu, '') === e)) continue; // a name, a number, or left as in English by design (an Arabic one isolated)
      pairs.push({ id: k, lang: l, text: show(v), english: show(e) });
    }
  }
  // ALIGNMENT CONTROLS: a translated option filed under another option's place of the same question
  // (id "alignctl:trivia.N.oI", text of option J, English of option I). qa/align.py must call every one
  // of them misplaced, or it proves nothing about the real options.
  const opts = pairs.filter((p) => /^trivia\.\d+\.o\d$/.test(p.id));
  const byQ = new Map();
  for (const p of opts) { const n = p.id.split('.')[1]; if (!byQ.has(n)) byQ.set(n, []); byQ.get(n).push(p); }
  const twins = [...byQ.values()].filter((g) => g.length >= 2 && g[0].english.split(' ').length >= 2 && g[1].english.split(' ').length >= 2);
  for (let i = 0; i < Math.min(10, twins.length); i++) {
    const [a, b] = twins[(i * 13) % twins.length];
    pairs.push({ id: `alignctl:${a.id}`, lang: l, text: b.text, english: a.english });
  }
  const real = pairs.filter((p) => p.english.split(' ').length >= 4 && !p.id.startsWith('alignctl:'));
  for (let i = 0; i < 12; i++) {
    const a = real[(i * 37) % real.length], b = real[(i * 37 + 101) % real.length];
    pairs.push({ id: `control:${a.id}`, lang: l, text: a.text, english: b.english });
  }
  // Two files per language, named so that a plain sorted loop does the factual content first
  // (the trivia questions, with the controls) and the weakest languages before the strongest.
  const rank = String(ORDER.indexOf(l) + 1).padStart(2, '0');
  const first = pairs.filter((p) => /^trivia\.\d+\.q$/.test(p.id) || p.id.startsWith('control:') || p.id.startsWith('alignctl:') || /^trivia\.\d+\.o\d$/.test(p.id));
  writeFileSync(join(out, `pairs-1-${rank}-${l}.json`), JSON.stringify(first, null, 0));
  writeFileSync(join(out, `pairs-2-${rank}-${l}.json`), JSON.stringify(pairs.filter((p) => !first.includes(p)), null, 0));
  // Words for spelling: the translated text without what is English by design ("quoted lines", Latin-script names in other scripts are kept: the dictionary decides).
  const text = pairs.filter((p) => !p.id.includes('control:') && !p.id.startsWith('alignctl:')).map((p) => p.text.replace(/["“”«»„][^"“”«»„]{0,200}["“”«»]/g, ' ')).join('\n');
  writeFileSync(join(out, `text-${l}.txt`), text);
  console.log(l, pairs.length, 'pairs');
}
