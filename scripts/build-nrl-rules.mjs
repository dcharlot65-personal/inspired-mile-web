#!/usr/bin/env node
/**
 * Builds src/lib/voice/nrl-rules.ts: the letter-to-sound rules the voice uses for an English
 * word its pronunciation table (src/lib/voice/lexicon-en.ts) does not hold.
 *
 *   node scripts/build-nrl-rules.mjs
 *
 * The rules are those of NRL Report 7948, "Automatic Translation of English Text to Phonetics
 * by Means of Letter-to-Sound Rules" (H. S. Elovitz, R. Johnson, A. McHugh, J. E. Shore; Naval
 * Research Laboratory, Washington D.C., 21 January 1976; NTIS AD/A021 929): a report of a United
 * States government laboratory, written by its staff, so a work of the US government and not
 * under copyright (17 U.S.C. 105). They are read from John A. Wasser's C transcription of the
 * report's rules, posted to comp.sources.unix in 1985. His first posting says: "The translation
 * rules are from a government study and are probably in the public domain. The rest of the code
 * was written by me and is now in the public domain." His second (April 1985) corrects the
 * table; that is the one read here. Both pages of the TUHS archive are pinned by sha256: a page
 * that differs is refused, so the table cannot change without this script changing.
 *
 * Nothing of eSpeak NG or any other GPL program is read or copied. The output keeps the rules'
 * own phoneme codes (IY IH EY EH AE AA AO OW UH UW ER AX AH AY AW OY, and p b t d k g f v TH DH
 * s z SH ZH HH WH m n NG l w y r CH j); src/lib/voice/lts-en.ts applies them and maps the codes.
 */
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { get } from 'node:https';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src/lib/voice/nrl-rules.ts');

/** The table: "New version of English-to-Phoneme program!", comp.sources.unix, 5 April 1985. */
const TABLE_URL = 'https://www.tuhs.org/Usenet/comp.sources.unix/1985-April/001289.html';
const TABLE_SHA256 = '72a7900e7291f687abfad92b3169cb2db295a355665f7f2409f11a41e7311f02';
/** The dedication: "English to Phoneme translation", comp.sources.unix, March 1985. */
const DEDICATION_URL = 'https://www.tuhs.org/Usenet/comp.sources.unix/1985-March/004962.html';
const DEDICATION_SHA256 = '39c797755636d9138e9b44d438ffa91722ad569f191b9e9a1754d43e4804007b';
const DEDICATION = 'The rest of the code\n\twas written by me and is now in the public domain.';

/** GET with node:https: the archive takes about ten seconds to accept a connection, which is fetch()'s whole connect timeout. */
function download(url) {
  return new Promise((resolve, reject) => {
    const req = get(url, { timeout: 60000 }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`Could not download ${url}: ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('timeout', () => req.destroy(new Error(`${url}: no answer in 60 s`)));
    req.on('error', reject);
  });
}

async function fetchPinned(url, sha256) {
  const bytes = await download(url);
  const sha = createHash('sha256').update(bytes).digest('hex');
  if (sha !== sha256) throw new Error(`${url} has sha256 ${sha}, not ${sha256}. Read the new page, then update the pin.`);
  return bytes.toString('latin1');
}

/** The text of the article: the archive's <PRE> block with its few HTML entities and tags undone. */
function article(page) {
  const m = /<PRE>([\s\S]*)<\/PRE>/.exec(page);
  if (!m) throw new Error('No <PRE> block in the page');
  return m[1]
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

const NAMED = { Anything: '', Nothing: ' ', Silent: '', Pause: ' ' };

/** Every `static Rule X_rules[] = { {L, M, R, O}, ... };` table of ENGLISH.C, in order. */
export function parseRules(text) {
  const start = text.indexOf('static Rule punct_rules[]');
  const end = text.indexOf('Rule *Rules[]', start);
  if (start < 0 || end < 0) throw new Error('ENGLISH.C rule tables not found');
  const tables = new Map();
  let current = null;
  for (const line of text.slice(start, end).split('\n')) {
    const head = /^static Rule (\w+)_rules\[\]/.exec(line);
    if (head) {
      current = head[1] === 'punct' ? "'" : head[1];
      tables.set(current, []);
      continue;
    }
    const m = /^\s*\{(.*)\},?\s*$/.exec(line);
    if (!m || !current) continue;
    // Four parts, each a quoted string (which may hold a comma: ",") or a name from NAMED.
    const parts = [...m[1].matchAll(/"((?:[^"\\]|\\.)*)"|([A-Za-z_]\w*)/g)].map((p) => {
      if (p[1] !== undefined) return p[1];
      if (!(p[2] in NAMED)) throw new Error(`Unknown name ${p[2]} in: ${line}`);
      return NAMED[p[2]];
    });
    if (parts.length !== 4) throw new Error(`Not four parts in: ${line}`);
    tables.get(current).push(parts);
  }
  return tables;
}

async function main() {
  const [tablePage, dedicationPage] = await Promise.all([fetchPinned(TABLE_URL, TABLE_SHA256), fetchPinned(DEDICATION_URL, DEDICATION_SHA256)]);
  if (!article(dedicationPage).includes(DEDICATION)) throw new Error(`The dedication is not in ${DEDICATION_URL}`);
  const tables = parseRules(article(tablePage));
  const letters = [...tables.keys()].filter((k) => k !== "'");
  if (letters.join('') !== 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') throw new Error(`Rule tables found: ${[...tables.keys()].join(' ')}`);
  let count = 0;
  for (const [key, rules] of tables) {
    for (const [, match] of rules) {
      if (key !== "'" && match[0] !== key) throw new Error(`Rule ${match} sits in the ${key} table`);
    }
    count += rules.length;
  }
  // Every table must end with a rule that matches its letter in any context, or a word could
  // hold a letter no rule reads (the C program then loops for ever).
  for (const k of letters) {
    const last = tables.get(k).at(-1);
    if (last[0] !== '' || last[1] !== k || last[2] !== '') throw new Error(`The ${k} table does not end with a rule for ${k} alone`);
  }
  const body = [...tables].map(([k, rules]) => `  ${JSON.stringify(k)}: [\n${rules.map((r) => `    ${JSON.stringify(r)},`).join('\n')}\n  ],`).join('\n');
  const header = `/**
 * GENERATED by scripts/build-nrl-rules.mjs. Do not edit: change the script and run it again.
 *
 * English letter-to-sound rules of NRL Report 7948, "Automatic Translation of English Text to
 * Phonetics by Means of Letter-to-Sound Rules" (Elovitz, Johnson, McHugh, Shore; Naval Research
 * Laboratory, 1976; NTIS AD/A021 929), a work of the United States government, as transcribed
 * into C by John A. Wasser (comp.sources.unix, April 1985), who placed his code in the public
 * domain. Read from ${TABLE_URL}
 * (sha256 ${TABLE_SHA256}).
 *
 * ${count} rules. Each is [left context, letters matched, right context, phonemes]. Context
 * symbols: # one or more vowels, : zero or more consonants, ^ one consonant, . a voiced
 * consonant (B D V G J L M N R W Z), + a front vowel (E I Y), % a suffix (ER E ES ED ING ELY;
 * right context only), a space the edge of the word. Applied by src/lib/voice/lts-en.ts.
 */
`;
  writeFileSync(OUT, `${header}export const NRL_RULES: Readonly<Record<string, ReadonlyArray<readonly [string, string, string, string]>>> = {\n${body}\n};\n`);
  console.log(`${OUT}: ${count} rules in ${tables.size} tables; ${TABLE_URL} ${TABLE_SHA256}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
