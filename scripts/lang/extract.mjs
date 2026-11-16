#!/usr/bin/env node
/**
 * Write every translated string to one JSON file, for the tools that are not
 * JavaScript (the translation model, the reviewer).
 *
 *   node scripts/lang/extract.mjs [out.json]          default .langqa/strings.json
 *   node scripts/lang/extract.mjs --samples [out]     also the rendered sentences
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { allStrings, renderSamples, ROOT, HOUSE_QUOTES } from './lib/strings.mjs';

const args = process.argv.slice(2);
const withSamples = args.includes('--samples');
const out = resolve(args.find((a) => !a.startsWith('--')) ?? `${ROOT}.langqa/strings.json`);
const strings = await allStrings();
if (withSamples) {
  for (const [lang, s] of Object.entries(strings)) {
    s.samples = {};
    s.typical = {};
    for (const [key, template] of Object.entries(s.ui)) {
      if (key in HOUSE_QUOTES) continue;
      s.samples[key] = await renderSamples(lang, template);
      s.typical[key] = (await renderSamples(lang, template, { typical: true }))[0].text;
    }
  }
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(strings, null, 1) + '\n');
const n = Object.values(strings).reduce((a, s) => a + Object.keys(s.ui).length + Object.keys(s.pack).length, 0);
console.log(`${out}: ${Object.keys(strings).length} languages, ${n} strings`);
