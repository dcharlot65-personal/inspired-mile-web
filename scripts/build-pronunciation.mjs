#!/usr/bin/env node
/**
 * Builds src/lib/verse/pron-en.ts: what the verse rules need to know about how
 * English words sound, reduced from the CMU Pronouncing Dictionary.
 *
 *   node scripts/build-pronunciation.mjs [path/to/cmudict.dict]
 *
 * Without a path the dictionary is downloaded to the system temp folder (it is
 * about 3.6 MB and is NOT committed). The output is committed: the site build
 * needs no network, and the same table scores every match. The dictionary is
 * pinned to one commit of github.com/cmusphinx/cmudict and its sha256 (COMMIT,
 * SHA256 below): a file that differs is refused, so the table cannot change
 * without this script changing.
 *
 * For each word the game needs two things:
 *   - how many syllables it has (every count its pronunciations give), and
 *   - its rhyme key: the sounds from the last stressed vowel to the end.
 *
 * Words the dictionary lacks and the game cannot do without (its own character
 * names, the "thee" and "thou" of stage verse) are in scripts/pronunciation-extra.txt.
 *
 * Output format, one line per rhyme key:   <key>\t<word><counts>[*^] <word><counts>[*^] …
 * A key is one character per sound (table below); <counts> is one digit per
 * syllable count, the commonest pronunciation first. A word with two
 * pronunciations appears under both keys. A "*" marks a word the dictionary only
 * says letter by letter ("cd" is S IY D IY, "tv", "fbi"): an abbreviation, which
 * the substance floor does not count as a word (text.ts lexiconHas).
 *
 * A "^" marks a word the dictionary has but a dictionary of words does not: CMUdict lists
 * names, abbreviations said as words ("dr", "mt", "oz") and fragments ("ul", "fsi") beside
 * English words, and a speech dictionary must, but a verse made of them is not words. The
 * word lists are SCOWL's (Spell Checker Oriented Word Lists, wordlist.aspell.net), release
 * SCOWL_VERSION below pinned by its sha256, size SCOWL_SIZE (the size its author recommends
 * for spell checking): the English, American, British and Canadian words, the contractions,
 * and the capitalised words of the smallest sizes (months, days, nationalities), without its
 * lists of proper names and abbreviations. The game's own words
 * (scripts/pronunciation-extra.txt) are never marked. Neither mark changes rhyme or syllables.
 *
 * CMUdict: Copyright (C) 1993-2015 Carnegie Mellon University. BSD 2-clause style
 * licence; the notice is reproduced in the generated file. SCOWL: Copyright 2000-2018 by Kevin
 * Atkinson and the authors its Copyright file names (VarCon, Ispell, WordNet and others, each
 * with its own notice). That file is reproduced whole, as the release has it, in the generated
 * file and in public/licenses/SCOWL-Copyright.txt, which this script writes.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
/** The commit of github.com/cmusphinx/cmudict the table is built from (master on 2026-11-16), and the sha256 of its cmudict.dict. */
const COMMIT = '74790861f652b15e4ac49015a90074ad62a27690';
const SHA256 = '81917843c7f44ce2b094ac63873c2c7a4cf802040792c455ba3ca406891c3d22';
const SOURCE = `https://raw.githubusercontent.com/cmusphinx/cmudict/${COMMIT}/cmudict.dict`;
const OUT = join(ROOT, 'src/lib/verse/pron-en.ts');
/** SCOWL's Copyright file, byte for byte, served beside the other notices (/licenses/SCOWL-Copyright.txt). */
const SCOWL_COPYRIGHT_OUT = join(ROOT, 'public/licenses/SCOWL-Copyright.txt');
/** SCOWL, the word lists a word must be in to count as a word (see "^" above). */
const SCOWL_VERSION = '2020.12.07';
const SCOWL_SHA256 = '5587667caa20c4891390c2d42dbb4d5c4c3f41bee77af1457ece3ba23fb859cc';
const SCOWL_SOURCE = `https://downloads.sourceforge.net/project/wordlist/SCOWL/${SCOWL_VERSION}/scowl-${SCOWL_VERSION}.tar.gz`;
/** SCOWL's sizes run 10 (commonest) to 95; 60 is the size its README recommends for spell checking. */
const SCOWL_SIZE = 60;
/** The capitalised words ("English", "April") of the sizes up to this one only: from size 50 on they are mostly names. */
const SCOWL_UPPER_SIZE = 35;
const SCOWL_WORDS = ['english-words', 'american-words', 'british-words', 'canadian-words', 'english-contractions'];
const SCOWL_UPPER = ['english-upper'];

/** One character per sound. Vowels are the characters in VOWELS (src/lib/verse/pronounce.ts has the same string). */
export const SOUND = {
  AA: 'A', AE: 'a', AH: 'u', AO: 'O', AW: 'W', AY: 'Y', EH: 'e', ER: 'R', EY: 'E', IH: 'i', IY: 'I', OW: 'o', OY: 'y', UH: 'U', UW: 'w',
  B: 'b', CH: 'C', D: 'd', DH: 'D', F: 'f', G: 'g', HH: 'h', JH: 'j', K: 'k', L: 'l', M: 'm', N: 'n', NG: 'G', P: 'p', R: 'r',
  S: 's', SH: 'S', T: 't', TH: 'T', V: 'v', W: '9', Y: '8', Z: 'z', ZH: 'Z',
};
export const VOWELS = 'AauOWYeREiIoyUw';

/**
 * The rhyme key of one pronunciation, and its syllable counts.
 *
 * Sounds that rhyme to the ear but are written differently in the dictionary
 * are brought together:
 *   - "AO" and "AA" (dawn / on, fall / doll) except before R (war does not rhyme with star);
 *   - "IY R" and "IH R" (here is IY R, fear is IH R in the dictionary; they rhyme);
 *   - an unstressed "ER" straight after a vowel is the same as "R" (fire F AY ER / pyre P AY R).
 * That last case is also why "fire", "hour" and "flower" count as one syllable or two.
 */
export function reduce(phones) {
  const vowelAt = phones.map((p) => /\d$/.test(p));
  const count = vowelAt.filter(Boolean).length;
  let start = -1;
  for (let i = phones.length - 1; i >= 0; i--) if (/[12]$/.test(phones[i])) { start = i; break; }
  if (start < 0) for (let i = phones.length - 1; i >= 0; i--) if (vowelAt[i]) { start = i; break; }
  if (start < 0) return null;
  let glide = false;
  const out = [];
  for (let i = start; i < phones.length; i++) {
    let p = phones[i].replace(/\d$/, '');
    const next = (phones[i + 1] ?? '').replace(/\d$/, '');
    const prev = i > 0 ? phones[i - 1] : '';
    if (p === 'AO' && next !== 'R') p = 'AA';
    if (p === 'IY' && next === 'R') p = 'IH';
    if (phones[i] === 'ER0' && /^(AY|AW|OY)\d$/.test(prev)) { p = 'R'; glide = true; }
    if (!SOUND[p]) return null;
    out.push(SOUND[p]);
  }
  // A glide before the key ("higher" inside "higher up") still makes the word a syllable shorter when slurred.
  for (let i = 1; i < start; i++) if (phones[i] === 'ER0' && /^(AY|AW|OY)\d$/.test(phones[i - 1])) glide = true;
  const counts = glide && count > 1 ? [count, count - 1] : [count];
  return { key: out.join(''), counts };
}

/** The dictionary's licence: kept in the generated source, and shipped inside the table itself (below). */
export const LICENCE = `The CMU Pronouncing Dictionary is Copyright (C) 1993-2015 Carnegie Mellon
University. All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.
   The contents of this file are deemed to be source code.
2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

This work was supported in part by funding from the Defense Advanced Research
Projects Agency, the Office of Naval Research and the National Science
Foundation of the United States of America, and by member companies of the
Carnegie Mellon Sphinx Speech Consortium. We acknowledge the contributions of
many volunteers to the expansion and improvement of this dictionary.

THIS SOFTWARE IS PROVIDED BY CARNEGIE MELLON UNIVERSITY \`\`AS IS'' AND ANY
EXPRESSED OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL CARNEGIE MELLON UNIVERSITY NOR ITS EMPLOYEES BE
LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
POSSIBILITY OF SUCH DAMAGE.`;

/**
 * SCOWL's notice, shipped with the marks derived from it: its Copyright file, whole. That file says the
 * collective work is under "any of the copyrights mentioned below" (VarCon, Ispell, WordNet, UKACD and others),
 * so its first paragraph alone is not the notice.
 */
export function scowlLicence(copyright) {
  return `SCOWL (Spell Checker Oriented Word Lists), release ${SCOWL_VERSION}. Its Copyright file, in full:\n\n${copyright.replace(/\s+$/, '')}`;
}

/** The words of SCOWL's lists (see SCOWL_SIZE), lower case, from the release tarball (downloaded, then checked by sha256). */
async function scowlWords() {
  const dir = join(tmpdir(), `scowl-${SCOWL_VERSION}`);
  const tgz = `${dir}.tar.gz`;
  if (!existsSync(tgz)) {
    const res = await fetch(SCOWL_SOURCE);
    if (!res.ok) throw new Error(`Could not download ${SCOWL_SOURCE}: ${res.status}`);
    writeFileSync(tgz, Buffer.from(await res.arrayBuffer()));
  }
  const sha = createHash('sha256').update(readFileSync(tgz)).digest('hex');
  if (sha !== SCOWL_SHA256) throw new Error(`${tgz} has sha256 ${sha}, not ${SCOWL_SHA256} (SCOWL ${SCOWL_VERSION}). Check the new lists, then update SCOWL_VERSION and SCOWL_SHA256.`);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    execFileSync('tar', ['xzf', tgz, '-C', dir]);
  }
  const final = join(dir, `scowl-${SCOWL_VERSION}`, 'final');
  const words = new Set();
  let files = 0;
  for (const f of readdirSync(final)) {
    const m = /^(.+)\.(\d+)$/.exec(f);
    if (!m) continue;
    const size = Number(m[2]);
    if (!((SCOWL_WORDS.includes(m[1]) && size <= SCOWL_SIZE) || (SCOWL_UPPER.includes(m[1]) && size <= SCOWL_UPPER_SIZE))) continue;
    files++;
    // The lists are ISO-8859-1.
    for (const w of readFileSync(join(final, f), 'latin1').split('\n')) if (w.trim()) words.add(w.trim().toLowerCase());
  }
  if (files < 20) throw new Error(`Only ${files} SCOWL lists found in ${final}`);
  const copyright = readFileSync(join(dir, `scowl-${SCOWL_VERSION}`, 'Copyright'), 'latin1');
  return { words, files, copyright };
}

function parse(text, into, { first = false } = {}) {
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\s+#.*$/, '').trim();
    if (!line || line.startsWith('#') || line.startsWith(';;;')) continue;
    const [head, ...phones] = line.split(/\s+/);
    const word = head.replace(/\(\d+\)$/, '').toLowerCase();
    if (!/^'?[a-z]+(?:'[a-z]+)*'?$/.test(word) || !phones.length) continue;
    const r = reduce(phones);
    if (!r) continue;
    r.phones = phones.map((p) => p.replace(/\d$/, '')).join(' ');
    const list = into.get(word) ?? [];
    if (!into.has(word)) into.set(word, list);
    if (first) list.unshift(r);
    else list.push(r);
  }
}

/**
 * Is every pronunciation the dictionary gives this word its letters said one by one? Then it
 * is an abbreviation ("cd", "tv", "fbi"), not a word. Letter names are the dictionary's own
 * entries for "a" to "z"; stress is ignored.
 */
function spelledOut(word, list, words) {
  if (!/^[a-z]{2,6}$/.test(word)) return false;
  const names = [...word].map((ch) => new Set((words.get(ch) ?? []).map((r) => r.phones)));
  const can = (phones, i) => {
    if (i === word.length) return phones === '';
    for (const name of names[i]) {
      if (phones === name && i === word.length - 1) return true;
      if (phones.startsWith(`${name} `) && can(phones.slice(name.length + 1), i + 1)) return true;
    }
    return false;
  };
  return list.length > 0 && list.every((r) => r.phones && can(r.phones, 0));
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
  if (sha !== SHA256) throw new Error(`${path} has sha256 ${sha}, not ${SHA256} (cmudict commit ${COMMIT}). Check the new dictionary, then update COMMIT and SHA256.`);
  const words = new Map();
  parse(dict, words);
  const fromDictionary = words.size;

  // Extras: a word the dictionary lacks is added; one it has gains a pronunciation.
  // A line starting with "!" puts its pronunciation first (the game's own reading of a name).
  const extra = readFileSync(join(ROOT, 'scripts/pronunciation-extra.txt'), 'utf8');
  parse(extra.split('\n').filter((l) => !l.startsWith('!')).join('\n'), words);
  parse(extra.split('\n').filter((l) => l.startsWith('!')).map((l) => l.slice(1)).join('\n'), words, { first: true });

  const added = words.size - fromDictionary;
  // Every word of the extras file is the game's own: a word, whatever the word lists say.
  const own = new Set();
  for (const raw of extra.split('\n')) {
    const head = raw.replace(/^!/, '').trim().split(/\s+/)[0];
    if (head && !head.startsWith('#')) own.add(head.replace(/\(\d+\)$/, '').toLowerCase());
  }
  const scowl = await scowlWords();

  // "'tis" reaches the rules as "tis" (a word starts at its first letter), so a word written
  // with an opening apostrophe is listed without it as well. An apostrophe inside a word
  // ("don't", "o'er") stays: the rules keep it.
  let aliases = 0;
  for (const [word, list] of [...words]) {
    const bare = word.replace(/^'+/, '');
    if (bare !== word && bare && !words.has(bare)) {
      words.set(bare, list);
      aliases++;
    }
  }

  // Every character name in the catalogue must be in the table: haiku counts their syllables.
  const cards = readFileSync(join(ROOT, 'src/lib/cards.ts'), 'utf8');
  const missing = new Set();
  for (const block of cards.split(/\n  \{\n/).slice(1)) {
    if (!/type:\s*'Character'/.test(block)) continue;
    const name = block.match(/name:\s*(?:'((?:[^'\\]|\\.)*)'|"([^"]*)")/);
    for (const part of (name?.[1] ?? name?.[2] ?? '').replace(/\\'/g, "'").toLowerCase().split(/[^a-z']+/)) {
      if (part && !words.has(part)) missing.add(part);
    }
  }
  if (missing.size) throw new Error(`Character names with no pronunciation (add them to scripts/pronunciation-extra.txt): ${[...missing].join(', ')}`);

  const byKey = new Map();
  let spelled = 0;
  let unlisted = 0;
  /** In SCOWL's lists, or the game's own (an opening apostrophe dropped, as the rules read "'tis"). */
  const listed = (word) => own.has(word) || own.has(`'${word}`) || scowl.words.has(word) || scowl.words.has(`'${word}`);
  for (const [word, list] of words) {
    const counts = [...new Set(list.flatMap((r) => r.counts))].map((n) => Math.min(n, 9)).join('');
    const mark = spelledOut(word, list, words) ? '*' : listed(word) ? '' : '^';
    if (mark === '*') spelled++;
    if (mark === '^') unlisted++;
    for (const key of new Set(list.map((r) => r.key))) {
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(word + counts + mark);
    }
  }
  const lines = [...byKey.keys()].sort().map((key) => `${key}\t${byKey.get(key).sort().join(' ')}`);
  const data = lines.join('\n');
  if (/[`\\]|\$\{/.test(data)) throw new Error('The table contains a character that would break the template string');

  const SCOWL_NOTICE = scowlLicence(scowl.copyright);
  // Each notice line becomes a "#" line of the data, which the readers skip because it holds no tab; and the
  // header is a comment, which "*/" would end.
  if (/\t/.test(`${LICENCE}${SCOWL_NOTICE}`)) throw new Error('A licence notice holds a tab: the table reader would take its line for a table line');
  if (/\*\//.test(`${LICENCE}${SCOWL_NOTICE}`)) throw new Error('A licence notice holds "*/", which would end the generated header comment');
  const header = `/**
 * GENERATED by scripts/build-pronunciation.mjs. Do not edit: change the script or
 * scripts/pronunciation-extra.txt and run it again.
 *
 * English syllable counts and rhyme keys, reduced from the CMU Pronouncing
 * Dictionary (${fromDictionary} words; github.com/cmusphinx/cmudict commit ${COMMIT},
 * cmudict.dict sha256 ${SHA256}), ${added} words of the game's own
 * (scripts/pronunciation-extra.txt) and ${aliases} spellings without their opening apostrophe.
 * ${spelled} words the dictionary only says letter by letter are marked "*"; ${unlisted} words that
 * SCOWL ${SCOWL_VERSION} (size ${SCOWL_SIZE}, sha256 ${SCOWL_SHA256}) does not list
 * as words are marked "^" (${scowl.words.size} SCOWL words from ${scowl.files} lists).
 * Loaded on demand by pronounce.ts (loadPronunciation); never part of a page's first load.
 *
${LICENCE.split('\n').map((l) => ` * ${l}`.trimEnd()).join('\n')}
 *
${SCOWL_NOTICE.split('\n').map((l) => ` * ${l}`.trimEnd()).join('\n')}
 */
`;
  // The licence also travels inside the data, as lines that start with "#" (no tab, so the
  // reader skips them): a build minifies comments away, and the table it ships is a
  // redistribution that must carry the notice.
  // In a template string a backslash, a back-tick and "${" mean something: each is escaped, so the string reads
  // as the notice does (SCOWL's names the maintainer of ENABLE as M\Cooper).
  const notice = `${LICENCE}\n\n${SCOWL_NOTICE}`
    .split('\n')
    .map((l) => `# ${l}`.trimEnd())
    .join('\n')
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');
  writeFileSync(OUT, `${header}export default \`${notice}\n${data}\`;\n`);
  writeFileSync(SCOWL_COPYRIGHT_OUT, scowl.copyright, 'latin1');
  console.log(`${OUT}: ${words.size} words (${spelled} said letter by letter, ${unlisted} not in SCOWL's lists), ${byKey.size} rhyme keys, ${Buffer.byteLength(data)} bytes; cmudict ${COMMIT} ${sha}; SCOWL ${SCOWL_VERSION} ${SCOWL_SHA256}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
