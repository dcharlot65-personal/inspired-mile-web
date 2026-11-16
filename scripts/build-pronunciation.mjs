#!/usr/bin/env node
/**
 * Builds src/lib/verse/pron-en.ts: what the verse rules need to know about how
 * English words sound, reduced from the CMU Pronouncing Dictionary.
 *
 *   node scripts/build-pronunciation.mjs [path/to/cmudict.dict]
 *
 * Without a path the dictionary is downloaded to the system temp folder (it is
 * about 3.6 MB and is NOT committed). The output is committed: the site build
 * needs no network, and the same table scores every match.
 *
 * For each word the game needs two things:
 *   - how many syllables it has (every count its pronunciations give), and
 *   - its rhyme key: the sounds from the last stressed vowel to the end.
 *
 * Words the dictionary lacks and the game cannot do without (its own character
 * names, the "thee" and "thou" of stage verse) are in scripts/pronunciation-extra.txt.
 *
 * Output format, one line per rhyme key:   <key>\t<word><counts> <word><counts> …
 * A key is one character per sound (table below); <counts> is one digit per
 * syllable count, the commonest pronunciation first. A word with two
 * pronunciations appears under both keys.
 *
 * CMUdict: Copyright (C) 1993-2015 Carnegie Mellon University. BSD 2-clause style
 * licence; the notice is reproduced in the generated file.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = 'https://raw.githubusercontent.com/cmusphinx/cmudict/master/cmudict.dict';
const OUT = join(ROOT, 'src/lib/verse/pron-en.ts');

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

function parse(text, into, { first = false } = {}) {
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\s+#.*$/, '').trim();
    if (!line || line.startsWith('#') || line.startsWith(';;;')) continue;
    const [head, ...phones] = line.split(/\s+/);
    const word = head.replace(/\(\d+\)$/, '').toLowerCase();
    if (!/^'?[a-z]+(?:'[a-z]+)*'?$/.test(word) || !phones.length) continue;
    const r = reduce(phones);
    if (!r) continue;
    const list = into.get(word) ?? [];
    if (!into.has(word)) into.set(word, list);
    if (first) list.unshift(r);
    else list.push(r);
  }
}

async function main() {
  let path = process.argv[2];
  if (!path) {
    path = join(tmpdir(), 'cmudict.dict');
    if (!existsSync(path)) {
      const res = await fetch(SOURCE);
      if (!res.ok) throw new Error(`Could not download ${SOURCE}: ${res.status}`);
      writeFileSync(path, await res.text());
    }
  }
  const words = new Map();
  parse(readFileSync(path, 'utf8'), words);
  const fromDictionary = words.size;

  // Extras: a word the dictionary lacks is added; one it has gains a pronunciation.
  // A line starting with "!" puts its pronunciation first (the game's own reading of a name).
  const extra = readFileSync(join(ROOT, 'scripts/pronunciation-extra.txt'), 'utf8');
  parse(extra.split('\n').filter((l) => !l.startsWith('!')).join('\n'), words);
  parse(extra.split('\n').filter((l) => l.startsWith('!')).map((l) => l.slice(1)).join('\n'), words, { first: true });

  const added = words.size - fromDictionary;

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
  for (const [word, list] of words) {
    const counts = [...new Set(list.flatMap((r) => r.counts))].map((n) => Math.min(n, 9)).join('');
    for (const key of new Set(list.map((r) => r.key))) {
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(word + counts);
    }
  }
  const lines = [...byKey.keys()].sort().map((key) => `${key}\t${byKey.get(key).sort().join(' ')}`);
  const data = lines.join('\n');
  if (/[`\\]|\$\{/.test(data)) throw new Error('The table contains a character that would break the template string');

  const header = `/**
 * GENERATED by scripts/build-pronunciation.mjs. Do not edit: change the script or
 * scripts/pronunciation-extra.txt and run it again.
 *
 * English syllable counts and rhyme keys, reduced from the CMU Pronouncing
 * Dictionary (${fromDictionary} words), ${added} words of the game's own (scripts/pronunciation-extra.txt)
 * and ${aliases} spellings without their opening apostrophe.
 * Loaded on demand by pronounce.ts (loadPronunciation); never part of a page's first load.
 *
 * The CMU Pronouncing Dictionary is Copyright (C) 1993-2015 Carnegie Mellon
 * University. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice,
 *    this list of conditions and the following disclaimer.
 *    The contents of this file are deemed to be source code.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 * This work was supported in part by funding from the Defense Advanced Research
 * Projects Agency, the Office of Naval Research and the National Science
 * Foundation of the United States of America, and by member companies of the
 * Carnegie Mellon Sphinx Speech Consortium. We acknowledge the contributions of
 * many volunteers to the expansion and improvement of this dictionary.
 *
 * THIS SOFTWARE IS PROVIDED BY CARNEGIE MELLON UNIVERSITY \`\`AS IS'' AND ANY
 * EXPRESSED OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL CARNEGIE MELLON UNIVERSITY NOR ITS EMPLOYEES BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */
`;
  writeFileSync(OUT, `${header}export default \`${data}\`;\n`);
  console.log(`${OUT}: ${words.size} words, ${byKey.size} rhyme keys, ${Buffer.byteLength(data)} bytes`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
