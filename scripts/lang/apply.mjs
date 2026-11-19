#!/usr/bin/env node
/**
 * Write new text for some keys into the locale files.
 *
 *   node scripts/lang/apply.mjs changes.json      { "<lang>": { "<key>": "<new template>" } }
 *
 * Each key must already be in the file, on one line, as the locale files are
 * written. The file is otherwise left byte for byte as it was.
 */
import { readFileSync, writeFileSync } from 'node:fs';
const changes = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const quote = (v) => `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/ /g, '\\u00a0').replace(/ /g, '\\u202f')}'`;
let n = 0;
for (const [lang, keys] of Object.entries(changes)) {
  const path = new URL(`../../src/i18n/locales/${lang}.ts`, import.meta.url);
  let src = readFileSync(path, 'utf8');
  for (const [key, value] of Object.entries(keys)) {
    const re = new RegExp(`^(\\s*)'${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}':\\s*(?:'(?:[^'\\\\]|\\\\.)*'|"(?:[^"\\\\]|\\\\.)*"),?[ \\t]*$`, 'm');
    if (!re.test(src)) throw new Error(`${lang}: no line for ${key}`);
    src = src.replace(re, (_, indent) => `${indent}'${key}': ${quote(value)},`);
    n++;
  }
  writeFileSync(path, src);
}
console.log(`${n} strings written`);
