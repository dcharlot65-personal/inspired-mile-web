#!/usr/bin/env node
/**
 * Builds src/lib/voice/lexicon-en.ts: how the voice says English words, from the CMU
 * Pronouncing Dictionary (whole pronunciations with stress, which src/lib/verse/pron-en.ts
 * does not keep: the verse rules need only syllable counts and rhyme keys).
 *
 *   node scripts/build-voice-lexicon.mjs [path/to/cmudict.dict]
 *
 * Run it on the build host (`rb --pull`), like scripts/build-pronunciation.mjs, whose pins it
 * reuses: the same cmudict commit and sha256 (a file that differs is refused), the same SCOWL
 * release, and the game's own words (scripts/pronunciation-extra.txt; a "!" line puts its
 * pronunciation first). The output is committed; the site build needs no network.
 *
 * Output format, one line per word, sorted:   <word>[^] <pron>[,<pron>...]
 * A pronunciation is one character per sound (SOUND in build-pronunciation.mjs), a vowel followed
 * by "1" (primary stress) or "2" (secondary) when it is stressed. The dictionary's commonest
 * pronunciation comes first; the others are kept for the few words whose reading depends on the
 * words around them (src/lib/voice/g2p-en.ts, HETERONYMS). A "^" marks a word that is not in
 * SCOWL's word lists (a name, an abbreviation, a fragment): g2p-en.ts never splits an unknown
 * word into two such parts.
 *
 * CMUdict: Copyright (C) 1993-2015 Carnegie Mellon University, BSD 2-clause style licence. SCOWL:
 * Copyright 2000-2018 Kevin Atkinson, permissive licence. Both notices travel in the output, as
 * comments and inside the data itself (a build strips comments).
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { COMMIT, SHA256, SOURCE, SOUND, LICENCE, SCOWL_VERSION, SCOWL_SHA256, SCOWL_SIZE, scowlLicence, scowlWords } from './build-pronunciation.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src/lib/voice/lexicon-en.ts');

const VOWEL = /^(AA|AE|AH|AO|AW|AY|EH|ER|EY|IH|IY|OW|OY|UH|UW)([012])$/;

/** One pronunciation in the table's notation, or null if it holds a sound the table has no character for. */
export function encode(phones) {
  let out = '';
  for (const p of phones) {
    const v = VOWEL.exec(p);
    if (v) {
      out += SOUND[v[1]] + (v[2] === '0' ? '' : v[2]);
      continue;
    }
    if (!SOUND[p] || /\d/.test(p)) return null;
    out += SOUND[p];
  }
  return out;
}

/** word -> pronunciations (each an array of ARPAbet phones), in the order read. */
function parse(text, into, { first = false } = {}) {
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\s+#.*$/, '').trim();
    if (!line || line.startsWith('#') || line.startsWith(';;;')) continue;
    const [head, ...phones] = line.split(/\s+/);
    const word = head.replace(/\(\d+\)$/, '').toLowerCase();
    if (!/^'?[a-z]+(?:'[a-z]+)*'?$/.test(word) || !phones.length) continue;
    const code = encode(phones);
    if (code === null) continue;
    const list = into.get(word) ?? [];
    if (!into.has(word)) into.set(word, list);
    if (list.includes(code)) {
      if (first) list.splice(list.indexOf(code), 1);
      else continue;
    }
    if (first) list.unshift(code);
    else list.push(code);
  }
}

async function main() {
  let path = process.argv[2];
  if (!path) {
    path = join(tmpdir(), `cmudict-${COMMIT.slice(0, 12)}.dict`);
    if (!existsSync(path)) {
      const res = await fetch(SOURCE);
      if (!res.ok) throw new Error(`Could not download ${SOURCE}: ${res.status}`);
      writeFileSync(path, await res.text());
    }
  }
  const dict = readFileSync(path, 'utf8');
  const sha = createHash('sha256').update(dict, 'utf8').digest('hex');
  if (sha !== SHA256) throw new Error(`${path} has sha256 ${sha}, not ${SHA256} (cmudict commit ${COMMIT}).`);
  const words = new Map();
  parse(dict, words);
  const fromDictionary = words.size;
  const extra = readFileSync(join(ROOT, 'scripts/pronunciation-extra.txt'), 'utf8');
  parse(extra.split('\n').filter((l) => !l.startsWith('!')).join('\n'), words);
  parse(extra.split('\n').filter((l) => l.startsWith('!')).map((l) => l.slice(1)).join('\n'), words, { first: true });
  const added = words.size - fromDictionary;
  const own = new Set();
  for (const raw of extra.split('\n')) {
    const head = raw.replace(/^!/, '').trim().split(/\s+/)[0];
    if (head && !head.startsWith('#')) own.add(head.replace(/\(\d+\)$/, '').toLowerCase());
  }
  // "'tis" is also listed as "tis", as build-pronunciation.mjs does.
  let aliases = 0;
  for (const [word, list] of [...words]) {
    const bare = word.replace(/^'+/, '');
    if (bare !== word && bare && !words.has(bare)) {
      words.set(bare, list);
      aliases++;
    }
  }
  const scowl = await scowlWords();
  // SCOWL's notice is its release's whole Copyright file (build-pronunciation.mjs scowlLicence); never shorten it.
  const SCOWL_LICENCE = scowlLicence(scowl.copyright);
  const listed = (w) => own.has(w) || own.has(`'${w}`) || scowl.words.has(w) || scowl.words.has(`'${w}`);
  let unlisted = 0;
  let variants = 0;
  const lines = [];
  for (const word of [...words.keys()].sort()) {
    const list = words.get(word);
    variants += list.length - 1;
    const mark = listed(word) ? '' : '^';
    if (mark) unlisted++;
    lines.push(`${word}${mark} ${list.join(',')}`);
  }
  const data = lines.join('\n');
  if (/[`\\]|\$\{/.test(data)) throw new Error('The table contains a character that would break the template string');
  const header = `/**
 * GENERATED by scripts/build-voice-lexicon.mjs. Do not edit: change the script or
 * scripts/pronunciation-extra.txt and run it again.
 *
 * How the voice says English words: the CMU Pronouncing Dictionary (${fromDictionary} words;
 * github.com/cmusphinx/cmudict commit ${COMMIT}, cmudict.dict sha256 ${SHA256}),
 * ${added} words of the game's own (scripts/pronunciation-extra.txt) and ${aliases} spellings without their opening
 * apostrophe; ${variants} further pronunciations after each word's first. ${unlisted} words that SCOWL ${SCOWL_VERSION}
 * (size ${SCOWL_SIZE}, sha256 ${SCOWL_SHA256}) does not list as words are marked "^".
 * Format: "<word>[^] <pron>[,<pron>...]"; one character per sound (scripts/build-pronunciation.mjs
 * SOUND), a stressed vowel followed by 1 or 2. Loaded on demand by g2p-en.ts (loadVoiceLexicon),
 * only when the voice is turned on.
 *
${LICENCE.split('\n').map((l) => ` * ${l}`.trimEnd()).join('\n')}
 *
${SCOWL_LICENCE.split('\n').map((l) => ` * ${l}`.trimEnd()).join('\n')}
 */
`;
  const notice = `${LICENCE}\n\n${SCOWL_LICENCE}`.split('\n').map((l) => `# ${l}`.trimEnd()).join('\n').replace(/`/g, '\\`');
  const source = `${header}export default \`${notice}\n${data}\`;\n`;
  writeFileSync(OUT, source);
  const bytes = Buffer.byteLength(source);
  console.log(`${OUT}: ${words.size} words (${unlisted} not in SCOWL's lists, ${variants} further pronunciations), ${bytes} bytes, gzip ${gzipSync(source).length}, brotli ${brotliCompressSync(source).length}; cmudict ${COMMIT} ${sha}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
