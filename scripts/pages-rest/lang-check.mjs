// The strings of the page areas (src/i18n/pages), read by tools that did not write them:
// Hunspell for spelling, LanguageTool for grammar, and (scripts/pages-rest/backtranslate.py)
// a translation model for meaning.
//
//   node scripts/pages-rest/lang-check.mjs extract <strings.json>     every string as the sentence a player reads
//   node scripts/pages-rest/lang-check.mjs selftest                   prove each tool flags a known-bad input
//   node scripts/pages-rest/lang-check.mjs spell <strings.json> <out.json>
//   node scripts/pages-rest/lang-check.mjs grammar <strings.json> <out.json>
//
// Environment (scripts/pages-rest/lang-host.sh sets it on the build host):
//   HSPELL    the hspell binary of the shared language QA install (asks Hunspell about whole words)
//   DICT_DIR  its dictionaries (<name>.aff, <name>.dic)
//   LT_URL    a running LanguageTool server
//
// This is the simplest equivalent of the shared pipeline (scripts/lang on branch
// lang/qa-pipeline), which had not landed in main when this was written: the same tools,
// the same installed copies, a smaller script that knows only the page areas. When that
// pipeline lands, the page areas should be added to its string list and this file retired.
//
// Needs Node 23.6 or later (imports the locale modules as they are).
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const LOCALES = ['en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'ru', 'ar', 'hi', 'zh', 'ja', 'ko', 'vi', 'th', 'id'];
export const AREAS = ['classroom', 'marketplace', 'tournaments', 'season', 'viewer', 'shared', 'pwa'];
const CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'];

/** Hunspell dictionary of each language in the shared install; a language not listed has none there. */
const DICTS = { en: 'en', es: 'es', fr: 'fr', de: 'de', it: 'it', pt: 'pt-BR', pl: 'pl', ru: 'ru', ar: 'ar', hi: 'hi', ko: 'ko', vi: 'vi', th: 'th', id: 'id' };
/** LanguageTool's code for each language it has rules for; a language not listed has none. */
const LT = { en: 'en-US', es: 'es', fr: 'fr', de: 'de-DE', it: 'it', pt: 'pt-BR', pl: 'pl-PL', ru: 'ru-RU', ar: 'ar', zh: 'zh-CN', ja: 'ja-JP' };

async function areaMessages(locale) {
  const out = {};
  for (const area of AREAS) {
    const m = (await import(path.join(ROOT, 'src/i18n/pages', area, `${locale}.ts`))).default;
    for (const [k, v] of Object.entries(m)) out[k] = v;
  }
  return out;
}

/** Two names from the core locale, which the consent sentence is built around. Read as text: that module imports others. */
function coreValue(locale, key) {
  const source = readFileSync(path.join(ROOT, 'src/i18n/locales', `${locale}.ts`), 'utf8');
  const m = new RegExp(`^\\s*'${key.replace(/\./g, '\\.')}': '((?:[^'\\\\]|\\\\.)*)',\\s*$`, 'm').exec(source);
  if (!m) throw new Error(`${locale}: core locale has no ${key}`);
  return m[1].replace(/\\'/g, "'");
}

function pluralParts(key) {
  for (const c of CATEGORIES) if (key.endsWith(`.${c}`)) return [key.slice(0, -c.length - 1), c];
  return [key, null];
}

/** A number that falls in a plural category of a language. */
function numberIn(locale, category) {
  const rules = new Intl.PluralRules(locale);
  for (let n = 0; n <= 200; n++) if (rules.select(n) === category) return n;
  for (const n of [1000000, 1.5, 0.5]) if (rules.select(n) === category) return n;
  return 3;
}

const intl = (l) => (l === 'ar' ? 'ar-u-nu-latn' : l);

/** The sentence a player reads: every {placeholder} filled with a realistic value. Returns [text, the filled-in stretches]. */
function render(template, locale, key, messages) {
  const [, category] = pluralParts(key);
  const n = category ? numberIn(locale, category) : key === 'season.xp' || key === 'season.next' ? 150 : 3;
  const values = {
    n: new Intl.NumberFormat(intl(locale)).format(n),
    total: '4',
    min: '1',
    max: new Intl.NumberFormat(intl(locale)).format(100000),
    name: 'Verona',
    seller: 'Viola',
    cards: new Intl.ListFormat(intl(locale), { style: 'long', type: 'conjunction' }).format(['MO-001', 'CA-001']),
    status: messages['tour.status.registration'],
    file: 'hamlet.ply',
    card: 'Hamlet',
    id: 'DC-001',
    // A stored download, written as src/lib/pwa.ts writes it (Intl unit formatting).
    size: new Intl.NumberFormat(intl(locale), { style: 'unit', unit: 'gigabyte', unitDisplay: 'short', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(1.1),
  };
  const filled = [];
  const text = template.replace(/\{([a-zA-Z_]+)\}/g, (whole, name) => {
    if (!(name in values)) throw new Error(`${locale}: ${key} uses {${name}}, which lang-check.mjs cannot fill`);
    filled.push(String(values[name]));
    return String(values[name]);
  });
  return [text, filled];
}

/**
 * Sentences that the markup assembles from pieces around a link or a styled word. The
 * pieces are checked as the one sentence they make, not one by one.
 */
const COMPOSED = {
  'classroom.teacher.check3': (m, l) => `${m['classroom.teacher.check3Before']}${coreValue(l, 'footer.terms')}${m['classroom.teacher.check3And']}${coreValue(l, 'footer.privacy')}${m['classroom.teacher.check3After']}`,
  'vr.play': (m) => `${m['vr.play.before']}${m['vr.play.link']}${m['vr.play.after']}`,
  'market.title': (m) => `${m['market.titleA']}${m['market.titleB']}`,
  'tour.title': (m) => `${m['tour.titleA']}${m['tour.titleB']}`,
  'viewer.title': (m) => `${m['viewer.titleA']}${m['viewer.titleB']}`,
  'vr.title': (m) => `${m['vr.titleA']}${m['vr.titleB']}`,
};
const PIECES = new Set(['classroom.teacher.check3Before', 'classroom.teacher.check3And', 'classroom.teacher.check3After', 'vr.play.before', 'vr.play.link', 'vr.play.after',
  'market.titleA', 'market.titleB', 'tour.titleA', 'tour.titleB', 'viewer.titleA', 'viewer.titleB', 'vr.titleA', 'vr.titleB']);

export async function extract() {
  const out = { locales: {} };
  const english = await areaMessages('en');
  for (const locale of LOCALES) {
    const messages = await areaMessages(locale);
    const items = {};
    for (const [key, template] of Object.entries(messages)) {
      if (PIECES.has(key)) continue;
      const [text, filled] = render(template, locale, key, messages);
      // The English a counted form is compared with is English's form for the same number.
      const [base, category] = pluralParts(key);
      let en = english[key];
      if (category) {
        const n = numberIn(locale, category);
        const form = `${base}.${new Intl.PluralRules('en').select(n)}`;
        en = (english[form] ?? english[`${base}.other`]).replace('{n}', new Intl.NumberFormat('en').format(n));
      } else {
        en = render(en, 'en', key, english)[0];
      }
      items[key] = { text, english: en, filled };
    }
    for (const [key, build] of Object.entries(COMPOSED)) {
      items[key] = { text: build(messages, locale).trim(), english: build(english, 'en').trim(), filled: [] };
    }
    out.locales[locale] = items;
  }
  return out;
}

// --- Spelling ---------------------------------------------------------------

/** Words the game or the web brings with it, the same in every language; not a spelling matter. */
const KNOWN = new Set(['Inspired', 'Mile', 'Shakespeare', 'Verona', 'Viola', 'Hamlet', 'FERPA', 'GLB', 'WebXR', 'Quest', 'Vision', 'Pro', 'Babylon', 'js', 'model', 'viewer',
  'Gaussian', 'splat', 'Splat', 'Splats', 'splats', 'XP', 'AR', 'VR', 'RA', 'RV', 'fps', 'ply', 'hamlet', 'MO', 'CA', 'DC', 'email', 'e', 'mail', 'internet', 'Internet', 'online', 'offline', 'Offline',
  'Sonnet', 'Man', 'iPhone', 'iPad', 'iPhonie', 'iPadzie', 'app', 'App', 'MB', 'GB', 'Mo', 'Go']);

/** The words of a sentence that a dictionary can be asked about. */
function wordsOf(text, locale) {
  if (locale === 'th') {
    // Thai is written without spaces: the browser's own word breaker (ICU) finds the words.
    return [...new Intl.Segmenter('th', { granularity: 'word' }).segment(text)].filter((s) => s.isWordLike).map((s) => s.segment);
  }
  return text.split(/[^\p{L}\p{M}'’-]+/u).map((w) => w.replace(/^['’-]+|['’-]+$/g, '')).filter(Boolean);
}

function hspell(dict, words) {
  const { HSPELL, DICT_DIR } = process.env;
  if (!HSPELL || !DICT_DIR) throw new Error('set HSPELL and DICT_DIR (scripts/pages-rest/lang-host.sh does)');
  if (!existsSync(`${DICT_DIR}/${dict}.aff`)) throw new Error(`no dictionary ${dict} in ${DICT_DIR}`);
  const r = spawnSync(HSPELL, [`${DICT_DIR}/${dict}.aff`, `${DICT_DIR}/${dict}.dic`], { input: words.join('\n') + '\n', encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(`hspell ${dict}: ${r.error ?? r.stderr}`);
  return new Set(r.stdout.split('\n').filter(Boolean));
}

export function spell(strings) {
  const out = { tool: 'Hunspell (shared install), asked word by word through hspell', languages: {} };
  for (const locale of LOCALES) {
    const dict = DICTS[locale];
    if (!dict) {
      out.languages[locale] = { checked: false, why: 'no Hunspell dictionary for this language in the shared install' };
      continue;
    }
    const where = new Map();
    for (const [key, item] of Object.entries(strings.locales[locale])) {
      const filled = new Set(item.filled.flatMap((f) => wordsOf(f, locale)));
      for (const w of wordsOf(item.text, locale)) {
        if (KNOWN.has(w) || filled.has(w) || /^\p{Lu}{2,}$/u.test(w) || /\d/.test(w)) continue;
        if (!where.has(w)) where.set(w, []);
        where.get(w).push(key);
      }
    }
    const words = [...where.keys()];
    let rejected = hspell(dict, words);
    // A word that opens a sentence is tried again in lower case (the dictionary lists "create", not "Create").
    const again = [...rejected].map((w) => [w, w.toLocaleLowerCase(locale)]).filter(([w, low]) => low !== w);
    const stillBad = hspell(dict, again.map(([, low]) => low));
    rejected = new Set([...rejected].filter((w) => { const low = w.toLocaleLowerCase(locale); return low === w || stillBad.has(low); }));
    out.languages[locale] = { checked: true, dictionary: dict, words: words.length, rejected: Object.fromEntries([...rejected].sort().map((w) => [w, [...new Set(where.get(w))].slice(0, 4)])) };
  }
  return out;
}

// --- Grammar ----------------------------------------------------------------

async function languageTool(code, text) {
  const { LT_URL } = process.env;
  if (!LT_URL) throw new Error('set LT_URL (scripts/pages-rest/lang-host.sh does)');
  const r = await fetch(`${LT_URL}/v2/check`, { method: 'POST', body: new URLSearchParams({ language: code, text, level: 'picky' }) });
  if (!r.ok) throw new Error(`LanguageTool ${code}: ${r.status} ${await r.text()}`);
  return (await r.json()).matches;
}

export async function grammar(strings) {
  const out = { tool: 'LanguageTool (shared install), level picky', languages: {} };
  for (const locale of LOCALES) {
    const code = LT[locale];
    if (!code) {
      out.languages[locale] = { checked: false, why: 'LanguageTool has no rules for this language' };
      continue;
    }
    const hits = [];
    let n = 0;
    for (const [key, item] of Object.entries(strings.locales[locale])) {
      n++;
      for (const m of await languageTool(code, item.text)) {
        const word = item.text.slice(m.offset, m.offset + m.length);
        // A complaint about a value that was filled in (a name, a file, a card number) is not about the translation.
        if (item.filled.some((f) => f.includes(word) && word.trim()) || KNOWN.has(word)) continue;
        hits.push({ key, rule: m.rule.id, category: m.rule.category.id, message: m.message, text: item.text, at: word, suggestions: m.replacements.slice(0, 3).map((r) => r.value) });
      }
    }
    out.languages[locale] = { checked: true, code, strings: n, hits };
    console.error(`${locale}: ${n} strings, ${hits.length} hits`);
  }
  return out;
}

// --- Proof that the tools can flag something --------------------------------

const BAD_WORD = { en: 'clasroom', es: 'clasee', fr: 'clasze', de: 'Klaszse', it: 'clasze', pt: 'turmma', pl: 'klasaa', ru: 'класссс', ar: 'صفففف', hi: 'कक्षााा', ko: '학급굽굷', vi: 'lớpp', th: 'ชั้นนนเรียนน', id: 'kelasss' };
const BAD_SENTENCE = {
  en: ['This are a classroom.', 'are'], es: ['Los estudiante está en la clase.', 'estudiante'], fr: ['Les élève est dans la classe.', 'élève'],
  de: ['Ich habe ein Hund gesehen.', 'ein'], it: ['Gli studente è nella classe.', 'studente'], pt: ['Os estudante está na turma.', 'estudante'],
  pl: ['Uczeń są w klasie.', 'są'], ru: ['Ученик находятся в классе.', 'находятся'], ar: ['هذا طالبة جديد.', 'طالبة'], zh: ['我们今天去学校学校。', '学校'], ja: ['私は学校に行くます。', '行くます'],
};

export async function selftest() {
  let wrong = 0;
  for (const [locale, dict] of Object.entries(DICTS)) {
    const good = { en: 'classroom', es: 'clase', fr: 'classe', de: 'Klasse', it: 'classe', pt: 'turma', pl: 'klasa', ru: 'класс', ar: 'صف', hi: 'कक्षा', ko: '학급', vi: 'lớp', th: 'เรียน', id: 'kelas' }[locale];
    const rejected = hspell(dict, [BAD_WORD[locale], good]);
    const ok = rejected.has(BAD_WORD[locale]) && !rejected.has(good);
    console.log(`${ok ? 'CAUGHT ' : 'MISSED '} spelling ${locale}: "${BAD_WORD[locale]}" ${rejected.has(BAD_WORD[locale]) ? 'rejected' : 'ACCEPTED'}, "${good}" ${rejected.has(good) ? 'REJECTED' : 'accepted'}`);
    if (!ok) wrong++;
  }
  if (process.env.LT_URL) {
    for (const [locale, [sentence]] of Object.entries(BAD_SENTENCE)) {
      const matches = await languageTool(LT[locale], sentence);
      console.log(`${matches.length ? 'CAUGHT ' : 'MISSED '} grammar ${locale}: "${sentence}" -> ${matches.map((m) => m.rule.id).join(', ') || 'nothing'}`);
      if (!matches.length) wrong++;
    }
  } else {
    console.log('SKIPPED grammar: no LT_URL');
  }
  return wrong;
}

// --- Command line -----------------------------------------------------------

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [step, a, b] = process.argv.slice(2);
  const read = (f) => JSON.parse(readFileSync(f, 'utf8'));
  const write = (f, data) => writeFileSync(f, JSON.stringify(data, null, 1) + '\n');
  if (step === 'extract') {
    const strings = await extract();
    write(a, strings);
    // The same strings as the list backtranslate.py reads.
    const pairs = [];
    for (const [locale, items] of Object.entries(strings.locales)) {
      if (locale === 'en') continue;
      for (const [key, item] of Object.entries(items)) pairs.push({ id: key, lang: locale, text: item.text, english: item.english });
    }
    write(a.replace(/\.json$/, '') + '-pairs.json', pairs);
    console.log(`${Object.keys(strings.locales.en).length} strings per language, ${pairs.length} pairs to translate back`);
  } else if (step === 'selftest') {
    process.exit((await selftest()) ? 1 : 0);
  } else if (step === 'spell') {
    write(b, spell(read(a)));
  } else if (step === 'grammar') {
    write(b, await grammar(read(a)));
  } else {
    console.error('usage: node scripts/pages-rest/lang-check.mjs extract|selftest|spell|grammar … (see the top of the file)');
    process.exit(2);
  }
}
