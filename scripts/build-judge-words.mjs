// Builds src/lib/verse/judge-words.ts: the words a verse could use to address its judge, in
// each of the game's sixteen languages, from published data rather than from memory.
//
//   node scripts/build-judge-words.mjs <folder>
//
// <folder> holds the downloaded sources (the script fetches any that are missing into it and
// refuses any whose sha256 is not the one recorded here):
//   cldr-rbnf-49.0.0.tgz          Unicode CLDR 49 rule-based number formats (npm package
//                                 cldr-rbnf, from unicode-org/cldr-json), Unicode License v3.
//                                 The number words are 2 to 10 spelled out by every public
//                                 "spellout-numbering" and "spellout-cardinal..." rule set of
//                                 the language (all genders, cases and counting forms).
//   <word>.jsonl                  Wiktionary's English entries for grade, score, mark, rating,
//                                 point, judge, verdict, win and winner, as extracted by
//                                 wiktextract (kaikki.org/dictionary/English/meaning/...),
//                                 CC BY-SA 4.0 and GFDL. The judge words are their translations
//                                 in the senses listed in SENSES (a grade given, a score kept,
//                                 a judge of a contest, winning), and the English words with
//                                 the inflected forms Wiktionary gives them.
// Every sha256 and the date fetched are written into the module.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const LANGS = ['en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'ru', 'ar', 'hi', 'zh', 'ja', 'ko', 'vi', 'th', 'id'];
const OUT = 'src/lib/verse/judge-words.ts';
const FETCHED = '2026-11-16';

const RBNF = {
  file: 'cldr-rbnf-49.0.0.tgz',
  url: 'https://registry.npmjs.org/cldr-rbnf/-/cldr-rbnf-49.0.0.tgz',
  sha256: '6dc753630b1a7ebb1900b026e9ea0779c4c5ca0a4306c7c69a3ff37a07b5313d',
};
const WORDS = ['grade', 'score', 'mark', 'rating', 'point', 'judge', 'verdict', 'win', 'winner'];
const KAIKKI_SHA256 = {
  grade: 'fa40eb040354578464c516f62a7ce010c1147b53b7885fc43e3116400f0cc574',
  score: 'a4708af90c3408993913be59213a85b7d6902352d31534e807cdfd27287f4411',
  mark: '02c0cd6bcd37b1c613417623e2a53b03b38b6274f2034d5d96a946c391d928fb',
  rating: '4446b1ebba863f7c9d3d7ad4f622487c258836e25f2a7571a1c7486951b4dcd6',
  point: '068b66916850395e4cfec8dc4201f8eebb3fb845b47827530d4f69d49c3ec9e6',
  judge: 'ac7fede95e4358d6f5ad77388a8c3afff9497d3f5ecf0bef7e26798f93863765',
  verdict: '18f0c2a54ea9a5f28dc48a53bd5941796f41e455c839f43a560f5a8fb6d96e0f',
  win: 'ff93b88eaa20ac97b8c7a76fc027d0e89212e2adc0a9d61e9cbf979878f99969',
  winner: '744e2c4c2dfc5b62e58d5b6465920a05ee452a86dd5105f5a2019a4340c1857b',
};
/**
 * The English entries whose inflected forms are kept: the parts of speech of the senses used.
 * "point" contributes only its plural, "points": the brief names "points", and "point", "pointed"
 * and "pointing" are everyday words that address no judge.
 */
const ENGLISH = {
  grade: { pos: ['noun'] }, score: { pos: ['noun'] }, mark: { pos: ['noun'] }, rating: { pos: ['noun'] },
  point: { pos: ['noun'], only: ['points'] }, judge: { pos: ['noun', 'verb'] }, verdict: { pos: ['noun'] },
  win: { pos: ['verb', 'noun'] }, winner: { pos: ['noun'] },
};
/**
 * Numbers spelled out from 2 to 10. 0 and 1 are left out: a verse gains nothing by naming the
 * bottom of its grader's scale, and their spellings are the indefinite article in German,
 * French, Spanish, Italian and Portuguese ("ein", "un", "una", "um") and the word for "not" in
 * Vietnamese ("không"); keeping them would hide most lines of those languages from the judge
 * (measured in docs/language/JUDGE-INJECTION.md).
 */
const FIRST_NUMBER = 2;
/** The senses whose translations are kept: those in which the word is about grading, scoring, judging a contest or winning one. */
const SENSES = {
  grade: ['rating', 'performance expressed by a number, letter, or other symbol'],
  score: ['number of points earned', 'number of points accrued', 'performance of an individual or group on an examination or test'],
  mark: ['academic score', 'sporting score'],
  rating: ['position on a scale', 'evaluation of status', 'mark that refers to the ability of something'],
  point: ['unit of scoring in a game or competition'],
  judge: ['public judicial official', "someone deciding another's fate", 'sports official'],
  verdict: ['decision on an issue of fact in a civil or criminal case or an inquest', 'opinion or judgement'],
  win: ['transitive: achieve victory in', 'intransitive: achieve by winning', 'individual victory'],
  winner: ['one who has won or often wins'],
};
/** Wiktionary's codes for the game's languages (Chinese is listed as Mandarin). */
const CODE = { cmn: 'zh', es: 'es', fr: 'fr', de: 'de', it: 'it', pt: 'pt', pl: 'pl', ru: 'ru', ar: 'ar', hi: 'hi', ja: 'ja', ko: 'ko', vi: 'vi', th: 'th', id: 'id' };

const dir = process.argv[2];
if (!dir) throw new Error('usage: node scripts/build-judge-words.mjs <folder for the sources>');
mkdirSync(dir, { recursive: true });
const sha = (buf) => createHash('sha256').update(buf).digest('hex');

async function source(file, url, want) {
  const path = join(dir, file);
  if (!existsSync(path)) writeFileSync(path, Buffer.from(await (await fetch(url)).arrayBuffer()));
  const buf = readFileSync(path);
  const got = sha(buf);
  if (want && got !== want) throw new Error(`${file} has sha256 ${got}, not the recorded ${want}; check it and update the script`);
  return { buf, sha256: got };
}

// --- Number words from CLDR's rule-based number formats ---

const rbnf = await source(RBNF.file, RBNF.url, RBNF.sha256);
const unpacked = join(dir, 'cldr-rbnf-49.0.0');
if (!existsSync(unpacked)) {
  mkdirSync(unpacked, { recursive: true });
  execFileSync('tar', ['xzf', join(dir, RBNF.file), '-C', unpacked]);
}

/** Parse a CLDR "...-SpelloutRules.txt": rule sets of "base: text;" rules. */
function parseRules(text) {
  const sets = new Map();
  let current = null;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const head = /^(%%?[\w-]+):$/.exec(line);
    if (head) {
      current = [];
      sets.set(head[1], current);
      continue;
    }
    const m = /^([^:]+):\s?(.*);$/.exec(line);
    if (!m || !current) continue;
    const [base, radix] = m[1].split('/');
    if (!/^\d+$/.test(base)) continue; // -x, x.x, Inf, NaN, 0.x: not whole numbers
    current.push({ base: Number(base), radix: radix ? Number(radix) : 10, text: m[2].replace(/^'/, '') });
  }
  return sets;
}

/** Every spelling CLDR's rules give `n` under rule set `name` (plural alternatives give several). */
function spell(sets, name, n, depth = 0) {
  if (depth > 20) throw new Error(`rule loop at ${name}`);
  const rules = sets.get(name);
  if (!rules) throw new Error(`no rule set ${name}`);
  let rule = null;
  for (const r of rules) if (r.base <= n && (!rule || r.base >= rule.base)) rule = r;
  if (!rule) return [];
  const exp = rule.base === 0 ? 0 : Math.floor(Math.log(rule.base) / Math.log(rule.radix) + 1e-9);
  const div = rule.radix ** exp;
  const rest = n % div;
  let outs = [''];
  const pieces = rule.text.match(/\$\([^)]*\)\$|\[[^\]]*\]|=[^=]*=|>[^>]*>|<[^<]*<|[^$[=<>]+/g) ?? [];
  const expand = (piece) => {
    if (piece.startsWith('$(')) {
      const alts = [...piece.matchAll(/\{([^}]*)\}/g)].map((m) => m[1]);
      return alts.length ? alts : [''];
    }
    if (piece.startsWith('[')) return rest === 0 ? [''] : [...new Set(expandAll(piece.slice(1, -1)))];
    if (piece.startsWith('=')) {
      const ref = piece.slice(1, -1);
      return ref.startsWith('%') ? spell(sets, ref, n, depth + 1) : [String(n)];
    }
    if (piece.startsWith('>')) {
      const ref = piece.slice(1, -1).replace(/^>$/, '');
      return ref.startsWith('%') ? spell(sets, ref, rest, depth + 1) : spell(sets, name, rest, depth + 1);
    }
    if (piece.startsWith('<')) {
      const ref = piece.slice(1, -1).replace(/^<$/, '');
      const q = Math.floor(n / div);
      return ref.startsWith('%') ? spell(sets, ref, q, depth + 1) : spell(sets, name, q, depth + 1);
    }
    return [piece];
  };
  function expandAll(text) {
    let acc = [''];
    for (const piece of text.match(/\$\([^)]*\)\$|\[[^\]]*\]|=[^=]*=|>[^>]*>|<[^<]*<|[^$[=<>]+/g) ?? []) {
      const next = [];
      for (const a of acc) for (const b of expand(piece)) next.push(a + b);
      acc = next;
    }
    return acc;
  }
  outs = expandAll(rule.text);
  return [...new Set(outs.map((s) => s.trim()))];
}

const numbers = {};
for (const lang of LANGS) {
  const sets = parseRules(readFileSync(join(unpacked, 'package', 'rbnf', `${lang}-SpelloutRules.txt`), 'utf8'));
  const names = [...sets.keys()].filter((k) => /^%spellout-(numbering|cardinal)/.test(k) && !/year|days/.test(k));
  const words = new Set();
  for (const name of names) {
    for (let n = FIRST_NUMBER; n <= 10; n++) {
      for (const s of spell(sets, name, n)) for (const w of s.split(/[\s­​-]+/)) if (/\p{L}/u.test(w)) words.add(w.normalize('NFC').toLowerCase());
    }
  }
  numbers[lang] = [...words].sort();
}

// --- Judge words from Wiktionary ---

const kaikki = {};
const judge = Object.fromEntries(LANGS.map((l) => [l, new Set()]));
for (const word of WORDS) {
  const url = `https://kaikki.org/dictionary/English/meaning/${word[0]}/${word.slice(0, 2)}/${word}.jsonl`;
  const { buf, sha256 } = await source(`${word}.jsonl`, url, KAIKKI_SHA256[word] || undefined);
  kaikki[word] = sha256;
  for (const line of buf.toString('utf8').split('\n')) {
    if (!line.trim()) continue;
    const e = JSON.parse(line);
    if (e.word !== word) continue;
    const english = ENGLISH[word];
    if (english.pos.includes(e.pos)) {
      if (!english.only) judge.en.add(word);
      for (const f of e.forms ?? []) {
        const tags = f.tags ?? [];
        const inflected = tags.includes('plural') || tags.includes('present') || tags.includes('past') || tags.includes('participle');
        if (/^[a-z]+$/.test(f.form) && inflected && (!english.only || english.only.includes(f.form))) judge.en.add(f.form);
      }
    }
    for (const t of e.translations ?? []) {
      const lang = CODE[t.code];
      if (!lang || !SENSES[word].includes(t.sense ?? '')) continue;
      for (const alt of String(t.word).split('/')) {
        let w = alt.trim();
        if (!w || /[()0-9]/.test(w)) continue;
        // Wiktionary writes Russian with its stress marks; verse does not.
        if (lang === 'ru') w = w.normalize('NFD').replace(/[̀́]/g, '').normalize('NFC');
        if (lang === 'ar') w = w.replace(/[ً-ٰٟ]/g, '');
        if (/^-|-$/.test(w)) continue;
        judge[lang].add(w.normalize('NFC').toLowerCase());
      }
    }
  }
}

const data = Object.fromEntries(LANGS.map((l) => [l, { numbers: numbers[l], judge: [...judge[l]].sort() }]));
const src = `/**
 * GENERATED by scripts/build-judge-words.mjs. Do not edit: run the script again.
 *
 * Words with which a verse could address its judge, per language (judge.ts judgeLines). A
 * line holding one of them, or any number, is not shown to the judge model.
 *
 * numbers: 2 to 10 spelled out by every public spellout-numbering and spellout-cardinal rule
 *   set of Unicode CLDR 49 (npm cldr-rbnf 49.0.0, sha256 ${rbnf.sha256}),
 *   Unicode License v3. All genders, cases and counting forms CLDR gives. 0 and 1 are left out (FIRST_NUMBER in
 *   the script says why). Japanese kana readings of numbers are not in CLDR and are not here.
 * judge: the English words grade, score, mark, rating, point, judge, verdict, win and winner,
 *   with the inflected forms Wiktionary gives them, and their translations in Wiktionary's
 *   translation tables, in the senses of grading, scoring, judging a contest and winning one
 *   (scripts/build-judge-words.mjs SENSES), as extracted by wiktextract (kaikki.org), fetched
 *   ${FETCHED}. Text from Wiktionary, CC BY-SA 4.0 and GFDL. sha256 of each entry file:
${WORDS.map((w) => ` *     ${w}: ${kaikki[w]}`).join('\n')}
 */
export const JUDGE_WORDS_SOURCES = { cldr: '49.0.0', wiktionaryFetched: '${FETCHED}' };

const WORDS: Record<string, { numbers: string[]; judge: string[] }> = ${JSON.stringify(data, null, 0)};
export default WORDS;
`;
writeFileSync(OUT, src);
console.log(`${OUT}: ${Buffer.byteLength(src)} bytes`);
for (const l of LANGS) console.log(l, 'numbers', numbers[l].length, numbers[l].join(' '), '| judge', judge[l].size, [...judge[l]].join(' '));
