// Measures the rhyme rules against the published verse in src/lib/verse/sound/corpus/, and
// checks that every written verse of every pack keeps its form, from plain Node (no test
// runner): a quick look while working on a rule. The unit tests assert the same things.
//
//   node --import ./scripts/sound/ts-resolve.mjs scripts/sound/measure.mjs [--show] [--kuromoji <folder of the kuromoji package>] [lang ...]
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { gunzipSync } from 'node:zlib';
import { installSound, markSound } from '../../src/lib/verse/sound/index.ts';
import { setJapaneseAnalyser } from '../../src/lib/verse/sound/kana.ts';
import { rhymes, rhymeEnds } from '../../src/lib/verse/rhyme.ts';
import { syllablesInLine } from '../../src/lib/verse/text.ts';
import { formsFor, scoreForm } from '../../src/lib/verse/forms.ts';

const args = process.argv.slice(2);
const show = args.includes('--show');
const kuro = args.includes('--kuromoji') ? args[args.indexOf('--kuromoji') + 1] : null;
const langs = args.filter((a) => !a.startsWith('--') && a !== kuro);

for (const f of readdirSync('src/lib/verse/sound/data')) {
  const lang = f.replace('.ts', '');
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
for (const f of readdirSync(dir).sort()) {
  if (f === 'syllables.json') continue;
  const c = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
  if (langs.length && !langs.includes(c.lang)) continue;
  const run = (pairs, want) => {
    const wrong = [];
    for (const [a, b] of pairs) {
      const [wa, wb] = rhymeEnds(a, b, c.lang);
      if (rhymes(wa, wb, c.lang) !== want) wrong.push(`${wa}/${wb}`);
    }
    return wrong;
  };
  const missed = run(c.yes, true);
  const let_in = run(c.no, false);
  console.log(`${c.lang}: real rhymes heard ${c.yes.length - missed.length}/${c.yes.length}, non-rhymes refused ${c.no.length - let_in.length}/${c.no.length}`);
  if (show) {
    if (missed.length) console.log('   missed:', missed.join(' | '));
    if (let_in.length) console.log('   let in:', let_in.join(' | '));
  }
}

if (existsSync(`${dir}/syllables.json`)) {
  const sets = JSON.parse(readFileSync(`${dir}/syllables.json`, 'utf8'));
  for (const [lang, set] of Object.entries(sets)) {
    if (langs.length && !langs.includes(lang)) continue;
    if (lang === 'ja' && !kuro) continue;
    const wrong = set.words.filter(([w, n]) => syllablesInLine(w, lang) !== n);
    console.log(`${lang}: syllable counts right ${set.words.length - wrong.length}/${set.words.length}`);
    if (show && wrong.length) console.log('   wrong:', wrong.map(([w, n]) => `${w}=${syllablesInLine(w, lang)} (dictionary ${n})`).join(' | '));
  }
}

// Every written verse of every pack keeps its form.
const { PACK_LANGS, loadPack } = await import('../../src/lib/verse/packs/index.ts');
for (const lang of PACK_LANGS) {
  if (langs.length && !langs.includes(lang)) continue;
  if (lang === 'ja' && !kuro) continue;
  const pack = await loadPack(lang);
  const offered = formsFor(lang).filter((f) => f.id !== 'acrostic');
  const bad = [];
  for (const form of offered) {
    const verses = pack.written[form.id] ?? [];
    if (verses.length < 2) bad.push(`${form.id}: ${verses.length} verses`);
    for (const v of verses) {
      const s = scoreForm(form, v, { lang });
      if (!s.kept) bad.push(`${form.id}: ${s.checks.filter((c) => !c.met).map((c) => `${c.id} [${c.detail}]`).join(', ')}`);
    }
  }
  console.log(`${lang}: forms ${offered.map((f) => f.id).join(' ')}${bad.length ? `\n   NOT KEPT: ${bad.join(' | ')}` : ''}`);
}
