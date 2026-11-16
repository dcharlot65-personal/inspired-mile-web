#!/usr/bin/env node
/**
 * Grammar of the page areas, by LanguageTool: a tool that did not write the text.
 *
 *   LT_URL=http://127.0.0.1:<port> node scripts/pages-lang/grammar.mjs [--selftest] [--out file.json]
 *
 * The LanguageTool server is the one the language QA pipeline installs on the build host
 * (branch lang/qa-pipeline, scripts/lang/host-setup.sh: LanguageTool 6.6, LGPL 2.1); start it
 * on a port of your own:
 *   java -Xmx4g -cp $Q/LanguageTool-6.6/languagetool-server.jar org.languagetool.server.HTTPServer --port <port>
 *
 * Each string is checked as the sentence a reader meets (marks removed, placeholders filled
 * with plausible values, rendered() in strings.mjs). Strings go in batches, one paragraph each;
 * the rules that would judge the batching (three paragraphs beginning with the same word) are
 * off. The level is "picky", so style and typography rules speak too. What comes out is a list
 * to read, not a verdict; docs/language/pages-core/RESULTS.md says how each hit was settled.
 *
 * Which languages are checked is asked of the server. Hindi, Korean, Vietnamese, Thai and
 * Indonesian have no LanguageTool module.
 *
 * --selftest sends four sentences per language with an error a native reader sees at once
 * (the ones lang/qa-pipeline's scripts/lang/grammar.mjs uses) and says how many were flagged.
 */
import { writeFileSync } from 'node:fs';
import { LOCALES, SOURCED, areas, readArea, rendered } from './strings.mjs';

const LT_URL = process.env.LT_URL ?? 'http://127.0.0.1:8081';
const args = process.argv.slice(2);
const LT_CODE = { en: 'en-US', es: 'es', fr: 'fr', de: 'de-DE', it: 'it', pt: 'pt-BR', pl: 'pl-PL', ru: 'ru-RU', ar: 'ar', zh: 'zh-CN', ja: 'ja-JP' };
const BATCH_ARTEFACTS = ['ENGLISH', 'SPANISH', 'GERMAN', 'PORTUGUESE', 'FRENCH', 'ITALIAN', 'RUSSIAN', 'POLISH', 'ARABIC'].map((l) => `${l}_WORD_REPEAT_BEGINNING_RULE`).join(',');

const KNOWN_BAD = {
  en: ['She go to school every day.', 'I has two cats.', 'They was at home.', 'He have two book.'],
  es: ['Los casa es muy grandes.', 'Yo tiene dos gatos.', 'La problema es grande.', 'Nosotros va al cine.'],
  fr: ['Les maison est très grands.', 'Je a deux chats.', 'Nous allez au cinéma.', 'Il sont arrivé.'],
  de: ['Das Häuser ist sehr großen.', 'Ich haben zwei Katzen.', 'Wir geht ins Kino.', 'Er sind gekommen.'],
  it: ['Le casa è molto grandi.', 'Io ha mangiato la mela.', 'Un amica mia è venuto.', 'Loro è andati a casa.'],
  pt: ['As casa é muito grandes.', 'Eu vai para a escola.', 'Os menino jogam bola.', 'Nós vai embora.'],
  pl: ['Ten kobieta jest bardzo wysoki.', 'Ja idzie do szkoły.', 'Oni jest w domu.', 'Mam dwa psów.'],
  ru: ['Он пошла домой.', 'Я идёт в школу.', 'Они был дома.', 'Он купил два книга.'],
  ar: ['ذهبت الولد إلى المدرسة أمس.', 'أنا يذهب إلى المدرسة.', 'البنات ذهب إلى السوق.', 'هذا السيارة جميلة.'],
  zh: ['我昨天去学校了了。', '他们是很高兴的的。', '我有三个书。', '因为下雨，所以但是我去了。'],
  ja: ['私は学校に行くました。', 'これはペンをです。', '彼が本を読むますた。', '食べれる事が出来る。'],
};

async function check(code, text) {
  const body = new URLSearchParams({ language: code, text, level: 'picky', disabledRules: BATCH_ARTEFACTS });
  const r = await fetch(`${LT_URL}/v2/check`, { method: 'POST', body });
  if (!r.ok) throw new Error(`LanguageTool ${code}: ${r.status} ${await r.text()}`);
  return (await r.json()).matches;
}

/** Many strings in few requests: one paragraph each; every match is handed back to its string. */
async function batch(code, items) {
  const hits = items.map(() => []);
  const SEP = '\n\n';
  for (let start = 0; start < items.length; ) {
    let end = start, size = 0;
    while (end < items.length && (end === start || size + items[end].text.length < 12000)) size += items[end++].text.length + SEP.length;
    const offsets = [];
    let text = '';
    for (let i = start; i < end; i++) {
      offsets.push(text.length);
      text += items[i].text + SEP;
    }
    for (const m of await check(code, text)) {
      let i = offsets.length - 1;
      while (i > 0 && offsets[i] > m.offset) i--;
      const at = m.offset - offsets[i];
      hits[start + i].push({ rule: m.rule.id, category: m.rule.category?.id ?? '', message: m.message, found: items[start + i].text.slice(at, at + m.length), replacements: m.replacements.slice(0, 3).map((x) => x.value) });
    }
    start = end;
  }
  return hits;
}

const supported = new Set((await (await fetch(`${LT_URL}/v2/languages`)).json()).map((l) => l.longCode));
const result = { tool: 'LanguageTool', url: LT_URL, level: 'picky', languages: {} };

if (args.includes('--selftest')) {
  let dead = 0;
  for (const lang of LOCALES) {
    const code = LT_CODE[lang];
    if (!code || !supported.has(code)) {
      console.log(`${lang}\tno LanguageTool module`);
      continue;
    }
    let caught = 0;
    for (const s of KNOWN_BAD[lang]) if ((await check(code, s)).length) caught++;
    if (!caught) dead++;
    console.log(`${lang}\tflags ${caught} of ${KNOWN_BAD[lang].length} known-bad sentences`);
  }
  process.exit(dead ? 1 : 0);
}

for (const lang of LOCALES) {
  const code = LT_CODE[lang];
  if (!code || !supported.has(code)) {
    result.languages[lang] = { checked: false, why: 'no LanguageTool module' };
    console.log(`${lang}\tnot checked: no LanguageTool module`);
    continue;
  }
  const items = [];
  for (const a of areas()) for (const [key, value] of Object.entries(readArea(a, lang))) if (!SOURCED.test(key)) items.push({ key, text: rendered(value) });
  const hits = await batch(code, items);
  const found = items.map((it, i) => ({ key: it.key, text: it.text, hits: hits[i] })).filter((x) => x.hits.length);
  result.languages[lang] = { checked: true, code, strings: items.length, withHits: found.length, hits: found };
  const byRule = {};
  for (const f of found) for (const h of f.hits) byRule[h.rule] = (byRule[h.rule] ?? 0) + 1;
  console.log(`${lang}\t${code}\t${items.length} strings, ${found.length} with a hit\t${JSON.stringify(byRule)}`);
}
const o = args.indexOf('--out');
if (o >= 0) writeFileSync(args[o + 1], JSON.stringify(result, null, 1) + '\n');
