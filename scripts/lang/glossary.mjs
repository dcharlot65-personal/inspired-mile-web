#!/usr/bin/env node
/** Terminology check from the command line (the unit tests run the same). Exit 1 if a string strays from the glossary. */
import { allStrings, readJson, ROOT, LOCALES } from './lib/strings.mjs';
import { checkGlossary } from './lib/glossary.mjs';
const glossary = readJson(`${ROOT}docs/language/glossary.json`);
const strings = await allStrings();
let n = 0;
for (const lang of LOCALES) for (const p of checkGlossary(lang, strings[lang].ui, strings.en.ui, glossary)) { n++; console.log(`${p.lang}\t${p.rule}\t${p.key}\t${p.detail}`); }
console.log(`${n} glossary problems`);
process.exit(n ? 1 : 0);
