// Fetch the Wikidata labels the translated pages use (cities, regions, works, houses), in the game's
// sixteen languages, into docs/language/pages-core/wikidata-labels.json. Wikidata is CC0.
//
//   node scripts/pages-lang/fetch-wikidata-labels.mjs
//
// The API limits anonymous clients: on a refusal, wait a minute and run it again. After a refetch,
// compare the file with src/i18n/pages/ and docs/language/pages-core/sourced-names.json by hand:
// a label that changed upstream is a change to review, not to take blindly.
import fs from 'node:fs';
const LANGS = ['en','es','fr','de','it','pt','pl','ru','ar','hi','zh','ja','ko','vi','th','id'];
const IDS = {
  Tokyo:'Q1490', Lagos:'Q8673', Brooklyn:'Q18419', London:'Q84', Mumbai:'Q1156', Paris:'Q90', 'Sao Paulo':'Q174', Seoul:'Q8684',
  Nairobi:'Q3870', Berlin:'Q64', 'Mexico City':'Q1489', Cairo:'Q85', Accra:'Q3761', Johannesburg:'Q34647', Manila:'Q1461', Istanbul:'Q406',
  Toronto:'Q172', Sydney:'Q3130', Osaka:'Q35765', Kingston:'Q34692',
  'William Shakespeare':'Q692', 'Romeo and Juliet':'Q83186', Hamlet:'Q41567', 'As You Like It':'Q237572', 'The Tempest':'Q86440',
  Eurasia:'Q5401', Verona:'Q2028', Rome:'Q220', Illyria:'Q32047', 'Olympus (mythology)':'Q70054479', Capulets:'Q2937718', 'Greek underworld':'Q1521549', 'Arden (forest)':'Q4787912', 'New York City':'Q60', 'Mount Olympus':'Q80344', 'Lake District':'Q211778',
  'hip hop':'Q11401', Pokemon:'Q864', 'Magic: The Gathering':'Q207302', sonnet:'Q80056', 'New York City':'Q60',
};
const ids = Object.values(IDS).join('|');
const want = [...LANGS, 'zh-hans', 'zh-cn', 'pt-br', 'mul'].join('|');
const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids}&props=labels|descriptions&languages=${want}&format=json`;
const res = await fetch(url, { headers: { 'User-Agent': 'label-fetch/1.0 (generic client)' } });
const j = await res.json();
const out = {};
for (const [name, q] of Object.entries(IDS)) {
  const e = j.entities[q];
  const row = { qid: q, enDescription: e.descriptions?.en?.value ?? '', labels: {} , zhFrom: 'zh'};
  for (const l of LANGS) row.labels[l] = e.labels?.[l]?.value ?? null;
  // The game's Chinese is Simplified: take the Simplified label where Wikidata has one.
  for (const v of ['zh-cn', 'zh-hans', 'zh']) if (e.labels?.[v]?.value) { row.labels.zh = e.labels[v].value; row.zhFrom = v; break; }
  // The game's Portuguese is Brazilian: take the Brazilian label where Wikidata has one.
  row.ptFrom = 'pt'; if (e.labels?.['pt-br']?.value) { row.labels.pt = e.labels['pt-br'].value; row.ptFrom = 'pt-br'; }
  row.ptAll = { pt: e.labels?.pt?.value ?? null, 'pt-br': e.labels?.['pt-br']?.value ?? null };
  row.mul = e.labels?.mul?.value ?? null;
  row.zhAll = { zh: e.labels?.zh?.value ?? null, 'zh-hans': e.labels?.['zh-hans']?.value ?? null, 'zh-cn': e.labels?.['zh-cn']?.value ?? null };
  out[name] = row;
}
fs.writeFileSync(new URL('../../docs/language/pages-core/wikidata-labels.json', import.meta.url), JSON.stringify({ fetched: new Date().toISOString(), url, entities: out }, null, 1));
for (const [n, r] of Object.entries(out)) console.log(n, r.qid, '|', r.labels.en, '|', r.enDescription, '|', Object.values(r.labels).filter(Boolean).length);
