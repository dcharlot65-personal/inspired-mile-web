#!/usr/bin/env node
// The platform's own words for two buttons of the install guidance, from the Android Open
// Source Project's string resources (Apache-2.0), pinned to one commit:
//
//   "Install"   packages/PackageInstaller/res, string "install" (the package installer's button)
//   "Not now"   core/res/res, string "autofill_save_notnow"
//
//   node scripts/pages-rest/fetch-android-terms.mjs
//     -> docs/language/sources/pages-rest-android-terms.json
//
// The same commit as branch lang/qa-pipeline's docs/language/sources/aosp-terms.json, so the
// two records agree on where Android's wording was read.
import { writeFileSync } from 'node:fs';

const COMMIT = '1cdfff555f4a21f71ccc978290e2e212e2f8b168';
const BASE = `https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/${COMMIT}`;
// Android's resource folder for each of the game's languages (Indonesian is still "in").
const DIRS = { en: 'values', es: 'values-es', fr: 'values-fr', de: 'values-de', it: 'values-it', pt: 'values-pt-rBR', pl: 'values-pl', ru: 'values-ru', ar: 'values-ar', hi: 'values-hi', zh: 'values-zh-rCN', ja: 'values-ja', ko: 'values-ko', vi: 'values-vi', th: 'values-th', id: 'values-in' };
const TERMS = { install: ['packages/PackageInstaller/res', 'install'], notNow: ['core/res/res', 'autofill_save_notnow'] };

const unescape = (s) => s.replace(/^"|"$/g, '').replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const cache = new Map();
async function strings(module, dir) {
  const url = `${BASE}/${module}/${dir}/strings.xml`;
  if (!cache.has(url)) {
    const r = await fetch(url, { headers: { 'user-agent': 'term-fetch/1.0 (generic client)' } });
    cache.set(url, r.ok ? await r.text() : null);
  }
  return [url, cache.get(url)];
}

const out = { source: `${BASE}/<module>/<values-dir>/strings.xml`, commit: COMMIT, licence: 'Apache License 2.0 (Android Open Source Project)', fetched: new Date().toISOString(), terms: {} };
for (const [term, [module, name]] of Object.entries(TERMS)) {
  out.terms[term] = { module, name, text: {} };
  for (const [lang, dir] of Object.entries(DIRS)) {
    const [url, xml] = await strings(module, dir);
    const m = xml && new RegExp(`<string name="${name}"[^>]*>([\\s\\S]*?)</string>`).exec(xml);
    out.terms[term].text[lang] = m ? unescape(m[1].trim()) : null;
    if (!m) console.error(`${term} ${lang}: not found in ${url}`);
  }
  console.log(term, JSON.stringify(out.terms[term].text));
}
writeFileSync(new URL('../../docs/language/sources/pages-rest-android-terms.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
