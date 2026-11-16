#!/usr/bin/env node
/**
 * The names inside a sentence must be the names the sources give.
 *
 *   node scripts/pages-lang/names-in-text.mjs [--selftest]
 *
 * A city's own label (variants.city.<code>) comes from CLDR or Wikidata. The line that says why
 * a city grants its ability ("Brazilian humor and improvisation", "Toronto's hip-hop dynasty")
 * was written by a language model, and could spell the same city, or the country it speaks of,
 * another way. This checks, in every language, that such a line holds:
 *   - the city's sourced name (variants.city.<code> in that language), or
 *   - the country's name as CLDR has it, or its demonym as Wikidata has it (P1549),
 *     (docs/language/pages-core/countries.json), or
 *   - the region's CLDR name (variants.region.<code>).
 * A form counts if the text holds it, or holds it without its last letters (an inflected
 * "Berlina", "brasileña", "البرازيلية"), never shorter than three letters.
 * Exit status 1 if a line holds none of the forms it should.
 */
import { readFileSync } from 'node:fs';
import { LOCALES, ROOT, readArea } from './strings.mjs';

const record = JSON.parse(readFileSync(`${ROOT}/docs/language/pages-core/countries.json`, 'utf8'));
const countries = record.countries;
/** Wikidata's label and aliases of an item in a language (countries.json, `names`). */
const wd = (code, lang) => [record.names[code]?.labels[lang], ...(record.names[code]?.aliases[lang] ?? [])].filter(Boolean);
/**
 * Forms cut from a sourced name by a rule, not written from memory: the administrative word for
 * "city" taken off (Japanese and Chinese 大阪市 -> 大阪, Thai นครนิวยอร์ก -> นิวยอร์ก).
 */
const derived = (names, lang) => names.flatMap((n) => [n, ...(lang === 'ja' || lang === 'zh' ? [n.replace(/市$/u, '')] : []), ...(lang === 'th' ? [n.replace(/^นคร/u, '')] : [])]).filter((n, i, a) => n && a.indexOf(n) === i);
const wikidata = JSON.parse(readFileSync(`${ROOT}/docs/language/pages-core/wikidata-labels.json`, 'utf8')).entities;

// What each ability line names. LDN, CAI and IST name no place.
const NAMES = {
  TKY: { city: 'TKY' }, LGS: { city: 'LGS' }, MUM: { city: 'MUM' }, SEO: { city: 'SEO' }, BER: { city: 'BER' },
  JHB: { city: 'JHB' }, TOR: { city: 'TOR' }, OSA: { city: 'OSA' },
  BKN: { wikidata: 'New York City' },
  PAR: { country: 'FR' }, SAO: { country: 'BR' }, MEX: { country: 'MX' }, ACC: { country: 'GH' }, MNL: { country: 'PH' },
  SYD: { country: 'AU' }, KGN: { country: 'JM' },
  NRB: { region: '014' },
};

const letters = (s) => [...s.normalize('NFC')];
/** The name, and the name cut by one or two letters (never below three), so an inflected form still matches. */
function forms(name) {
  const out = new Set([name]);
  for (const part of [name, ...name.split(/\s+/)]) {
    const l = letters(part);
    if (l.length >= 3) out.add(part);
    for (let cut = 1; cut <= 2; cut++) if (l.length - cut >= 3) out.add(l.slice(0, l.length - cut).join(''));
  }
  return [...out];
}
/** Latin letters without their accents (México and mexicana), lower case. Other scripts as they are. */
const fold = (s, lang) => s.normalize('NFD').replace(/(\p{Script=Latin})\p{M}+/gu, '$1').normalize('NFC').toLocaleLowerCase(lang);

export function wanted(lang, code) {
  const what = NAMES[code];
  const variants = readArea('variants', lang);
  if (what.city) return derived([variants[`variants.city.${what.city}`], ...(code === 'OSA' ? wd('OSA', lang) : [])], lang);
  if (what.region) return [variants[`variants.region.${what.region}`]];
  if (what.wikidata) return derived([wikidata[what.wikidata].labels[lang], ...wd('NYC', lang)].filter(Boolean), lang);
  const c = countries[what.country];
  return [c.cldr[lang], ...(c.demonyms[lang] ?? []), ...wd(what.country, lang)].filter(Boolean);
}

export function holds(text, names, lang) {
  const t = fold(text, lang);
  return names.some((n) => forms(n).some((f) => t.includes(fold(f, lang))));
}

if (process.argv.includes('--selftest')) {
  const cases = [
    [true, 'de', 'SAO', 'Brasilianischer Humor und Improvisation'],
    [false, 'de', 'SAO', 'Südamerikanischer Humor und Improvisation'],
    [true, 'ru', 'BER', 'Кабаре Берлина и сухой юмор'],
    [false, 'ru', 'BER', 'Кабаре столицы и сухой юмор'],
    [true, 'vi', 'SYD', 'Sự hài hước của nước Úc'],
    [false, 'hi', 'MNL', 'फ़िलीपींस की रैप बैटल संस्कृति'],
    // A name of two letters counts whole (도쿄), and an accent does not stop a Latin match.
    [true, 'ko', 'TKY', '정밀함을 중시하는 도쿄의 문화'],
    [false, 'ko', 'TKY', '정밀함을 중시하는 교토의 문화'],
    [true, 'pt', 'MEX', 'A tradição poética mexicana'],
  ];
  let bad = 0;
  for (const [expect, lang, code, text] of cases) {
    const got = holds(text, wanted(lang, code), lang);
    if (got !== expect) bad++;
    console.log(`${got === expect ? 'ok  ' : 'WRONG'}\t${lang} ${code}\t${expect ? 'holds' : 'lacks'} the name\t${text}`);
  }
  process.exit(bad ? 1 : 0);
}

let open = 0;
for (const lang of LOCALES) {
  const v = readArea('variants', lang);
  for (const code of Object.keys(NAMES)) {
    const text = v[`variants.ability.${code}.why`];
    const names = wanted(lang, code);
    if (!holds(text, names, lang)) {
      open++;
      console.log(`${lang}\t${code}\tnone of [${names.join(' | ')}] in\t${text}`);
    }
  }
}
console.log(`${open} ability lines name a place otherwise than the sources`);
process.exit(open ? 1 : 0);
