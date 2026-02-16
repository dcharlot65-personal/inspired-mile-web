/**
 * Battle Ruleset — card abilities, house synergies, item effects, deck building.
 * Applied as post-judge modifiers after the LLM scores each round.
 */

import type { Card, House } from './cards';
import { CARD_CATALOG, getCardById } from './cards';

export type BattleAxis = 'wordplay' | 'shakespeare' | 'flow' | 'wit';

export interface BattleModifiers {
  wordplay: number;
  shakespeare: number;
  flow: number;
  wit: number;
}

// --- Character Passive Abilities ---

export interface PassiveAbility {
  id: string;
  name: string;
  description: string;
  axis?: BattleAxis;
  bonus: number;
  condition?: string;
}

export const CHARACTER_ABILITIES: Record<string, PassiveAbility> = {
  'SM-001': { id: 'mic-drop', name: 'Mic Drop', description: '+3 Wordplay when HP below 50%', axis: 'wordplay', bonus: 3, condition: 'low-hp' },
  'MO-001': { id: 'star-crossed', name: 'Star-Crossed', description: '+2 Flow when paired with a Capulet card', axis: 'flow', bonus: 2, condition: 'cross-house-capulet' },
  'CA-001': { id: 'what-light', name: 'What Light', description: '+2 Shakespeare when opponent has higher ATK', axis: 'shakespeare', bonus: 2, condition: 'underdog-atk' },
  'DC-001': { id: 'to-be', name: 'To Be or Not To Be', description: '+3 Wordplay (always active)', axis: 'wordplay', bonus: 3 },
  'DC-002': { id: 'remembrance', name: 'Remembrance', description: '+2 Flow (always active)', axis: 'flow', bonus: 2 },
  'MO-002': { id: 'plague', name: 'A Plague', description: '+2 Wit (always active)', axis: 'wit', bonus: 2 },
  'FA-001': { id: 'trickster', name: 'Trickster', description: '+2 Wit, +1 Flow (always active)', axis: 'wit', bonus: 2 },
  'FA-002': { id: 'fairy-queen', name: 'Fairy Queen', description: '+2 Shakespeare (always active)', axis: 'shakespeare', bonus: 2 },
  'VC-001': { id: 'judgment', name: 'Royal Judgment', description: '+2 Shakespeare, +1 Wit', axis: 'shakespeare', bonus: 2 },
  'VC-002': { id: 'counsel', name: 'Wise Counsel', description: '+2 Wordplay (always active)', axis: 'wordplay', bonus: 2 },
  'VC-003': { id: 'devotion', name: 'Fierce Devotion', description: '+1 to all axes', axis: undefined, bonus: 1 },
  'TP-001': { id: 'tempest', name: 'Tempest', description: '+2 Wordplay, +1 Shakespeare', axis: 'wordplay', bonus: 2 },
  'TP-002': { id: 'spirit-flight', name: 'Spirit Flight', description: '+2 Flow, +1 Wit', axis: 'flow', bonus: 2 },
  'TP-003': { id: 'primal-rage', name: 'Primal Rage', description: '+3 Wit when at full HP', axis: 'wit', bonus: 3, condition: 'full-hp' },
  'MO-003': { id: 'peacekeeper', name: 'Peacekeeper', description: '+1 to all axes', axis: undefined, bonus: 1 },
  'CA-002': { id: 'firebrand', name: 'Firebrand', description: '+3 Wit (always active)', axis: 'wit', bonus: 3 },
  'DC-003': { id: 'usurper', name: 'Usurper', description: '+2 Wordplay, +1 Shakespeare', axis: 'wordplay', bonus: 2 },
  'FA-003': { id: 'moonlight-king', name: 'Moonlight King', description: '+2 Shakespeare, +1 Flow', axis: 'shakespeare', bonus: 2 },

  // V2: Scottish Court
  'SC-001': { id: 'vaulting-ambition', name: 'Vaulting Ambition', description: '+3 Wit when HP below 50%', axis: 'wit', bonus: 3, condition: 'low-hp' },
  'SC-002': { id: 'unsex-me', name: 'Unsex Me Here', description: '+2 Wordplay, +1 Wit', axis: 'wordplay', bonus: 2 },
  'SC-003': { id: 'prophecy', name: 'Prophecy', description: '+2 Shakespeare (always active)', axis: 'shakespeare', bonus: 2 },

  // V2: Illyria
  'IL-001': { id: 'disguise', name: 'Disguise', description: '+2 Flow, +1 Wit', axis: 'flow', bonus: 2 },
  'IL-002': { id: 'self-love', name: 'Self-Love', description: '+2 Wordplay (always active)', axis: 'wordplay', bonus: 2 },
  'IL-003': { id: 'mourning-veil', name: 'Mourning Veil', description: '+2 Shakespeare (always active)', axis: 'shakespeare', bonus: 2 },

  // V2: Rome
  'RM-001': { id: 'honorable-man', name: 'Honorable Man', description: '+2 Shakespeare, +1 Wordplay', axis: 'shakespeare', bonus: 2 },
  'RM-002': { id: 'lean-hungry', name: 'Lean and Hungry', description: '+3 Wit (always active)', axis: 'wit', bonus: 3 },
  'RM-003': { id: 'lend-ears', name: 'Lend Me Your Ears', description: '+3 Wordplay (always active)', axis: 'wordplay', bonus: 3 },

  // V2: Existing Houses Expansion
  'MO-004': { id: 'patriarch', name: 'Patriarch', description: '+1 to all axes', axis: undefined, bonus: 1 },
  'CA-003': { id: 'matriarch', name: 'Matriarch', description: '+2 Shakespeare (always active)', axis: 'shakespeare', bonus: 2 },
  'DC-004': { id: 'faithful-friend', name: 'Faithful Friend', description: '+2 Flow, +1 Shakespeare', axis: 'flow', bonus: 2 },
  'FA-004': { id: 'translated', name: 'Translated', description: '+2 Wit (always active)', axis: 'wit', bonus: 2 },
  'VC-004': { id: 'suitor', name: 'Noble Suitor', description: '+1 to all axes', axis: undefined, bonus: 1 },
  'TP-004': { id: 'wonder', name: 'Brave New World', description: '+2 Flow (always active)', axis: 'flow', bonus: 2 },
};

/** Apply a character's passive ability to battle modifiers */
export function applyPassive(cardId: string, mods: BattleModifiers, context?: { round: number; totalRounds: number }): BattleModifiers {
  const ability = CHARACTER_ABILITIES[cardId];
  if (!ability) return mods;

  const result = { ...mods };

  // Cards with conditions — simplified for single-player (conditions always active in V2)
  if (ability.axis) {
    result[ability.axis] += ability.bonus;
  } else {
    // +N to all axes
    result.wordplay += ability.bonus;
    result.shakespeare += ability.bonus;
    result.flow += ability.bonus;
    result.wit += ability.bonus;
  }

  // Secondary bonuses for specific characters
  if (cardId === 'FA-001') result.flow += 1;
  if (cardId === 'VC-001') result.wit += 1;
  if (cardId === 'TP-001') result.shakespeare += 1;
  if (cardId === 'TP-002') result.wit += 1;
  if (cardId === 'DC-003') result.shakespeare += 1;
  if (cardId === 'FA-003') result.flow += 1;

  return result;
}

// --- House Synergies ---

export interface HouseSynergy {
  house: House;
  minCards: number;
  axis: BattleAxis;
  bonus: number;
  description: string;
}

export const HOUSE_SYNERGIES: HouseSynergy[] = [
  { house: 'Montague', minCards: 2, axis: 'wit', bonus: 2, description: '2+ Montague: +2 Wit' },
  { house: 'Capulet', minCards: 2, axis: 'shakespeare', bonus: 2, description: '2+ Capulet: +2 Shakespeare' },
  { house: 'Danish Court', minCards: 2, axis: 'wordplay', bonus: 2, description: '2+ Danish Court: +2 Wordplay' },
  { house: 'Forest of Arden', minCards: 2, axis: 'flow', bonus: 2, description: '2+ Forest of Arden: +2 Flow' },
  { house: 'Verona Court', minCards: 2, axis: 'shakespeare', bonus: 1, description: '2+ Verona Court: +1 Shakespeare' },
  { house: 'The Tempest', minCards: 2, axis: 'wordplay', bonus: 1, description: '2+ Tempest: +1 Wordplay' },
  { house: 'Scottish Court', minCards: 2, axis: 'wit', bonus: 2, description: '2+ Scottish Court: +2 Wit' },
  { house: 'Illyria', minCards: 2, axis: 'flow', bonus: 2, description: '2+ Illyria: +2 Flow' },
  { house: 'Rome', minCards: 2, axis: 'wordplay', bonus: 2, description: '2+ Rome: +2 Wordplay' },
];

/** Calculate house synergy bonuses for a set of card IDs */
export function calculateSynergies(cardIds: string[]): BattleModifiers {
  const mods: BattleModifiers = { wordplay: 0, shakespeare: 0, flow: 0, wit: 0 };

  const houseCounts: Partial<Record<House, number>> = {};
  for (const id of cardIds) {
    const card = getCardById(id);
    if (card?.type === 'Character') {
      houseCounts[card.house] = (houseCounts[card.house] || 0) + 1;
    }
  }

  for (const synergy of HOUSE_SYNERGIES) {
    if ((houseCounts[synergy.house] || 0) >= synergy.minCards) {
      mods[synergy.axis] += synergy.bonus;
    }
  }

  return mods;
}

/** Get active synergies for a deck */
export function getActiveSynergies(cardIds: string[]): HouseSynergy[] {
  const houseCounts: Partial<Record<House, number>> = {};
  for (const id of cardIds) {
    const card = getCardById(id);
    if (card?.type === 'Character') {
      houseCounts[card.house] = (houseCounts[card.house] || 0) + 1;
    }
  }

  return HOUSE_SYNERGIES.filter(s => (houseCounts[s.house] || 0) >= s.minCards);
}

// --- Relic & Potion Effects ---

export interface ItemEffect {
  cardId: string;
  name: string;
  description: string;
  usesPerBattle: number;
  type: 'boost' | 'reduce_opponent' | 'reroll';
  axis?: BattleAxis;
  amount: number;
}

export const ITEM_EFFECTS: Record<string, ItemEffect> = {
  'RL-001': { cardId: 'RL-001', name: "Yorick's Skull", description: '+3 Wit for one round', usesPerBattle: 1, type: 'boost', axis: 'wit', amount: 3 },
  'RL-002': { cardId: 'RL-002', name: "Prospero's Staff", description: '+2 to all axes for one round', usesPerBattle: 1, type: 'boost', amount: 2 },
  'RL-003': { cardId: 'RL-003', name: 'Dagger of the Mind', description: 'Reduce opponent total by 3', usesPerBattle: 1, type: 'reduce_opponent', amount: 3 },
  'PT-001': { cardId: 'PT-001', name: 'Love Potion', description: '+3 Flow for one round', usesPerBattle: 2, type: 'boost', axis: 'flow', amount: 3 },
  'PT-002': { cardId: 'PT-002', name: "Witches' Brew", description: '+3 Wordplay for one round', usesPerBattle: 2, type: 'boost', axis: 'wordplay', amount: 3 },
  'PT-003': { cardId: 'PT-003', name: "Puck's Flower Juice", description: 'Reroll lowest axis score', usesPerBattle: 1, type: 'reroll', amount: 0 },

  // V2: New Relics
  'RL-004': { cardId: 'RL-004', name: "Romeo's Ring", description: '+3 Flow for one round', usesPerBattle: 1, type: 'boost', axis: 'flow', amount: 3 },
  'RL-005': { cardId: 'RL-005', name: "Portia's Casket", description: '+2 Shakespeare, +1 Wordplay', usesPerBattle: 1, type: 'boost', axis: 'shakespeare', amount: 2 },
  'RL-006': { cardId: 'RL-006', name: "Macbeth's Crown", description: '+3 Wit for one round', usesPerBattle: 1, type: 'boost', axis: 'wit', amount: 3 },
  'RL-007': { cardId: 'RL-007', name: 'The Tempest Codex', description: '+2 to all axes for one round', usesPerBattle: 1, type: 'boost', amount: 2 },
  'RL-008': { cardId: 'RL-008', name: "Cordelia's Tears", description: '+3 Shakespeare for one round', usesPerBattle: 1, type: 'boost', axis: 'shakespeare', amount: 3 },
  'RL-009': { cardId: 'RL-009', name: "Bottom's Mask", description: 'Reroll lowest axis score', usesPerBattle: 1, type: 'reroll', amount: 0 },

  // V2: New Potions
  'PT-004': { cardId: 'PT-004', name: 'Mandrake Root', description: '+2 Wordplay for one round', usesPerBattle: 2, type: 'boost', axis: 'wordplay', amount: 2 },
  'PT-005': { cardId: 'PT-005', name: "Oberon's Dew", description: '+3 Flow for one round', usesPerBattle: 1, type: 'boost', axis: 'flow', amount: 3 },
  'PT-006': { cardId: 'PT-006', name: 'Hemlock Tincture', description: 'Reduce opponent total by 3', usesPerBattle: 1, type: 'reduce_opponent', amount: 3 },
  'PT-007': { cardId: 'PT-007', name: 'Mistletoe Extract', description: '+2 Shakespeare for one round', usesPerBattle: 2, type: 'boost', axis: 'shakespeare', amount: 2 },
  'PT-008': { cardId: 'PT-008', name: "Mermaid's Tears", description: '+2 to all axes for one round', usesPerBattle: 1, type: 'boost', amount: 2 },
  'PT-009': { cardId: 'PT-009', name: "Apothecary's Elixir", description: '+3 Wit for one round', usesPerBattle: 2, type: 'boost', axis: 'wit', amount: 3 },
};

/** Apply an item effect to battle modifiers */
export function applyItemEffect(itemId: string, mods: BattleModifiers): BattleModifiers {
  const effect = ITEM_EFFECTS[itemId];
  if (!effect) return mods;

  const result = { ...mods };

  if (effect.type === 'boost') {
    if (effect.axis) {
      result[effect.axis] += effect.amount;
    } else {
      // +N to all axes
      result.wordplay += effect.amount;
      result.shakespeare += effect.amount;
      result.flow += effect.amount;
      result.wit += effect.amount;
    }
  }

  return result;
}

// --- Deck Validation ---

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

  if (deck.characters.length < DECK_RULES.minCharacters) {
    errors.push(`Need at least ${DECK_RULES.minCharacters} characters`);
  }
  if (deck.characters.length > DECK_RULES.maxCharacters) {
    errors.push(`Max ${DECK_RULES.maxCharacters} characters`);
  }
  if (deck.relics.length > DECK_RULES.maxRelics) {
    errors.push(`Max ${DECK_RULES.maxRelics} relics`);
  }
  if (deck.potions.length > DECK_RULES.maxPotions) {
    errors.push(`Max ${DECK_RULES.maxPotions} potions`);
  }

  const total = deck.characters.length + deck.relics.length + deck.potions.length;
  if (total > DECK_RULES.totalMax) {
    errors.push(`Max ${DECK_RULES.totalMax} total cards in deck`);
  }

  // Check all cards exist
  for (const id of [...deck.characters, ...deck.relics, ...deck.potions]) {
    if (!getCardById(id)) {
      errors.push(`Unknown card: ${id}`);
    }
  }

  // Check type correctness
  for (const id of deck.characters) {
    const card = getCardById(id);
    if (card && card.type !== 'Character') errors.push(`${card.name} is not a Character`);
  }
  for (const id of deck.relics) {
    const card = getCardById(id);
    if (card && card.type !== 'Relic') errors.push(`${card.name} is not a Relic`);
  }
  for (const id of deck.potions) {
    const card = getCardById(id);
    if (card && card.type !== 'Potion') errors.push(`${card.name} is not a Potion`);
  }

  return { valid: errors.length === 0, errors };
}

/** Calculate total battle modifiers for a deck + active character card */
export function calculateBattleModifiers(deck: Deck, activeCardId: string): BattleModifiers {
  let mods: BattleModifiers = { wordplay: 0, shakespeare: 0, flow: 0, wit: 0 };

  // 1. Character passive ability
  mods = applyPassive(activeCardId, mods);

  // 2. House synergies from full deck
  const synergies = calculateSynergies(deck.characters);
  mods.wordplay += synergies.wordplay;
  mods.shakespeare += synergies.shakespeare;
  mods.flow += synergies.flow;
  mods.wit += synergies.wit;

  return mods;
}

/** Card stat influence — high ATK/DEF grants small bonuses */
export function cardStatModifier(card: Card): BattleModifiers {
  return {
    wordplay: card.atk >= 85 ? 1 : 0,
    shakespeare: card.def >= 85 ? 1 : 0,
    flow: 0,
    wit: card.atk >= 85 ? 1 : 0,
  };
}
