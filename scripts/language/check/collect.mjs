// Collect every card text that was written for the game rather than taken from a source: scene
// descriptions, lines marked NEW, names marked translated, and translated house, element and type
// labels. Each item keeps its English source and its words (Intl.Segmenter), for the checks.
//
//   node scripts/language/check/collect.mjs <out.json>        (Node 23 or later: it imports .ts)
import { readFileSync, writeFileSync } from 'node:fs';
import { CARD_CATALOG } from '../../../src/lib/cards.ts';

const LANGS = ['es', 'fr', 'de', 'it', 'pt', 'pl', 'ru', 'ar', 'hi', 'zh', 'ja', 'ko', 'vi', 'th', 'id'];
const prov = JSON.parse(readFileSync(new URL('../../../docs/language/card-text.provenance.json', import.meta.url), 'utf8'));
const words = (lang, text) => [...new Intl.Segmenter(lang, { granularity: 'word' }).segment(text)].filter((s) => s.isWordLike).map((s) => s.segment);

const items = [];
const names = {};
const nameStrings = {};
// Every word of a character's name (a name of one word too) and its one-word aliases: the words the invocation would
// count by themselves (src/lib/verse/echo.ts, localCharacterNames). check.py names asks Hunspell which of them are
// ordinary words.
const nameWords = {};
const nameTokens = {};
const DECLINING = ['ru', 'pl', 'de', 'ar'];
// The pattern src/lib/verse/text.ts reads spaced words with (wordsOf), keeping the letters' case.
const WORD_RE = /[\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*/gu;
const bare = (w) => w.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const SPLIT = /[\s・·‧]+/u;
const clean = (s) => s.replace(/^[^\p{L}]+|[^\p{L}\p{M}]+$/gu, '');
for (const lang of LANGS) {
  const pack = (await import(`../../../src/lib/cards-i18n/${lang}.ts`)).default;
  // Every word of every card name in this language and in English: proper nouns, not spelling errors.
  const known = new Set();
  for (const c of CARD_CATALOG) {
    const e = pack.cards[c.id];
    for (const t of [e.name, c.name, ...(e.aliases ?? [])]) if (t) for (const w of words(lang, t)) known.add(w.toLowerCase());
  }
  names[lang] = [...known];
  nameStrings[lang] = [...new Set(CARD_CATALOG.flatMap((c) => [pack.cards[c.id].name, ...(pack.cards[c.id].aliases ?? [])]).filter(Boolean))];
  const nw = new Set();
  for (const c of CARD_CATALOG) {
    const e = pack.cards[c.id];
    if (c.type !== 'Character' || !e.name || e.nameSource === 'missing') continue;
    const parts = clean(e.name.replace(/,.*$/u, '')).split(SPLIT).map(clean).filter(Boolean);
    for (const w of [...parts, ...(e.aliases ?? []).map(clean)]) if (w && !SPLIT.test(w)) nw.add(w);
  }
  nameWords[lang] = [...nw].sort();
  // Every word of every character's name and alias, as the invocation compares them one by one (echo.ts saidName), in
  // the languages where a name changes in a sentence: check.py forms makes and checks their forms (declension.py).
  if (DECLINING.includes(lang)) {
    const toks = new Map();
    for (const c of CARD_CATALOG) {
      const e = pack.cards[c.id];
      if (c.type !== 'Character' || !e.name || e.nameSource === 'missing' || e.nameSource === 'kept') continue;
      const english = new Set((c.name.match(WORD_RE) ?? []).map(bare));
      for (const t of [e.name.replace(/,.*$/u, ''), ...(e.aliases ?? [])]) {
        for (const w of t.match(WORD_RE) ?? []) if (!toks.has(w)) toks.set(w, english.has(bare(w)));
      }
    }
    nameTokens[lang] = [...toks].sort(([a], [b]) => (a < b ? -1 : 1)).map(([word, en]) => ({ word, english: en }));
  }
  const add = (id, field, source, text, english) => items.push({ lang, id, field, source, text, english, words: words(lang, text) });
  for (const c of CARD_CATALOG) {
    const e = pack.cards[c.id];
    if (e.scene) add(c.id, 'scene', 'translated', e.scene, c.scene);
    if (e.quoteSource === 'new') add(c.id, 'quote', 'new', e.quote, c.quote);
    if (e.nameSource === 'translated' && c.id !== 'SM-001') add(c.id, 'name', 'translated', e.name, c.name);
  }
  for (const [h, text] of Object.entries(pack.houses)) if (prov.langs[lang].houses[h]?.source === 'translated') add(`house:${h}`, 'house', 'translated', text, h);
  for (const [el, text] of Object.entries(pack.elements)) add(`element:${el}`, 'element', 'translated', text, el);
  for (const [ty, text] of Object.entries(pack.types)) add(`type:${ty}`, 'type', 'translated', text, ty);
}
writeFileSync(process.argv[2], JSON.stringify({ items, names, nameStrings, nameWords, nameTokens }, null, 1));
console.log(`${items.length} items in ${LANGS.length} languages`);
