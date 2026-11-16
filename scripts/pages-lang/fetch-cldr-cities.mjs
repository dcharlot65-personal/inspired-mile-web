// Fetch CLDR exemplar city names (timeZoneNames) and the names of the world's regions (territories,
// by UN M.49 code) for the game's sixteen locales into
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
// The regions the city catalog uses (src/lib/variants.ts), as UN M.49 codes.
const REGIONS = ['142', '150', '009', '029', '003', '013', '005', '011', '014', '015', '018', '030', '034', '035'];
const out = { version: VER, fetched: new Date().toISOString(), source: `https://cdn.jsdelivr.net/npm/cldr-dates-full@${VER}/main/<locale>/timeZoneNames.json`, regionSource: `https://cdn.jsdelivr.net/npm/cldr-localenames-full@${VER}/main/<locale>/territories.json`, cities: {}, regions: {} };
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
  const tr = await fetch(`https://cdn.jsdelivr.net/npm/cldr-localenames-full@${VER}/main/${cl}/territories.json`);
  if (!tr.ok) { console.log(l, 'territories HTTP', tr.status); continue; }
  const territories = (await tr.json()).main[cl].localeDisplayNames.territories;
  out.regions[l] = Object.fromEntries(REGIONS.map((code) => [code, territories[code] ?? null]));
  console.log(l, Object.entries(out.cities[l]).map(([c, v]) => `${c}=${v.name}${v.explicit ? '' : '*'}`).join(' '), '|', Object.values(out.regions[l]).join(', '));
}
fs.writeFileSync(new URL('../../docs/language/pages-core/cldr-exemplar-cities.json', import.meta.url), JSON.stringify(out, null, 1));
