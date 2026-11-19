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
import { RULE_TOLD_TO_CASTER } from './context.mjs';
import { fileURLToPath } from 'node:url';

const { parseMessage, formatNumber, formatList, pluralCategory, PLURAL_CATEGORIES, koreanParticleAfter } = await import('../../../src/lib/verse/msg.ts');
const { LOCALES, loadMessages } = await import('../../../src/i18n/index.ts');
const { loadPack } = await import('../../../src/lib/verse/packs/index.ts');
const { HOUSE_QUOTES } = await import('../../../src/lib/verse/english.ts');
const { default: JUDGE_WORDS } = await import('../../../src/lib/verse/judge-words.ts');

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
 * into lines (a verse is not a sentence); words are given one by one. The
 * written opponent's verses: `written`, and `spare`, those it keeps for a curse.
 */
export async function packStrings(lang) {
  const pack = await loadPack(lang);
  const out = {};
  pack.acrostic.forEach((w, i) => (out[`acrostic.${i}`] = w));
  for (const [id, words] of Object.entries(pack.relics)) words.forEach((w, i) => (out[`relics.${id}.${i}`] = w));
  for (const [form, verses] of Object.entries(pack.written)) verses.forEach((v, i) => v.split('\n').forEach((line, j) => (out[`written.${form}.${i}.${j}`] = line)));
  // The verses held back for a cursed opponent (packs/index.ts `spare`; English only, since 2026-11-17).
  for (const [form, verses] of Object.entries(pack.spare ?? {})) verses.forEach((v, i) => v.split('\n').forEach((line, j) => (out[`spare.${form}.${i}.${j}`] = line)));
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
    // The label the page shows (src/lib/brain.ts): a Korean particle after it is chosen by its last letter.
    model: 'Gemma 4 E2B',
    email: 'a@example.com',
    city: 'Verona',
    size: `${formatNumber(3.1, lang)} GB`,
    date: new Intl.DateTimeFormat(lang, { dateStyle: 'medium' }).format(new Date(Date.UTC(2026, 10, 16))),
    letter: pack.forbidden[0].toLocaleUpperCase(lang),
    word: words[0],
    words: formatList(words.slice(0, 3), lang),
    rule: r('curse.short-words.brief', { n: 5 }),
    ruleTheirs: r('curse.short-words.theirs', { n: 5 }),
    curseName: ui['curse.short-words.name'],
    // The links a sentence holds in its slots (age.consent, age.agree, auth.legal: fillSlots, src/i18n).
    terms: ui['footer.terms'],
    privacy: ui['footer.privacy'],
    brief: r('device.exclaim.brief', {}),
    label: r('check.lines', { n: 4 }),
    criterion: ui['criterion.wit'],
    who: ui['verdict.who.player'],
    you: ui['battle.you'],
    them: ui['battle.opponent'],
    // The lines the grading model will not read, as battle.astro and theatre.ts list them: each line's
    // number and the word that leaves it out (live.judgeUnreadLine, one of the language's judge words in
    // src/lib/verse/judge-words.ts), joined as the language joins a list.
    lines: formatList([2, 4].map((n, i) => plain(ui['live.judgeUnreadLine'] ?? '{line} ({word})', { line: n, word: JUDGE_WORDS[lang].judge[i] }, lang)), lang),
  };
}

function plain(template, vars, lang) {
  let out = '';
  const walk = (parts, pound) => {
    let last = null; // the value just written: a Korean particle after it takes its form, as msg.ts renders
    for (const p of parts) {
      if (p.type === 'text') out += lang === 'ko' && last !== null ? koreanParticleAfter(last, p.value) : p.value;
      else if (p.type === 'pound') out += pound;
      else if (p.type === 'arg') out += p.name in vars ? (typeof vars[p.name] === 'number' ? formatNumber(vars[p.name], lang) : vars[p.name]) : `{${p.name}}`;
      else {
        const n = Number(vars[p.name]);
        walk(p.options[`=${n}`] ?? p.options[pluralCategory(n, lang)] ?? p.options.other, formatNumber(n, lang));
      }
      last = p.type === 'arg' && p.name in vars ? (typeof vars[p.name] === 'number' ? formatNumber(vars[p.name], lang) : vars[p.name]) : null;
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
  // {rule} as the page fills it: told to the caster in these strings (lib/context.mjs).
  if (RULE_TOLD_TO_CASTER.includes(opts.key)) fill.rule = fill.ruleTheirs;
  // {name} is a curse's name, in the language, where the page passes curseName() (battle.astro).
  if (opts.key === 'round.cursesYou') fill.name = fill.curseName;
  const parts = parseMessage(template);
  const counted = new Set();
  const collect = (ps) => ps.forEach((p) => { if (p.type === 'plural') { counted.add(p.name); Object.values(p.options).forEach(collect); } });
  collect(parts);
  const cats = categorySamples(lang);
  // opts.typical: one sentence only, every count at a number the game really shows.
  // opts.n: one sentence only, every count at that number (the English beside a plural form).
  const one = opts.typical || opts.n !== undefined;
  const runs = counted.size && !one ? Object.entries(cats).map(([cat, n]) => ({ cat, n })) : [{ cat: null, n: opts.n ?? null }];
  // Exact-number branches (=0, =1) are sentences too.
  const exact = new Set();
  const collectExact = (ps) => ps.forEach((p) => { if (p.type === 'plural') { for (const [sel, o] of Object.entries(p.options)) { if (sel[0] === '=') exact.add(Number(sel.slice(1))); collectExact(o); } } });
  collectExact(parts);
  if (!one) for (const n of exact) runs.push({ cat: `=${n}`, n });

  const out = [];
  for (const run of runs) {
    let text = '';
    const filled = [];
    const put = (s, name) => { filled.push([text.length, text.length + s.length, name]); text += s; };
    const walk = (ps, pound) => {
      let last = null; // the value just put: a Korean particle after it takes its form, as msg.ts renders
      for (const p of ps) {
        if (p.type === 'text') text += lang === 'ko' && last !== null ? koreanParticleAfter(last, p.value) : p.value;
        else if (p.type === 'pound') put(pound, '#');
        else if (p.type === 'arg') {
          if (NUMERIC.has(p.name)) put(formatNumber(counted.has(p.name) && run.n !== null ? run.n : TYPICAL[p.name], lang), p.name);
          else if (p.name in fill) put(fill[p.name], p.name);
          else throw new Error(`renderSamples: no sample value for {${p.name}}; add one in scripts/lang/lib/strings.mjs`);
        } else {
          const n = run.n ?? TYPICAL[p.name] ?? 3;
          walk(p.options[`=${n}`] ?? p.options[pluralCategory(n, lang)] ?? p.options.other, formatNumber(n, lang));
        }
        last = p.type === 'arg' ? text.slice(filled.at(-1)[0]) : null;
      }
    };
    walk(parts, '#');
    out.push({ text, filled, category: run.cat, n: run.n });
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
 *
 * A string with a count also gives each of its other plural forms, keyed '<key>@<category>' (Arabic
 * zero, one, two, few, many; Polish and Russian few and many; …), each at the number that selects
 * it, and meaningEnglish() gives the English at that same number. Until 2026-11-17 only the typical
 * form was back-translated, so a wrong Arabic dual or Polish genitive plural was never read.
 */
export async function meaningTexts(lang, s) {
  const out = {};
  for (const [key, template] of Object.entries(s.ui)) {
    if (key in HOUSE_QUOTES) continue;
    const typical = (out[key] = (await renderSamples(lang, template, { typical: true, key }))[0].text);
    for (const x of await renderSamples(lang, template, { key })) if (x.category && x.text !== typical) out[`${key}@${x.category}`] = x.text;
  }
  for (const [id, text] of Object.entries(s.pack)) if (id.startsWith('relics.')) out[`pack:${id}`] = text;
  return out;
}

/** The English each of meaningTexts(lang)'s plural forms is compared with: { '<key>@<category>': text }. */
export async function meaningEnglish(lang, s, en) {
  const out = {};
  for (const [key, template] of Object.entries(s.ui)) {
    if (key in HOUSE_QUOTES || !(key in en.ui)) continue;
    const typical = (await renderSamples(lang, template, { typical: true, key }))[0].text;
    for (const x of await renderSamples(lang, template, { key })) if (x.category && x.text !== typical) out[`${key}@${x.category}`] = (await renderSamples('en', en.ui[key], { key, n: x.n }))[0].text;
  }
  return out;
}

/**
 * What the grammar and spelling tools read, as [{ id, text, filled, category }]: every interface
 * string as the sentences a player can see (one per plural form; the house quotations, which are the
 * source text, left out) and every pack line as written. `onlyKeys`: a Set of ids ('ui:key',
 * 'pack:id') to keep. scripts/lang/fresh.mjs rebuilds this list to see whether grammar.json is about
 * the strings as they are now.
 */
export async function grammarItems(lang, s, onlyKeys = null) {
  const items = [];
  for (const [key, template] of Object.entries(s.ui)) {
    if (key in HOUSE_QUOTES || (onlyKeys && !onlyKeys.has(key))) continue;
    for (const x of await renderSamples(lang, template, { key })) items.push({ id: `ui:${key}`, text: x.text, filled: x.filled, category: x.category });
  }
  for (const [id, text] of Object.entries(s.pack)) if (!onlyKeys || onlyKeys.has(`pack:${id}`)) items.push({ id: `pack:${id}`, text, filled: [], category: null });
  return items;
}

/** The sentences checked, per id: { id: [text, …] }, as grammar.json keeps them. */
export function checkedTexts(items) {
  const out = {};
  for (const i of items) (out[i.id] ??= []).push(i.text);
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
