// The judging test set: 12 pairs per language, one verse clearly better than the other.
//
//   node scripts/model-eval/build-pairs.mjs [lang…]   writes docs/language/model-eval/pairs/<lang>.json
//                                                   (every language, or only those named)
//
// The better verse is real: an excerpt of public-domain poetry from Wikisource
// (docs/language/model-eval/corpus/<lang>.json, built by corpus-fetch.mjs).
// The worse one is constructed, three of each kind per language:
//   prose      the opening sentence of that language's Wikipedia article on bread, the bicycle
//              or the cat: real, fluent text in the language that is not verse and not on topic
//   interface  two of the game's own interface strings in that language, as two lines: flat
//   gibberish  the letters of the language's own excerpts, shuffled into word-like strings
//   injection  an instruction to the judge, written in the language (injections.json)
// Everything taken from a source is recorded with where it came from.
//
// Light enough for the dev Mac: a few HTTPS requests and no model.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { htmlToLines } from './corpus-fetch.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIR = join(ROOT, 'docs', 'language', 'model-eval');
const UA = 'verse-eval-corpus-fetch/1.0 (automated; fetches a few pages once)';
export const LANGS = ['en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'ru', 'ar', 'hi', 'zh', 'ja', 'ko', 'vi', 'th', 'id'];

/** Wikidata items whose article supplies an off-topic sentence. */
const TOPICS = [['Q7802', 'bread'], ['Q11442', 'bicycle'], ['Q146', 'house cat']];
/** Pairs of interface strings (src/i18n/locales) that make two flat lines. */
const UI_PAIRS = [['brain.playNow', 'brain.noModel'], ['brain.checking', 'brain.kept'], ['battle.buildDeck', 'battle.duelLanguage']];

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Word-like strings made of a text's own letters in a seeded random order. */
export function gibberish(source, lang, seed) {
  const r = rng(seed);
  const units = [...new Intl.Segmenter(lang, { granularity: 'grapheme' }).segment(source)].map((s) => s.segment).filter((g) => /^\p{L}/u.test(g));
  const pickUnit = () => units[Math.floor(r() * units.length)];
  const spaced = !['zh', 'ja', 'th'].includes(lang);
  const line = () => {
    if (!spaced) return Array.from({ length: 5 + Math.floor(r() * 3) }, pickUnit).join('');
    return Array.from({ length: 3 + Math.floor(r() * 2) }, () => Array.from({ length: 2 + Math.floor(r() * 5) }, pickUnit).join('')).join(' ');
  };
  return `${line()}\n${line()}`.toLowerCase();
}

/** A string from a locale module, read as text: the modules import game code that Node cannot load. */
function uiString(lang, key) {
  const src = readFileSync(join(ROOT, 'src', 'i18n', 'locales', `${lang}.ts`), 'utf8');
  const m = new RegExp(`^\\s*'${key.replace(/\./g, '\\.')}':\\s*(['"])((?:\\\\.|(?!\\1).)*)\\1,?\\s*$`, 'm').exec(src);
  if (!m) throw new Error(`${lang}: no interface string ${key}`);
  return m[2].replace(/\\(['"\\])/g, '$1');
}

// A full stop ends a sentence where a space follows it; the CJK marks and the danda need none.
const SENTENCE_END = /[。！？।]|[.!?؟]["»”’)]?(?=\s|$)/gu;

/** The opening sentence of a Wikipedia article: the first paragraph that names its subject in bold, cut at the first sentence end past 60 characters. */
export function openingSentence(html) {
  const start = html.search(/<div class="[^"]*mw-parser-output[^"]*"/);
  const body = html.slice(start).replace(/\sdata-mw='[^']*'/g, '').replace(/\sdata-mw="[^"]*"/g, '').replace(/<table[\s\S]*?<\/table>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  for (const m of body.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    // An article opens by naming its subject in bold; notes above it do not.
    if (!/<b\b/i.test(m[1])) continue;
    const text = htmlToLines(m[1]).join(' ').replace(/\[[^\]]{0,12}\]/g, '').replace(/\s+/g, ' ').trim();
    if ([...text].length < 40) continue;
    SENTENCE_END.lastIndex = 0;
    for (let e; (e = SENTENCE_END.exec(text)); ) {
      const cut = text.slice(0, e.index + e[0].length);
      if ([...cut].length >= 60 && [...cut].length <= 400) return cut;
    }
    // No sentence end in reach (or a very long sentence): the first 300 characters, cut at a space where there is one.
    const head = [...text].slice(0, 300).join('');
    return [...text].length <= 300 ? text : head.slice(0, head.lastIndexOf(' ') > 150 ? head.lastIndexOf(' ') : head.length);
  }
  return null;
}

async function article(lang, qid, cacheDir) {
  const file = cacheDir && join(cacheDir, `wp-${lang}-${qid}.html`);
  let html;
  if (file && existsSync(file)) html = readFileSync(file, 'utf8');
  else {
    const res = await fetch(`https://www.wikidata.org/wiki/Special:GoToLinkedPage/${lang}wiki/${qid}`, { headers: { 'user-agent': UA, accept: 'text/html' } });
    if (!res.ok) throw new Error(`${lang} ${qid}: ${res.status}`);
    html = await res.text();
    if (file) { mkdirSync(cacheDir, { recursive: true }); writeFileSync(file, html); }
    await new Promise((r) => setTimeout(r, 300));
  }
  const revid = Number(/"wgRevisionId":(\d+)/.exec(html)?.[1]);
  const name = /"wgPageName":"((?:[^"\\]|\\.)*)"/.exec(html)?.[1];
  if (!revid || !name) throw new Error(`${lang} ${qid}: not an article`);
  return { html, revid, title: JSON.parse(`"${name}"`).replace(/_/g, ' ') };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const injections = JSON.parse(readFileSync(join(ROOT, 'scripts', 'model-eval', 'injections.json'), 'utf8')).texts;
  const today = new Date().toISOString().slice(0, 10);
  mkdirSync(join(DIR, 'pairs'), { recursive: true });
  const only = process.argv.slice(2);
  for (const bad of only) if (!LANGS.includes(bad)) throw new Error(`no such language: ${bad}`);
  for (const lang of LANGS.filter((l) => !only.length || only.includes(l))) {
    const corpus = JSON.parse(readFileSync(join(DIR, 'corpus', `${lang}.json`), 'utf8')).excerpts;
    if (corpus.length < 12) throw new Error(`${lang}: ${corpus.length} excerpts, 12 needed`);
    const letters = corpus.map((e) => e.text).join(' ');
    const pairs = [];
    for (let i = 0; i < 12; i++) {
      const kind = ['prose', 'interface', 'gibberish', 'injection'][i % 4];
      const n = Math.floor(i / 4);
      let worse;
      if (kind === 'prose') {
        const [qid, topic] = TOPICS[n];
        const a = await article(lang, qid, process.env.CORPUS_CACHE);
        const text = openingSentence(a.html);
        if (!text) throw new Error(`${lang} ${qid}: no opening sentence found`);
        worse = { kind, text, source: { site: `${lang}.wikipedia.org`, page: a.title, about: `${topic} (${qid})`, permalink: `https://${lang}.wikipedia.org/w/index.php?oldid=${a.revid}`, revid: a.revid, licence: 'CC BY-SA 4.0', fetched: today } };
      } else if (kind === 'interface') {
        const keys = UI_PAIRS[n];
        worse = { kind, text: keys.map((k) => uiString(lang, k)).join('\n'), source: { file: `src/i18n/locales/${lang}.ts`, keys } };
      } else if (kind === 'gibberish') {
        worse = { kind, text: gibberish(letters, lang, 1000 + i), source: { made: 'letters of this language\'s excerpts, shuffled by seed', seed: 1000 + i } };
      } else {
        worse = { kind, text: injections[lang][n], source: { file: 'scripts/model-eval/injections.json', written: 'by a language model for this test; not reviewed by a native speaker' } };
      }
      const e = corpus[i];
      pairs.push({ id: `${lang}-${String(i + 1).padStart(2, '0')}`, better: { text: e.text, poet: e.poet, poem: e.poem, source: e.source.permalink }, worse });
    }
    writeFileSync(join(DIR, 'pairs', `${lang}.json`), JSON.stringify({ lang, pairs }, null, 1) + '\n');
    console.log(lang, pairs.filter((p) => p.worse.kind === 'prose').map((p) => `[${p.worse.source.page}] ${p.worse.text}`).join('\n   '));
    console.log('   ', pairs.find((p) => p.worse.kind === 'gibberish').worse.text.replace('\n', ' / '), '|', pairs.find((p) => p.worse.kind === 'interface').worse.text.replace('\n', ' / '));
  }
}
