#!/usr/bin/env node
/**
 * Spelling of the page areas, by Hunspell: a tool that did not write the text.
 *
 *   HSPELL=/path/hspell DICT_DIR=/path/dict node scripts/pages-lang/spell.mjs [--out file.json] [--selftest]
 *
 * hspell asks the Hunspell library about one word per line (the hunspell command cuts
 * Devanagari and Thai words at their vowel signs). Both it and the dictionaries are the ones
 * the language QA pipeline installs on the build host (branch lang/qa-pipeline,
 * scripts/lang/host-setup.sh); this script only reads them.
 *
 * What comes out is a list of words a dictionary does not know, per language, with the keys
 * they are in. It is a list to read, not a verdict: names, loanwords and the game's own terms
 * are not in dictionaries. docs/language/pages-core/README.md records how each was settled.
 *
 * Chinese and Japanese have no Hunspell dictionary and are not checked. Thai has no spaces:
 * it is cut into words with Intl.Segmenter (ICU's dictionary) before the dictionary is asked.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { LOCALES, SOURCED, areas, readArea, rendered } from './strings.mjs';

const HSPELL = process.env.HSPELL ?? 'hspell';
const DICT_DIR = process.env.DICT_DIR ?? '';
const DICT = { en: 'en', es: 'es', fr: 'fr', de: 'de', it: 'it', pt: 'pt-BR', pl: 'pl', ru: 'ru', ar: 'ar', hi: 'hi', ko: 'ko', vi: 'vi', th: 'th', id: 'id' };
const args = process.argv.slice(2);
const outFile = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;

function rejects(dict, words) {
  const r = spawnSync(HSPELL, [`${DICT_DIR}/${dict}.aff`, `${DICT_DIR}/${dict}.dic`], { input: words.join('\n') + '\n', encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(`hspell failed for ${dict}: ${r.stderr}`);
  return new Set(r.stdout.split('\n').filter(Boolean));
}

function wordsOf(text, lang) {
  if (lang === 'th') return [...new Intl.Segmenter('th', { granularity: 'word' }).segment(text)].filter((s) => s.isWordLike && /\p{Script=Thai}/u.test(s.segment)).map((s) => s.segment);
  // Letters and combining marks, with an apostrophe or hyphen inside a word.
  return (text.normalize('NFC').match(/[\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*/gu) ?? []).filter((w) => !/^\p{Script=Latin}+$/u.test(w) || lang === 'en' || ['es', 'fr', 'de', 'it', 'pt', 'pl', 'vi', 'id'].includes(lang));
}

// Proof that the tool can flag something: a misspelling must be rejected and the right word accepted.
const SELFTEST = { en: ['recieve', 'receive'], es: ['coleccion', 'colección'], fr: ['personage', 'personnage'], de: ['Samlung', 'Sammlung'], it: ['colezione', 'collezione'], pt: ['colecao', 'coleção'], pl: ['kolekcia', 'kolekcja'], ru: ['колекция', 'коллекция'], ar: ['مجموعه', 'مجموعة'], hi: ['संगरह', 'संग्रह'], ko: ['컬랙션', '컬렉션'], vi: ['bộ sưu tâp', 'sưu'], th: ['ตัวลคร', 'ตัวละคร'], id: ['koleksii', 'koleksi'] };

const result = { tool: 'Hunspell (hspell)', dictDir: DICT_DIR, languages: {} };
let failed = false;
for (const lang of LOCALES) {
  const dict = DICT[lang];
  if (!dict || !existsSync(`${DICT_DIR}/${dict}.aff`)) {
    result.languages[lang] = { checked: false, why: dict ? `no ${dict} dictionary in DICT_DIR` : 'no Hunspell dictionary for this language' };
    console.log(`${lang}\tnot checked: ${result.languages[lang].why}`);
    continue;
  }
  const [wrong, right] = SELFTEST[lang];
  const st = rejects(dict, [wrong.split(' ').pop(), right]);
  const works = st.has(wrong.split(' ').pop()) && !st.has(right);
  if (!works) failed = true;
  if (args.includes('--selftest')) {
    console.log(`${lang}\t${works ? 'rejects the misspelling, accepts the word' : `UNEXPECTED: rejected [${[...st].join(', ')}] of [${wrong}, ${right}]`}`);
    continue;
  }
  const where = new Map();
  let total = 0;
  for (const a of areas()) {
    const m = readArea(a, lang);
    for (const [key, value] of Object.entries(m)) {
      if (SOURCED.test(key)) continue;
      for (const w of wordsOf(rendered(value), lang)) {
        total++;
        if (!where.has(w)) where.set(w, []);
        if (where.get(w).length < 3) where.get(w).push(key);
      }
    }
  }
  const all = [...where.keys()];
  let bad = rejects(dict, all);
  // A word that is only capitalised differently at the start of a sentence is not a misspelling.
  const lower = [...bad].filter((w) => w !== w.toLocaleLowerCase(lang)).map((w) => w.toLocaleLowerCase(lang));
  const lowerBad = lower.length ? rejects(dict, lower) : new Set();
  bad = new Set([...bad].filter((w) => w === w.toLocaleLowerCase(lang) || lowerBad.has(w.toLocaleLowerCase(lang))));
  result.languages[lang] = { checked: true, dictionary: dict, selftest: works, words: total, distinct: all.length, unknown: [...bad].sort().map((w) => ({ word: w, keys: where.get(w) })) };
  console.log(`${lang}\t${dict}\t${all.length} distinct words, ${bad.size} not in the dictionary${works ? '' : '\tSELFTEST FAILED'}`);
}
if (outFile) writeFileSync(outFile, JSON.stringify(result, null, 1) + '\n');
process.exit(failed ? 1 : 0);
