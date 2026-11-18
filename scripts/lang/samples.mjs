#!/usr/bin/env node
/**
 * The sentences a player can read in one language, as JSON on stdout: { key: [sentence, …] }, every
 * interface string filled in as the pages fill it (lib/strings.mjs renderSamples: one sentence per
 * plural form, a card's and a model's real names where the page puts them).
 *
 *   node scripts/lang/samples.mjs ar
 *
 * tests/theatre-bidi.spec.ts draws each of them on a canvas.
 */
import { LOCALES, renderSamples, uiStrings, HOUSE_QUOTES } from './lib/strings.mjs';

const lang = process.argv[2];
if (!LOCALES.includes(lang)) {
  console.error(`usage: node scripts/lang/samples.mjs <${LOCALES.join('|')}>`);
  process.exit(2);
}
const out = {};
for (const [key, template] of Object.entries(await uiStrings(lang))) {
  if (key in HOUSE_QUOTES) continue;
  out[key] = (await renderSamples(lang, template, { key })).map((s) => s.text);
}
process.stdout.write(JSON.stringify(out));
