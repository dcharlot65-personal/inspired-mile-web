/**
 * Card text per language: names, quotations, scene descriptions, and the labels
 * of houses, elements, rarities and card types.
 *
 * src/lib/cards.ts stays the English source of truth. Each other language is one
 * generated module here (./<code>.ts, written by scripts/language/build_card_text.py
 * from the sources recorded in docs/language/), loaded on demand: with the
 * interface language for display, and with a duel's language pack for the
 * signature and the invocation (loadPack loads it).
 *
 * Every entry says where it came from:
 *   name   'wikidata'    the item's label in this language
 *          'wikipedia'   the title of this language's Wikipedia article
 *          'derived'     cut by rule from a sourced label (the title of the play, a longer name)
 *          'translated'  the game's own invention, translated for the game; no published source
 *          'missing'     no source has this name in this language; the English name is shown
 *   quote  'published'   copied from a published translation that is in the public domain
 *          'new'         translated for the game; no usable published translation was found
 *          'missing'     not translated; the English line is shown
 * The full record (item ids, translators, URLs, licences) is docs/language/NAMES-AND-QUOTATIONS.md.
 */
import type { Card } from '../cards';

export type NameSource = 'wikidata' | 'wikipedia' | 'derived' | 'translated' | 'missing';
export type QuoteSource = 'published' | 'new' | 'missing';

export interface CardText {
  name?: string;
  nameSource: NameSource;
  /** Other forms the name is known by in this language (single words), for the invocation. */
  aliases?: string[];
  quote?: string;
  quoteSource: QuoteSource;
  /**
   * The line as the signature reads it, where the published spelling is older than what players
   * type: Japanese old character forms converted to the modern ones by OpenCC's JPVariants table.
   * Absent when it would be the same as `quote`.
   */
  echo?: string;
  /** Scene description. Always translated for the game: it has no published source. */
  scene?: string;
}

export interface CardTextPack {
  lang: string;
  cards: Record<string, CardText>;
  /** Labels, keyed by the English value in cards.ts. All translated for the game. */
  houses: Record<string, string>;
  elements: Record<string, string>;
  rarities: Record<string, string>;
  types: Record<string, string>;
  /** Words too common to count as an echo of a quotation (from an open stop-word list; see the docs). */
  stop: string[];
}

export const CARD_TEXT_LANGS = ['es', 'fr', 'de', 'it', 'pt', 'pl', 'ru', 'ar', 'hi', 'zh', 'ja', 'ko', 'vi', 'th', 'id'] as const;
export type CardTextLang = (typeof CARD_TEXT_LANGS)[number];

const LOADERS: Record<CardTextLang, () => Promise<{ default: CardTextPack }>> = {
  es: () => import('./es'),
  fr: () => import('./fr'),
  de: () => import('./de'),
  it: () => import('./it'),
  pt: () => import('./pt'),
  pl: () => import('./pl'),
  ru: () => import('./ru'),
  ar: () => import('./ar'),
  hi: () => import('./hi'),
  zh: () => import('./zh'),
  ja: () => import('./ja'),
  ko: () => import('./ko'),
  vi: () => import('./vi'),
  th: () => import('./th'),
  id: () => import('./id'),
};

const loaded = new Map<string, CardTextPack>();
const base = (lang: string) => lang.toLowerCase().split('-')[0];

/** Load a language's card text. English, and a language that has none, resolve to null. */
export async function loadCardText(lang: string): Promise<CardTextPack | null> {
  const b = base(lang);
  const have = loaded.get(b);
  if (have) return have;
  const loader = (LOADERS as Record<string, (() => Promise<{ default: CardTextPack }>) | undefined>)[b];
  if (!loader) return null;
  const pack = (await loader()).default;
  loaded.set(b, pack);
  return pack;
}

export async function loadAllCardText(): Promise<CardTextPack[]> {
  return (await Promise.all(CARD_TEXT_LANGS.map((l) => loadCardText(l)))).filter((p): p is CardTextPack => !!p);
}

/** The card text of a language if it has been loaded; null for English or a language not loaded. */
export function getCardText(lang: string): CardTextPack | null {
  return loaded.get(base(lang)) ?? null;
}

/** A card's name in a language; the English name where the language has none (or is not loaded). */
export function cardName(card: Card, lang: string): string {
  return getCardText(lang)?.cards[card.id]?.name ?? card.name;
}

/** A card's quotation in a language; the English line where the language has none. */
export function cardQuote(card: Card, lang: string): string {
  return getCardText(lang)?.cards[card.id]?.quote ?? card.quote;
}

/** The quotation in a language only if that language has its own; null otherwise. */
export function localQuote(card: Card, lang: string): string | null {
  return getCardText(lang)?.cards[card.id]?.quote ?? null;
}

/** The quotation as the signature reads it (its modern spelling where it has one); null where the language has none. */
export function localEchoText(card: Card, lang: string): string | null {
  const text = getCardText(lang)?.cards[card.id];
  return text?.echo ?? text?.quote ?? null;
}

export function cardScene(card: Card, lang: string): string {
  return getCardText(lang)?.cards[card.id]?.scene ?? card.scene;
}

export function houseName(house: string, lang: string): string {
  return getCardText(lang)?.houses[house] ?? house;
}

export function elementName(element: string, lang: string): string {
  return getCardText(lang)?.elements[element] ?? element;
}

export function rarityName(rarity: string, lang: string): string {
  return getCardText(lang)?.rarities[rarity] ?? rarity;
}

export function typeName(type: string, lang: string): string {
  return getCardText(lang)?.types[type] ?? type;
}
