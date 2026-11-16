/**
 * The mechanical quality checks on every locale, and the proof that each check
 * can fail. The rules are in scripts/lang/lib/mechanical.mjs; accepted
 * exceptions, each with its reason, in docs/language/allow/.
 *
 * What these cannot see (grammar, spelling, meaning, tone) is the business of
 * the tools in scripts/lang/, which run on the build host: see its README.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LOCALES, loadMessages, setLocale, t, num, list, type Locale } from './index';
import en from './locales/en';
import { HOUSE_QUOTES } from '../lib/verse/english';
import { loadPack, PACK_LANGS } from '../lib/verse/packs';
import { argumentNames, interpolate, parseMessage, pluralBlocks, pluralCategory, MessageSyntaxError } from '../lib/verse/msg';
// @ts-expect-error a plain JavaScript module shared with the command-line tools
import { applyAllowlist, checkLanguage, untranslated } from '../../scripts/lang/lib/mechanical.mjs';
// @ts-expect-error as above
import { checkCitations, checkGlossary } from '../../scripts/lang/lib/glossary.mjs';

const read = (path: string) => JSON.parse(readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8'));
const cldr = read('docs/language/sources/cldr.json');
const allow = read('docs/language/allow/mechanical.json');
const same = read('docs/language/allow/untranslated.json');
const glossary = read('docs/language/glossary.json');
const SOURCE_FILES = ['aosp-terms', 'mozilla-terms', 'google-help', 'apple-passkeys', 'wikidata-names'];
const sources = Object.fromEntries(SOURCE_FILES.map((f) => [f, read(`docs/language/sources/${f}.json`)]));
const helpers = { parseMessage, argumentNames, pluralBlocks };

type Problem = { lang: string; key: string; rule: string; detail: string };
const show = (ps: Problem[]) => ps.map((p) => `${p.lang} ${p.rule} ${p.key}: ${p.detail}`);

describe('plural rules', () => {
  it('the pinned CLDR and this machine’s Intl agree on every language’s plural categories', () => {
    for (const l of LOCALES) {
      const intl = new Intl.PluralRules(l).resolvedOptions().pluralCategories;
      expect([l, [...intl].sort()]).toEqual([l, [...cldr.languages[l].pluralCategories].sort()]);
    }
  });

  it('chooses the form by the language’s rule, and writes the number the language’s way', () => {
    const pl = 'Dokładnie {n, plural, one {# wers} few {# wersy} many {# wersów} other {# wersu}}';
    expect([1, 2, 4, 5, 12, 22, 25, 1.5].map((n) => interpolate(pl, { n }, 'pl'))).toEqual([
      'Dokładnie 1 wers', 'Dokładnie 2 wersy', 'Dokładnie 4 wersy', 'Dokładnie 5 wersów', 'Dokładnie 12 wersów', 'Dokładnie 22 wersy', 'Dokładnie 25 wersów', 'Dokładnie 1,5 wersu',
    ]);
    const ar = '{n, plural, zero {# سطر} one {سطر واحد} two {سطران} few {# أسطر} many {# سطرًا} other {# سطر}}';
    expect([0, 1, 2, 3, 10, 11, 99, 100, 102, 103].map((n) => pluralCategory(n, 'ar'))).toEqual(['zero', 'one', 'two', 'few', 'few', 'many', 'many', 'other', 'other', 'few']);
    expect(interpolate(ar, { n: 2 }, 'ar')).toBe('سطران');
    expect(interpolate(ar, { n: 11 }, 'ar')).toBe('11 سطرًا');
    // Russian: 21 takes the singular, 11 does not.
    const ru = '{n, plural, one {# строка} few {# строки} many {# строк} other {# строки}}';
    expect([1, 11, 21, 22, 111].map((n) => interpolate(ru, { n }, 'ru'))).toEqual(['1 строка', '11 строк', '21 строка', '22 строки', '111 строк']);
    // French counts 0 as singular; English does not.
    expect(interpolate('{n, plural, one {# vers} many {# vers} other {# vers}}', { n: 0 }, 'fr')).toBe('0 vers');
    expect(interpolate('{n, plural, one {# line} other {# lines}}', { n: 0 })).toBe('0 lines');
    expect(interpolate('{n, plural, one {# line} other {# lines}}', { n: 1 })).toBe('1 line');
    // An exact number wins over its category; a count in a string still chooses a form.
    expect(interpolate('{n, plural, =0 {none} one {# line} other {# lines}}', { n: 0 })).toBe('none');
    expect(interpolate('{n, plural, one {# line} other {# lines}}', { n: '1' })).toBe('1 line');
    // Numbers: grouping and decimal mark are the language's.
    expect(interpolate('{n}', { n: 1234.5 }, 'de')).toBe('1.234,5');
    expect(interpolate('{n}', { n: 1234.5 }, 'en')).toBe('1,234.5');
    expect(interpolate('{n}', { n: 0.5 }, 'fr')).toBe('0,5');
    // A missing count stays visible instead of silently choosing a form.
    expect(interpolate('{n, plural, one {# line} other {# lines}}', {})).toBe('{n} lines');
    // Text with no placeholders is returned untouched, apostrophes and all.
    expect(interpolate("opponent's verse", { n: 1 })).toBe("opponent's verse");
  });

  it('joins a list the way the language does', () => {
    expect(interpolate('{words}', { words: ['a', 'b', 'c'] }, 'en')).toBe('a, b, and c');
    expect(interpolate('{words}', { words: ['a', 'b', 'c'] }, 'es')).toBe('a, b y c');
    expect(interpolate('{words}', { words: ['a', 'b', 'c'] }, 'ja')).toBe('a、b、c');
    expect(interpolate('{words}', { words: ['a'] }, 'de')).toBe('a');
  });

  it('refuses a malformed template when parsing, and shows it as written when rendering', () => {
    for (const bad of ['{n, plural, one {# line}}', '{n, plural, one {x} other {y}', 'a } b', '{n, select, a {x} other {y}}', '{n, plural, some {x} other {y}}', '{2n}', '{n, plural, one {a} one {b} other {c}}']) {
      expect(() => parseMessage(bad), bad).toThrow(MessageSyntaxError);
      expect(interpolate(bad, { n: 1 })).toBe(bad);
    }
  });

  it('t(), num() and list() follow the current locale', async () => {
    try {
      await setLocale('ru', { persist: false });
      expect(t('check.lines', { n: 3 })).toBe('Ровно 3 строки');
      expect(t('check.lines', { n: 5 })).toBe('Ровно 5 строк');
      expect(num(1234.5)).toBe('1 234,5');
      expect(list(['а', 'б', 'в'])).toBe('а, б и в');
      await setLocale('ar', { persist: false });
      expect(t('check.lines', { n: 2 })).toBe('سطران بالضبط');
      expect(t('check.lines', { n: 4 })).toBe('4 أسطر بالضبط');
    } finally {
      await setLocale('en', { persist: false });
    }
    expect(t('check.lines', { n: 1 })).toBe('Exactly 1 line');
    expect(t('check.lines', { n: 4 })).toBe('Exactly 4 lines');
  });

  it('every count in every language renders for every number without leaving syntax behind', async () => {
    const numbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 14, 20, 21, 22, 25, 99, 100, 101, 102, 111, 1000, 1.5];
    const leftovers: string[] = [];
    for (const l of LOCALES) {
      const m = await loadMessages(l);
      for (const [key, template] of Object.entries(m)) {
        const counts = pluralBlocks(template).map((b) => b.name);
        if (!counts.length) continue;
        for (const n of numbers) {
          const vars: Record<string, number | string> = { line: 2 };
          for (const c of counts) vars[c] = n;
          const out = interpolate(template, vars, l);
          if (/[{}#]|plural/.test(out)) leftovers.push(`${l} ${key} n=${n}: ${out}`);
        }
      }
    }
    expect(leftovers).toEqual([]);
  });
});

describe('every locale passes the mechanical checks', () => {
  it('structure, plural categories, spacing, punctuation, quotation marks, script, hidden characters', async () => {
    const problems: Problem[] = [];
    for (const l of LOCALES) {
      const m = await loadMessages(l);
      problems.push(...checkLanguage(l, m, en, cldr.languages[l], helpers, { quotations: HOUSE_QUOTES, extraQuotes: allow.extraQuotes }));
      for (const key of untranslated(l, m, en, HOUSE_QUOTES)) problems.push({ lang: l, key, rule: 'same-as-english', detail: en[key] });
    }
    const { open, unused } = applyAllowlist(problems, [...allow.entries, ...same.entries.map((e: object) => ({ ...e, rule: 'same-as-english' }))]);
    expect(show(open)).toEqual([]);
    // An exception that no longer excuses anything is removed, not left to excuse the next mistake.
    expect(unused).toEqual([]);
    for (const e of [...allow.entries, ...same.entries]) expect([e.key, typeof e.reason === 'string' && e.reason.length > 10]).toEqual([e.key, true]);
  });

  it('each language keeps to its glossary', async () => {
    const problems: Problem[] = [];
    for (const l of LOCALES) problems.push(...checkGlossary(l, await loadMessages(l), en, glossary));
    expect(show(problems)).toEqual([]);
  });

  it('every word the glossary quotes from a fetched source is in that source file', () => {
    const { problems, count } = checkCitations(glossary, sources);
    expect(show(problems)).toEqual([]);
    // The pattern must still be finding the citations (about 137 on 2026-11-16), or this passes on nothing.
    expect(count).toBeGreaterThan(120);
  });
});

describe('relic power words translate the English list word for word', () => {
  // The meaning check (scripts/lang/lib/strings.mjs, meaningTexts) compares word i of a relic in each
  // language with English word i, so the lists must line up.
  it('every pack has the same relics as English, each with as many words', async () => {
    const en = await loadPack('en');
    const shape = (p: { relics: Record<string, string[]> }) => Object.fromEntries(Object.entries(p.relics).map(([id, ws]) => [id, ws.length]));
    for (const l of PACK_LANGS) expect([l, shape(await loadPack(l))]).toEqual([l, shape(en)]);
  });
});

describe('the checks can fail', () => {
  // Each line: a language, a bad translation of an English string, and the rule that must name it.
  const EN = {
    a: 'Exactly {n, plural, one {# line} other {# lines}}',
    b: 'Sign in',
    c: 'Is it yours?',
    d: 'echoed “{word}”',
    e: 'Line {line}: done.',
    f: ' and ',
  };
  const CASES: [Locale, keyof typeof EN, string, string][] = [
    ['pl', 'a', 'Dokładnie {n} wersów', 'plural-missing'],
    ['pl', 'a', 'Dokładnie {n, plural, one {# wers} other {# wersów}}', 'plural-category-missing'],
    ['ja', 'a', 'ちょうど{n, plural, one {#行} other {#行}}', 'plural-category-unknown'],
    ['ar', 'a', '{n, plural, zero {# سطر} one {سطر} two {سطران} few {# أسطر} other {# سطر}}', 'plural-category-missing'],
    ['de', 'a', 'Genau {m, plural, one {# Zeile} other {# Zeilen}}', 'placeholders'],
    ['de', 'a', 'Genau {n, plural, one {# Zeile} other {# Zeilen}', 'syntax'],
    ['de', 'b', '', 'empty'],
    ['de', 'b', 'Anmelden  jetzt', 'double-space'],
    ['de', 'b', ' Anmelden', 'edge-space'],
    ['de', 'f', 'und', 'edge-space'],
    ['de', 'b', 'Anmelden,, jetzt', 'doubled-punctuation'],
    ['de', 'b', 'Anmelden ,jetzt', 'space-before-punctuation'],
    ['fr', 'b', 'Se connecter ,maintenant', 'space-before-punctuation'],
    ['de', 'b', 'Anmelden , jetzt', 'space-before-punctuation'],
    ['de', 'b', 'Anmelden (jetzt', 'unbalanced'],
    ['de', 'b', 'Anmel​den', 'invisible-char'],
    ['de', 'b', 'Anmelden‎', 'bidi-control'],
    ['ar', 'b', 'تسجيل‏ الدخول', 'bidi-control'],
    ['de', 'b', 'Anmelden.', 'ending'],
    ['de', 'c', 'Ist es deins.', 'ending'],
    ['de', 'd', 'wiederholt "{word}"', 'straight-quote'],
    ['de', 'd', 'wiederholt «{word}»', 'foreign-quote'],
    ['fr', 'c', 'Est-ce à vous ?', 'fr-nbsp'],
    ['fr', 'e', 'Vers {line} : fait.', 'fr-nbsp'],
    ['fr', 'd', 'repris «{word}»', 'fr-nbsp'],
    ['es', 'c', 'Es tuyo?', 'es-inverted'],
    ['de', 'b', 'Anmelden…', 'de-ellipsis-space'],
    ['es', 'b', 'Iniciar sesión...', 'ascii-ellipsis'],
    ['zh', 'e', '第{line}行:完成。', 'cjk-halfwidth'],
    ['ja', 'c', 'あなたのですか?', 'cjk-halfwidth'],
    ['zh', 'b', '登 录', 'cjk-space'],
    ['ar', 'c', 'هل هو لك?', 'ar-punctuation'],
    ['ar', 'b', 'تسجيـل الدخول', 'ar-tatweel'],
    ['hi', 'e', 'पंक्ति {line}: हो गया.', 'hi-danda'],
    ['th', 'e', 'บรรทัด {line}: เสร็จแล้ว.', 'th-full-stop'],
    ['vi', 'b', 'Đăng nhập bằng khóa truy cập', 'vi-tone-placement'],
    ['vi', 'c', 'Bạn có khỏe không?', 'vi-tone-placement'],
    ['ru', 'b', 'Sign in', 'no-native-script'],
    ['ru', 'b', 'Вoйти', 'mixed-script-word'],
    ['de', 'b', 'Anmelden�', 'replacement-char'],
    // The escape written twice in the source: the player saw the six characters.
    ['fr', 'e', 'Vers {line}\\u00a0: fait.', 'escape-literal'],
    ['de', 'b', 'Änmelden', 'not-nfc'],
  ];

  it('each rule names a known-bad string', () => {
    for (const [lang, key, value, rule] of CASES) {
      const strings: Record<string, string> = { ...EN, [key]: value };
      // The other keys are English, which is fine for this purpose except in the rules about script.
      const found = (checkLanguage(lang, strings, EN, cldr.languages[lang], helpers) as Problem[]).filter((p) => p.key === key).map((p) => p.rule);
      expect([lang, value, found.includes(rule) ? rule : found]).toEqual([lang, value, rule]);
    }
  });

  it('a clean string raises nothing, so the rules above are not simply always on', () => {
    const clean: [Locale, Record<string, string>][] = [
      ['fr', { a: 'Exactement {n, plural, one {# vers} many {# vers} other {# vers}}', b: 'Se connecter', c: 'Est-ce à vous ?', d: 'repris « {word} »', e: 'Vers {line} : fait.', f: ' et ' }],
      ['ja', { a: 'ちょうど{n}行', b: 'サインイン', c: 'あなたのですか？', d: '「{word}」を響かせた', e: '{line}行目：完了。', f: 'と' }],
      ['ar', { a: '{n, plural, zero {# سطر} one {سطر واحد} two {سطران} few {# أسطر} many {# سطرًا} other {# سطر}} بالضبط', b: 'تسجيل الدخول', c: 'هل هو لك؟', d: 'ردّدت ”{word}“', e: 'السطر {line}: تمّ.', f: ' و ' }],
      // The new placement, and syllables whose mark is placed the same in both (quý, hoàng, khoản).
      ['vi', { a: 'Đúng {n, plural, one {# dòng} other {# dòng}}', b: 'Đăng nhập bằng khoá truy cập', c: 'Bạn có khoẻ không, quý khách?', d: 'lặp lại “{word}”', e: 'Dòng {line}: hoàng hôn, khoản cuối.', f: ' và ' }],
    ];
    for (const [lang, strings] of clean) expect(show(checkLanguage(lang, strings, EN, cldr.languages[lang], helpers))).toEqual([]);
  });

  it('the glossary check names a string that strays from the term, a ruled-out word, and a changed form name', async () => {
    const es = { ...(await loadMessages('es')) };
    expect(checkGlossary('es', es, en, glossary)).toEqual([]);
    es['round.yourVerse'] = 'Tu poema';
    es['form.haiku.name'] = 'Jaiku';
    const found = (checkGlossary('es', es, en, glossary) as Problem[]).map((p) => `${p.rule} ${p.key}`);
    expect(found).toEqual(['glossary round.yourVerse', 'glossary-name form.haiku.name']);
    const tiny = { terms: { ink: { match: '\\bink\\b', langs: { es: { term: 'tinta', forbid: ['pintura'] } } } }, names: {} };
    expect((checkGlossary('es', { a: 'Sin pintura.' }, { a: 'Not enough ink.' }, tiny) as Problem[]).map((p) => p.rule)).toEqual(['glossary', 'glossary-forbidden']);
    expect(checkGlossary('fr', { a: 'x' }, { a: 'Not enough ink.' }, tiny).map((p: Problem) => p.rule)).toEqual(['glossary-missing']);
  });

  it('the citation check names a quotation its source file does not hold, and a file that is not there', () => {
    const fake = {
      terms: {
        x: {
          langs: {
            es: { source: 'Google Help, Gmail answer 8154 (sources/google-help.json): Cerrar la sesión de Gmail.' },
            fr: { source: 'Android (AOSP core, kg_login_submit_button): Connexion; Mozilla Firefox (sources/mozilla-terms.json, fxa-menu-sign-out): Se déconnecter…' },
            de: { source: 'Mozilla Firefox (sources/nowhere.json): Abmelden' },
          },
        },
      },
      names: {},
    };
    const src = { 'google-help': { pages: { 'sign-out': { text: { es: { title: null, heading: null } } } } }, 'aosp-terms': { t: 'Connexion' }, 'mozilla-terms': { t: 'Se déconnecter…' } };
    const { problems, count } = checkCitations(fake, src);
    expect(count).toBe(4);
    expect(problems.map((p: Problem) => `${p.lang} ${p.rule}`)).toEqual(['es citation-not-in-source', 'de citation-no-file']);
  });

  it('a string left in English is caught unless it is on the list', () => {
    expect(untranslated('de', { ...en, 'battle.begin': en['battle.begin'] }, en, HOUSE_QUOTES)).toContain('battle.begin');
    const { open, unused } = applyAllowlist(
      [{ lang: 'de', key: 'x', rule: 'ending', detail: '' }],
      [{ lang: 'de', key: 'y', rule: 'ending', reason: 'stale' }],
    );
    expect([open.length, unused.length]).toEqual([1, 1]);
  });
});
