import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { CARD_CATALOG, getCardById, type Card } from '../cards';
import { DEVICES, checkSignature, signatureWords } from '../verse/devices';
import { createDuel, scoreVerse } from '../verse/duel';
import { localCharacterNames, localSignatureWords, saysWord } from '../verse/echo';
import { getForm } from '../verse/forms';
import { loadAllPacks, PACK_LANGS } from '../verse/packs';
import { wordsOf } from '../verse/text';
import { CARD_TEXT_LANGS, cardName, cardQuote, cardScene, elementName, getCardText, houseName, loadAllCardText, rarityName, typeName, type CardTextPack } from './index';

interface Provenance {
  langs: Record<string, { cards: Record<string, { name: { text: string | null; source: string; detail?: string }; quote: Record<string, string | number | null>; scene: string }> }>;
}
const provenance: Provenance = JSON.parse(readFileSync('docs/language/card-text.provenance.json', 'utf8'));
const record = readFileSync('docs/language/NAMES-AND-QUOTATIONS.md', 'utf8');

const NAME_SOURCES = ['wikidata', 'wikipedia', 'derived', 'translated', 'missing'];

/** Everything wrong with one language's card text. Empty means sound. Kept as a function so it can be shown to fail. */
function problems(pack: CardTextPack, prov: Provenance['langs'][string], doc: string): string[] {
  const out: string[] = [];
  const l = pack.lang;
  const missingLine = doc.split('\n').find((line) => line.startsWith(`- **${l}** (`)) ?? '';
  for (const c of CARD_CATALOG) {
    const e = pack.cards[c.id];
    const p = prov?.cards[c.id];
    if (!e) { out.push(`${l} ${c.id}: no entry`); continue; }
    if (!p) { out.push(`${l} ${c.id}: no provenance record`); continue; }
    if (!NAME_SOURCES.includes(e.nameSource)) out.push(`${l} ${c.id}: name source "${e.nameSource}"`);
    if (e.nameSource === 'missing') {
      if (e.name !== undefined) out.push(`${l} ${c.id}: marked missing but has a name`);
      if (!missingLine.includes(`${c.id} ${c.name}`)) out.push(`${l} ${c.id}: missing name not listed in the record`);
    } else if (!e.name || !e.name.trim()) out.push(`${l} ${c.id}: empty name with source ${e.nameSource}`);
    if (p.name.source !== e.nameSource || (p.name.text ?? undefined) !== e.name) out.push(`${l} ${c.id}: name differs from its provenance record`);
    if ((e.nameSource === 'wikidata' || e.nameSource === 'wikipedia' || e.nameSource === 'derived') && !/Q\d+/.test(p.name.detail ?? '')) {
      out.push(`${l} ${c.id}: sourced name without a Wikidata item id`);
    }
    if (e.quoteSource === 'published') {
      if (!e.quote) out.push(`${l} ${c.id}: published line is empty`);
      for (const k of ['translator', 'edition', 'status', 'url', 'revid', 'cite']) if (!p.quote[k]) out.push(`${l} ${c.id}: published line without ${k}`);
      if (!/^https:\/\/[a-z]+\.wikisource\.org\/.+oldid=\d+$/.test(String(p.quote.url ?? ''))) out.push(`${l} ${c.id}: source URL is not a permanent Wikisource link`);
      if (!/[Pp]ublic domain/.test(String(p.quote.status ?? ''))) out.push(`${l} ${c.id}: status does not say public domain`);
    } else if (e.quoteSource === 'new') {
      if (!e.quote) out.push(`${l} ${c.id}: new line is empty`);
      if (p.quote.url) out.push(`${l} ${c.id}: a new line must not claim a source`);
    } else if (e.quoteSource === 'missing') {
      if (e.quote !== undefined) out.push(`${l} ${c.id}: marked missing but has a line`);
    } else out.push(`${l} ${c.id}: quote source "${e.quoteSource}"`);
    if (p.quote.source !== e.quoteSource || (p.quote.text ?? undefined) !== e.quote) out.push(`${l} ${c.id}: line differs from its provenance record`);
    if (!p.quote.cite) out.push(`${l} ${c.id}: no citation for the English line`);
    if (e.quote && e.quote === c.quote) out.push(`${l} ${c.id}: the line is the English line`);
  }
  for (const h of new Set(CARD_CATALOG.map((c) => c.house))) if (!pack.houses[h]) out.push(`${l}: no label for house ${h}`);
  for (const el of new Set(CARD_CATALOG.map((c) => c.element))) if (!pack.elements[el]) out.push(`${l}: no label for element ${el}`);
  for (const r of new Set(CARD_CATALOG.map((c) => c.rarity))) if (!pack.rarities[r]) out.push(`${l}: no label for rarity ${r}`);
  for (const ty of ['Character', 'Relic', 'Potion']) if (!pack.types[ty]) out.push(`${l}: no label for type ${ty}`);
  if (pack.stop.length < 50) out.push(`${l}: stop list has only ${pack.stop.length} words`);
  return out;
}

let packs: CardTextPack[] = [];
beforeAll(async () => {
  await loadAllPacks();
  packs = await loadAllCardText();
});

const card = (id: string) => getCardById(id)!;

describe('card text in fifteen languages', () => {
  it('covers every language the duel is fought in, except English, which is cards.ts', () => {
    expect([...CARD_TEXT_LANGS].sort()).toEqual(PACK_LANGS.filter((l) => l !== 'en').sort());
    expect(packs.map((p) => p.lang).sort()).toEqual([...CARD_TEXT_LANGS].sort());
    expect(getCardText('en')).toBeNull();
  });

  it('every card has a name or a listed "missing", every line a provenance record, every label a translation', () => {
    for (const p of packs) expect(problems(p, provenance.langs[p.lang], record)).toEqual([]);
  });

  it('the checker above can fail: each kind of fault is reported', () => {
    const fr = packs.find((p) => p.lang === 'fr')!;
    const prov = provenance.langs.fr;
    const broken = (change: (p: CardTextPack) => void): string[] => {
      const copy: CardTextPack = JSON.parse(JSON.stringify(fr));
      change(copy);
      return problems(copy, prov, record);
    };
    expect(problems(fr, prov, record)).toEqual([]);
    expect(broken((p) => { delete p.cards['DC-001']; })).toEqual(['fr DC-001: no entry']);
    expect(broken((p) => { p.cards['DC-001'].name = ''; }).some((m) => m.includes('DC-001: empty name'))).toBe(true);
    expect(broken((p) => { p.cards['DC-001'].name = 'Amleth'; })).toEqual(['fr DC-001: name differs from its provenance record']);
    expect(broken((p) => { p.cards['DC-001'].nameSource = 'missing'; delete p.cards['DC-001'].name; }).some((m) => m.includes('not listed in the record'))).toBe(true);
    expect(broken((p) => { p.cards['DC-001'].quote = 'Être ou ne pas être'; })).toEqual(['fr DC-001: line differs from its provenance record']);
    expect(broken((p) => { p.cards['DC-001'].quote = card('DC-001').quote; }).some((m) => m.includes('is the English line'))).toBe(true);
    expect(broken((p) => { p.cards['LD-001'].quoteSource = 'published'; }).some((m) => m.includes('LD-001: published line without translator'))).toBe(true);
    expect(broken((p) => { delete p.elements.Fire; })).toEqual(['fr: no label for element Fire']);
    expect(broken((p) => { p.stop = []; })).toEqual(['fr: stop list has only 0 words']);
    // A record with no provenance at all.
    expect(problems(fr, { cards: {} }, record).length).toBe(CARD_CATALOG.length);
  });

  it('shows the English name and line where a language has none, and for a language not loaded', () => {
    const hamlet = card('DC-001');
    expect(cardName(hamlet, 'en')).toBe('Hamlet');
    expect(cardName(hamlet, 'xx')).toBe('Hamlet');
    expect(cardQuote(hamlet, 'en')).toBe(hamlet.quote);
    expect(cardScene(hamlet, 'en')).toBe(hamlet.scene);
    expect(cardName(hamlet, 'ru')).toBe('Гамлет');
    expect(cardQuote(hamlet, 'fr')).toBe('Être, ou ne pas être, c’est là la question.');
    expect(houseName('Rome', 'de')).toBe('Rom');
    expect(houseName('Rome', 'en')).toBe('Rome');
    expect(elementName('Fire', 'es')).toBe('Fuego');
    expect(typeName('Potion', 'fr')).toBe('Potion');
    expect(rarityName('Legendary', 'en')).toBe('Legendary');
    for (const p of packs) {
      for (const c of CARD_CATALOG) if (p.cards[c.id].nameSource === 'missing') expect([p.lang, c.id, cardName(c, p.lang)]).toEqual([p.lang, c.id, c.name]);
    }
  });
});

describe('the signature in the language of the duel', () => {
  it('every card with a line in a language has telling words in it, none of them a stop word', () => {
    const none: string[] = [];
    for (const p of packs) {
      const stop = new Set(p.stop);
      for (const c of CARD_CATALOG) {
        if (!p.cards[c.id].quote) continue;
        const words = localSignatureWords(c, p.lang);
        if (!words.length) none.push(`${p.lang} ${c.id}`);
        for (const w of words) expect([p.lang, c.id, w, stop.has(w)]).toEqual([p.lang, c.id, w, false]);
      }
    }
    // A line whose every word is short or common has no telling word of its own; the English ones then decide, as before.
    expect(none).toEqual([]);
  });

  it('lands for a verse that echoes the translated line, and is refused for one that quotes it outright', () => {
    for (const p of packs) {
      for (const c of CARD_CATALOG) {
        const quote = p.cards[c.id].quote;
        if (!quote) continue;
        const words = localSignatureWords(c, p.lang);
        if (!words.length) continue;
        const echo = checkSignature(c, words[0], p.lang);
        expect([p.lang, c.id, words[0], echo.met, echo.code]).toEqual([p.lang, c.id, words[0], true, 'echoed']);
        if (wordsOf(quote, p.lang).length >= 4) {
          const recited = checkSignature(c, quote, p.lang);
          expect([p.lang, c.id, recited.met, recited.code]).toEqual([p.lang, c.id, false, 'quoted']);
        }
        const silent = checkSignature(c, '0', p.lang);
        expect([p.lang, c.id, silent.met, silent.code, silent.detail.split(', ')[0]]).toEqual([p.lang, c.id, false, 'hint', words[0]]);
      }
    }
  });

  it('reads real verses: French, Japanese, and the endings of other languages', () => {
    const hamlet = card('DC-001');
    // French: Hugo's line is "Être, ou ne pas être, c'est là la question."
    expect(checkSignature(hamlet, 'Je pose ma question à la nuit', 'fr').met).toBe(true);
    expect(checkSignature(hamlet, 'Je dis : être, ou ne pas être, voilà tout', 'fr').code).toBe('quoted');
    expect(checkSignature(hamlet, 'Rien de lui ici', 'fr').code).toBe('hint');
    // Japanese has no spaces: the word is found inside the line.
    const ja = localSignatureWords(hamlet, 'ja');
    expect(ja.length).toBeGreaterThan(0);
    expect(checkSignature(hamlet, `闇に向かって${ja[0]}を投げる`, 'ja').met).toBe(true);
    expect(checkSignature(hamlet, cardQuote(hamlet, 'ja'), 'ja').code).toBe('quoted');
    expect(checkSignature(hamlet, '月は静かに沈む', 'ja').code).toBe('hint');
    // The English word still lands in any language, and reciting the English line is still refused.
    expect(checkSignature(hamlet, 'I put the question to the dark', 'ja').met).toBe(true);
    expect(checkSignature(hamlet, 'To be, or not to be, that is the question', 'ja').met).toBe(false);
    // Endings: a word says another when it begins with it, or with all but its last letter (five letters or more).
    expect(saysWord('Гамлет', 'Слушай Гамлета', 'ru')).toBe(true);
    expect(saysWord('Джульетта', 'Зову Джульетту', 'ru')).toBe(true);
    expect(saysWord('Julia', 'Wołam Julię', 'pl')).toBe(true);
    expect(saysWord('햄릿', '햄릿이여 들으라', 'ko')).toBe(true);
    expect(saysWord('هاملت', 'اسمع يا وهاملت', 'ar')).toBe(true);
    expect(saysWord('Roma', 'Romeo llega', 'es')).toBe(false);
    expect(saysWord('Гамлет', 'Слушай Макбета', 'ru')).toBe(false);
  });

  it('counts in a duel: the multiplier rises for the echo and not for the recital', () => {
    const duel = createDuel(7, 'fr', { characters: ['DC-001', 'MO-001', 'CA-001'], relics: [], potions: [] });
    const plan = duel.rounds[0];
    const base = { form: getForm(plan.formId), ctx: plan.ctx, card: card('DC-001'), deckCharacters: ['DC-001', 'MO-001', 'CA-001'] };
    const echo = scoreVerse({ ...base, verse: 'Je pose ma question à la nuit' });
    const recital = scoreVerse({ ...base, verse: 'Être, ou ne pas être, c’est là la question' });
    expect(echo.signature.met).toBe(true);
    expect(recital.signature.met).toBe(false);
    expect(recital.signature.code).toBe('quoted');
  });
});

describe('the invocation in the language of the duel', () => {
  it('lands with each character’s name as the language writes it', () => {
    for (const p of packs) {
      const names = localCharacterNames(p.lang);
      for (const c of CARD_CATALOG) {
        const name = p.cards[c.id].name;
        if (c.type !== 'Character' || !name || c.id === 'SM-001') continue;
        const r = DEVICES.invocation.check(name, { lang: p.lang, names: [] });
        expect([p.lang, c.id, name, r.met]).toEqual([p.lang, c.id, name, true]);
      }
      expect([p.lang, names.length > 20]).toEqual([p.lang, true]);
    }
  });

  it('takes inflected and unspaced names, keeps the English ones, and is not met by nothing', () => {
    const en = ['Hamlet', 'Romeo'];
    expect(DEVICES.invocation.check('ハムレットよ、聞け', { lang: 'ja', names: en }).met).toBe(true);
    expect(DEVICES.invocation.check('Слушай Гамлета', { lang: 'ru', names: en }).met).toBe(true);
    expect(DEVICES.invocation.check('햄릿이여 들으라', { lang: 'ko', names: en }).met).toBe(true);
    expect(DEVICES.invocation.check('Hear me, Hamlet', { lang: 'ja', names: en }).met).toBe(true);
    expect(DEVICES.invocation.check('月は静かに沈む', { lang: 'ja', names: en }).met).toBe(false);
    expect(DEVICES.invocation.check('Ночь тиха и пуста', { lang: 'ru', names: en }).met).toBe(false);
    expect(DEVICES.invocation.check('La nuit est calme', { lang: 'fr', names: en }).met).toBe(false);
  });
});

describe('an English duel is as it was', () => {
  const COMMON = 'that this with from have what when where which thou thee thy your their there these those shall will would should could been were upon into then than them they more most some such very much come here hath doth lord'.split(' ');

  it('telling words of every card are exactly the old measure, with every language loaded', () => {
    for (const c of CARD_CATALOG) {
      const old = [...new Set(wordsOf(c.quote, 'en').filter((w) => [...w].length >= 4).map((w) => w.normalize('NFD').replace(/[̀-ͯ]/g, '')).filter((w) => !COMMON.includes(w)))];
      expect([c.id, signatureWords(c)]).toEqual([c.id, old]);
      expect([c.id, signatureWords(c, 'en')]).toEqual([c.id, old]);
    }
  });

  it('the signature and the invocation judge English verses as before', () => {
    const hamlet = card('DC-001');
    expect(checkSignature(hamlet, 'I put the question to the dark')).toEqual({ met: true, detail: 'question', code: 'echoed' });
    expect(checkSignature(hamlet, 'To be, or not to be, that is the question')).toEqual({ met: false, detail: '', code: 'quoted' });
    expect(checkSignature(hamlet, 'Nothing of his here')).toEqual({ met: false, detail: 'question', code: 'hint' });
    // A French word of Hugo's line does not land in an English duel.
    expect(checkSignature(card('MO-001'), 'la lumière', 'en').met).toBe(false);
    expect(DEVICES.invocation.check('Hear me, Hamlet', { names: ['Hamlet'] })).toEqual({ met: true, detail: 'Hamlet' });
    expect(DEVICES.invocation.check('Écoute, Roméo', { lang: 'en', names: ['Hamlet'] }).met).toBe(false);
    expect(DEVICES.invocation.check('ハムレットよ', { lang: 'en', names: ['Hamlet'] }).met).toBe(false);
    for (const c of CARD_CATALOG as Card[]) {
      const first = signatureWords(c)[0];
      if (first) expect([c.id, checkSignature(c, `one ${first} here`, 'en').code]).toEqual([c.id, 'echoed']);
    }
  });
});
