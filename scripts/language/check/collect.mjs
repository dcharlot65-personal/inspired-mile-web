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
for (const lang of LANGS) {
  const pack = (await import(`../../../src/lib/cards-i18n/${lang}.ts`)).default;
  // Every word of every card name in this language and in English: proper nouns, not spelling errors.
  const known = new Set();
  for (const c of CARD_CATALOG) {
    const e = pack.cards[c.id];
    for (const t of [e.name, c.name, ...(e.aliases ?? [])]) if (t) for (const w of words(lang, t)) known.add(w.toLowerCase());
  }
  names[lang] = [...known];
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
writeFileSync(process.argv[2], JSON.stringify({ items, names }, null, 1));
console.log(`${items.length} items in ${LANGS.length} languages`);
