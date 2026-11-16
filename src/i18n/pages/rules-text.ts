/**
 * What a card does in a duel and what a deck may hold, as text in the interface
 * language, for the collection and deck-building screens.
 *
 * src/lib/battle-rules.ts says the same in English (CHARACTER_ABILITIES,
 * ITEM_EFFECTS, validateDeck); this is the translated counterpart, built from
 * the engine's own messages (a device's name and brief, a curse's rule, a
 * house's line) plus the 'rules' area. Thresholds and power words differ by
 * language, so everything here takes the language to describe the duel in; the
 * pack for that language must be loaded (loadPack) before a relic is described.
 */
import { t, tm } from '../index';
import { curseName, curseRuleTheirs, deviceBrief, deviceName } from '../duel';
import { DECK_RULES, type Deck } from '../../lib/battle-rules';
import { getCardById, type Card } from '../../lib/cards';
import { POTION_CURSE, POWER_WORDS_NEEDED, POWER_WORD_BONUS, deviceForHouse, houseWhy } from '../../lib/verse/devices';
import { getPack } from '../../lib/verse/packs';
import { list, tn } from './runtime';
import { houseName } from './terms';

export interface CardRule {
  kind: 'character' | 'relic' | 'potion';
  /** The device or the item, by name. */
  name: string;
  /** Sentences, each complete in itself. Shown one per line: languages do not all join sentences with a space. */
  lines: string[];
  usesPerBattle?: number;
}

const INK_COST = 1;

/** A relic's power words in `lang`, or the English ones if that language's pack is not loaded. */
function relicWords(cardId: string, lang: string): string[] {
  try {
    return getPack(lang).relics[cardId] ?? [];
  } catch {
    return getPack('en').relics[cardId] ?? [];
  }
}

export function cardRule(card: Card, lang: string): CardRule {
  if (card.type === 'Character') {
    const device = deviceForHouse(card.house, lang);
    const why = houseWhy(card.house, lang);
    return { kind: 'character', name: deviceName(device.id), lines: [deviceBrief(device.id, lang), t('rules.landIt'), ...(why ? [tm(why)] : [])] };
  }
  const cost = tn('rules.cost', { n: INK_COST });
  if (card.type === 'Relic') {
    const words = relicWords(card.id, lang);
    return { kind: 'relic', name: card.name, usesPerBattle: 1, lines: [tn('rules.relic', { words: list(words), n: POWER_WORDS_NEEDED, bonus: POWER_WORD_BONUS }), cost] };
  }
  const id = POTION_CURSE[card.id];
  const name = curseName(id);
  // A Forbidden Letter potion names its letter only when the duel is dealt.
  const line = id === 'forbidden-letter' ? t('rules.potion.letter', { name }) : t('rules.potion', { name, rule: curseRuleTheirs(id, '', lang) });
  return { kind: 'potion', name: card.name, usesPerBattle: 1, lines: [line, cost] };
}

/** One sentence for a house with two or more characters in the deck. */
export function synergyLine(house: string, lang: string): string {
  return t('rules.synergy', { house: houseName(house), device: deviceName(deviceForHouse(house, lang).id) });
}

/** Why a deck cannot be saved, in the order validateDeck reports its errors. Empty when it can. */
export function deckProblems(deck: Deck): string[] {
  const out: string[] = [];
  if (deck.characters.length < DECK_RULES.minCharacters) out.push(tn('rules.deck.minCharacters', { n: DECK_RULES.minCharacters }));
  if (deck.characters.length > DECK_RULES.maxCharacters) out.push(tn('rules.deck.maxCharacters', { n: DECK_RULES.maxCharacters }));
  if (deck.relics.length > DECK_RULES.maxRelics) out.push(tn('rules.deck.maxRelics', { n: DECK_RULES.maxRelics }));
  if (deck.potions.length > DECK_RULES.maxPotions) out.push(tn('rules.deck.maxPotions', { n: DECK_RULES.maxPotions }));
  if (deck.characters.length + deck.relics.length + deck.potions.length > DECK_RULES.totalMax) out.push(tn('rules.deck.totalMax', { n: DECK_RULES.totalMax }));
  const expect = (ids: string[], type: Card['type'], key: string) => {
    for (const id of ids) {
      const card = getCardById(id);
      if (!card) out.push(t('rules.deck.unknownCard', { id }));
      else if (card.type !== type) out.push(t(key, { card: card.name }));
    }
  };
  expect(deck.characters, 'Character', 'rules.deck.notCharacter');
  expect(deck.relics, 'Relic', 'rules.deck.notRelic');
  expect(deck.potions, 'Potion', 'rules.deck.notPotion');
  return out;
}
