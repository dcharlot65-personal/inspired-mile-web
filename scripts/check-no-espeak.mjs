#!/usr/bin/env node
/**
 * Fails when a build holds eSpeak NG (GPL-3.0-or-later) or the npm package "phonemizer" that
 * wraps it. `npm run build` runs it on dist/ after `astro build`.
 *
 *   node scripts/check-no-espeak.mjs [dir]      (default: dist)
 *
 * kokoro-js imports "phonemizer"; astro.config.mjs swaps it for src/lib/voice/no-espeak.ts. This
 * check is what proves the swap held: on the build of c22b035a (before it) it finds the package
 * in the voice's chunk.
 *
 * What it looks for, in every file under the folder:
 *   - the names phonemizer's Emscripten glue uses (eSpeakNGWorker, espeak-ng-data,
 *     espeakEVENT_, synthesize_ipa, espeak-ng-ipa-tmp-) and eSpeak NG's data files (phontab,
 *     phonindex), and the package by its path or its description;
 *   - eSpeak NG's own name, "eSpeak" or "espeak-ng" / "espeak_ng" / "espeak_X", as a word: not
 *     inside another one (Transformers.js has a "WeSpeaker" model; the CMU table has "bespeak");
 *   - the same inside every long base64 run of a text file, decoded, and gunzipped when it is
 *     gzip: phonemizer carries eSpeak's program and data that way, where no text search sees them.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

export const MARKERS = [
  'eSpeakNGWorker',
  'espeak-ng-data',
  'espeakEVENT_',
  'synthesize_ipa',
  'espeak-ng-ipa-tmp-',
  'phontab',
  'phonindex',
  'node_modules/phonemizer',
  'phonemizer/dist',
  'Simple text to phones converter using eSpeak',
];
/** eSpeak NG's name as a word of its own. */
export const NAME = /(?<![A-Za-z])(?:eSpeak|ESPEAK|espeak[-_]ng)|(?<![A-Za-z])espeak_[A-Za-z]/;
const TEXT = /\.(?:m?js|cjs|html?|css|json|txt|xml|svg|map|webmanifest)$/i;
const BASE64_RUN = /[A-Za-z0-9+/]{4096,}={0,2}/g;

/** The markers found in one buffer (read as Latin-1, so any byte sequence can be searched). */
export function markersIn(buf) {
  const text = buf.toString('latin1');
  const found = MARKERS.filter((m) => text.includes(m));
  const name = NAME.exec(text);
  if (name) found.push(name[0]);
  return found;
}

/** Every finding in one file: [{ marker, where }]. */
export function scanFile(name, buf) {
  const findings = [];
  if (/phonemizer|espeak/i.test(name)) findings.push({ marker: 'file name', where: 'name' });
  for (const marker of markersIn(buf)) findings.push({ marker, where: 'bytes' });
  if (TEXT.test(name)) {
    const text = buf.toString('latin1');
    for (const m of text.matchAll(BASE64_RUN)) {
      let bytes = Buffer.from(m[0], 'base64');
      let where = 'base64';
      if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
        try {
          bytes = gunzipSync(bytes);
          where = 'gzip in base64';
        } catch {
          // a run that only starts like gzip: search it as it is
        }
      }
      for (const marker of markersIn(bytes)) findings.push({ marker, where: `${where} at ${m.index}` });
    }
  } else if (buf[0] === 0x1f && buf[1] === 0x8b) {
    try {
      for (const marker of markersIn(gunzipSync(buf))) findings.push({ marker, where: 'gzip' });
    } catch {
      // not gzip after all
    }
  }
  return findings;
}

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else yield path;
  }
}

/** Every finding under a folder: [{ file, marker, where }], and how many files were read. */
export function scanDir(dir) {
  const findings = [];
  let count = 0;
  for (const path of files(dir)) {
    count++;
    // The name check reads the path inside the folder only: the folder's own name is not the build's.
    const file = relative(dir, path);
    for (const f of scanFile(file, readFileSync(path))) findings.push({ file, ...f });
  }
  return { findings, files: count };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2] ?? 'dist';
  const { findings, files: count } = scanDir(dir);
  if (findings.length) {
    console.error(`check-no-espeak: eSpeak NG (GPL-3.0-or-later) or the phonemizer package is in ${dir}/:`);
    for (const f of findings.slice(0, 40)) console.error(`  ${f.file}: ${f.marker} (${f.where})`);
    if (findings.length > 40) console.error(`  ... and ${findings.length - 40} more`);
    console.error('The voice must read English with src/lib/voice/g2p-en.ts; see astro.config.mjs (the phonemizer alias).');
    process.exit(1);
  }
  console.log(`check-no-espeak: ${count} files in ${dir}/, no eSpeak NG and no phonemizer.`);
}
