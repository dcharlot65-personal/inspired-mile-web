/**
 * Every translated string of the game, per language, and a way to turn a
 * template into the sentences a player actually reads.
 *
 * A template such as "Exactly {n, plural, one {# line} other {# lines}}" is not
 * something a grammar checker can read. renderSamples() fills it in: one
 * sentence for each plural category the language has (with a number that falls
 * in that category), every other placeholder replaced by a realistic value
 * (a card's name, a model's name, a word of the language). It also says which
 * stretches of each sentence were filled in, so a tool's complaint about
 * "Hamlet" or "Gemma" can be told from one about the translation.
 */
import './ts-hooks.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const { parseMessage, formatNumber, formatList, pluralCategory, PLURAL_CATEGORIES } = await import('../../../src/lib/verse/msg.ts');
const { LOCALES, loadMessages } = await import('../../../src/i18n/index.ts');
const { loadPack } = await import('../../../src/lib/verse/packs/index.ts');
const { HOUSE_QUOTES } = await import('../../../src/lib/verse/english.ts');

export { LOCALES, HOUSE_QUOTES, parseMessage, PLURAL_CATEGORIES, pluralCategory };

export const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

// Proposed corrections laid over the locale files without touching them: { lang: { key: template } }
// (LANGQA_OVERLAY=file.json). Lets the tools judge a correction before it is adopted.
const overlay = process.env.LANGQA_OVERLAY ? JSON.parse(readFileSync(process.env.LANGQA_OVERLAY, 'utf8')) : {};

/** The interface messages of a language: { key: template }. */
export async function uiStrings(lang) {
  return { ...(await loadMessages(lang)), ...(overlay[lang] ?? {}) };
}

/**
 * The player-facing text of a language pack: { id: text }. Verses are split
 * into lines (a verse is not a sentence); words are given one by one.
 */
export async function packStrings(lang) {
  const pack = await loadPack(lang);
  const out = {};
  pack.acrostic.forEach((w, i) => (out[`acrostic.${i}`] = w));
  for (const [id, words] of Object.entries(pack.relics)) words.forEach((w, i) => (out[`relics.${id}.${i}`] = w));
  for (const [form, verses] of Object.entries(pack.written)) verses.forEach((v, i) => v.split('\n').forEach((line, j) => (out[`written.${form}.${i}.${j}`] = line)));
  for (const [unit, lines] of Object.entries(pack.acrosticLines)) lines.forEach((l, i) => (out[`acrosticLines.${unit}.${i}`] = l));
  return out;
}

/** One number in each plural category the language has (the smallest whole number that falls in it). */
export function categorySamples(lang) {
  const out = {};
  const want = new Intl.PluralRules(lang).resolvedOptions().pluralCategories;
  for (let n = 0; n <= 1000 && Object.keys(out).length < want.length; n++) {
    const c = pluralCategory(n, lang);
    if (!(c in out)) out[c] = n;
  }
  // A language with a category only fractions reach (Polish and Russian "other").
  for (const c of want) if (!(c in out)) for (const f of [1.5, 0.5, 2.5]) if (pluralCategory(f, lang) === c) { out[c] = f; break; }
  // Numbers the game really shows, so each form is also read with a typical count.
  return out;
}

/** Realistic values for the placeholders that are not counts. */
async function fillers(lang) {
  const ui = await uiStrings(lang);
  const pack = await loadPack(lang);
  const words = pack.relics['RL-001'] ?? Object.values(pack.relics)[0];
  const r = (key, vars) => plain(ui[key], vars, lang);
  return {
    card: 'Hamlet',
    name: 'Ariel',
    model: 'Gemma',
    email: 'a@example.com',
    city: 'Verona',
    size: `${formatNumber(3.1, lang)} GB`,
    date: new Intl.DateTimeFormat(lang, { dateStyle: 'medium' }).format(new Date(Date.UTC(2026, 10, 16))),
    letter: pack.forbidden[0].toLocaleUpperCase(lang),
    word: words[0],
    words: formatList(words.slice(0, 3), lang),
    rule: r('curse.short-words.brief', { n: 5 }),
    brief: r('device.exclaim.brief', {}),
    label: r('check.lines', { n: 4 }),
    criterion: ui['criterion.wit'],
    who: ui['verdict.who.player'],
    you: ui['battle.you'],
    them: ui['battle.opponent'],
  };
}

function plain(template, vars, lang) {
  let out = '';
  const walk = (parts, pound) => {
    for (const p of parts) {
      if (p.type === 'text') out += p.value;
      else if (p.type === 'pound') out += pound;
      else if (p.type === 'arg') out += p.name in vars ? (typeof vars[p.name] === 'number' ? formatNumber(vars[p.name], lang) : vars[p.name]) : `{${p.name}}`;
      else {
        const n = Number(vars[p.name]);
        walk(p.options[`=${n}`] ?? p.options[pluralCategory(n, lang)] ?? p.options.other, formatNumber(n, lang));
      }
    }
  };
  walk(parseMessage(template), '#');
  return out;
}

const NUMERIC = new Set(['n', 'total', 'points', 'bonus', 'penalty', 'a', 'b', 'line', 'done', 'mb', 'percent', 'cards', 'achievements']);
const TYPICAL = { n: 3, total: 3, points: 2, bonus: 2, penalty: 1, a: 1, b: 2, line: 2, done: 512, mb: 75, percent: 40, cards: 12, achievements: 4 };

// A name that means something else in one string: in the tally, {you} and {them} are rounds won.
const BY_KEY = { 'end.tally': { you: 2, them: 1 } };
const fillerCache = new Map();

/**
 * The sentences a template can become. Returns [{ text, filled: [[start, end, name]], counts: {arg: n} }].
 * A template with no count gives one sentence; one with a count gives one per plural category.
 */
export async function renderSamples(lang, template, opts = {}) {
  if (!fillerCache.has(lang)) fillerCache.set(lang, await fillers(lang));
  const own = BY_KEY[opts.key] ?? {};
  const fill = { ...fillerCache.get(lang), ...Object.fromEntries(Object.entries(own).map(([k, v]) => [k, formatNumber(v, lang)])) };
  const parts = parseMessage(template);
  const counted = new Set();
  const collect = (ps) => ps.forEach((p) => { if (p.type === 'plural') { counted.add(p.name); Object.values(p.options).forEach(collect); } });
  collect(parts);
  const cats = categorySamples(lang);
  // opts.typical: one sentence only, every count at a number the game really shows.
  const runs = counted.size && !opts.typical ? Object.entries(cats).map(([cat, n]) => ({ cat, n })) : [{ cat: null, n: null }];
  // Exact-number branches (=0, =1) are sentences too.
  const exact = new Set();
  const collectExact = (ps) => ps.forEach((p) => { if (p.type === 'plural') { for (const [sel, o] of Object.entries(p.options)) { if (sel[0] === '=') exact.add(Number(sel.slice(1))); collectExact(o); } } });
  collectExact(parts);
  if (!opts.typical) for (const n of exact) runs.push({ cat: `=${n}`, n });

  const out = [];
  for (const run of runs) {
    let text = '';
    const filled = [];
    const put = (s, name) => { filled.push([text.length, text.length + s.length, name]); text += s; };
    const walk = (ps, pound) => {
      for (const p of ps) {
        if (p.type === 'text') text += p.value;
        else if (p.type === 'pound') put(pound, '#');
        else if (p.type === 'arg') {
          if (NUMERIC.has(p.name)) put(formatNumber(counted.has(p.name) && run.n !== null ? run.n : TYPICAL[p.name], lang), p.name);
          else if (p.name in fill) put(fill[p.name], p.name);
          else throw new Error(`renderSamples: no sample value for {${p.name}}; add one in scripts/lang/lib/strings.mjs`);
        } else {
          const n = run.n ?? TYPICAL[p.name] ?? 3;
          walk(p.options[`=${n}`] ?? p.options[pluralCategory(n, lang)] ?? p.options.other, formatNumber(n, lang));
        }
      }
    };
    walk(parts, '#');
    out.push({ text, filled, category: run.cat });
  }
  // Two categories that give the same sentence need checking once.
  const seen = new Set();
  return out.filter((s) => (seen.has(s.text) ? false : (seen.add(s.text), true)));
}

/**
 * What the meaning check (back-translation and LaBSE) compares with the English, as { key: text }:
 * every interface string as a player reads it (one sentence, typical numbers), but the house
 * quotations, which are the source text; and each relic's power words, keyed 'pack:relics.<id>.<i>'.
 * A relic's list translates the English list word for word (word i in every language is English
 * word i; src/i18n/quality.test.ts holds the lists to the same length). The written opponent's
 * verses and the acrostic words are not here: each language's were written to keep a form, not
 * translated line by line, so there is no English line to compare them with.
 */
export async function meaningTexts(lang, s) {
  const out = {};
  for (const [key, template] of Object.entries(s.ui)) if (!(key in HOUSE_QUOTES)) out[key] = (await renderSamples(lang, template, { typical: true, key }))[0].text;
  for (const [id, text] of Object.entries(s.pack)) if (id.startsWith('relics.')) out[`pack:${id}`] = text;
  return out;
}

/** Everything, for every language: { lang: { ui: {key: template}, pack: {id: text} } }. */
export async function allStrings() {
  const out = {};
  for (const lang of LOCALES) out[lang] = { ui: await uiStrings(lang), pack: await packStrings(lang) };
  return out;
}

export function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    if (fallback !== undefined && err.code === 'ENOENT') return fallback;
    throw err;
  }
}
