#!/usr/bin/env node
/**
 * A second opinion from a different model, run locally (llama.cpp's server,
 * OpenAI-compatible, started by run.sh). For each language it is asked to act
 * as a native-speaking localisation reviewer: it sees the English, where the
 * string appears, and the translation, and returns corrections with reasons.
 *
 *   LLAMA_URL=http://127.0.0.1:18732 node scripts/lang/review.mjs --out review.json [--lang xx,yy] [--batch 12] [--no-pack]
 *
 * What it reads: every interface string, and (unless --no-pack) the language pack's player-facing
 * text: each relic's power words beside the English word they translate, and each line of the
 * written opponent's verses, which have no English source (they were written in the language to keep
 * a form), so for those it judges the language only. Until 2026-11-16 only interface strings were
 * reviewed.
 *
 * This is one generative model checking another: what it returns is a proposal.
 * Nothing it says is adopted until scripts/lang/adopt.mjs has put the correction
 * through the mechanical checks, LanguageTool and Hunspell, and back-translation.
 *
 * The run begins with a control: three translations with planted errors (a wrong
 * word, a missing placeholder's sense, the wrong language) that the reviewer
 * must object to, and one correct translation it must pass. If it fails the
 * control in a language, the result says so, and its silence about the other
 * strings of that language counts for nothing.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { allStrings, HOUSE_QUOTES, LOCALES, ROOT, readJson } from './lib/strings.mjs';
import { contextOf } from './lib/context.mjs';

const args = process.argv.slice(2);
// The last occurrence wins, as in grammar.mjs: run.sh's default --out comes first.
const opt = (name, dflt) => (args.includes(name) ? args[args.lastIndexOf(name) + 1] : dflt);
const URL_ = process.env.LLAMA_URL ?? 'http://127.0.0.1:18732';
const OUT = resolve(opt('--out', `${ROOT}.langqa/review.json`));
const BATCH = Number(opt('--batch', '20'));
const only = opt('--lang', '').split(',').filter(Boolean);
const PACK = !args.includes('--no-pack');
const NAME = { es: 'Spanish (neutral, European spelling)', fr: 'French', de: 'German', it: 'Italian', pt: 'Brazilian Portuguese', pl: 'Polish', ru: 'Russian', ar: 'Modern Standard Arabic', hi: 'Hindi', zh: 'Simplified Chinese', ja: 'Japanese', ko: 'Korean', vi: 'Vietnamese', th: 'Thai', id: 'Indonesian' };
const glossary = readJson(`${ROOT}docs/language/glossary.json`, { terms: {} });

function glossaryLines(lang) {
  const lines = [];
  for (const [id, t] of Object.entries(glossary.terms ?? {})) if (t.langs?.[lang]?.term) lines.push(`${t.english ?? id} = ${t.langs[lang].term}`);
  return lines.join('; ');
}

// The answer names items by number: the ones that are fine, and a correction with its reason for
// the rest. (Writing out every key and an empty correction for each "ok" took most of the
// reviewer's output; on the shared GPU that made a language take over an hour.) An item the answer
// does not name is recorded as "no answer", never as "ok".
const SCHEMA = {
  type: 'object',
  properties: {
    ok: { type: 'array', items: { type: 'integer' } },
    fix: {
      type: 'array',
      items: {
        type: 'object',
        properties: { n: { type: 'integer' }, corrected: { type: 'string' }, reason: { type: 'string' } },
        required: ['n', 'corrected', 'reason'],
      },
    },
  },
  required: ['ok', 'fix'],
};

function prompt(lang, items) {
  return [
    {
      role: 'system',
      content: `You are a professional localisation reviewer and a native speaker of ${NAME[lang]}. You review the ${NAME[lang]} interface text of "Sonnet Man", a card game in which the player's move is a short verse, fought as a three-round duel against a computer opponent.

Each item is numbered and gives where the text appears, the English source and the current translation. Judge the translation as a native reader would: is it correct ${NAME[lang]} (grammar, spelling, agreement, word order), does it mean what the English means, is it natural for a game interface, and does it use the right register consistently?

Rules:
- Text in curly braces is a placeholder ({card}, {n}) and must be kept exactly. A block like {n, plural, one {# line} other {# lines}} is ICU plural syntax: keep the syntax and the category names; only the words inside may change. "#" stands for the number.
- Card names, character names, model names and product names stay as they are.
- Do not change a translation that is already correct. A different but equally good wording is fine. Only correct a real error or clearly unnatural wording: give the complete corrected string and a one-sentence reason in English.
- Keep these terms as the game uses them: ${glossaryLines(lang) || '(no glossary given)'}.

Answer with JSON: {"ok": [numbers of the items that are fine], "fix": [{"n": number, "corrected": "the whole corrected string", "reason": "why"}]}. Every item number appears exactly once, in "ok" or in "fix".`,
    },
    { role: 'user', content: JSON.stringify(items.map((i, k) => ({ n: k + 1, where: i.where, english: i.english, translation: i.translation })), null, 1) },
  ];
}

/** The reviewer's verdicts as [{ key, verdict, corrected, reason }]; an item it did not name is left out. Null if every attempt failed. */
async function ask(lang, items) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    let j;
    try {
      const r = await fetch(`${URL_}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: prompt(lang, items), temperature: 0, max_tokens: 3072, response_format: { type: 'json_schema', json_schema: { name: 'review', schema: SCHEMA, strict: true } }, chat_template_kwargs: { enable_thinking: false } }),
      });
      if (!r.ok) {
        console.error(`${lang}: HTTP ${r.status} ${(await r.text()).slice(0, 200)} (attempt ${attempt})`);
        await new Promise((res) => setTimeout(res, 10000));
        continue;
      }
      j = await r.json();
    } catch (err) {
      // The server went away mid-request (a memory guard, a restart): wait, and try again.
      console.error(`${lang}: request failed (attempt ${attempt}): ${String(err.cause ?? err).slice(0, 160)}`);
      await new Promise((res) => setTimeout(res, 15000));
      continue;
    }
    try {
      const parsed = JSON.parse(j.choices[0].message.content);
      if (!Array.isArray(parsed.ok) || !Array.isArray(parsed.fix)) throw new Error('no ok/fix arrays');
      const out = new Map();
      for (const n of parsed.ok) if (items[n - 1]) out.set(n, { key: items[n - 1].key, verdict: 'ok', corrected: '', reason: '' });
      for (const f of parsed.fix) if (items[f.n - 1]) out.set(f.n, { key: items[f.n - 1].key, verdict: 'fix', corrected: f.corrected, reason: f.reason });
      return [...out.values()];
    } catch (err) {
      console.error(`${lang}: unparseable answer (attempt ${attempt}): ${String(err).slice(0, 100)}`);
    }
  }
  return null;
}

// The control: planted errors the reviewer must catch, and a correct line it must leave alone.
const CONTROL = {
  // per language: [correct translation of "Not enough ink.", the same with a wrong word (means something else)]
  es: ['No hay suficiente tinta.', 'No hay suficiente leche.'], fr: ['Pas assez d’encre.', 'Pas assez de lait.'], de: ['Nicht genug Tinte.', 'Nicht genug Milch.'],
  it: ['Inchiostro insufficiente.', 'Latte insufficiente.'], pt: ['Tinta insuficiente.', 'Leite insuficiente.'], pl: ['Za mało atramentu.', 'Za mało mleka.'],
  ru: ['Не хватает чернил.', 'Не хватает молока.'], ar: ['لا يكفي الحبر.', 'لا يكفي الحليب.'], hi: ['स्याही काफ़ी नहीं है।', 'दूध काफ़ी नहीं है।'],
  zh: ['墨水不足。', '牛奶不足。'], ja: ['インクが足りません。', '牛乳が足りません。'], ko: ['잉크가 부족해요.', '우유가 부족해요.'],
  vi: ['Không đủ mực.', 'Không đủ sữa.'], th: ['หมึกไม่พอ', 'นมไม่พอ'], id: ['Tinta tidak cukup.', 'Susu tidak cukup.'],
};
async function control(lang) {
  const [good, wrongWord] = CONTROL[lang];
  const items = [
    { key: 'control.good', where: contextOf('illegal.no-ink'), english: 'Not enough ink.', translation: good },
    { key: 'control.wrong-word', where: contextOf('illegal.no-ink'), english: 'Not enough ink.', translation: wrongWord },
    { key: 'control.english', where: contextOf('verdict.next'), english: 'Next round', translation: 'Next round' },
    { key: 'control.grammar', where: contextOf('round.label'), english: 'Round {n} of {total}', translation: lang === 'de' ? 'Runden {n} von der {total}' : lang === 'es' ? 'Rondas {n} de los {total}' : lang === 'fr' ? 'Manches {n} de les {total}' : `{total} {n} Round of` },
  ];
  const got = await ask(lang, items);
  const verdict = (k) => got?.find((r) => r.key === k)?.verdict ?? 'no answer';
  return { passedGood: verdict('control.good') === 'ok', caughtWrongWord: verdict('control.wrong-word') === 'fix', caughtEnglish: verdict('control.english') === 'fix', caughtGrammar: verdict('control.grammar') === 'fix', raw: got };
}

const strings = await allStrings();
const result = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { model: process.env.GGUF ?? null, started: new Date().toISOString(), languages: {} };
mkdirSync(dirname(OUT), { recursive: true });
try {
  const props = await (await fetch(`${URL_}/props`)).json();
  result.server = { model: props.model_path ?? props.default_generation_settings?.model ?? null, build: props.build_info ?? null };
} catch { /* older servers have no /props */ }

// Languages are reviewed side by side, one per server slot (run.sh starts llama-server with -np 2).
const PARALLEL = Number(process.env.REVIEW_PARALLEL ?? '2');
// In the order given (--lang th,hi,…: the weakest first), else the locale order.
const queue = (only.length ? only : LOCALES).filter((l) => l !== 'en' && LOCALES.includes(l));
await Promise.all(Array.from({ length: PARALLEL }, async () => {
  for (let lang = queue.shift(); lang; lang = queue.shift()) await reviewLanguage(lang);
}));
result.finished = new Date().toISOString();
writeFileSync(OUT, JSON.stringify(result, null, 1) + '\n');

// What each item is: interface strings with their English, then the pack's words and lines.
function itemsOf(lang) {
  const out = [];
  for (const [key, text] of Object.entries(strings[lang].ui)) if (!(key in HOUSE_QUOTES)) out.push({ key, where: contextOf(key), english: strings.en.ui[key], translation: text });
  if (!PACK) return out;
  for (const [id, text] of Object.entries(strings[lang].pack)) {
    const key = `pack:${id}`;
    if (id.startsWith('relics.')) out.push({ key, where: 'A power word lent by a relic card: one word (a noun where it can be) that the player works into a verse for bonus points; an inflected form counts. It translates the English word.', english: strings.en.pack[id], translation: text });
    else if (id.startsWith('written.')) out.push({ key, where: 'One line of a verse that the computer opponent plays. It was written in this language to keep a verse form, not translated: there is no English. Judge only whether it is correct, natural verse in this language.', english: '(none: an original line in this language)', translation: text });
  }
  return out;
}

async function reviewLanguage(lang) {
  const done = (result.languages[lang] ??= { control: null, reviewed: {}, failedBatches: 0 });
  // Counted per run: a batch that failed on an earlier run is asked again on this one (its strings
  // have no verdict), so the old count no longer says anything. (de kept "1 failed batch" from a
  // run whose strings were all answered on the next.)
  done.failedBatches = 0;
  if (!done.control) done.control = await control(lang);
  console.log(`${lang} control: ${JSON.stringify({ ...done.control, raw: undefined })}`);
  // On a resume, a string is asked about again if its text has changed since its review.
  const all = itemsOf(lang);
  const pending = all.filter((i) => done.reviewed[i.key]?.translation !== i.translation || done.reviewed[i.key].verdict === 'no answer');
  const keys = pending.map((i) => i.key);
  const byKey = new Map(all.map((i) => [i.key, i]));
  for (let i = 0; i < keys.length; i += BATCH) {
    const batch = keys.slice(i, i + BATCH).map((key) => byKey.get(key));
    const got = await ask(lang, batch);
    if (!got) {
      done.failedBatches++;
      continue;
    }
    for (const b of batch) {
      const r = got.find((x) => x.key === b.key);
      // No answer for a key is recorded as that, never as "ok".
      done.reviewed[b.key] = r ? { verdict: r.verdict, corrected: r.verdict === 'fix' ? r.corrected : '', reason: r.reason, translation: b.translation } : { verdict: 'no answer', corrected: '', reason: '', translation: b.translation };
    }
    writeFileSync(OUT, JSON.stringify(result, null, 1) + '\n');
    console.log(`${lang} ${Math.min(i + BATCH, keys.length)}/${keys.length}`);
  }
  const fixes = Object.values(done.reviewed).filter((r) => r.verdict === 'fix').length;
  console.log(`${lang}: ${Object.keys(done.reviewed).length} reviewed, ${fixes} corrections proposed, ${done.failedBatches} failed batches`);
  writeFileSync(OUT, JSON.stringify(result, null, 1) + '\n');
}
