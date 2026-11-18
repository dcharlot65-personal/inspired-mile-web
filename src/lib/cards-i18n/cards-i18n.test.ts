import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { CARD_CATALOG, getCardById, type Card } from '../cards';
import { DEVICES, checkSignature, signatureNeeded, signatureWords } from '../verse/devices';
import { createDuel, scoreVerse } from '../verse/duel';
import { articleOnlyNames, capitalOnlyNames, localCharacterNames, localSignatureWords, saysWord, wordKey } from '../verse/echo';
import { getForm } from '../verse/forms';
import { loadAllPacks, PACK_LANGS } from '../verse/packs';
import { wordsOf } from '../verse/text';
import {
  CARD_TEXT_LANGS, capitalised, cardName, cardNameInText, cardQuote, cardScene, cardTitle, elementName, getCardText, houseName, loadAllCardText, rarityName, typeName,
  withCardName,
  type CardTextPack,
} from './index';

interface Provenance {
  langs: Record<string, { houses?: Record<string, { source: string }>; cards: Record<string, { name: { text: string | null; source: string; detail?: string }; quote: Record<string, string | number | null>; scene: string }> }>;
}
const provenance: Provenance = JSON.parse(readFileSync('docs/language/card-text.provenance.json', 'utf8'));
const record = readFileSync('docs/language/NAMES-AND-QUOTATIONS.md', 'utf8');

const NAME_SOURCES = ['wikidata', 'wikipedia', 'published', 'derived', 'translated', 'kept', 'missing'];
const publishedNames: Record<string, Record<string, { name: string; revid: number; printed: string; count: number; url: string }>> =
  JSON.parse(readFileSync('docs/language/sources/published-names.json', 'utf8')).names;

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
    if (['wikidata', 'wikipedia', 'derived', 'published'].includes(e.nameSource) && !/Q\d+/.test(p.name.detail ?? '')) {
      out.push(`${l} ${c.id}: sourced name without a Wikidata item id`);
    }
    // A name taken from a published translation: recorded with the revision it was read in, and printed there.
    if (e.nameSource === 'published') {
      const r = publishedNames[l]?.[c.id];
      if (!r || r.name !== e.name || !(r.count > 0) || !/oldid=\d+$/.test(r.url) || !String(p.name.detail ?? '').includes(`revision ${r.revid}`)) {
        out.push(`${l} ${c.id}: name from a published translation without its record`);
      }
    }
    if (e.quoteSource === 'published') {
      if (!e.quote) out.push(`${l} ${c.id}: published line is empty`);
      for (const k of ['translator', 'edition', 'status', 'url', 'revid', 'cite']) if (!p.quote[k]) out.push(`${l} ${c.id}: published line without ${k}`);
      // A Wikisource revision (oldid), or a Project Gutenberg ebook pinned by the sha256 of the file that was read.
      const url = String(p.quote.url ?? '');
      const wikisource = /^https:\/\/[a-z]+\.wikisource\.org\/.+oldid=\d+$/.test(url);
      const gutenberg = /^https:\/\/www\.gutenberg\.org\/ebooks\/\d+$/.test(url) && /^[0-9a-f]{64}$/.test(String(p.quote.revid ?? ''));
      if (!wikisource && !gutenberg) out.push(`${l} ${c.id}: source URL is not a permanent Wikisource link or a pinned Project Gutenberg file`);
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
  // A house that is a real place takes its label from Wikidata; where Wikidata has none it is recorded as missing and shown in English.
  for (const h of new Set(CARD_CATALOG.map((c) => c.house))) if (!pack.houses[h] && prov?.houses?.[h]?.source !== 'missing') out.push(`${l}: no label for house ${h}`);
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
    expect(broken((p) => { p.cards['DC-001'].nameSource = 'published'; })).toEqual([
      'fr DC-001: name differs from its provenance record', 'fr DC-001: name from a published translation without its record',
    ]);
    expect(broken((p) => { p.cards['DC-001'].nameSource = 'missing'; delete p.cards['DC-001'].name; }).some((m) => m.includes('not listed in the record'))).toBe(true);
    expect(broken((p) => { p.cards['DC-001'].quote = 'Être ou ne pas être'; })).toEqual(['fr DC-001: line differs from its provenance record']);
    expect(broken((p) => { p.cards['DC-001'].quote = card('DC-001').quote; }).some((m) => m.includes('is the English line'))).toBe(true);
    expect(broken((p) => { p.cards['LD-001'].quoteSource = 'published'; }).some((m) => m.includes('LD-001: published line without translator'))).toBe(true);
    expect(broken((p) => { delete p.elements.Fire; })).toEqual(['fr: no label for element Fire']);
    expect(broken((p) => { delete p.houses.Capulet; })).toEqual(['fr: no label for house Capulet']);
    expect(broken((p) => { p.stop = []; })).toEqual(['fr: stop list has only 0 words']);
    // A published line whose source is not pinned to a fixed version.
    const unpinned: Provenance['langs'][string] = JSON.parse(JSON.stringify(prov));
    unpinned.cards['DC-001'].quote.url = 'https://fr.wikisource.org/wiki/Hamlet';
    expect(problems(fr, unpinned, record)).toEqual(['fr DC-001: source URL is not a permanent Wikisource link or a pinned Project Gutenberg file']);
    const de = packs.find((p) => p.lang === 'de')!;
    const gutenberg: Provenance['langs'][string] = JSON.parse(JSON.stringify(provenance.langs.de));
    expect(String(gutenberg.cards['DC-001'].quote.url)).toMatch(/gutenberg\.org\/ebooks\/7276$/);
    expect(problems(de, gutenberg, record)).toEqual([]);
    gutenberg.cards['DC-001'].quote.revid = 'abc';
    expect(problems(de, gutenberg, record)).toEqual(['de DC-001: source URL is not a permanent Wikisource link or a pinned Project Gutenberg file']);
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

describe('published lines: copyright and spelling', () => {
  const translators: Record<string, { died: string | null }> = JSON.parse(readFileSync('docs/language/sources/translators.json', 'utf8')).translators;
  const deathYears = new Set(Object.values(translators).map((t) => t.died?.slice(0, 4)).filter(Boolean));

  /**
   * Every published line must be out of copyright by the life + 70 test (translator died in 1955 or
   * earlier, counted to 2026), with the death year taken from Wikidata (translators.json). A translator
   * without known dates is accepted only for an edition of 1880 or earlier.
   */
  function copyrightProblems(prov: Provenance): string[] {
    const out: string[] = [];
    for (const [lang, l] of Object.entries(prov.langs)) {
      for (const [id, c] of Object.entries(l.cards)) {
        if (c.quote.source !== 'published') continue;
        const dates = String(c.quote.translator ?? '').match(/\((\d{4})–(\d{4})\)/);
        if (dates) {
          if (Number(dates[2]) > 1955) out.push(`${lang} ${id}: translator died ${dates[2]}, within life + 70`);
          if (!deathYears.has(dates[2])) out.push(`${lang} ${id}: death year ${dates[2]} is not Wikidata's`);
        } else {
          const year = String(c.quote.edition ?? '').match(/\b(1[5-8]\d\d)\b/);
          if (!year || Number(year[1]) > 1880) out.push(`${lang} ${id}: translator without dates and no edition of 1880 or earlier`);
        }
      }
    }
    return out;
  }

  it('every published line is by a translator who died more than seventy years ago, by Wikidata’s dates', () => {
    expect(copyrightProblems(provenance)).toEqual([]);
    const published = Object.values(provenance.langs).reduce((n, l) => n + Object.values(l.cards).filter((c) => c.quote.source === 'published').length, 0);
    expect(published).toBeGreaterThan(150);
  });

  it('the copyright check can fail', () => {
    const copy: Provenance = JSON.parse(JSON.stringify(provenance));
    const line = copy.langs.it.cards['DC-001'].quote;
    line.translator = 'Someone (1890–1960)';
    expect(copyrightProblems(copy)).toEqual(['it DC-001: translator died 1960, within life + 70', "it DC-001: death year 1960 is not Wikidata's"]);
    line.translator = 'Carlo Rusconi (1812–1888)';
    expect(copyrightProblems(copy)).toEqual(["it DC-001: death year 1888 is not Wikidata's"]);
    line.translator = 'Anonymous';
    line.edition = 'Milano, 1925';
    expect(copyrightProblems(copy)).toEqual(['it DC-001: translator without dates and no edition of 1880 or earlier']);
  });

  // OpenCC's JPVariants table: old Japanese character forms to the modern ones.
  const jp = new Map(
    readFileSync('docs/language/sources/opencc-JPVariants.txt', 'utf8').split('\n').filter((l) => l.includes('\t')).map((l) => {
      const [a, b] = l.split('\t');
      return [a, b.split(' ')[0]] as [string, string];
    }),
  );
  /** A Japanese line in old forms must carry its modern reading, and that reading must be the table's, character for character. */
  function echoProblems(pack: CardTextPack): string[] {
    const out: string[] = [];
    for (const [id, c] of Object.entries(pack.cards)) {
      if (!c.quote) continue;
      const modern = [...c.quote].map((ch) => jp.get(ch) ?? ch).join('');
      if (c.echo === undefined) {
        if (modern !== c.quote) out.push(`${id}: old character forms without a modern reading`);
      } else if (c.echo !== modern) out.push(`${id}: the modern reading is not the table's conversion`);
    }
    return out;
  }

  it('a Japanese line printed in old character forms is also read in the modern ones, by OpenCC’s table; no other language needs it', () => {
    const ja = packs.find((p) => p.lang === 'ja')!;
    expect(echoProblems(ja)).toEqual([]);
    expect(Object.values(ja.cards).filter((c) => c.echo).length).toBeGreaterThanOrEqual(5);
    for (const p of packs) if (p.lang !== 'ja') expect([p.lang, Object.values(p.cards).filter((c) => c.echo).length]).toEqual([p.lang, 0]);
  });

  it('the modern-reading check can fail', () => {
    const ja: CardTextPack = JSON.parse(JSON.stringify(packs.find((p) => p.lang === 'ja')!));
    delete ja.cards['VC-002'].echo;
    expect(echoProblems(ja)).toEqual(['VC-002: old character forms without a modern reading']);
    ja.cards['VC-002'].echo = 'さうした過激の歡楽は';
    expect(echoProblems(ja)).toEqual(['VC-002: the modern reading is not the table\'s conversion']);
  });
});

describe('the signature in the language of the duel', () => {
  it('every card with a line in a language has telling words in it, none of them a stop word', () => {
    const none: string[] = [];
    for (const p of packs) {
      const stop = new Set(p.stop.map((w) => wordKey(w, p.lang)));
      for (const c of CARD_CATALOG) {
        if (!p.cards[c.id].quote) continue;
        const words = localSignatureWords(c, p.lang);
        if (!words.length) none.push(`${p.lang} ${c.id}`);
        for (const w of words) expect([p.lang, c.id, w, stop.has(wordKey(w, p.lang))]).toEqual([p.lang, c.id, w, false]);
      }
    }
    // A line whose every word is short or on the stop list has no telling word of its own ("I am not what I am" has none
    // in English either); the English words then decide, as before. These are few, and each is reported by name.
    if (none.length) console.warn(`[cards-i18n] lines with no telling word of their own: ${none.join(', ')}`);
    // Where the English line has telling words, the line in another language should too. These have none of their
    // own, and the English words decide there. Their words are function words (pronouns, particles, "how"), or too
    // short for the language's measure (Hindi छह, सदा; Thai รัก, วิธี; Vietnamese hè), or single characters, which do not
    // count in Chinese and Japanese (花 "flower", 草, 愛, 力; the segmenter also cuts Tsubouchi's rare 齷齬 into two).
    // Viola's IL-001, "I am not what I am", is little words in every language; since the integration the English line
    // has a phrase to echo ("not what"), so its lines are listed here too, and the English phrase decides.
    // Pinned, so a change to the stop lists that takes the words of another line shows here.
    const lost = none.filter((key) => signatureWords(card(key.split(' ')[1])).length > 0);
    expect(lost).toEqual([
      'es IL-001', 'fr IL-001', 'de IL-001', 'pt IL-001', 'hi UW-002', 'zh LD-004', 'ja VC-003', 'ja IL-001', 'ja PT-005', 'ja OL-004',
      'vi SM-001', 'vi IL-001', 'th LD-004', 'id IL-001',
    ]);
    expect(none.length).toBeLessThanOrEqual(20);
    for (const key of none) {
      const [lang, id] = key.split(' ');
      const c = card(id);
      const english = signatureWords(c).slice(0, signatureNeeded(c));
      if (english.length) expect([key, checkSignature(c, `one ${english.join(' and ')} here`, lang).met]).toEqual([key, true]);
      else expect([key, checkSignature(c, 'anything at all', lang).code]).toEqual([key, 'none']);
    }
    // The measure is not vacuous: nearly every line does have telling words.
    const lines = packs.reduce((n, p) => n + CARD_CATALOG.filter((c) => p.cards[c.id].quote).length, 0);
    expect(lines).toBeGreaterThan(1000);
  });

  // Over a thousand lines, five checks each: 3 s alone on the Studio, past vitest's 5 s default when the host is loaded.
  it('lands for a verse that echoes the translated line, and is refused for one that quotes it outright', { timeout: 60_000 }, () => {
    let two = 0;
    for (const p of packs) {
      for (const c of CARD_CATALOG) {
        const quote = p.cards[c.id].quote;
        if (!quote) continue;
        const words = localSignatureWords(c, p.lang);
        if (!words.length) continue;
        // As in English (signatureNeeded), a line with three or more telling words needs two of them: its first and its last.
        const needed = localSignatureWords(c, p.lang, true).length >= 3 ? 2 : 1;
        const said = needed === 2 ? [words[0], localSignatureWords(c, p.lang, true).at(-1)!] : [words[0]];
        const echo = checkSignature(c, said.join(' / '), p.lang);
        expect([p.lang, c.id, said, echo.met, echo.code]).toEqual([p.lang, c.id, said, true, 'echoed']);
        if (needed === 2) {
          two++;
          const one = checkSignature(c, words[0], p.lang);
          expect([p.lang, c.id, words[0], one.met, one.code]).toEqual([p.lang, c.id, words[0], false, 'hint-two']);
        }
        if (wordsOf(quote, p.lang).length >= 4) {
          const recited = checkSignature(c, quote, p.lang);
          expect([p.lang, c.id, recited.met, recited.code]).toEqual([p.lang, c.id, false, 'quoted']);
        }
        const silent = checkSignature(c, '0', p.lang);
        expect([p.lang, c.id, silent.met, silent.code]).toEqual([p.lang, c.id, false, needed === 2 ? 'hint-two' : 'hint']);
        expect([p.lang, c.id, silent.detail.startsWith(words[0])]).toEqual([p.lang, c.id, true]);
      }
    }
    expect(two).toBeGreaterThan(400);
  });

  it('reads real verses: French, Japanese, and the endings of other languages', () => {
    const hamlet = card('DC-001');
    // French: Hugo's line is "Être, ou ne pas être, c'est là la question."
    expect(checkSignature(hamlet, 'Je pose ma question à la nuit', 'fr').met).toBe(true);
    expect(checkSignature(hamlet, 'Être, ou ne pas être, c’est là ma question', 'fr').code).toBe('quoted');
    // As in English, a verse that echoes no telling word is told what to echo, whatever else it recites.
    expect(checkSignature(hamlet, 'Je dis : être, ou ne pas être, voilà tout', 'fr').code).toBe('hint');
    expect(checkSignature(hamlet, 'Rien de lui ici', 'fr').code).toBe('hint');
    // Japanese has no spaces: the words are found inside the line. Its line has three telling words, so two are needed.
    const ja = localSignatureWords(hamlet, 'ja');
    expect(ja).toEqual(['生きる', '死ぬ', '問題']);
    expect(checkSignature(hamlet, `闇に向かって${ja[0]}と${ja[2]}を投げる`, 'ja').met).toBe(true);
    expect(checkSignature(hamlet, `闇に向かって${ja[2]}を投げる`, 'ja').code).toBe('hint-two');
    expect(checkSignature(hamlet, cardQuote(hamlet, 'ja'), 'ja').code).toBe('quoted');
    expect(checkSignature(hamlet, '月は静かに沈む', 'ja').code).toBe('hint-two');
    // The English word still lands in any language, as one of the words, and reciting the English line is still refused.
    expect(checkSignature(hamlet, 'I put the question to the dark', 'it').met).toBe(true);
    expect(checkSignature(hamlet, 'I put the question to the dark, 問題', 'ja').met).toBe(true);
    expect(checkSignature(hamlet, 'I put the question to the dark', 'ja').code).toBe('hint-two');
    expect(checkSignature(hamlet, 'To be, or not to be, that is the question', 'ja').met).toBe(false);
    // Endings: two forms of one word have one stem (Snowball); Korean particles follow a noun; Arabic prefixes join it.
    expect(saysWord('Гамлет', 'Слушай Гамлета', 'ru')).toBe(true);
    expect(saysWord('Джульетта', 'Зову Джульетту', 'ru')).toBe(true);
    expect(saysWord('Julia', 'Wołam Julię', 'pl')).toBe(true);
    expect(saysWord('햄릿', '햄릿이여 들으라', 'ko')).toBe(true);
    expect(saysWord('هاملت', 'اسمع يا وهاملت', 'ar')).toBe(true);
    expect(saysWord('Roma', 'Romeo llega', 'es')).toBe(false);
    expect(saysWord('Гамлет', 'Слушай Макбета', 'ru')).toBe(false);
  });

  it('reads real verses against published lines: Rusconi, Moratín, Luís I, Tsubouchi', () => {
    const hamlet = card('DC-001');
    // Rusconi: «Essere o non essere, ecco il gran problema»
    expect(checkSignature(hamlet, 'Il mio problema è la notte', 'it').met).toBe(true);
    expect(checkSignature(hamlet, 'Essere o non essere, ecco il gran problema', 'it').code).toBe('quoted');
    expect(checkSignature(hamlet, 'La luna dorme sul mare', 'it').code).toBe('hint');
    // Moratín: «Ser, o no ser, ésa es la cuestión.»
    expect(checkSignature(hamlet, 'Mi cuestión es la luna', 'es').met).toBe(true);
    expect(checkSignature(hamlet, 'Ser, o no ser, ésa es la cuestión', 'es').code).toBe('quoted');
    // Luís I: «Ser ou não ser, eis o problema.»
    expect(checkSignature(hamlet, 'O meu problema é a noite', 'pt').met).toBe(true);
    expect(checkSignature(hamlet, 'Ser ou não ser, eis o problema', 'pt').code).toBe('quoted');
    // Tsubouchi, printed in old forms: 「さうした過激の歡樂は、とかく過激の終を遂ぐる。」 (modern 歓楽).
    const friar = card('VC-002');
    const ja = localSignatureWords(friar, 'ja');
    expect(ja).toContain('歓楽');
    expect(ja).toContain('歡樂');
    expect(checkSignature(friar, '夜の歓楽よ、さらば', 'ja').met).toBe(true);
    expect(checkSignature(friar, '夜の歡樂よ、さらば', 'ja').met).toBe(true);
    expect(checkSignature(friar, cardQuote(friar, 'ja'), 'ja').code).toBe('quoted');
    expect(checkSignature(friar, 'さうした過激の歓楽は、とかく過激の終を遂ぐる。', 'ja').code).toBe('quoted');
    // Two spellings of one word are one word: the line has two telling words, 過激 and 歓楽, so one is enough.
    expect(checkSignature(friar, '月は静かに沈む', 'ja').code).toBe('hint');
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

/** Card names that are one ordinary word (pack.ordinary) or Bottom's, which count only inside a longer name. */
const NOT_ALONE: string[] = [
  // Bottom, whom English calls on only as "Nick Bottom", "Bully Bottom" or "Bottom the weaver" (devices.ts NAME_PHRASES).
  'es Bottom', 'fr Bottom', 'it Bottom', 'id Bottom', 'de Zettel', 'hi बॉटम', 'zh 波顿', 'ja ボトム',
  // Ordinary words of the language (Wiktionary): a puck, a pack, "I imagine", banks (typed without the nasal mark).
  'de Puck', 'ja パック', 'ar أخيل', 'hi बैंको',
];

describe('the invocation in the language of the duel', () => {
  it('lands with each character’s name as the language writes it', () => {
    // A name that is also an ordinary word counts as English counts "Bottom" (echo.ts): written with a capital inside a
    // sentence where the language writes its ordinary words small, and otherwise only by a longer name.
    const alone: string[] = [];
    for (const p of packs) {
      const names = localCharacterNames(p.lang);
      const capital = capitalOnlyNames(p.lang);
      // A role counts after a definite article in German, as English counts "the nurse" (articleOnlyNames).
      const article = articleOnlyNames(p.lang);
      for (const c of CARD_CATALOG) {
        const name = p.cards[c.id].name;
        if (c.type !== 'Character' || !name || c.id === 'SM-001') continue;
        const counts = names.includes(name);
        if (!counts) alone.push(`${p.lang} ${name}`);
        const verse = capital.includes(name) ? `x, ${name}` : article.includes(name) ? `${p.definite![0]} ${name}` : name;
        const r = DEVICES.invocation.check(verse, { lang: p.lang, names: [] });
        expect([p.lang, c.id, name, r.met]).toEqual([p.lang, c.id, name, counts]);
      }
      expect([p.lang, names.length > 20]).toEqual([p.lang, true]);
    }
    // The names that count only inside a longer name (or, for Bottom, in English's phrases): ordinary words of the language.
    expect(alone.sort()).toEqual(NOT_ALONE.sort());
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
  // That loading every language's card text changes nothing in English is english.test.ts; these pin what the
  // engine gives English verses, as the integration's rules have it (two words for a line with three or more).
  it('the signature and the invocation judge English verses as the engine does', () => {
    const hamlet = card('DC-001');
    expect(checkSignature(hamlet, 'I put the question to the dark')).toEqual({ met: true, detail: 'question', code: 'echoed', words: ['question'] });
    expect(checkSignature(hamlet, 'To be, or not to be, that is the question')).toEqual({ met: false, detail: '', code: 'quoted' });
    expect(checkSignature(hamlet, 'Nothing of his here')).toEqual({ met: false, detail: 'question', code: 'hint' });
    // A French word of Hugo's line does not land in an English duel.
    expect(checkSignature(card('MO-001'), 'la lumière', 'en').met).toBe(false);
    expect(DEVICES.invocation.check('Hear me, Hamlet', { names: ['Hamlet'] })).toEqual({ met: true, detail: 'Hamlet', words: ['hamlet'] });
    expect(DEVICES.invocation.check('Écoute, Roméo', { lang: 'en', names: ['Hamlet'] }).met).toBe(false);
    expect(DEVICES.invocation.check('ハムレットよ', { lang: 'en', names: ['Hamlet'] }).met).toBe(false);
    for (const c of CARD_CATALOG as Card[]) {
      const words = signatureWords(c).slice(0, signatureNeeded(c));
      if (words.length) expect([c.id, checkSignature(c, `one ${words.join(' and ')} here`, 'en').code]).toEqual([c.id, 'echoed']);
    }
  });
});

describe('card names as the interface shows them', () => {
  it('inside a sentence, set off as a title where the language needs an article, and bare otherwise', async () => {
    const es = (await import('../../i18n/locales/es')).default;
    expect(es['live.signature'].replace('{card}', cardNameInText(card('DC-001'), 'es'))).toBe('Firma (+½ de oficio): evoca la frase de «Príncipe Hamlet» sin citarla');
    expect(es['verdict.roundTheirs'].replace('{card}', cardNameInText(card('VC-004'), 'es'))).toBe('«Conde Paris» se lleva la ronda.');
    expect(es['verdict.roundTheirs'].replace('{card}', cardNameInText(card('MO-001'), 'es'))).toBe('Romeo se lleva la ronda.');
    expect(cardNameInText(card('PT-008'), 'es')).toBe('«Lágrimas de sirena»');
    expect(cardNameInText(card('RM-003'), 'es')).toBe('Marco Antonio');
    expect(cardNameInText(card('SC-002'), 'es')).toBe('Lady Macbeth');
    expect(cardNameInText(card('VC-003'), 'fr')).toBe('«\u00a0La Nourrice\u00a0»');
    expect(cardNameInText(card('VC-004'), 'fr')).toBe('«\u00a0Comte Pâris\u00a0»');
    expect(cardNameInText(card('DC-003'), 'it')).toBe('«Re Claudio»');
    expect(cardNameInText(card('DC-001'), 'pt')).toBe('“Príncipe Hamlet”');
    // German puts no article before a title with a name (Prinz Hamlet gewinnt), only before a role or a thing.
    expect(cardNameInText(card('DC-001'), 'de')).toBe('Prinz Hamlet');
    expect(cardNameInText(card('VC-003'), 'de')).toBe('„Wärterin“');
    expect(cardNameInText(card('PT-001'), 'de')).toBe('„Liebestrank“');
    // Languages without articles before a name take it as it is.
    for (const l of ['ru', 'pl', 'zh', 'ja', 'ko', 'vi', 'th', 'id']) for (const c of CARD_CATALOG) expect([l, c.id, cardNameInText(c, l)]).toEqual([l, c.id, cardName(c, l)]);
    // Hindi and Arabic: a character by its local name; a relic or a potion by its English one, since those sentences put
    // the verb in the masculine and the local names are often feminine (योरिक की खोपड़ी आपको ये शब्द देता है would be wrong).
    for (const l of ['hi', 'ar']) {
      for (const c of CARD_CATALOG) expect([l, c.id, cardNameInText(c, l)]).toEqual([l, c.id, c.type === 'Character' ? cardName(c, l) : c.name]);
    }
    expect(cardName(card('RL-001'), 'hi')).toBe('योरिक की खोपड़ी');
  });
  it('standing alone, and at the start of a sentence, with a capital', async () => {
    const ru = (await import('../../i18n/locales/ru')).default;
    expect(cardName(card('VC-004'), 'ru')).toBe('граф Парис');
    expect(cardTitle(card('VC-004'), 'ru')).toBe('Граф Парис');
    expect(capitalised(ru['round.composing'].replace('{card}', cardNameInText(card('VC-004'), 'ru')), 'ru')).toBe('Граф Парис сочиняет…');
    expect(ru['verdict.roundTheirs'].replace('{card}', cardNameInText(card('VC-004'), 'ru'))).toBe('Раунд забирает граф Парис.');
  });
  // The third check (2026-11-17): a title these languages write with no article needs no quotation marks, and French
  // put «de» before a vowel («la réplique de Ophélie»).
  it('a religious’s or a courtly title takes no article, so no marks: Fray, Frate, Messer, Madonna, Frère', async () => {
    expect(cardNameInText(card('VC-002'), 'es')).toBe(cardName(card('VC-002'), 'es'));
    expect(cardName(card('VC-002'), 'es')).toMatch(/^Fray /u);
    expect(cardNameInText(card('VC-002'), 'it')).toMatch(/^Frate /u);
    expect(cardNameInText(card('MO-004'), 'it')).toMatch(/^Messer /u);
    expect(cardNameInText(card('CA-003'), 'it')).toMatch(/^Madonna /u);
    expect(cardNameInText(card('VC-002'), 'fr')).toBe('Frère Laurence');
    // A title that takes the article keeps its marks.
    expect(cardNameInText(card('VC-004'), 'it')).toMatch(/^«/u);
    expect(cardNameInText(card('MO-004'), 'es')).toMatch(/^«/u);
  });
  it('French elides de before a name that begins with a vowel or a mute h, and only there', async () => {
    const fr = (await import('../../i18n/locales/fr')).default;
    const sig = (id: string) => withCardName((n) => fr['live.signature'].replace('{card}', n), card(id), 'fr');
    const expected = (before: string) => fr['live.signature'].replace('de {card}', before);
    expect(fr['live.signature']).toContain('la réplique de {card} sans');
    expect(sig('DC-002')).toBe(expected('d’Ophélie'));
    expect(sig('DC-004')).toBe(expected('d’Horatio'));
    expect(sig('OL-007')).toBe(expected('d’Achille'));
    expect(sig('MO-002')).toBe(expected('de Mercutio'));
    expect(sig('RL-001')).toMatch(/réplique de «\u00a0/u); // a relic, in quotation marks
    // Spanish has no elision: «de Ofelia».
    const es = (await import('../../i18n/locales/es')).default;
    expect(withCardName((n) => es['live.signature'].replace('{card}', n), card('DC-002'), 'es')).toContain('de Ofelia');
    for (const c of CARD_CATALOG) {
      const text = withCardName((n) => fr['live.signature'].replace('{card}', n), c, 'fr');
      expect([c.id, /\bde [AEIOUÉÈÊÂÎÔŒH]/u.test(text)]).toEqual([c.id, false]);
    }
  });
  it('a published line its edition begins mid-sentence is shown after an ellipsis', () => {
    expect(cardQuote(card('RL-007'), 'fr')).toBe('… je noierai mon livre');
    expect(cardQuote(card('DC-001'), 'fr')).toBe('Être, ou ne pas être, c’est là la question.');
  });
});

describe('a published line whose copyright is in doubt is not used', () => {
  it('Gumilyov’s Russian Rime: the record keeps it and says why; the card has the game’s own line, marked new', () => {
    const ld = getCardText('ru')!.cards['LD-002'];
    expect(ld.quoteSource).toBe('new');
    const rec = provenance.langs.ru.cards['LD-002'] as unknown as { publishedNotUsed?: { url: string; why: string } };
    expect(rec.publishedNotUsed?.url).toMatch(/ru\.wikisource\.org\/.+oldid=5058375$/);
    expect(rec.publishedNotUsed?.why).toMatch(/rehabilitated/);
    expect(record).toContain('## Published lines found and not used');
  });
});
