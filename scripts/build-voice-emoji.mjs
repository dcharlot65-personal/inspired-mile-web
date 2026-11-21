#!/usr/bin/env node
/**
 * Builds src/lib/voice/emoji-en.ts: what the voice says for an emoji inside English text ("I 💀
 * you" is "I skull you"), from Unicode CLDR's English short names for text to speech (the "tts"
 * annotation), not from memory.
 *
 *   node scripts/build-voice-emoji.mjs <folder>
 *
 * <folder> holds the downloaded sources (the script fetches any that are missing into it and
 * refuses any whose sha256 is not the one recorded here):
 *   cldr-annotations-full-49.0.0.tgz          CLDR 49 annotations (npm, from unicode-org/cldr-json):
 *                                             annotations/en/annotations.json, every single emoji.
 *   cldr-annotations-derived-full-49.0.0.tgz  CLDR 49 derived annotations: flags, keycaps and
 *                                             sequences joined with ZWJ (annotationsDerived/en).
 * Both are Unicode License v3 for their data (the packages' LICENSE: only the text of UTS #35, the
 * standard, is under Unicode's terms of use, and these packages hold none of it). The licence's
 * notice travels inside the data string, so it ships with every copy (a build strips comments).
 *
 * What is kept: entries with an emoji in them (a pictographic character, a regional indicator or
 * a keycap); not CLDR's names for punctuation and symbols such as "#" or "%", which g2p-en.ts
 * reads itself; not those Unicode's compatibility normalisation (NFKC, which normalise() applies)
 * turns into letters or marks ("™" is "TM", "‼" is "!!"), which stay as they read now. The emoji
 * presentation selector (U+FE0F) is taken out of every key. A derived entry that only adds a skin
 * tone to one kept without it is left out: the voice says "thumbs up" for every 👍, whatever its
 * tone (g2p-en.ts takes the tone off before it looks).
 *
 * Output format, after the notice's "#" lines, one line per emoji, sorted:   <emoji>\t<name>
 * The output is committed; the site build needs no network.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src/lib/voice/emoji-en.ts');
const FETCHED = '2026-11-20';
const SOURCES = {
  base: {
    file: 'cldr-annotations-full-49.0.0.tgz',
    url: 'https://registry.npmjs.org/cldr-annotations-full/-/cldr-annotations-full-49.0.0.tgz',
    sha256: 'ce415a4898da7a4ca755437de2593863c05045fc6b1649d8da5ee05fa3bdc33b',
    json: 'package/annotations/en/annotations.json',
  },
  derived: {
    file: 'cldr-annotations-derived-full-49.0.0.tgz',
    url: 'https://registry.npmjs.org/cldr-annotations-derived-full/-/cldr-annotations-derived-full-49.0.0.tgz',
    sha256: 'e83ab0348ec09f4b5bb27f658b9c424c9c8fbf512484b728903515b9f01c3c28',
    json: 'package/annotationsDerived/en/annotations.json',
  },
};

const dir = process.argv[2];
if (!dir) throw new Error('usage: node scripts/build-voice-emoji.mjs <folder for the sources>');
mkdirSync(dir, { recursive: true });

const sha = (buf) => createHash('sha256').update(buf).digest('hex');

/** The source's JSON and LICENSE, after its sha256 is checked. */
async function source({ file, url, sha256, json }) {
  const path = join(dir, file);
  if (!existsSync(path)) writeFileSync(path, Buffer.from(await (await fetch(url)).arrayBuffer()));
  const got = sha(readFileSync(path));
  if (got !== sha256) throw new Error(`${file} has sha256 ${got}, not the recorded ${sha256}; check it and update the script`);
  const into = join(dir, file.replace(/\.tgz$/, ''));
  mkdirSync(into, { recursive: true });
  execFileSync('tar', ['xzf', path, '-C', into, json, 'package/LICENSE']);
  return { data: JSON.parse(readFileSync(join(into, json), 'utf8')), licence: readFileSync(join(into, 'package/LICENSE'), 'utf8') };
}

const base = await source(SOURCES.base);
const derived = await source(SOURCES.derived);
if (base.licence !== derived.licence) throw new Error('the two packages give different LICENSE files; read both and update the script');
if (!/All other content in this repo is released under UNICODE LICENSE V3/.test(base.licence) || !/SPDX-License-Identifier: Unicode-3\.0/.test(base.licence)) {
  throw new Error('the LICENSE no longer says the data is Unicode License v3; read it and update the script');
}

/** The data's licence: Unicode's copyright line and the Unicode License v3 text, as the package gives them. */
const copyright = /^Copyright © .*Unicode, Inc\.$/m.exec(base.licence)?.[0];
const permission = base.licence.slice(base.licence.indexOf('NOTICE TO USER:')).trim();
if (!copyright || !permission.startsWith('NOTICE TO USER:')) throw new Error('the LICENSE has changed shape; read it and update the script');
const NOTICE = `UNICODE LICENSE V3\n\nCOPYRIGHT AND PERMISSION NOTICE\n\n${copyright}\n\n${permission}`;

const PICTURE = /[\p{Extended_Pictographic}\p{Regional_Indicator}\u20E3]/u;
const TONE = /[\u{1F3FB}-\u{1F3FF}]/gu;
const plain = (k) => k.replace(/\uFE0F/g, '');
/** Kept: an emoji, which NFKC leaves as it is. */
const keep = (k) => PICTURE.test(k) && plain(k).normalize('NFKC') === plain(k);

const table = new Map();
for (const [k, v] of Object.entries(base.data.annotations.annotations)) {
  if (keep(k) && v.tts?.length) table.set(plain(k), v.tts.join(' '));
}
const baseCount = table.size;
let toneOnly = 0;
const derivedAll = derived.data.annotationsDerived.annotations;
const derivedKeys = new Set(Object.keys(derivedAll).map(plain));
for (const [k, v] of Object.entries(derivedAll)) {
  if (!keep(k) || !v.tts?.length) continue;
  const key = plain(k);
  if (table.has(key)) continue;
  const toneless = key.replace(TONE, '');
  if (toneless !== key && (table.has(toneless) || derivedKeys.has(toneless))) {
    toneOnly++;
    continue;
  }
  table.set(key, v.tts.join(' '));
}

const rows = [...table].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
for (const [k, v] of rows) {
  if (/[\t\n]/.test(k) || /[\t\n]/.test(v)) throw new Error(`a tab or line break in ${JSON.stringify(k)}`);
}
const data = [
  ...`Emoji names for the voice: Unicode CLDR 49 English annotations (tts), from the npm packages cldr-annotations-full and cldr-annotations-derived-full 49.0.0.\n\n${NOTICE}`
    .split('\n')
    .map((l) => `# ${l}`.trimEnd()),
  ...rows.map(([k, v]) => `${k}\t${v}`),
].join('\n');

const out = `/**
 * GENERATED by scripts/build-voice-emoji.mjs. Do not edit: run the script again.
 *
 * What the voice says for an emoji inside English text: Unicode CLDR 49's English short names for
 * text to speech ("tts"), ${rows.length} emoji: ${baseCount} single ones (npm cldr-annotations-full 49.0.0,
 * annotations/en, sha256 ${SOURCES.base.sha256})
 * and ${rows.length - baseCount} flags, keycaps and joined sequences (npm cldr-annotations-derived-full 49.0.0,
 * annotationsDerived/en, sha256 ${SOURCES.derived.sha256});
 * fetched ${FETCHED}. ${toneOnly} derived entries that only add a skin tone are left out (the voice
 * says the emoji without its tone). Format, after the notice: "<emoji>\\t<name>", U+FE0F taken out.
 * Imported by g2p-en.ts, which the page loads only with the voice.
 *
 * Unicode License v3; its notice is the first lines of the data, so it ships with it.
 */
const EMOJI_EN = ${JSON.stringify(data)};
export default EMOJI_EN;
`;
writeFileSync(OUT, out);
console.log(`${OUT}: ${rows.length} emoji (${baseCount} single, ${rows.length - baseCount} derived; ${toneOnly} skin-tone variants left out), ${Buffer.byteLength(data)} bytes of data`);
