/**
 * The mechanical quality checks on every locale, and the proof that each check
 * can fail. The rules are in scripts/lang/lib/mechanical.mjs; accepted
 * exceptions, each with its reason, in docs/language/allow/.
 *
 * What these cannot see (grammar, spelling, meaning, tone) is the business of
 * the tools in scripts/lang/, which run on the build host: see its README.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LOCALES, loadMessages, setLocale, slotPieces, t, num, list, type Locale } from './index';
import en from './locales/en';
import { HOUSE_QUOTES } from '../lib/verse/english';
import { loadPack, PACK_LANGS } from '../lib/verse/packs';
import { argumentNames, interpolate, koreanFinal, parseMessage, pluralBlocks, pluralCategory, MessageSyntaxError } from '../lib/verse/msg';
// @ts-expect-error a plain JavaScript module shared with the command-line tools
import { applyAllowlist, checkLanguage, untranslated } from '../../scripts/lang/lib/mechanical.mjs';
// @ts-expect-error as above
import { checkCitations, checkGlossary, checkNameExceptions } from '../../scripts/lang/lib/glossary.mjs';
// @ts-expect-error as above
import { checkWords, wordsToCheck } from '../../scripts/lang/lib/words.mjs';
// @ts-expect-error as above
import { RULE_TOLD_TO_CASTER } from '../../scripts/lang/lib/context.mjs';
import { readsRtl, startsRtl, wrapUnits } from '../lib/xr/text-wrap';

const read = (path: string) => JSON.parse(readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8'));
const cldr = read('docs/language/sources/cldr.json');
const allow = read('docs/language/allow/mechanical.json');
const same = read('docs/language/allow/untranslated.json');
const glossary = read('docs/language/glossary.json');
const SOURCE_FILES = ['aosp-terms', 'mozilla-terms', 'google-help', 'apple-passkeys', 'wikidata-names', 'wikidata-terms', 'wikidata-titles', 'wiktionary-translations', 'wiktionary-words'];
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

  it('a Korean particle after a value takes the form the value\'s last sound asks for, where the spelling tells it', () => {
    const ko = (template: string, vars: Record<string, string | number>) => interpolate(template, vars, 'ko');
    // A Hangul syllable carries its final consonant: 햄릿 ends in ㅅ, 오필리아 in a vowel.
    expect(ko('{card}이(가) 이겼어요', { card: '햄릿' })).toBe('햄릿이 이겼어요');
    expect(ko('{card}이(가) 이겼어요', { card: '오필리아' })).toBe('오필리아가 이겼어요');
    expect(ko('‘{word}’을(를) 떠올렸어요', { word: '왕관' })).toBe('‘왕관’을 떠올렸어요');
    expect(ko('‘{word}’을(를) 떠올렸어요', { word: '바다' })).toBe('‘바다’를 떠올렸어요');
    // 으로 after a consonant, 로 after a vowel and after ㄹ.
    expect([ko('{w}(으)로', { w: '밤' }), ko('{w}(으)로', { w: '바다' }), ko('{w}(으)로', { w: '달' })]).toEqual(['밤으로', '바다로', '달로']);
    // A letter by its name (ㄱ 기역), a number in Sino-Korean (3 삼, 2 이, 10 십), a capital as a letter (B 비, M 엠).
    expect([ko('{l}을(를)', { l: 'ㄱ' }), ko('{l}을(를)', { l: '이' }), ko('{n}이(가)', { n: 3 }), ko('{n}이(가)', { n: 2 }), ko('{n}이(가)', { n: 10 })]).toEqual(['ㄱ을', '이를', '3이', '2가', '10이']);
    expect([ko('{m}을(를)', { m: 'Gemma 4 E2B' }), ko('{m}을(를)', { m: 'LFM2.5 350M' })]).toEqual(['Gemma 4 E2B를', 'LFM2.5 350M을']);
    // An English word's last sound is not in its spelling: the hedge stays.
    expect(ko('{card}이(가) 이겼어요', { card: 'Hamlet' })).toBe('Hamlet이(가) 이겼어요');
    expect(koreanFinal('Hamlet')).toBeNull();
    // Other languages are untouched.
    expect(interpolate('{card}이(가)', { card: '햄릿' }, 'en')).toBe('햄릿이(가)');
  });

  it('a sentence with links splits at its slots, and only there', () => {
    expect(slotPieces('親が{terms}と{privacy}を確認し')).toEqual([{ text: '親が' }, { slot: 'terms' }, { text: 'と' }, { slot: 'privacy' }, { text: 'を確認し' }]);
    expect(slotPieces('{terms}')).toEqual([{ slot: 'terms' }]);
    expect(slotPieces('no slot')).toEqual([{ text: 'no slot' }]);
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

  it('every citation in the glossary is true of the fetched source files, and every form name says where it comes from', () => {
    const { problems, count } = checkCitations(glossary, sources);
    expect(show(problems)).toEqual([]);
    // 509 cites on 2026-11-16: if they stop being read, this passes on nothing.
    expect(count).toBeGreaterThan(500);
  });

  it('an exception for a form name, or for a word of one, says what the glossary says about its source', () => {
    const allowFiles = { meaning: read('docs/language/allow/meaning.json').entries, spelling: read('docs/language/allow/spelling.json').words, grammar: read('docs/language/allow/grammar.json').entries };
    expect(show(checkNameExceptions(glossary, allowFiles, LOCALES))).toEqual([]);
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

describe('the tools read what the player reads', () => {
  it('a curse rule is filled into {rule} as the pages fill it: told to the caster or to the one cursed', () => {
    // scripts/lang/lib/strings.mjs (renderSamples) fills {rule} with the caster's wording for the keys in
    // RULE_TOLD_TO_CASTER and with the cursed player's for the rest; the pages decide by calling
    // curseRuleTheirs or curseRule. The two must agree, or the tools judge a sentence nobody sees.
    const theirs = new Set<string>();
    const brief = new Set<string>();
    const src = new URL('../', import.meta.url);
    for (const f of readdirSync(src, { recursive: true }) as string[]) {
      if (!/\.(astro|ts|tsx)$/.test(f) || f.endsWith('.test.ts')) continue;
      for (const m of readFileSync(new URL(f, src), 'utf8').matchAll(/\bt\('([\w.-]+)',\s*\{[^}]*?\brule:\s*(curseRuleTheirs|curseRule)\(/g)) (m[2] === 'curseRuleTheirs' ? theirs : brief).add(m[1]);
    }
    expect([...theirs].sort()).toEqual([...RULE_TOLD_TO_CASTER].sort());
    expect([...brief].sort()).toEqual(['round.cursesYou', 'theatre.cursesYou']);
  });
});

describe('the theatre draws text in every script', () => {
  // src/lib/xr/text-wrap.ts: the pieces Babylon's TextBlock may break a line between (it broke only at
  // spaces, so Japanese ran off its panel), and the direction marks a right-to-left line needs.
  const RLM = String.fromCharCode(0x200f);
  it('breaks Japanese, Chinese and Thai between words, never before closing punctuation, and gives each line back whole', async () => {
    for (const l of ['ja', 'zh', 'th', 'de', 'ar'] as Locale[]) {
      const m = await loadMessages(l);
      for (const key of ['theatre.versePrompt', 'theatre.intro']) {
        const line = m[key];
        const units = wrapUnits(line);
        expect([l, key, units.join('').split(RLM).join('')]).toEqual([l, key, line]);
        expect([l, key, units.length > 4]).toEqual([l, key, true]);
        for (const u of units) expect([l, u, /^[\p{Pe}\p{Pf}\p{Po}]/u.test(u.split(RLM).join(''))]).toEqual([l, u, false]);
      }
    }
    expect(wrapUnits('「詩」を書く')).toEqual(['「詩」', 'を', '書く']);
  });

  it('marks a right-to-left line, and only such a line', () => {
    expect(startsRtl('سيظهر بيتك هنا.')).toBe(true);
    expect(startsRtl('Your verse')).toBe(false);
    expect(wrapUnits('هنا.').every((u) => u.startsWith(RLM) && u.endsWith(RLM))).toBe(true);
    expect(wrapUnits('Here.').some((u) => u.includes(RLM))).toBe(false);
    // A panel is aligned by most of its letters: a Latin card name above an Arabic verse reads right to left.
    expect(readsRtl('Apollo\nالفخامة\n\nأعرتك سمعي فأضعت الوقت')).toBe(true);
    expect(readsRtl('Apollo\nVerse in English, with one word عربي')).toBe(false);
  });
});

describe('single words against a published dictionary', () => {
  // Relic power words, the judge's criteria and the glossary's core terms, against English Wiktionary's
  // translation tables (scripts/lang/lib/words.mjs). Back-translation cannot judge a lone word: Hindi
  // लालसा (greed) for "ambition" passed the meaning check with LaBSE 0.72.
  const wikt = read('docs/language/sources/wiktionary-words.json');
  const ts = read('docs/language/sources/opencc-ts.json').map;
  const allowWords = read('docs/language/allow/words.json').entries;
  async function inputs() {
    const packs: Record<string, unknown> = {};
    const ui: Record<string, Record<string, string>> = {};
    for (const l of LOCALES) {
      packs[l] = await loadPack(l);
      ui[l] = await loadMessages(l);
    }
    return { packs, ui };
  }

  it('every word is listed under its English word, or was read and kept with a reason', async () => {
    const { packs, ui } = await inputs();
    const { rows, open, stale } = checkWords(wordsToCheck(LOCALES, packs, ui, glossary), wikt, allowWords, ts);
    expect(open.map((r: { lang: string; id: string; word: string }) => `${r.lang} ${r.id} ${r.word}`)).toEqual([]);
    expect(stale).toEqual([]);
    // 945 words on 2026-11-16 (63 in each of 15 languages): 695 listed, 229 read and kept, 21 with no entry.
    expect(rows.length).toBe(945);
    expect(rows.filter((r: { state: string }) => r.state === 'listed').length).toBeGreaterThan(650);
  });

  it('names a word the dictionary does not give, unless it was read and kept', async () => {
    const { packs, ui } = await inputs();
    const hi = structuredClone(packs.hi) as { relics: Record<string, string[]> };
    hi.relics['RL-006'][2] = 'लालसा';
    const pt = { ...ui.pt, 'criterion.wit': 'engenho' };
    const { open } = checkWords(wordsToCheck(['hi', 'pt'], { ...packs, hi }, { ...ui, pt }, glossary), wikt, allowWords, ts);
    expect(open.map((r: { lang: string; id: string; word: string }) => `${r.lang} ${r.id} ${r.word}`)).toEqual(['hi relics.RL-006.2 लालसा', 'pt criterion.wit engenho']);
    // A reason names the exact word: a changed word is a new finding, and the old reason goes stale.
    const es = structuredClone(packs.es) as { relics: Record<string, string[]> };
    es.relics['RL-001'][1] = 'chanza';
    const r = checkWords(wordsToCheck(['es'], { ...packs, es }, ui, glossary), wikt, allowWords, ts);
    expect(r.open.map((x: { word: string }) => x.word)).toEqual(['chanza']);
    expect(r.stale.map((x: { word: string }) => x.word)).toContain('burla');
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
    // Hedges (the checker planted the first; none of the rules named it).
    ['es', 'b', 'Atrás, querido(a)', 'hedge'],
    ['es', 'b', 'Bienvenido/a', 'hedge'],
    ['pl', 'b', 'Zalogowany(-a)', 'hedge'],
    ['ru', 'b', 'Вы вошли(-ла)', 'hedge'],
    ['hi', 'b', 'मैं पुष्टि करता/करती हूँ', 'hedge'],
    ['ko', 'b', '개인정보 처리방침을(를) 읽었어요', 'ko-particle-hedge'],
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
    // A Korean hedge right after a value is the runtime's to resolve (msg.ts), and a slash in "km/h" is no hedge.
    const enKo = { a: '{card} wins', b: 'Echoed “{word}”', c: 'Starts with {word}', d: '{n} km/h' };
    expect(show(checkLanguage('ko', { a: '{card}이(가) 이겨요', b: '‘{word}’을(를) 떠올렸어요', c: '{word}(으)로 시작해요', d: '시속 {n} km/h' }, enKo, cldr.languages.ko, helpers))).toEqual([]);
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

  it('the citation check names a citation its source file does not bear out', () => {
    const fake = {
      terms: {
        x: {
          langs: {
            es: { source: 'Google Help', cite: [{ google: 'sign-out', text: 'Cerrar la sesión de Gmail' }] },
            fr: { source: 'Android and Mozilla', cite: [{ aosp: 'kg_login_submit_button', text: 'Connexion' }, { mozilla: 'fxa-menu-sign-out', text: 'Se déconnecter…' }] },
            de: { source: 'Mozilla Firefox (sources/nowhere.json)', cite: [{ nowhere: 'x', text: 'Abmelden' }] },
            it: { source: 'Android (AOSP core, screen_lock): Blocco schermo' },
            pt: { source: 'Android', cite: [{ aosp: 'passkey', text: 'chave' }] },
            ja: { source: 'Apple', cite: [{ apple: true, text: 'サインイン' }] },
          },
        },
      },
      names: {
        'form.couplet.name': {
          langs: {
            fr: { value: 'Distique', status: 'sourced', source: 'fr Wikipedia article Distique (littérature)', cite: [{ wikipedia: 'fr', title: 'Distique (littérature)', qid: 'Q4779829' }] },
            // The checker's probe: one title changed.
            it: { value: 'Distico', status: 'sourced', source: 'it Wikipedia article Distich', cite: [{ wikipedia: 'it', title: 'Distich', qid: 'Q4779829' }] },
            pl: { value: 'Dwuwiersz', status: 'sourced', source: 'Wiktionary', cite: [{ wiktionary: 'couplet', text: 'dwuwiersz' }] },
            ru: { value: 'Двустишие', status: 'sourced', source: 'Wiktionary', cite: [{ wiktionary: 'couplet', text: 'двустих' }] },
            // Says it is sourced, cites a true fact, but not one that gives this name.
            pt: { value: 'Parelha', status: 'sourced', source: 'pt Wikipedia article Dístico', cite: [{ wikipedia: 'pt', title: 'Dístico', qid: 'Q4779829' }] },
            // Status and prose disagree.
            ko: { value: '쿠플레', status: 'not-sourced', source: 'ko Wikipedia article 쿠플레', cite: [{ wikipedia: 'ko', title: '쿠플레', qid: 'Q4779829' }] },
            th: { value: 'กลอนคู่', status: 'sourced', source: 'Not sourced.' },
            vi: { value: 'Câu đối vần', status: 'coined', source: 'Not sourced.' },
          },
        },
      },
    };
    const src = {
      'google-help': { pages: { 'sign-out': { text: { es: { title: 'Cerrar sesión o eliminar una cuenta de Gmail', heading: 'Cerrar la sesión de Gmail en el ordenador' } } } } },
      'aosp-terms': { terms: { kg_login_submit_button: { text: { fr: 'Connexion' } }, passkey: { text: { pt: 'chave de acesso' } } } },
      'mozilla-terms': { terms: { 'fxa-menu-sign-out': { text: { fr: 'Se déconnecter…' } } } },
      'apple-passkeys': { pages: { ja: { firstSentence: 'パスキーはパスワードに代わるものとして設計されました。' } } },
      'wikidata-terms': { concepts: { couplet: { qid: 'Q4779829', langs: { fr: { sitelink: 'Distique (littérature)' }, it: { sitelink: 'Distico' }, pt: { sitelink: 'Dístico' }, ko: { sitelink: '쿠플레' } } } } },
      'wikidata-titles': { languages: {} },
      'wiktionary-translations': { concepts: { couplet: { tables: [{ sense: 'in poetry', langs: { pl: ['dwuwiersz', 'dystych'], ru: ['куплет', 'двустишие'] } }] } } },
    };
    const { problems, count } = checkCitations(fake, src);
    expect(count).toBe(12);
    expect(problems.map((p: Problem) => `${p.lang} ${p.rule}`)).toEqual([
      'es citation-not-in-source', // a near-quotation is not the heading
      'de citation-not-in-source', // a cite of no known kind
      'it citation-missing', // prose that names Android, and no cite
      'pt citation-not-in-source', // a substring of Android's string is not the string
      'ja citation-not-in-source', // Apple's sentence does not contain it
      'it citation-not-in-source', // the changed title
      'ru citation-not-in-source',
      'it name-unbacked', // its only cite is false
      'ru name-unbacked',
      'pt name-unbacked',
      'ko name-status',
      'th name-status',
      'th name-unbacked',
      'vi name-status',
    ]);
  });

  it('the name-exception check names a reason that claims a source the glossary denies', () => {
    const g = { names: { 'form.quatrain-aabb.name': { langs: { ko: { value: '짝운 4행시', status: 'not-sourced', source: 'Not sourced.' }, es: { value: 'Cuarteta de pareados', status: 'head', head: 'Cuarteta', source: 'x' } } } } };
    const bad = {
      meaning: [
        { lang: 'ko', key: 'form.quatrain-aabb.name', text: '짝운 4행시', reason: 'The name of a verse form as glossary.json records it.' },
        { lang: 'es', key: 'form.quatrain-aabb.name', text: 'Cuarteta de pareados', reason: 'Head word sourced: Cuarteta.' },
      ],
      spelling: { ko: { '짝운': "A word of a verse form's or device's name, taken from a published source (docs/language/glossary.json, 'names')." }, es: { Cuarteta: "A verse form's name: not sourced." } },
      grammar: [{ lang: 'ko', rule: 'X', id: '*', at: '짝운', reason: "A verse form's name sourced in docs/language/glossary.json." }],
    };
    expect((checkNameExceptions(g, bad, ['ko', 'es']) as Problem[]).map((p) => `${p.lang} ${p.key}`)).toEqual([
      'ko form.quatrain-aabb.name',
      'ko spelling:짝운',
      'es spelling:Cuarteta',
      'ko grammar X:짝운',
    ]);
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
