// Fetch the quotation marks of the game's sixteen languages from Unicode CLDR (delimiters.json)
// into docs/language/pages-core/cldr-quotes.json. Unicode License v3. Data only.
//
//   node scripts/pages-lang/fetch-cldr-quotes.mjs
//
// The page runtime's QUOTES table (src/i18n/pages/runtime.ts) must agree with this record;
// src/i18n/pages.test.ts holds it to it.
import fs from 'node:fs';
const VER = '49.0.0';
const LANGS = ['en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'ru', 'ar', 'hi', 'zh', 'ja', 'ko', 'vi', 'th', 'id'];
const source = `https://raw.githubusercontent.com/unicode-org/cldr-json/${VER}/cldr-json/cldr-misc-full/main/<lang>/delimiters.json`;
const out = { source, version: VER, licence: 'Unicode License v3 (https://www.unicode.org/license.txt)', fetched: new Date().toISOString(), languages: {} };
for (const l of LANGS) {
  const res = await fetch(source.replace('<lang>', l));
  if (!res.ok) throw new Error(`${l}: HTTP ${res.status}`);
  const d = (await res.json()).main[l].delimiters;
  out.languages[l] = { quotationStart: d.quotationStart, quotationEnd: d.quotationEnd, alternateQuotationStart: d.alternateQuotationStart, alternateQuotationEnd: d.alternateQuotationEnd };
  console.log(l, d.quotationStart, d.quotationEnd, d.alternateQuotationStart, d.alternateQuotationEnd);
}
fs.writeFileSync(new URL('../../docs/language/pages-core/cldr-quotes.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
