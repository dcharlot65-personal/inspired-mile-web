#!/usr/bin/env node
/**
 * Grammar and spelling by tool: LanguageTool and Hunspell over every string of
 * every language, as the sentences a player reads (placeholders filled in, one
 * sentence per plural form; see lib/strings.mjs).
 *
 *   LT_URL=http://127.0.0.1:8099 HUNSPELL=/path/hunspell DICT_DIR=/path/dict \
 *     node scripts/lang/grammar.mjs [--selftest] [--lang xx,yy] [--out file.json]
 *
 * scripts/lang/run.sh starts the LanguageTool server and sets these.
 *
 * A hit is open unless docs/language/allow/grammar.json (LanguageTool) or
 * docs/language/allow/spelling.json (Hunspell) accepts it, with a reason.
 * Exit status 1 if any hit is open, or if --selftest finds a tool that should
 * have flagged a known-bad sentence and did not.
 *
 * Which languages each tool covers is asked of the tools, not assumed: the
 * LanguageTool server lists its languages, and a Hunspell dictionary either
 * exists in DICT_DIR or does not. The result file says which.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { allStrings, renderSamples, readJson, ROOT, HOUSE_QUOTES, LOCALES } from './lib/strings.mjs';

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : dflt;
};
const LT_URL = process.env.LT_URL ?? 'http://127.0.0.1:8099';
const HUNSPELL = process.env.HUNSPELL ?? 'hunspell';
const HSPELL = process.env.HSPELL ?? 'hspell';
const DICT_DIR = process.env.DICT_DIR ?? '';
const OUT = resolve(opt('--out', `${ROOT}.langqa/grammar.json`));
const only = opt('--lang', '')?.split(',').filter(Boolean);
const langs = only?.length ? LOCALES.filter((l) => only.includes(l)) : [...LOCALES];

// Our language code -> LanguageTool's. A language missing here is one LanguageTool has no module for.
const LT_CODE = { en: 'en-US', es: 'es', fr: 'fr', de: 'de-DE', it: 'it', pt: 'pt-BR', pl: 'pl-PL', ru: 'ru-RU', ar: 'ar', zh: 'zh-CN', ja: 'ja-JP' };
// Our language code -> the dictionaries to try, in order (a word is right if any accepts it).
const DICTS = { en: ['en'], es: ['es'], fr: ['fr'], de: ['de'], it: ['it'], pt: ['pt-BR'], pl: ['pl'], ru: ['ru'], ar: ['ar'], hi: ['hi'], ko: ['ko'], vi: ['vi'], th: ['th'], id: ['id'] };

// ---------- LanguageTool ----------
async function ltLanguages() {
  const r = await fetch(`${LT_URL}/v2/languages`);
  if (!r.ok) throw new Error(`LanguageTool at ${LT_URL}: ${r.status}`);
  return r.json();
}

async function ltCheck(code, text) {
  const body = new URLSearchParams({ language: code, text, level: 'picky' });
  // Spelling is Hunspell's job where we have a dictionary of our own; LanguageTool's speller still runs (it knows compounds and names).
  const r = await fetch(`${LT_URL}/v2/check`, { method: 'POST', body });
  if (!r.ok) throw new Error(`LanguageTool ${code}: ${r.status} ${await r.text()}`);
  return (await r.json()).matches;
}

/** Check many sentences in few requests: join them as paragraphs, then hand each match back to its sentence. */
async function ltBatch(code, sentences) {
  const hits = sentences.map(() => []);
  const SEP = '\n\n';
  for (let start = 0; start < sentences.length; ) {
    let end = start;
    let size = 0;
    while (end < sentences.length && (end === start || size + sentences[end].length < 15000)) size += sentences[end++].length + SEP.length;
    const offsets = [];
    let text = '';
    for (let i = start; i < end; i++) {
      offsets.push(text.length);
      text += sentences[i] + SEP;
    }
    for (const m of await ltCheck(code, text)) {
      let i = offsets.length - 1;
      while (i > 0 && offsets[i] > m.offset) i--;
      hits[start + i].push({ offset: m.offset - offsets[i], length: m.length, rule: m.rule.id, category: m.rule.category?.id ?? '', message: m.message, replacements: m.replacements.slice(0, 3).map((x) => x.value) });
    }
    start = end;
  }
  return hits;
}

// ---------- Hunspell ----------
function dictPaths(lang) {
  return (DICTS[lang] ?? []).filter((d) => DICT_DIR && existsSync(`${DICT_DIR}/${d}.aff`) && existsSync(`${DICT_DIR}/${d}.dic`));
}

/** The words Hunspell rejects, out of a list. Each is put to the library whole (see hspell.cpp). */
function misspelled(dict, words) {
  if (!words.length) return new Set();
  const r = spawnSync(HSPELL, [`${DICT_DIR}/${dict}.aff`, `${DICT_DIR}/${dict}.dic`], { input: words.join('\n') + '\n', encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(`hspell ${dict}: ${r.error ?? r.stderr}`);
  return new Set(r.stdout.split('\n').filter(Boolean));
}

// Arabic vowel marks (U+064B-0652, U+0670) and tatweel (U+0640): spelling is checked without them.
const ARABIC_MARKS = /[\u064B-\u0652\u0670\u0640]/g;

/** The words of a sentence, with where each starts. Thai has no spaces: the browser's own word segmenter (ICU) finds them. */
function words(lang, text) {
  const out = [];
  if (lang === 'th') {
    for (const s of new Intl.Segmenter('th', { granularity: 'word' }).segment(text)) if (s.isWordLike && /\p{Script=Thai}/u.test(s.segment)) out.push({ word: s.segment, index: s.index });
    return out;
  }
  for (const m of text.matchAll(/[\p{L}\p{M}]+(?:[’'\-][\p{L}\p{M}]+)*/gu)) out.push({ word: m[0], index: m.index });
  return out;
}

function spellForm(lang, word) {
  if (lang === 'ar') return word.replace(ARABIC_MARKS, '');
  return word.replace(/’/g, "'");
}

// ---------- known-bad sentences: the proof that each tool can flag something in each language ----------
const KNOWN_BAD = {
  // [sentences with a grammar error a native reader sees at once], a misspelled word, the word spelled right
  en: [['She go to school every day.', 'I has two cats.', 'They was at home.', 'He have two book.'], 'recieve', 'receive'],
  es: [['Los casa es muy grandes.', 'Yo tiene dos gatos.', 'La problema es grande.', 'Nosotros va al cine.'], 'recivir', 'recibir'],
  fr: [['Les maison est très grands.', 'Je a deux chats.', 'Nous allez au cinéma.', 'Il sont arrivé.'], 'recevior', 'recevoir'],
  de: [['Das Häuser ist sehr großen.', 'Ich haben zwei Katzen.', 'Wir geht ins Kino.', 'Er sind gekommen.'], 'bekomen', 'bekommen'],
  it: [['Le casa è molto grandi.', 'Io ha mangiato la mela.', 'Un amica mia è venuto.', 'Loro è andati a casa.'], 'ricevre', 'ricevere'],
  pt: [['As casa é muito grandes.', 'Eu vai para a escola.', 'Os menino jogam bola.', 'Nós vai embora.'], 'recebr', 'receber'],
  pl: [['Ten kobieta jest bardzo wysoki.', 'Ja idzie do szkoły.', 'Oni jest w domu.', 'Mam dwa psów.'], 'otrzymć', 'otrzymać'],
  ru: [['Он пошла домой.', 'Я идёт в школу.', 'Они был дома.', 'Он купил два книга.'], 'получиьт', 'получить'],
  ar: [['ذهبت الولد إلى المدرسة أمس.', 'أنا يذهب إلى المدرسة.', 'البنات ذهب إلى السوق.', 'هذا السيارة جميلة.'], 'مدرسسة', 'مدرسة'],
  hi: [[], 'विद्यालयय', 'विद्यालय'],
  zh: [['我昨天去学校了了。', '他们是很高兴的的。', '我有三个书。', '因为下雨，所以但是我去了。'], '', ''],
  ja: [['私は学校に行くました。', 'これはペンをです。', '彼が本を読むますた。', '食べれる事が出来る。'], '', ''],
  ko: [[], '학굥', '학교'],
  vi: [[], 'trườngg', 'trường'],
  th: [[], 'โรงเรียยน', 'โรงเรียน'],
  id: [[], 'sekolaah', 'sekolah'],
};

async function selftest(supported) {
  const rows = [];
  let failed = 0;
  for (const lang of langs) {
    const [bad, wrong, right] = KNOWN_BAD[lang];
    const row = { lang, languagetool: 'no module', hunspell: 'no dictionary' };
    if (LT_CODE[lang] && supported.has(LT_CODE[lang])) {
      let caught = 0;
      for (const sentence of bad) if ((await ltCheck(LT_CODE[lang], sentence)).length) caught++;
      row.languagetool = `flags ${caught} of ${bad.length} known-bad sentences`;
      row.languagetoolCaught = caught;
      row.languagetoolTried = bad.length;
    }
    const dicts = dictPaths(lang);
    if (dicts.length && wrong) {
      const out = misspelled(dicts[0], [spellForm(lang, wrong), spellForm(lang, right)]);
      const ok = out.has(spellForm(lang, wrong)) && !out.has(spellForm(lang, right));
      row.hunspell = ok ? 'rejects the misspelling, accepts the word' : `UNEXPECTED: rejected [${[...out].join(', ')}] of [${wrong}, ${right}]`;
      row.hunspellWorks = ok;
      if (!ok) failed++;
    }
    rows.push(row);
  }
  return { rows, failed };
}

// ---------- main ----------
const ltLangs = await ltLanguages();
const supported = new Set(ltLangs.map((l) => l.longCode));
const software = await (await fetch(`${LT_URL}/v2/check`, { method: 'POST', body: new URLSearchParams({ language: 'en-US', text: 'ok' }) })).json();
const hunspellVersion = spawnSync(HUNSPELL, ['--version'], { encoding: 'utf8' }).stdout.split('\n')[0];

const self = await selftest(supported);
if (args.includes('--selftest')) {
  for (const r of self.rows) console.log(`${r.lang}\tLanguageTool: ${r.languagetool}\tHunspell: ${r.hunspell}`);
  process.exit(self.failed ? 1 : 0);
}

const allowGrammar = readJson(`${ROOT}docs/language/allow/grammar.json`, { entries: [] }).entries;
const allowSpelling = readJson(`${ROOT}docs/language/allow/spelling.json`, { words: {} }).words;
const strings = await allStrings();
const result = {
  ran: new Date().toISOString(),
  languagetool: { version: software.software?.version, buildDate: software.software?.buildDate, languages: [...supported].sort() },
  hunspell: { version: hunspellVersion },
  selftest: self.rows,
  languages: {},
};
let open = 0;
const usedGrammar = new Set();
const usedWords = new Set();

for (const lang of langs) {
  const ltCode = LT_CODE[lang] && supported.has(LT_CODE[lang]) ? LT_CODE[lang] : null;
  const dicts = dictPaths(lang);
  // Every sentence to check: interface strings as rendered samples, pack text as written.
  const items = [];
  for (const [key, template] of Object.entries(strings[lang].ui)) {
    if (key in HOUSE_QUOTES) continue;
    for (const s of await renderSamples(lang, template)) items.push({ id: `ui:${key}`, text: s.text, filled: s.filled, category: s.category });
  }
  for (const [id, text] of Object.entries(strings[lang].pack)) items.push({ id: `pack:${id}`, text, filled: [], category: null });

  const hits = [];
  // --- LanguageTool ---
  if (ltCode) {
    const found = await ltBatch(ltCode, items.map((i) => i.text));
    items.forEach((item, i) => {
      for (const m of found[i]) {
        // A complaint wholly inside a filled-in value (a card's name, a sample word) is not about this string.
        if (item.filled.some(([a, b]) => m.offset >= a && m.offset + m.length <= b)) continue;
        hits.push({ tool: 'languagetool', id: item.id, rule: m.rule, category: m.category, text: item.text, at: item.text.slice(m.offset, m.offset + m.length), message: m.message, replacements: m.replacements });
      }
    });
  }
  // --- Hunspell ---
  if (dicts.length) {
    const occurrences = [];
    for (const item of items) {
      for (const w of words(lang, item.text)) {
        if (item.filled.some(([a, b]) => w.index >= a && w.index < b)) continue;
        if (/^\p{Lu}+$/u.test(w.word) && w.word.length <= 3) continue; // GB, MB, VR
        occurrences.push({ id: item.id, word: w.word, form: spellForm(lang, w.word), text: item.text });
      }
    }
    let wrong = new Set(occurrences.map((o) => o.form));
    for (const d of dicts) wrong = misspelled(d, [...wrong]);
    // A word at the start of a sentence may be capitalised: try it in lower case too.
    const lower = misspelled(dicts[0], [...wrong].map((w) => w.toLocaleLowerCase(lang)));
    for (const o of occurrences) {
      if (!wrong.has(o.form) || !lower.has(o.form.toLocaleLowerCase(lang))) continue;
      hits.push({ tool: 'hunspell', id: o.id, rule: 'SPELLING', category: 'SPELLING', text: o.text, at: o.word, message: `not in the ${dicts.join('+')} dictionary`, replacements: [] });
    }
  }
  // One finding per (string, rule, flagged text): the same string rendered in six plural forms complains six times.
  const seen = new Set();
  const unique = hits.filter((h) => {
    const k = `${h.tool}|${h.id}|${h.rule}|${h.at}`;
    return seen.has(k) ? false : (seen.add(k), true);
  });
  for (const h of unique) {
    if (h.tool === 'hunspell') {
      const reason = allowSpelling[lang]?.[h.at] ?? allowSpelling['*']?.[h.at];
      if (reason) {
        h.allowed = reason;
        usedWords.add(`${lang in allowSpelling && h.at in allowSpelling[lang] ? lang : '*'}|${h.at}`);
      }
    } else {
      const i = allowGrammar.findIndex((a) => (a.lang === '*' || a.lang === lang) && a.rule === h.rule && (a.id === '*' || a.id === h.id) && (a.at === undefined || a.at === h.at));
      if (i >= 0) {
        h.allowed = allowGrammar[i].reason;
        usedGrammar.add(i);
      }
    }
    if (!h.allowed) open++;
  }
  result.languages[lang] = {
    strings: { ui: Object.keys(strings[lang].ui).length - Object.keys(HOUSE_QUOTES).length, pack: Object.keys(strings[lang].pack).length, sentences: items.length },
    languagetool: ltCode ?? null,
    hunspell: dicts.length ? dicts : null,
    counts: {
      languagetool: unique.filter((h) => h.tool === 'languagetool').length,
      hunspell: unique.filter((h) => h.tool === 'hunspell').length,
      allowed: unique.filter((h) => h.allowed).length,
      open: unique.filter((h) => !h.allowed).length,
    },
    hits: unique,
  };
  console.log(`${lang}\tLT ${ltCode ?? '—'}: ${result.languages[lang].counts.languagetool}\tHunspell ${dicts.join('+') || '—'}: ${result.languages[lang].counts.hunspell}\topen ${result.languages[lang].counts.open}`);
}
// A stale exception is a problem too (only judged on a full run).
const stale = [];
if (!only?.length) {
  allowGrammar.forEach((a, i) => { if (!usedGrammar.has(i)) stale.push(`grammar: ${a.lang} ${a.rule} ${a.id} ${a.at ?? ''}`); });
  for (const [l, ws] of Object.entries(allowSpelling)) for (const w of Object.keys(ws)) if (!usedWords.has(`${l}|${w}`)) stale.push(`spelling: ${l} ${w}`);
}
result.stale = stale;
result.open = open;
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(result, null, 1) + '\n');
for (const s of stale) console.log(`STALE allowlist entry: ${s}`);
console.log(`${OUT}: ${open} open, ${stale.length} stale allowlist entries`);
process.exit(open || stale.length || self.failed ? 1 : 0);
