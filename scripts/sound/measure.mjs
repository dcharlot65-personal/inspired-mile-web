// Measures the rhyme rules against the published verse in src/lib/verse/sound/corpus/, and
// checks that every written verse of every pack keeps its form, from plain Node (no test
// runner): a quick look while working on a rule. The unit tests assert the same things.
//
//   node --import ./scripts/sound/ts-resolve.mjs scripts/sound/measure.mjs [--show] [--write] [--kuromoji <folder of the kuromoji package>] [lang ...]
//
// --write records every language's counts and digest in corpus/expected.json, which the unit
// tests and the browser test must then reproduce. Japanese needs --kuromoji (the unpacked
// npm package, version as in package.json); without it Japanese is left as recorded.
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { gunzipSync } from 'node:zlib';
import { installSound, markSound } from '../../src/lib/verse/sound/index.ts';
import { setJapaneseAnalyser } from '../../src/lib/verse/sound/kana.ts';
import { rhymes, rhymeEnds } from '../../src/lib/verse/rhyme.ts';
import { syllablesInLine } from '../../src/lib/verse/text.ts';
import { formsFor, scoreForm } from '../../src/lib/verse/forms.ts';
import { soundReport } from '../../src/lib/verse/sound/digest.ts';
import { PACK_LANGS, loadPack } from '../../src/lib/verse/packs/index.ts';

const args = process.argv.slice(2);
const show = args.includes('--show');
const write = args.includes('--write');
const kuro = args.includes('--kuromoji') ? args[args.indexOf('--kuromoji') + 1] : null;
const langs = args.filter((a) => !a.startsWith('--') && a !== kuro);

for (const f of readdirSync('src/lib/verse/sound/data')) {
  const lang = f.replace('.ts', '');
  // Only the languages asked for: the Russian table alone is 400,000 entries.
  if (langs.length && !langs.includes(lang)) continue;
  installSound(lang, (await import(`../../src/lib/verse/sound/data/${f}`)).default);
}
if (kuro) {
  const require = createRequire(import.meta.url);
  const DD = require(`${kuro}/src/dict/DynamicDictionaries.js`);
  const Tok = require(`${kuro}/src/Tokenizer.js`);
  const b = (n) => {
    const u = gunzipSync(readFileSync(`${kuro}/dict/${n}.dat.gz`));
    return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength);
  };
  const d = new DD();
  d.loadTrie(new Int32Array(b('base')), new Int32Array(b('check')));
  d.loadTokenInfoDictionaries(new Uint8Array(b('tid')), new Uint8Array(b('tid_pos')), new Uint8Array(b('tid_map')));
  d.loadConnectionCosts(new Int16Array(b('cc')));
  d.loadUnknownDictionaries(new Uint8Array(b('unk')), new Uint8Array(b('unk_pos')), new Uint8Array(b('unk_map')), new Uint8Array(b('unk_char')), new Uint32Array(b('unk_compat')), new Uint8Array(b('unk_invoke')));
  const t = new Tok(d);
  setJapaneseAnalyser((text) => t.tokenize(text));
  markSound('ja', true);
}

const dir = 'src/lib/verse/sound/corpus';
const sets = existsSync(`${dir}/syllables.json`) ? JSON.parse(readFileSync(`${dir}/syllables.json`, 'utf8')) : {};
const expectedFile = `${dir}/expected.json`;
const expected = existsSync(expectedFile) ? JSON.parse(readFileSync(expectedFile, 'utf8')) : {};

for (const lang of PACK_LANGS) {
  if (lang === 'en' || (langs.length && !langs.includes(lang)) || (lang === 'ja' && !kuro)) continue;
  await loadPack(lang);
  const corpus = existsSync(`${dir}/${lang}.json`) ? JSON.parse(readFileSync(`${dir}/${lang}.json`, 'utf8')) : undefined;
  const r = soundReport(lang, corpus, sets[lang]);
  console.log(`${lang}: real rhymes heard ${r.heard}/${r.yes}, non-rhymes refused ${r.refused}/${r.no}, counts right ${r.counted}/${r.words}, pack verses kept ${r.kept}/${r.verses}, digest ${r.digest}${expected[lang] && expected[lang].digest !== r.digest ? ' (was ' + expected[lang].digest + ')' : ''}`);
  expected[lang] = r;
  if (!show) continue;
  const ends = ([a, b]) => rhymeEnds(a, b, lang);
  const missed = (corpus?.yes ?? []).map(ends).filter(([a, b]) => !rhymes(a, b, lang));
  const letIn = (corpus?.no ?? []).map(ends).filter(([a, b]) => rhymes(a, b, lang));
  if (missed.length) console.log('   missed:', missed.map((p) => p.join('/')).join(' | '));
  if (letIn.length) console.log('   let in:', letIn.map((p) => p.join('/')).join(' | '));
  const wrong = (sets[lang]?.words ?? []).filter(([w, n]) => syllablesInLine(w, lang) !== n);
  if (wrong.length) console.log('   counts:', wrong.map(([w, n]) => `${w}=${syllablesInLine(w, lang)} (dictionary ${n})`).join(' | '));
  const pack = await loadPack(lang);
  for (const form of formsFor(lang)) {
    if (form.id === 'acrostic') continue;
    const verses = pack.written[form.id] ?? [];
    if (verses.length < 2) console.log(`   ${form.id}: only ${verses.length} written verses`);
    for (const v of verses) {
      const s = scoreForm(form, v, { lang });
      if (!s.kept) console.log(`   NOT KEPT ${form.id}: ${s.checks.filter((c) => !c.met).map((c) => `${c.id} [${c.detail}]`).join(', ')}`);
    }
  }
}
if (write) writeFileSync(expectedFile, JSON.stringify(expected, null, 1) + '\n');
