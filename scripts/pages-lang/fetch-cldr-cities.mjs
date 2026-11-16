// Fetch CLDR exemplar city names (timeZoneNames) for the game's sixteen locales into
// docs/language/pages-core/cldr-exemplar-cities.json. Unicode License v3. Data only.
//
//   node scripts/pages-lang/fetch-cldr-cities.mjs
//
// `explicit: false` means CLDR lists no name for that city in that language (the zone id's own
// spelling is what a formatter would fall back to); the pages then use the Wikidata label.
import fs from 'node:fs';
const VER = '46.0.0';
const LOC = { en:'en', es:'es', fr:'fr', de:'de', it:'it', pt:'pt', pl:'pl', ru:'ru', ar:'ar', hi:'hi', zh:'zh', ja:'ja', ko:'ko', vi:'vi', th:'th', id:'id' };
const ZONES = { TKY:'Asia/Tokyo', LGS:'Africa/Lagos', LDN:'Europe/London', PAR:'Europe/Paris', SAO:'America/Sao_Paulo', SEO:'Asia/Seoul', NRB:'Africa/Nairobi', BER:'Europe/Berlin', MEX:'America/Mexico_City', CAI:'Africa/Cairo', ACC:'Africa/Accra', JHB:'Africa/Johannesburg', MNL:'Asia/Manila', IST:'Europe/Istanbul', TOR:'America/Toronto', SYD:'Australia/Sydney' };
const out = { version: VER, fetched: new Date().toISOString(), source: `https://cdn.jsdelivr.net/npm/cldr-dates-full@${VER}/main/<locale>/timeZoneNames.json`, cities: {} };
for (const [l, cl] of Object.entries(LOC)) {
  const url = `https://cdn.jsdelivr.net/npm/cldr-dates-full@${VER}/main/${cl}/timeZoneNames.json`;
  const res = await fetch(url);
  if (!res.ok) { console.log(l, 'HTTP', res.status); continue; }
  const j = await res.json();
  const zone = j.main[cl].dates.timeZoneNames.zone;
  out.cities[l] = {};
  for (const [code, id] of Object.entries(ZONES)) {
    const [a, b] = id.split('/');
    const explicit = zone?.[a]?.[b]?.exemplarCity ?? null;
    out.cities[l][code] = { name: explicit ?? b.replaceAll('_', ' '), explicit: explicit !== null };
  }
  console.log(l, Object.entries(out.cities[l]).map(([c, v]) => `${c}=${v.name}${v.explicit ? '' : '*'}`).join(' '));
}
fs.writeFileSync(new URL('../../docs/language/pages-core/cldr-exemplar-cities.json', import.meta.url), JSON.stringify(out, null, 1));
