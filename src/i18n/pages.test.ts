import { describe, expect, it } from 'vitest';
import { LOCALES, loadArea, loadMessages, setLocale, t, type Locale, type Messages } from './index';
import { compareMessages } from './pages/check';
import { MONTH_LABEL_TITLECASE, isolated, list, monthOfYear, quoted, quoteMarks, rich, signedLtr, tn } from './pages/runtime';
import { cardRule, deckProblems, synergyLine } from './pages/rules-text';
import { abilityBonus, achievementDescription, achievementName, cityName, cityRegion, elementName, houseName, initialOf, typeName } from './pages/terms';
import { ACHIEVEMENTS, type PlayerStats } from '../lib/achievements';
import { CARD_CATALOG } from '../lib/cards';
import { CITY_CATALOG, type WorldCity } from '../lib/variants';
import { getPack, loadPack } from '../lib/verse/packs';
import sourced from '../../docs/language/pages-core/sourced-names.json';
import cldrQuotes from '../../docs/language/pages-core/cldr-quotes.json';
import cldrCities from '../../docs/language/pages-core/cldr-exemplar-cities.json';
import cldrContext from '../../docs/language/pages-core/cldr-context-transforms.json';
import wikidataLabels from '../../docs/language/pages-core/wikidata-labels.json';

const MODULES = import.meta.glob<{ default: Messages }>('./pages/*/*.ts', { eager: true });
const AREAS = ['about', 'achievements', 'card-terms', 'collection', 'home', 'profile', 'rules', 'variants', 'world-map'];
const area = (name: string, l: string): Messages => MODULES[`./pages/${name}/${l}.ts`]?.default;

/** Names taken from CLDR or Wikidata, and words that are the same in two languages, may equal the English. */
const SOURCED = /^(variants\.(city|region)\.|card-terms\.(work\.|house\.(rome|illyria|the-tempest|lake-district|olympus)$))/;

type Labels = Record<string, string | null>;
type WikidataEntity = { qid: string; labels: Labels; ptAll?: Labels; zhAll?: Labels };
const WIKIDATA = new Map((Object.values(wikidataLabels.entities) as WikidataEntity[]).map((e) => [e.qid, e]));
/** A Wikidata label as fetched: the language's own, or the variant the record names (pt-br, zh-cn…). */
function wikidataLabel(qid: string, lang: string, variant?: string): string | null | undefined {
  const e = WIKIDATA.get(qid);
  if (!variant) return e?.labels[lang];
  return (variant.startsWith('pt') ? e?.ptAll : variant.startsWith('zh') ? e?.zhAll : undefined)?.[variant];
}

/** Each sourced value against the fetched file its record cites (Wikidata labels, CLDR cities and regions). */
function sourceProblems(entries: Record<string, Record<string, { value: string; source: string }>>): string[] {
  const out: string[] = [];
  const cities = cldrCities.cities as Record<string, Record<string, { name: string }>>;
  const regions = cldrCities.regions as Record<string, Record<string, string>>;
  for (const [key, byLang] of Object.entries(entries)) {
    for (const [l, { value, source }] of Object.entries(byLang)) {
      const said = (got: unknown, from: string) => out.push(`${key} ${l}: "${value}" but ${from} has "${got}"`);
      let m: RegExpMatchArray | null;
      if ((m = source.match(/^Wikidata (Q\d+) label(?: \(([a-z]{2}(?:-[a-z]+)?)\))?$/))) {
        const got = wikidataLabel(m[1], l, m[2]);
        if (got !== value) said(got, `Wikidata ${m[1]} ${m[2] ?? l}`);
      } else if ((m = source.match(/^Wikidata (Q\d+) label "([^"]+)", first letter capitalised, /))) {
        // A label used as a heading where the names beside it start with a capital: the label, and only its first letter changed.
        const got = wikidataLabel(m[1], l);
        if (got !== m[2]) said(got, `Wikidata ${m[1]} ${l}`);
        else if (value !== m[2].charAt(0).toLocaleUpperCase(l) + m[2].slice(1)) out.push(`${key} ${l}: "${value}" is not "${m[2]}" with its first letter capitalised`);
      } else if ((m = source.match(/^CLDR 46\.0\.0 exemplarCity \(Wikidata (Q\d+) has "([^"]+)"\)$/))) {
        const got = cities[l]?.[key.split('.').at(-1)!]?.name;
        if (got !== value) said(got, 'CLDR exemplarCity');
        const e = WIKIDATA.get(m[1]);
        const all = [e?.labels[l], ...Object.values(e?.ptAll ?? {}), ...Object.values(e?.zhAll ?? {})];
        if (!all.includes(m[2])) out.push(`${key} ${l}: Wikidata ${m[1]} has no label "${m[2]}"`);
      } else if ((m = source.match(/^CLDR 46\.0\.0 territory (\d{3})$/))) {
        if (regions[l]?.[m[1]] !== value) said(regions[l]?.[m[1]], `CLDR territory ${m[1]}`);
      } else if (!source.startsWith('NOT FROM A SOURCE: ')) out.push(`${key} ${l}: source not checkable: ${source}`);
    }
  }
  return out;
}

const COUNTS = ['n', 'total', 'owned', 'min', 'max', 'relics', 'potions', 'characters', 'bonus'];
/**
 * The words that may follow a count in the languages whose nouns change with the number (in the
 * others a counter or a bare noun follows, and nothing agrees). None is a noun: "or", "to", "of
 * them"… A noun there would have to agree with the number, and these strings have no plural forms.
 */
const AFTER_COUNT: Record<string, string[]> = {
  en: ['or', 'to', 'of'],
  es: ['o', 'a', 'de'],
  fr: ['ou', 'à', 'pour', 'de'],
  de: ['oder', 'bis', 'davon'],
  it: ['o', 'a', 'per', 'di'],
  pt: ['ou', 'a', 'delas', 'de'],
  pl: ['lub', 'do', 'z'],
  ru: ['или', 'до', 'из', 'к'],
  ar: ['أو', 'إلى', 'منها', 'في', 'على'],
  hi: ['या', 'से', 'का'],
};
/** A score added to a criterion, named after the number as the core's variant.bonus does ("+6 craft"): a mass noun, no plural. */
const DELTA_LABEL: Record<string, string> = { en: 'craft', de: 'Handwerk', hi: 'शिल्प' };
function countThenNoun(l: string, messages: Messages): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(messages)) {
    for (const m of value.matchAll(/\{([a-zA-Z_]+)\}/g)) {
      if (!COUNTS.includes(m[1])) continue;
      const word = value.slice(m.index! + m[0].length).replace(/^(?:<\/b>|[\s  ])+/, '').match(/^\p{L}[\p{L}\p{M}]*/u)?.[0];
      if (word && !AFTER_COUNT[l].includes(word) && !(m[1] === 'bonus' && DELTA_LABEL[l] === word)) out.push(`${l} ${key}: {${m[1]}} ${word}`);
    }
  }
  return out;
}

describe('page areas', () => {
  it('has the nine areas in all sixteen languages, and every area (these or another page’s) has exactly the sixteen', () => {
    const files = Object.keys(MODULES);
    for (const a of AREAS) for (const l of LOCALES) expect(files).toContain(`./pages/${a}/${l}.ts`);
    // Other branches add areas of their own beside these nine; each must still be one file per language.
    const byArea = new Map<string, string[]>();
    for (const f of files) {
      const [, a, l] = f.match(/^\.\/pages\/([^/]+)\/([^/]+)\.ts$/)!;
      byArea.set(a, [...(byArea.get(a) ?? []), l]);
    }
    for (const [a, langs] of byArea) expect([a, langs.sort()]).toEqual([a, [...LOCALES].sort()]);
  });

  it('every area key begins with its area, so two areas cannot overwrite each other or a core key', async () => {
    const core = await loadMessages('en');
    for (const a of AREAS) for (const k of Object.keys(area(a, 'en'))) expect([k, k.startsWith(`${a}.`), k in core]).toEqual([k, true, false]);
  });

  it('every language has exactly the keys of English, with the same placeholders and marks', () => {
    const problems: string[] = [];
    for (const a of AREAS) for (const l of LOCALES) if (l !== 'en') problems.push(...compareMessages(`${a}/${l}`, area(a, 'en'), area(a, l)));
    expect(problems).toEqual([]);
    expect(AREAS.reduce((n, a) => n + Object.keys(area(a, 'en')).length, 0)).toBeGreaterThan(380);
  });

  it('the comparison itself can fail: a missing key, a changed placeholder, a lost mark, a stray brace', () => {
    const en = { 'x.a': 'Cards: {n}', 'x.b': 'The <b>Team</b>', 'x.c': 'Open the <a>Playground</a>.' };
    expect(compareMessages('ok', en, { 'x.a': 'Cartas: {n}', 'x.b': 'El <b>equipo</b>', 'x.c': 'Abre la <a>Zona</a>.' })).toEqual([]);
    expect(compareMessages('t', en, { 'x.a': 'Cartas: {n}', 'x.b': 'El <b>equipo</b>' })).toEqual(['t: missing x.c']);
    expect(compareMessages('t', en, { ...en, 'x.d': 'more' })).toEqual(['t: extra x.d']);
    expect(compareMessages('t', en, { ...en, 'x.a': 'Cartas: {m}' })[0]).toContain('x.a has {m} but English has {n}');
    expect(compareMessages('t', en, { ...en, 'x.a': 'Cartas' })[0]).toContain('x.a has {} but English has {n}');
    expect(compareMessages('t', en, { ...en, 'x.b': 'El equipo' })[0]).toContain('x.b has marks');
    expect(compareMessages('t', en, { ...en, 'x.b': 'El </b>equipo<b>' })[0]).toContain('not closed');
    expect(compareMessages('t', en, { ...en, 'x.b': 'El <b>equipo</b> <i>ya</i>' }).join(' ')).toContain('x.b');
    expect(compareMessages('t', en, { ...en, 'x.a': 'Cartas: {n} }' })[0]).toContain('stray brace');
    expect(compareMessages('t', en, { ...en, 'x.a': '  ' })).toEqual(['t: empty x.a']);
    expect(compareMessages('t', en, { ...en, 'x.a': 'Cartas: {n} ' })[0]).toContain('space');
  });

  it('every language is actually translated: almost nothing reads the same as English', () => {
    for (const l of LOCALES) {
      if (l === 'en') continue;
      const same = AREAS.flatMap((a) => Object.keys(area(a, 'en')).filter((k) => !SOURCED.test(k) && area(a, l)[k] === area(a, 'en')[k]));
      expect([l, same.length < 25, same]).toEqual([l, true, same]);
    }
    // The bound bites: a language file left in English would have every one of these the same.
    expect(AREAS.flatMap((a) => Object.keys(area(a, 'en')).filter((k) => !SOURCED.test(k))).length).toBeGreaterThan(300);
  });

  it('names taken from CLDR and Wikidata are exactly what the provenance record says', () => {
    const entries = sourced.entries as Record<string, Record<string, { value: string; source: string }>>;
    expect(Object.keys(entries).length).toBeGreaterThan(25);
    for (const [key, byLang] of Object.entries(entries)) {
      const a = key.split('.')[0];
      for (const l of LOCALES) {
        expect([key, l, area(a, l)[key]]).toEqual([key, l, byLang[l].value]);
        expect([key, l, /^(CLDR \d|Wikidata Q\d|NOT FROM A SOURCE: )/.test(byLang[l].source)]).toEqual([key, l, true]);
      }
    }
    // Every city of the catalog has a sourced name.
    for (const c of Object.values(CITY_CATALOG)) expect([c.code, `variants.city.${c.code}` in entries]).toEqual([c.code, true]);
  });

  it('the provenance record says what the fetched sources say', () => {
    // The test above holds the pages to the record; this one holds the record to the files it cites.
    // A vi value had been capitalised by hand and was still recorded as "Wikidata Q5401 label".
    const entries = sourced.entries as Record<string, Record<string, { value: string; source: string }>>;
    expect(sourceProblems(entries)).toEqual([]);
    // It bites: the record as it stood, a city CLDR names differently, a source it cannot read.
    const stale = structuredClone(entries);
    stale['variants.region.eurasia'].vi.source = 'Wikidata Q5401 label';
    expect(sourceProblems(stale)).toEqual(['variants.region.eurasia vi: "Lục địa Á-Âu" but Wikidata Q5401 vi has "lục địa Á-Âu"']);
    const city = structuredClone(entries);
    city['variants.city.TKY'].es.value = 'Tokyo';
    expect(sourceProblems(city)).toEqual(['variants.city.TKY es: "Tokyo" but CLDR exemplarCity has "Tokio"']);
    const odd = structuredClone(entries);
    odd['variants.region.142'].fr.source = 'a dictionary';
    expect(sourceProblems(odd)).toEqual(['variants.region.142 fr: source not checkable: a dictionary']);
  });

  it('covers the data it names: every house, element, type, city, ability and achievement', () => {
    const terms = area('card-terms', 'en');
    const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    for (const c of CARD_CATALOG) {
      expect([c.id, `card-terms.house.${slug(c.house)}` in terms]).toEqual([c.id, true]);
      expect([c.id, c.element, `card-terms.element.${slug(c.element)}` in terms]).toEqual([c.id, c.element, true]);
      expect([c.id, `card-terms.type.${c.type.toLowerCase()}` in terms]).toEqual([c.id, true]);
    }
    const variants = area('variants', 'en');
    for (const c of Object.values(CITY_CATALOG)) {
      for (const k of [`variants.city.${c.code}`, `variants.ability.${c.code}.name`, `variants.ability.${c.code}.why`]) expect([k, k in variants]).toEqual([k, true]);
    }
    const ach = area('achievements', 'en');
    for (const a of ACHIEVEMENTS) {
      expect([a.id, `achievements.${a.id}.name` in ach, `achievements.${a.id}.description` in ach]).toEqual([a.id, true, true]);
      // A description that shows a number needs the achievement to say which, and the other way round.
      expect([a.id, ach[`achievements.${a.id}.description`].includes('{n}')]).toEqual([a.id, a.goal !== undefined]);
    }
  });
});

describe('a count', () => {
  it('is never followed by a noun where nouns agree with the number: the strings have no plural forms', () => {
    // "Consigue {n} puntos" read right for 35 and would read "1 puntos" for a goal of 1. Counts are
    // written "label: number" instead, or followed by a word that does not agree ("or more", "of them").
    const found = Object.keys(AFTER_COUNT).flatMap((l) => countThenNoun(l, Object.assign({}, ...AREAS.map((a) => area(a, l)))));
    expect(found).toEqual([]);
    // It bites: the Spanish and German descriptions as they were.
    expect(countThenNoun('es', { 'achievements.wordsmith.description': 'Consigue {n} puntos o más en una sola ronda' })).toEqual(['es achievements.wordsmith.description: {n} puntos']);
    expect(countThenNoun('de', { 'x.y': 'Erreiche <b>{n}</b> Punkte', 'x.z': '+{bonus} Handwerk', 'x.w': '+{n} Handwerk' })).toEqual(['de x.y: {n} Punkte', 'de x.w: {n} Handwerk']);
  });
});

describe('a month on its own', () => {
  it('is capitalised where CLDR capitalises a month name standing alone, and nowhere else', async () => {
    const langs = cldrContext.languages as Record<string, Record<string, Record<string, string>> | null>;
    const want = Object.keys(langs).filter((l) => Object.entries(langs[l] ?? {}).some(([k, v]) => k.startsWith('month') && v['stand-alone'] === 'titlecase-firstword'));
    expect([...MONTH_LABEL_TITLECASE].sort()).toEqual(want.sort());
    expect(want.length).toBeGreaterThan(2);
    for (const [l, label] of [['es', 'Abr 2025'], ['fr', 'Avr. 2025'], ['de', 'Apr. 2025'], ['en', 'Apr 2025'], ['pt', 'abr. de 2025']] as const) {
      await setLocale(l, { persist: false });
      expect([l, monthOfYear(2025, 4)]).toEqual([l, label]);
    }
    await setLocale('en', { persist: false });
  });
});

describe('achievement goals', () => {
  const stats = (v: number): PlayerStats => ({ battleWins: v, totalBattles: v, totalRounds: v, highestScore: v, triviaCorrect: v, triviaPerfect: v, challengesCompleted: v, uniqueCards: v, totalCards: v, packsOpened: v });
  it('the number shown is the number the check asks for', () => {
    for (const a of ACHIEVEMENTS) {
      if (a.goal === undefined) {
        expect([a.id, a.check(stats(1))]).toEqual([a.id, true]);
        continue;
      }
      expect([a.id, a.check(stats(a.goal)), a.check(stats(a.goal - 1))]).toEqual([a.id, true, false]);
    }
  });
});

describe('loading an area', () => {
  it('adds the area to the language in use, with English beneath it, and leaves other languages alone', async () => {
    expect(t('home.cta.collection')).toBe('home.cta.collection');
    await loadArea('home');
    expect(t('home.cta.collection')).toBe('View Collection');
    await setLocale('de', { persist: false });
    // German is in use but its copy of the area has not been asked for yet: English shows, never the key.
    expect(t('home.cta.collection')).toBe('View Collection');
    await loadArea('home');
    expect(t('home.cta.collection')).toBe('Sammlung ansehen');
    expect(tn('home.houses.cards', { n: 4 })).toBe('Karten: 4');
    await setLocale('en', { persist: false });
    expect(t('home.cta.collection')).toBe('View Collection');
    // An area that does not exist changes nothing and does not throw.
    await loadArea('no-such-area');
    expect(t('no-such-area.x')).toBe('no-such-area.x');
  });

  it('renders marks as HTML and escapes everything else', async () => {
    await loadArea('home');
    await loadArea('collection');
    expect(rich('home.platform.title')).toBe('The <span class="text-gradient">Platform</span>');
    expect(rich('collection.intro', {}, { aHref: '/playground', aClass: 'x' })).toContain('<a href="/playground" class="x">Playground</a>');
    expect(rich('collection.owned', { owned: 3, total: 71 }, { bClass: 'n', varIds: { owned: 'owned-count' } })).toBe('Cards owned: <span class="n"><span id="owned-count">3</span></span> / 71');
    const en = await loadMessages('en');
    en['home.test.evil'] = 'A <b>bold</b> <img src=x onerror=alert(1)> & "quoted" {name}';
    expect(rich('home.test.evil', { name: '<script>' })).toBe('A <span class="text-gradient">bold</span> &lt;img src=x onerror=alert(1)&gt; &amp; &quot;quoted&quot; &lt;script&gt;');
    delete en['home.test.evil'];
  });
});

describe('a house badge’s letter', () => {
  it('is the first letter a reader would take as the name’s initial', () => {
    expect(initialOf('Danish Court', 'en')).toBe('D');
    // Arabic: past the article, or every "the …" would show ا.
    expect(initialOf('البلاط الدنماركي', 'ar')).toBe('ب');
    expect(initialOf('روما', 'ar')).toBe('ر');
    // Thai: past a leading vowel, as Thai dictionary order goes.
    expect(initialOf('โรม', 'th')).toBe('ร');
    // Hindi: a whole cluster, never a consonant cut from its vowel sign.
    expect(initialOf('मोंटेग्यू', 'hi')).toBe('मों');
    expect(initialOf('montaigu', 'fr')).toBe('M');
  });
});

describe('text in another script on a right-to-left page', () => {
  it('goes in <bdi> when it has no right-to-left letter, and is escaped', () => {
    expect(isolated('"To be, or not to be, that is the question."', 'ar')).toBe('<bdi>&quot;To be, or not to be, that is the question.&quot;</bdi>');
    expect(isolated('أتقنها لتزيد صنعتك بمقدار النصف.', 'ar')).toBe('أتقنها لتزيد صنعتك بمقدار النصف.');
    expect(isolated('Land it.', 'en')).toBe('Land it.');
  });
});

describe('quotation marks', () => {
  it('are the language’s own, as CLDR records them (French adds its no-break spaces)', () => {
    for (const l of LOCALES) {
      const c = cldrQuotes.languages[l as keyof typeof cldrQuotes.languages];
      const want = l === 'fr' ? [`${c.quotationStart}\u00a0`, `\u00a0${c.quotationEnd}`] : [c.quotationStart, c.quotationEnd];
      expect([l, ...quoteMarks(l)]).toEqual([l, ...want]);
    }
    // The comparison bites: English marks are not German ones.
    expect(quoteMarks('de')).not.toEqual(quoteMarks('en'));
  });

  it('wrap the quoted text in <bdi> and escape it', () => {
    expect(quoted('To be, or not to be?', 'ja')).toBe('<span data-qo>「</span><bdi>To be, or not to be?</bdi><span data-qc>」</span>');
    expect(quoted('<i>x</i>', 'en')).toContain('<bdi>&lt;i&gt;x&lt;/i&gt;</bdi>');
  });
});

describe('a signed number on a right-to-left page', () => {
  it('sits in a left-to-right isolate in Arabic, so +50 does not show as 50+, and nothing changes elsewhere', async () => {
    const LRI = '\u2066';
    const PDI = '\u2069';
    expect(signedLtr('الفوز في نزال: +50', 'ar')).toBe(`الفوز في نزال: ${LRI}+50${PDI}`);
    expect(signedLtr('+2 في التلاعب', 'ar')).toBe(`${LRI}+2${PDI} في التلاعب`);
    // a hyphen in an id is not a sign, and a left-to-right language is left alone
    expect(signedLtr('بطاقة غير معروفة: XX-000', 'ar')).toBe('بطاقة غير معروفة: XX-000');
    expect(signedLtr('Win a battle: +50', 'en')).toBe('Win a battle: +50');
    await setLocale('ar', { persist: false });
    await Promise.all(['about', 'rules', 'variants', 'card-terms'].map((a) => loadArea(a)));
    await loadPack('ar');
    expect(tn('rules.relic', { words: 'x', n: 2, bonus: 6 })).toContain(`${LRI}+6${PDI}`);
    expect(rich('rules.relic', { words: 'x', n: 2, bonus: 6 })).toContain(`${LRI}+6${PDI}`);
    expect(abilityBonus('Tokyo')).toContain(`${LRI}+2${PDI}`);
    expect(cardRule(CARD_CATALOG.find((c) => c.type === 'Relic')!, 'ar').lines[0]).toContain(`${LRI}+6${PDI}`);
    await setLocale('en', { persist: false });
    expect(tn('rules.relic', { words: 'x', n: 2, bonus: 6 })).not.toContain(LRI);
  });
});

describe('a list of words', () => {
  it('keeps its words apart in every language, and a relic names its power words one by one', async () => {
    for (const l of LOCALES) {
      await setLocale(l as Locale, { persist: false });
      await loadArea('rules');
      await loadPack(l);
      // Intl's "unit" lists put nothing between items in Chinese and Japanese: 髑髏冗談墓笑い塵.
      const joined = list(['髑髏', '冗談', '墓']);
      expect([l, joined.includes('髑髏冗談') || joined.includes('冗談墓')]).toEqual([l, false]);
      const relic = CARD_CATALOG.find((c) => c.type === 'Relic')!;
      const words = getPack(l).relics[relic.id] ?? [];
      const line = cardRule(relic, l).lines[0];
      expect([l, words.length >= 2]).toEqual([l, true]);
      for (let i = 0; i + 1 < words.length; i++) expect([l, line.includes(words[i] + words[i + 1])]).toEqual([l, false]);
    }
    await setLocale('en', { persist: false });
  });
});

describe('card and rule text in every language', () => {
  it('names every piece of data and describes every card, with no key or placeholder left showing', async () => {
    const leak = /\{[a-zA-Z_]+\}|\b(?:card-terms|variants|rules|achievements|device|curse|house|criterion|variant)\.[a-zA-Z-]+/;
    for (const l of LOCALES) {
      await setLocale(l as Locale, { persist: false });
      await Promise.all(['card-terms', 'variants', 'rules', 'achievements'].map((a) => loadArea(a)));
      await loadPack(l);
      const said: string[] = [];
      for (const c of CARD_CATALOG) {
        said.push(houseName(c.house), elementName(c.element), typeName(c.type));
        const rule = cardRule(c, l);
        expect([l, c.id, rule.lines.length >= 2]).toEqual([l, c.id, true]);
        said.push(rule.name, ...rule.lines);
      }
      for (const city of Object.keys(CITY_CATALOG) as WorldCity[]) said.push(cityName(city), cityRegion(city), abilityBonus(city));
      for (const a of ACHIEVEMENTS) said.push(achievementName(a), achievementDescription(a));
      said.push(synergyLine('Montague', l), ...deckProblems({ name: 'x', characters: ['RL-001'], relics: ['MO-001', 'MO-002', 'CA-001'], potions: ['nope'] }));
      for (const s of said) expect([l, s, s.length > 0 && !leak.test(s)]).toEqual([l, s, true]);
      if (l !== 'en') {
        // Not English underneath: the pieces that come from this work's areas differ from the English ones.
        expect([l, deckProblems({ name: 'x', characters: [], relics: [], potions: [] })[0]]).not.toEqual([l, 'Characters in a deck: at least 3.']);
        expect([l, achievementDescription(ACHIEVEMENTS[0])]).not.toEqual([l, 'Win your first battle']);
      }
    }
    await setLocale('en', { persist: false });
    expect(deckProblems({ name: 'x', characters: [], relics: [], potions: [] })).toEqual(['Characters in a deck: at least 3.']);
    expect(deckProblems({ name: 'x', characters: ['MO-001', 'MO-002', 'CA-001'], relics: [], potions: [] })).toEqual([]);
    expect(cityRegion('Lagos')).toBe('Western Africa');
    expect(cityRegion('Istanbul')).toBe('Eurasia');
  });
});
