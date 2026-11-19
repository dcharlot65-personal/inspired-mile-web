// Fetch the names of the countries the city abilities speak of (Brazilian humor, Ghanaian highlife…)
// in the game's sixteen languages: CLDR territory names (cldr-localenames-full 46.0.0, Unicode
// License v3) and Wikidata demonyms (property P1549, CC0), into
// docs/language/pages-core/countries.json. Data only.
//
//   node scripts/pages-lang/fetch-countries.mjs
//
// scripts/pages-lang/names-in-text.mjs then checks that each ability line names its city and its
// country as these sources do.
import fs from 'node:fs';
const VER = '46.0.0';
const LANGS = ['en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'ru', 'ar', 'hi', 'zh', 'ja', 'ko', 'vi', 'th', 'id'];
// country code -> Wikidata item
const COUNTRIES = { BR: 'Q155', MX: 'Q96', GH: 'Q117', PH: 'Q928', AU: 'Q408', JM: 'Q766', FR: 'Q142' };
const territoriesUrl = `https://cdn.jsdelivr.net/npm/cldr-localenames-full@${VER}/main/<lang>/territories.json`;
const out = { fetched: new Date().toISOString(), cldr: { source: territoriesUrl, version: VER, licence: 'Unicode License v3' }, wikidata: { property: 'P1549 (demonym)', licence: 'CC0 1.0' }, countries: {} };
for (const [code, q] of Object.entries(COUNTRIES)) out.countries[code] = { qid: q, cldr: {}, demonyms: {} };
for (const l of LANGS) {
  const res = await fetch(territoriesUrl.replace('<lang>', l));
  if (!res.ok) throw new Error(`${l}: HTTP ${res.status}`);
  const t = (await res.json()).main[l].localeDisplayNames.territories;
  for (const code of Object.keys(COUNTRIES)) out.countries[code].cldr[l] = t[code] ?? null;
}
const ids = Object.values(COUNTRIES).join('|');
const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids}&props=claims&format=json`;
out.wikidata.url = url;
const j = await (await fetch(url, { headers: { 'User-Agent': 'label-fetch/1.0 (generic client)' } })).json();
for (const [code, q] of Object.entries(COUNTRIES)) {
  for (const c of j.entities[q].claims.P1549 ?? []) {
    const v = c.mainsnak?.datavalue?.value;
    if (!v) continue;
    const lang = v.language === 'pt-br' ? 'pt' : v.language === 'zh-cn' || v.language === 'zh-hans' ? 'zh' : v.language;
    if (!LANGS.includes(lang)) continue;
    (out.countries[code].demonyms[lang] ??= []).includes(v.text) || out.countries[code].demonyms[lang].push(v.text);
  }
}
// Labels and aliases, for the countries and for the two cities whose label is a formal name
// (Osaka Q35765 is 大阪市, New York City Q60 is นครนิวยอร์ก): a short form a sentence uses may be one of them.
const more = { ...COUNTRIES, OSA: 'Q35765', NYC: 'Q60' };
const want = [...LANGS, 'zh-cn', 'zh-hans', 'pt-br'].join('|');
const url2 = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${Object.values(more).join('|')}&props=labels|aliases&languages=${want}&format=json`;
out.wikidata.namesUrl = url2;
const k = await (await fetch(url2, { headers: { 'User-Agent': 'label-fetch/1.0 (generic client)' } })).json();
out.names = {};
for (const [code, q] of Object.entries(more)) {
  const e = k.entities[q];
  const row = { qid: q, labels: {}, aliases: {} };
  for (const l of LANGS) {
    const codes = l === 'zh' ? ['zh-cn', 'zh-hans', 'zh'] : l === 'pt' ? ['pt-br', 'pt'] : [l];
    row.labels[l] = codes.map((c) => e.labels?.[c]?.value).find(Boolean) ?? null;
    row.aliases[l] = [...new Set(codes.flatMap((c) => (e.aliases?.[c] ?? []).map((a) => a.value)))];
  }
  out.names[code] = row;
}
fs.writeFileSync(new URL('../../docs/language/pages-core/countries.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
for (const [code, n] of Object.entries(out.names)) console.log(code, 'labels+aliases:', ['ko','vi','zh','ja','th','hi'].map((l) => `${l}=${[n.labels[l], ...n.aliases[l]].join('/')}`).join(' '));
for (const [code, c] of Object.entries(out.countries)) console.log(code, Object.entries(c.cldr).map(([l, n]) => `${l}=${n}`).join(' '), '| demonyms:', Object.entries(c.demonyms).map(([l, d]) => `${l}=${d.join('/')}`).join(' '));
