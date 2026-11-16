#!/usr/bin/env node
/**
 * The mechanical rules of the language QA pipeline (branch lang/qa-pipeline,
 * scripts/lang/lib/mechanical.mjs), run over the page areas of this branch.
 *
 *   QA_SRC=<a tree of lang/qa-pipeline> node scripts/pages-lang/mechanical.mjs [--json out.json] [--selftest]
 *
 * QA_SRC needs scripts/lang/lib/mechanical.mjs, src/lib/verse/msg.ts and
 * docs/language/sources/cldr.json from that branch, for example
 *   git archive lang/qa-pipeline scripts/lang src/lib/verse/msg.ts docs/language/sources | tar -x -C "$QA_SRC"
 * Those rules were written by another engineer, for the core locale files: spacing and
 * punctuation by language (French no-break spaces, Spanish ¿ ¡, full-width CJK marks,
 * Arabic ، ؛ ؟, the Hindi danda), quotation marks from CLDR, hidden and bidirectional
 * characters, the language's own script, a string left in English. This script only feeds
 * them the page areas; the <b>/<a> marks are taken out first (src/i18n/pages/check.ts
 * holds them to English).
 *
 * --selftest feeds the rules strings that break them, one per rule this branch relies on,
 * and fails unless every one is flagged. Read that before trusting a clean run.
 *
 * When the pipeline is in main, run its own check over src/i18n/pages and delete this.
 */
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { LOCALES, SOURCED, areas, readArea } from './strings.mjs';

const QA = process.env.QA_SRC;
if (!QA) {
  console.error('QA_SRC is not set: point it at a tree of branch lang/qa-pipeline');
  process.exit(2);
}
const { checkLanguage, untranslated } = await import(pathToFileURL(`${QA}/scripts/lang/lib/mechanical.mjs`).href);
const { parseMessage, argumentNames, pluralBlocks } = await import(pathToFileURL(`${QA}/src/lib/verse/msg.ts`).href);
const cldr = JSON.parse(readFileSync(`${QA}/docs/language/sources/cldr.json`, 'utf8'));
const { checkGlossary } = await import(pathToFileURL(`${QA}/scripts/lang/lib/glossary.mjs`).href);
// The glossary's game terms (verse, round, deck, relic, potion, duel, craft, judge, opponent…), one
// accepted word per language with its source. Its `names` table is for the verse forms' and devices'
// own keys, which these areas do not have, so it is left out.
const glossary = { ...JSON.parse(readFileSync(`${QA}/docs/language/glossary.json`, 'utf8')), names: {} };
const helpers = { parseMessage, argumentNames, pluralBlocks };
const unmark = (s) => s.replace(/<\/?[ab]>/g, '');
const args = process.argv.slice(2);

/**
 * Words a language shares with English on these pages, and why. A string that is the same
 * as the English is flagged by `untranslated` unless it is listed here. Each of these is also
 * spelled by Hunspell in its language (spell.mjs), which says whether the language's own
 * dictionary has the word.
 */
const SAME_AS_ENGLISH = {
  // The written opponent's role on the home page card: a name, kept as it is.
  '*': ['home.card.bard'],
  // The same word in the language (a cognate or the usual loanword), or a stat's usual abbreviation.
  es: ['achievements.virtuoso.name', 'card-terms.stat.def', 'card-terms.element.honor'],
  fr: ['achievements.tier.bronze', 'achievements.hundred-rounds.name', 'card-terms.type.potion', 'card-terms.types.potion', 'card-terms.house.potion',
    'card-terms.element.air', 'card-terms.element.ambition', 'card-terms.element.arcane', 'card-terms.element.compassion', 'card-terms.element.illusion',
    'card-terms.element.innocence', 'card-terms.element.justice', 'card-terms.element.nature', 'card-terms.element.passion', 'card-terms.element.poison',
    'card-terms.element.vision',
    // the family is "Capulet" in French translations of Romeo and Juliet (Montague is "Montaigu")
    'card-terms.house.capulet'],
  de: ['achievements.tier.bronze', 'achievements.tier.gold', 'card-terms.element.illusion', 'card-terms.element.rebellion', 'card-terms.element.revolution',
    'card-terms.element.vision', 'card-terms.element.wind', 'variants.source.event',
    // the families keep their names in German translations (Schlegel: "die Montagues", "die Capulets")
    'card-terms.house.montague', 'card-terms.house.capulet'],
  it: ['achievements.virtuoso.name'],
  pt: ['achievements.tier.bronze', 'achievements.virtuoso.name', 'card-terms.stat.def'],
  pl: ['achievements.hundred-rounds.name', 'card-terms.stat.atk', 'card-terms.element.honor', 'card-terms.element.ocean'],
  // Vietnamese and Indonesian write the two families' names as they are.
  vi: ['card-terms.house.montague', 'card-terms.house.capulet'],
  id: ['achievements.virtuoso.name', 'card-terms.house.montague', 'card-terms.house.capulet'],
};

/** Findings of the glossary checks that were read and are not errors, with the reason. */
const ALLOW = [
  { lang: '*', key: 'about.tech.ai.body', rule: 'glossary', reason: '"judge" is the verb here (they judge the duel); the glossary term is the noun' },
  { lang: '*', key: 'about.free.earn.l2', rule: 'glossary', reason: 'a trivia round, not a round of the duel' },
  { lang: '*', key: 'variants.ability.MEX.name', rule: 'glossary', reason: '"Corrido Craft" gives +2 Wordplay; "craft" is the ordinary word here, and the score term would say it adds craft' },
  { lang: 'pl', key: 'rules.cost', rule: 'glossary', reason: '"atramencie" is the locative of atrament' },
  { lang: 'pl', key: 'rules.relic', rule: 'glossary', reason: '"słów mocy" is the genitive of słowa mocy' },
  { lang: 'ru', key: 'rules.deck.maxPotions', rule: 'glossary', reason: '"зелий" is the genitive plural of зелье' },
  { lang: 'ar', key: 'rules.landIt', rule: 'glossary', reason: '"صنعتك" is صنعة with a suffix (ة is written ت)' },
  { lang: 'ar', key: 'rules.synergy', rule: 'glossary', reason: '"صنعتك" is صنعة with a suffix (ة is written ت)' },
  { lang: 'hi', key: 'collection.deck.addPotions', rule: 'glossary', reason: '"काढ़ों" is the oblique plural of काढ़ा' },
];
const allowedBy = (p) => ALLOW.find((a) => (a.lang === '*' || a.lang === p.lang) && a.key === p.key && a.rule === p.rule);

/**
 * Terms these pages share with the core locale files that the pipeline's glossary does not
 * list. Each is the word the core file uses (the key it was read from is named), as a stem so
 * inflected forms pass. Checked with the same checkGlossary() as the pipeline's terms.
 */
const T = (match, from, langs) => ({ match, english: from, langs: Object.fromEntries(Object.entries(langs).map(([l, v]) => [l, { term: [v].flat()[0], accept: [v].flat().slice(1), source: `core locale file, ${from}` }])) });
const CORE_TERMS = {
  trivia: T('\\btrivia\\b', 'offline.banner', { es: 'trivial', fr: 'quiz', de: 'quiz', it: 'quiz', pt: 'quiz', pl: 'quiz', ru: 'викторин', ar: 'مسابق', hi: ['प्रश्नोत्तरी', 'प्रश्नोत्तरि'], zh: '问答', ja: 'クイズ', ko: '퀴즈', vi: 'đố vui', th: 'ควิซ', id: 'kuis' }),
  achievement: T('\\bachievements?\\b', 'toast.achievement', { es: 'logro', fr: 'succès', de: 'erfolg', it: 'obiettiv', pt: 'conquista', pl: 'osiągnię', ru: 'достижени', ar: 'إنجاز', hi: 'उपलब्धि', zh: '成就', ja: '実績', ko: '업적', vi: 'thành tựu', th: 'ความสำเร็จ', id: 'pencapaian' }),
  'world-card': T('\\bworld cards?\\b', 'battle.worldCard', { es: 'del mundo', fr: 'du monde', de: 'weltkarte', it: 'del mondo', pt: 'do mundo', pl: 'świata', ru: 'мира', ar: ['العالم', 'بطاقة عالم'], hi: 'विश्व कार्ड', zh: '世界卡', ja: 'ワールドカード', ko: '월드 카드', vi: 'thế giới', th: 'การ์ดโลก', id: 'kartu dunia' }),
  collection: T('\\bcollection\\b', 'nav.collection', { es: 'colecci', fr: 'collection', de: 'sammlung', it: 'collezion', pt: 'coleç', pl: 'kolekcj', ru: 'коллекци', ar: 'مجموع', hi: 'संग्रह', zh: '收藏', ja: 'コレクション', ko: '컬렉션', vi: 'bộ sưu tập', th: 'คอลเลกชัน', id: 'koleksi' }),
  multiplayer: T('\\bmultiplayer\\b', 'nav.multiplayer', { es: 'multijugador', fr: 'multijoueur', de: 'mehrspieler', it: 'multigiocatore', pt: 'multijogador', pl: 'wieloosobow', ru: 'сетев', ar: 'الجماعي', hi: 'मल्टीप्लेयर', zh: '多人', ja: 'マルチプレイ', ko: '멀티플레이', vi: 'nhiều người chơi', th: 'ผู้เล่นหลายคน', id: 'multipemain' }),
  battle: T('\\bbattles?\\b', 'nav.battle, battle page', { es: 'batalla', fr: 'combat', de: ['kampf', 'kämpf'], it: 'battagli', pt: 'batalha', pl: ['bitw', 'bitew'], ru: ['битв', 'боев'], ar: ['نزال', 'مبارز'], hi: 'युद्ध', zh: '对战', ja: 'バトル', ko: '배틀', vi: ['trận', 'đấu'], th: ['การประชัน', 'ประชัน'], id: ['pertarungan', 'tarung'] }),
  house: T('\\bhouses?\\b', 'battle page house names', { es: 'casa', fr: 'maison', de: ['haus', 'häuser'], it: 'casat', pt: 'casa', pl: ['dom', 'domy', 'domów'], ru: ['дом', 'дома'], ar: ['بيت', 'بيوت'], hi: 'घरान', zh: '家族', ja: '家門', ko: '가문', vi: 'gia tộc', th: 'ตระกูล', id: 'wangsa' }),
};
// "Rap battle" is a genre with its own name in each language (рэп-баттл, battle de rap, adu rap), and a
// "battle streak" is a winning streak (Siegesserie): neither is the game's battle.
CORE_TERMS.battle.skip = ['about.vision.p1', 'variants.ability.BKN.why', 'variants.ability.MNL.why', 'variants.source.battle-streak'];
const coreGlossary = { terms: CORE_TERMS, names: {} };

function check(lang, strings, english) {
  const problems = checkLanguage(lang, strings, english, cldr.languages[lang], helpers, {});
  for (const key of untranslated(lang, strings, english)) problems.push({ lang, key, rule: 'same-as-english', detail: english[key] });
  problems.push(...checkGlossary(lang, strings, english, glossary).filter((p) => p.rule !== 'glossary-missing'));
  problems.push(...checkGlossary(lang, strings, english, coreGlossary).map((p) => ({ ...p, rule: p.rule === 'glossary' ? 'core-term' : p.rule })));
  return problems;
}

if (args.includes('--selftest')) {
  const english = { 'x.a': 'Deck: {n}', 'x.b': 'The card "{name}" is ready.', 'x.c': 'Your verse is ready.', 'x.d': 'Ready?', 'x.e': 'Win a battle', 'x.f': 'Each round has its own form.', 'x.g': 'Get a perfect trivia score.' };
  const cases = [
    ['fr', 'x.a', 'Jeu : {n}', 'fr-nbsp'],
    ['fr', 'x.b', 'La carte « {name} » est prête.', 'fr-nbsp'],
    ['de', 'x.b', 'Die Karte "{name}" ist bereit.', 'straight-quote'],
    ['de', 'x.b', 'Die Karte «{name}» ist bereit.', 'foreign-quote'],
    ['es', 'x.d', 'Listo?', 'es-inverted'],
    ['ja', 'x.c', '詩の準備ができました.', 'cjk-halfwidth'],
    ['ar', 'x.d', 'جاهز?', 'ar-punctuation'],
    ['hi', 'x.c', 'आपका पद तैयार है.', 'hi-danda'],
    ['ru', 'x.c', 'Your verse is ready.', 'no-native-script'],
    ['it', 'x.e', 'Win a battle', 'same-as-english'],
    ['pl', 'x.a', 'Talia: {count}', 'placeholders'],
    ['pt', 'x.c', 'Sua  estrofe está pronta.', 'double-space'],
    ['ko', 'x.c', '시가 준비되었어요', 'ending'],
    ['es', 'x.c', 'Tu poema está listo.', 'glossary'],
    ['fr', 'x.f', 'Chaque round a sa forme.', 'glossary'],
    ['es', 'x.g', 'Consigue una puntuación perfecta en las preguntas.', 'core-term'],
    ['ar', 'x.c', '\u200fأبياتك جاهزة.', 'bidi-control'],
  ];
  let missed = 0;
  for (const [lang, key, value, rule] of cases) {
    const strings = Object.fromEntries(Object.keys(english).map((k) => [k, k === key ? value : `${english[k]}`]));
    // Only the key under test is looked at; the others are English on purpose.
    const got = check(lang, strings, english).filter((p) => p.key === key).map((p) => p.rule);
    const ok = got.includes(rule);
    if (!ok) missed++;
    console.log(`${ok ? 'flagged' : 'MISSED '}\t${lang}\t${rule}\t${JSON.stringify(value)}${ok ? '' : `\tgot [${got.join(', ')}]`}`);
  }
  console.log(missed ? `${missed} of ${cases.length} known-bad strings were NOT flagged` : `all ${cases.length} known-bad strings flagged`);
  process.exit(missed ? 1 : 0);
}

const out = [];
const allowed = new Set();
for (const lang of LOCALES) {
  if (lang === 'en') continue;
  for (const area of areas()) {
    const en = readArea(area, 'en');
    const mine = readArea(area, lang);
    const E = {}, M = {};
    for (const [k, v] of Object.entries(en)) {
      if (SOURCED.test(k)) continue; // names from CLDR and Wikidata: as the source has them
      E[k] = unmark(v);
      if (k in mine) M[k] = unmark(mine[k]);
    }
    for (const p of check(lang, M, E)) {
      if (allowedBy(p)) {
        allowed.add(`${lang} ${p.key} ${p.rule}`);
        continue;
      }
      if (p.rule === 'same-as-english' && [...(SAME_AS_ENGLISH['*'] ?? []), ...(SAME_AS_ENGLISH[lang] ?? [])].includes(p.key)) {
        allowed.add(`${lang} ${p.key}`);
        continue;
      }
      out.push({ ...p, area, text: M[p.key] });
    }
  }
}
for (const p of out) console.log(`${p.lang}\t${p.rule}\t${p.key}\t${p.detail}\t${JSON.stringify(p.text ?? '')}`);
const byLang = {};
for (const p of out) byLang[p.lang] = (byLang[p.lang] ?? 0) + 1;
console.log(`${out.length} open findings (${allowed.size} read and allowed: same as English, or a glossary hit with its reason)`, JSON.stringify(byLang));
const j = args.indexOf('--json');
if (j >= 0) writeFileSync(args[j + 1], JSON.stringify({ tool: 'lang/qa-pipeline scripts/lang/lib/mechanical.mjs', open: out }, null, 1) + '\n');
process.exit(out.length ? 1 : 0);
