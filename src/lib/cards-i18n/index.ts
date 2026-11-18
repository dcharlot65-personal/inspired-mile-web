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
 *          'published'   as a published translation quoted here prints it (Hugo's «La Nourrice»), where the
 *                        Wikidata label is wrong or English (docs/language/sources/published-names.json)
 *          'derived'     cut by rule from a sourced label (the title of the play, a longer name)
 *          'translated'  the game's own invention, translated for the game; no published source
 *          'kept'        the product name (SM-001, "The Sonnet Man"), the same in every language
 *          'missing'     no source has this name in this language; the English name is shown
 *   quote  'published'   copied from a published translation that is in the public domain
 *          'new'         translated for the game; no usable published translation was found
 *          'missing'     not translated; the English line is shown
 * The full record (item ids, translators, URLs, licences) is docs/language/NAMES-AND-QUOTATIONS.md.
 */
import type { Card } from '../cards';
import { loadStemmer } from '../verse/stem';

export type NameSource = 'wikidata' | 'wikipedia' | 'published' | 'derived' | 'translated' | 'kept' | 'missing';
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
  /**
   * Words too common to count as an echo of a quotation: the open stop-word list, and the function words
   * (pronouns, particles, conjunctions, adpositions, determiners, articles) Wiktionary lists for the language.
   */
  stop: string[];
  /** Korean only: the particles (josa) a noun may carry, from Wiktionary. */
  particles?: string[];
  /** Korean only: particles with one form after a vowel and another after a consonant (를 / 을; 로 also after ㄹ), from Wiktionary. */
  particleForms?: { afterVowel: string[]; afterConsonant: string[]; alsoAfterL: string[] };
  /** Words of a character's longer name, or aliases, that are ordinary words of the language (Hunspell): not a name by themselves. */
  common?: string[];
  /**
   * Names, words of a name and aliases that are also ordinary words of the language, written as the language writes the
   * ordinary word: Spanish «bruto», German «Zettel», Japanese パック (scripts/language/build_card_text.py,
   * ordinary_name_words: English Wiktionary, and Hunspell too where the script has capitals). One listed in small letters
   * counts as a name by itself only written with a capital inside a sentence; one listed with a capital (a German noun),
   * or in a script without capitals, never by itself (src/lib/verse/echo.ts).
   */
  ordinary?: string[];
  /**
   * Chinese and Thai: for a name, the dictionary words that hold it with more around it and are not the character
   * (圣安东尼奥, "San Antonio", holds 安东尼; CC-CEDICT, jieba, PyThaiNLP: scripts/language/fetch/containing_words.py).
   * The invocation refuses the name where the verse writes one of them around it.
   */
  containing?: Record<string, string[]>;
  /**
   * Chinese only: how a foreign name is spelled, so the invocation can see where one goes on around a name of the game
   * (哈德斯菲尔德, Huddersfield, holds 哈德斯, Hades): `chars`, every character Xinhua's transliteration tables use (Chinese
   * Wikipedia, Wikipedia:外語譯音表); `bound`, those that are no word by themselves (jieba: 迪, 娅, 菲, 斯); `native`, the
   * common words written only in such characters (wordfreq: 当然, 东西), which end a foreign name rather than carry it on
   * (scripts/language/fetch/transliteration.py).
   */
  transliteration?: { chars: string; bound: string; native: string[] };
  /**
   * German only: the definite articles (Wiktionary: der, die, das, den, dem, des), after one of which a role's one-word
   * name counts, as English counts "the nurse" and not "a nurse" («die Wärterin»; scripts/language/fetch/definite_articles.py).
   */
  definite?: string[];
  /**
   * Vietnamese: the words of two to four syllables (nouns, verbs, adjectives, from Wiktionary) that occur in the
   * lines, which the signature reads as one word («vấn đề», "problem", not «vấn» and «đề»). Thai: the lines' words as
   * PyThaiNLP's newmm reads them (scripts/language/check/segment.py), read as one word where ICU cuts them in pieces
   * (โรสแมรี, "rosemary", not โรส and แมรี).
   */
  compounds?: string[];
  /**
   * Russian, Polish, German and Arabic: the forms each word of a character's name takes in a sentence, which the
   * invocation accepts besides the name itself (Джульетту, Julię, Romeos, وروميو). Made by the paradigms of
   * scripts/language/check/declension.py and put to Hunspell, which drops a form it knows as an ordinary word
   * (docs/language/checks/name-forms.json): no other declined word counts.
   */
  forms?: Record<string, string[]>;
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

/**
 * Load a language's card text, and the stemmer the signature and the invocation read it with (../verse/stem).
 * English, and a language that has none, resolve to null.
 */
export async function loadCardText(lang: string): Promise<CardTextPack | null> {
  const b = base(lang);
  const have = loaded.get(b);
  if (have) return have;
  const loader = (LOADERS as Record<string, (() => Promise<{ default: CardTextPack }>) | undefined>)[b];
  if (!loader) return null;
  const [mod] = await Promise.all([loader(), loadStemmer(b)]);
  const pack = mod.default;
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

/**
 * A card's name standing alone (on the card, as a heading, in a label), which starts with a capital as a title
 * does. Wikidata writes a label as it reads inside a sentence (Russian «граф Парис»); ru.wikipedia titles the same
 * article «Граф Парис».
 */
export function cardTitle(card: Card, lang: string): string {
  return capitalised(cardName(card, lang), lang);
}

/** The text with its first letter a capital, as a sentence or a title begins. */
export function capitalised(text: string, lang: string): string {
  return text.replace(/^\p{Ll}/u, (c) => c.toLocaleUpperCase(base(lang)));
}

/**
 * Quotation marks that set a card's name off as a title inside a sentence: CLDR's (version 49, cldr-misc-full
 * delimiters) for French, Italian, Portuguese and German, with the no-break space French puts inside « »; for
 * Spanish the angular quotes the Royal Spanish Academy puts first, which the Spanish interface already uses.
 */
const TITLE_QUOTES: Record<string, [string, string]> = {
  es: ['«', '»'],
  fr: ['«\u00a0', '\u00a0»'],
  it: ['«', '»'],
  pt: ['“', '”'],
  de: ['„', '“'],
};

/**
 * A card's name inside a sentence of the interface ("{card} takes the round", "echo {card}'s line"). Those
 * sentences were written for a bare name, as English puts one. Spanish, French, Italian, Portuguese and German
 * put an article before a common noun, a role or (except German) a title: es «el príncipe Hamlet», de «die
 * Wärterin», and fr «de le» is «du». So in those languages a name that is not a plain personal name is set off as
 * the card's title, in the language's quotation marks, which needs no article and agrees as one singular name:
 *   - a relic's or a potion's name (es «Lágrimas de sirena» maldice…);
 *   - a role: the English card has an article ("The Nurse");
 *   - outside German, a name whose first word is an ordinary word of the language, as Hunspell tells (pack.common:
 *     Príncipe, Conde, Señora, Comte, Re), which is how a title is written there, unless that word is the English
 *     name's own first word in this language's spelling (it begins with the same three letters: Marco Antonio for
 *     Mark Antony, Julieta Capuleto for Juliet).
 * A plain name is left bare (Romeo se lleva la ronda), and so is a name shown in English because the language has
 * none. Every other language takes the name as it is, except one case: in Hindi and Arabic the sentences about a
 * relic or a potion put its verb in the masculine (hi «{card} आपको ये शब्द देता है», ar «{card} يعيرك»), and many of
 * those names are feminine there (योरिक की खोपड़ी, جمجمة يوريك), so the sentence keeps the English name, as it did
 * before card names were translated, until those sentences are worded so that no verb agrees with the name.
 */
export function cardNameInText(card: Card, lang: string): string {
  const b = base(lang);
  if ((b === 'hi' || b === 'ar') && card.type !== 'Character') return card.name;
  const name = cardName(card, b);
  const quotes = TITLE_QUOTES[b];
  const pack = getCardText(b);
  const text = pack?.cards[card.id];
  if (!quotes || !pack || !text?.name || text.nameSource === 'missing') return /^The\s/.test(name) && quotes ? quotes[0] + name + quotes[1] : name;
  const words = name.split(/\s+/);
  const head = (w: string) => w.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().slice(0, 3);
  const titled = b !== 'de' && words.length > 1 && (pack.common ?? []).includes(words[0]) && head(words[0]) !== head(card.name.split(/\s+/)[0])
    && !NO_ARTICLE[b]?.includes(words[0]);
  return card.type !== 'Character' || /^The\s/.test(card.name) || titled ? quotes[0] + name + quotes[1] : name;
}

/**
 * Forms of address these languages put before a name with no article, so a name that begins with one needs no
 * quotation marks: a religious's (Spanish fray, Italian frate and fra, French frère, Portuguese frei) and the old
 * courtly ones (Italian messer, madonna; don and doña, dom and dona). Written out here by hand from the languages'
 * usage, not fetched (es «la frase de Fray Lorenzo», it «la battuta di Messer Montecchi», fr «la réplique de Frère
 * Laurence»); a title that takes the article (príncipe, conde, re, conte, comte, senhor) keeps its marks.
 */
const NO_ARTICLE: Record<string, string[]> = {
  es: ['Fray', 'Sor', 'Don', 'Doña'],
  it: ['Frate', 'Fra', 'Messer', 'Madonna', 'Don', 'Donna'],
  fr: ['Frère', 'Sœur', 'Dom'],
  pt: ['Frei', 'Dom', 'Dona'],
};

const CARD_MARK = String.fromCharCode(0xfffc);

/**
 * A sentence of the interface with a card's name in it (`sentence` puts its argument where {card} goes). The name is
 * cardNameInText's; and French elides de and que before a name that begins with a vowel or a mute h (la réplique
 * d’Ophélie, d’Horatio; not de Ophélie), which the sentences, written for any name, cannot do themselves. A name set
 * in quotation marks, or one that begins with a consonant (Yorick's Y is one), is left after de.
 */
export function withCardName(sentence: (card: string) => string, card: Card, lang: string): string {
  const name = cardNameInText(card, lang);
  let text = sentence(CARD_MARK);
  if (base(lang) === 'fr' && /^[aeiouàâäéèêëîïôöùûüœæh]/iu.test(name)) text = text.replace(new RegExp(`\\b(d|qu)e ${CARD_MARK}`, 'giu'), `$1’${CARD_MARK}`);
  return text.split(CARD_MARK).join(name);
}

/**
 * A card's quotation in a language, as it is shown; the English line where the language has none. A published
 * line that the edition begins in the middle of a sentence (its first letter is small: «je noierai mon livre»)
 * is shown after an ellipsis, which marks what was left out before it; its words are the edition's.
 */
export function cardQuote(card: Card, lang: string): string {
  const text = getCardText(lang)?.cards[card.id];
  if (!text?.quote) return card.quote;
  return text.quoteSource === 'published' && /^\p{Ll}/u.test(text.quote) ? `… ${text.quote}` : text.quote;
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
