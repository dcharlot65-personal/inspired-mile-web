/**
 * The signature and the invocation in languages other than English.
 *
 * A card's quotation and name exist per language (src/lib/cards-i18n). In a duel
 * fought in such a language the signature is earned by echoing a telling word of
 * the quotation as it is published in that language, and refused for reciting
 * it; the invocation is earned by a character's name as that language writes it.
 * The English line and the English names keep counting too, as they always did.
 *
 * Other languages inflect, so a word is "said" when a verse word begins with it,
 * or (five letters or more) with all but its last letter: Polish "Hamleta" says
 * "Hamlet", Russian "Джульетту" says "Джульетта", Korean "햄릿이" says "햄릿".
 * Arabic attaches the article and prepositions in front, so there the word may
 * sit anywhere inside a verse word. Chinese, Japanese and Thai are written
 * unspaced: words come from Intl.Segmenter, and a word is said when its letters
 * appear in the verse's letters, because the segmenter may cut the same word
 * differently in a different sentence.
 *
 * English never comes through here: devices.ts keeps its own path for it.
 */
import { CARD_CATALOG, type Card } from '../cards';
import { getCardText, localQuote } from '../cards-i18n';
import { baseLang } from './lang';
import { contentWords, fold, hiragana, letterCount, wordsOf } from './text';

const UNSPACED = new Set(['zh', 'ja', 'th']);

/** Folded letters only, kana merged: what unspaced scripts are compared by. */
function letters(text: string): string {
  return hiragana(fold(text)).replace(/[^\p{L}\p{M}]/gu, '');
}

/** Is `word` (already a single word) said in the verse, allowing for the language's endings? */
export function saysWord(word: string, verse: string, lang: string): boolean {
  const b = baseLang(lang);
  const w = fold(word);
  if (!w) return false;
  if (UNSPACED.has(b)) return letters(verse).includes(letters(word));
  const said = wordsOf(verse, lang).map(fold);
  if (b === 'ar') return said.some((s) => s.includes(w));
  const ls = [...w];
  const stem = ls.length >= 5 ? ls.slice(0, -1).join('') : w;
  return said.some((s) => s.startsWith(stem));
}

const stops = new Map<string, Set<string>>();
function stopWords(lang: string): Set<string> {
  const b = baseLang(lang);
  if (!stops.has(b)) stops.set(b, new Set((getCardText(b)?.stop ?? []).map(fold)));
  return stops.get(b)!;
}

/** The telling words of the card's quotation in this language; empty when the language has no line of its own. */
export function localSignatureWords(card: Card, lang: string): string[] {
  const quote = localQuote(card, lang);
  if (!quote) return [];
  const stop = stopWords(lang);
  return [...new Set(contentWords(quote, lang).map(fold).filter((w) => !stop.has(w)))];
}

/** Does the verse recite the line: four of its words running? */
function recites(quote: string, verse: string, lang: string): boolean {
  const q = wordsOf(quote, lang).map(fold);
  if (UNSPACED.has(baseLang(lang))) {
    const v = letters(verse);
    for (let i = 0; i + 4 <= q.length; i++) if (v.includes(letters(q.slice(i, i + 4).join('')))) return true;
    return false;
  }
  const spoken = ` ${wordsOf(verse, lang).map(fold).join(' ')} `;
  for (let i = 0; i + 4 <= q.length; i++) if (spoken.includes(` ${q.slice(i, i + 4).join(' ')} `)) return true;
  return false;
}

export interface LocalSignature {
  met: boolean;
  detail: string;
  code: 'hint' | 'quoted' | 'echoed';
}

/**
 * The signature in a language that has its own line for this card, or null when
 * it has none (English, a language not loaded, a card not translated): the
 * caller then judges by the English line alone, as before.
 *
 * `englishWords` are the English line's telling words, which still count.
 */
export function localSignature(card: Card, verse: string, lang: string, englishWords: string[]): LocalSignature | null {
  if (baseLang(lang) === 'en') return null;
  const quote = localQuote(card, lang);
  if (!quote) return null;
  const local = localSignatureWords(card, lang);
  if (!local.length) return null;
  const saidEn = new Set(wordsOf(verse, 'en').map(fold));
  const echoed = local.find((w) => saysWord(w, verse, lang)) ?? englishWords.find((w) => saidEn.has(w));
  if (!echoed) return { met: false, detail: local.slice(0, 4).join(', '), code: 'hint' };
  if (recites(quote, verse, lang) || recites(card.quote, verse, 'en')) return { met: false, detail: '', code: 'quoted' };
  return { met: true, detail: echoed, code: 'echoed' };
}

// --- Invocation: character names as each language writes them ---

const SPLIT = /[\s・·‧]+/u;
const nameCache = new Map<string, string[]>();

/**
 * Names that count as an invocation in a language, beyond the English ones:
 * each word of every character's name in that language, and its one-word
 * aliases. Words on the language's stop list, and words of fewer than three
 * letters (two where a letter is a syllable or a character), do not count.
 */
export function localCharacterNames(lang: string): string[] {
  const b = baseLang(lang);
  const pack = getCardText(b);
  if (!pack) return [];
  const have = nameCache.get(b);
  if (have) return have;
  const min = ['zh', 'ja', 'ko', 'th', 'hi'].includes(b) ? 2 : 3;
  const stop = stopWords(b);
  const out = new Set<string>();
  for (const c of CARD_CATALOG) {
    if (c.type !== 'Character') continue;
    const text = pack.cards[c.id];
    if (!text?.name) continue;
    for (const part of [...text.name.split(SPLIT), ...(text.aliases ?? [])]) {
      const w = part.replace(/^[^\p{L}]+|[^\p{L}\p{M}]+$/gu, '');
      if (letterCount(w) >= min && !stop.has(fold(w))) out.add(w);
    }
  }
  const names = [...out];
  nameCache.set(b, names);
  return names;
}

/** The first localised name the verse says, or undefined. */
export function saidLocalName(verse: string, lang: string): string | undefined {
  if (baseLang(lang) === 'en') return undefined;
  return localCharacterNames(lang).find((n) => saysWord(n, verse, lang));
}
