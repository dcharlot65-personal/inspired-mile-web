/**
 * Deck rules, and what each card does in a duel, described for the collection
 * and deck-building screens.
 *
 * The effects themselves live in ./verse: a character carries its house's
 * device, a relic lends power words, a potion casts a curse. This file only
 * describes them and validates decks.
 */
import type { House } from './cards';
import { CARD_CATALOG, getCardById } from './cards';
import { CURSES, HOUSE_DEVICE, POTION_CURSE, POWER_WORDS_NEEDED, POWER_WORD_BONUS, RELIC_WORDS, deviceForHouse } from './verse/devices';

/** The four things a judge weighs. World cards name one of them. */
export type BattleAxis = 'wordplay' | 'shakespeare' | 'flow' | 'wit';

export interface CardEffect {
  id: string;
  name: string;
  description: string;
}

/** Each character's device, keyed by card id. */
export const CHARACTER_ABILITIES: Record<string, CardEffect> = Object.fromEntries(
  CARD_CATALOG.filter((c) => c.type === 'Character').map((c) => {
    const device = deviceForHouse(c.house);
    return [c.id, { id: device.id, name: device.name, description: `${device.brief} Land it to add half again to your craft. ${HOUSE_DEVICE[c.house]?.why ?? ''}`.trim() }];
  }),
);

export interface ItemEffect extends CardEffect {
  cardId: string;
  usesPerBattle: number;
}

/** What each relic and potion does, keyed by card id. */
export const ITEM_EFFECTS: Record<string, ItemEffect> = Object.fromEntries(
  CARD_CATALOG.filter((c) => c.type !== 'Character').map((c) => {
    if (c.type === 'Relic') {
      const words = RELIC_WORDS.en[c.id] ?? [];
      return [c.id, { cardId: c.id, id: 'power-words', name: c.name, usesPerBattle: 1, description: `Lends power words: ${words.join(', ')}. Use ${POWER_WORDS_NEEDED} of them for +${POWER_WORD_BONUS} craft. Costs 1 ink.` }];
    }
    const curse = CURSES[POTION_CURSE[c.id]];
    return [c.id, { cardId: c.id, id: curse.id, name: c.name, usesPerBattle: 1, description: `Curses your opponent's next verse with ${curse.name}: ${curse.brief('one chosen letter').replace('Your verse', 'their verse')} Costs 1 ink.` }];
  }),
);

export interface HouseSynergy {
  house: House;
  minCards: number;
  description: string;
}

/** Houses with two or more characters in the deck: their device pays an extra quarter. */
export function getActiveSynergies(cardIds: string[]): HouseSynergy[] {
  const counts = new Map<House, number>();
  for (const id of cardIds) {
    const card = getCardById(id);
    if (card?.type === 'Character') counts.set(card.house, (counts.get(card.house) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, n]) => n >= 2)
    .map(([house]) => ({ house, minCards: 2, description: `2+ ${house}: ${deviceForHouse(house).name} adds three quarters to your craft instead of half` }));
}

// --- Deck validation ---

export interface Deck {
  name: string;
  characters: string[];
  relics: string[];
  potions: string[];
}

export const DECK_RULES = {
  minCharacters: 3,
  maxCharacters: 5,
  maxRelics: 2,
  maxPotions: 2,
  totalMax: 7,
};

export function validateDeck(deck: Deck): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (deck.characters.length < DECK_RULES.minCharacters) errors.push(`Need at least ${DECK_RULES.minCharacters} characters`);
  if (deck.characters.length > DECK_RULES.maxCharacters) errors.push(`Max ${DECK_RULES.maxCharacters} characters`);
  if (deck.relics.length > DECK_RULES.maxRelics) errors.push(`Max ${DECK_RULES.maxRelics} relics`);
  if (deck.potions.length > DECK_RULES.maxPotions) errors.push(`Max ${DECK_RULES.maxPotions} potions`);
  const total = deck.characters.length + deck.relics.length + deck.potions.length;
  if (total > DECK_RULES.totalMax) errors.push(`Max ${DECK_RULES.totalMax} total cards in deck`);

  const expect = (ids: string[], type: 'Character' | 'Relic' | 'Potion') => {
    for (const id of ids) {
      const card = getCardById(id);
      if (!card) errors.push(`Unknown card: ${id}`);
      else if (card.type !== type) errors.push(`${card.name} is not a ${type}`);
    }
  };
  expect(deck.characters, 'Character');
  expect(deck.relics, 'Relic');
  expect(deck.potions, 'Potion');
  return { valid: errors.length === 0, errors };
}
