/**
 * Deck Manager — persistent deck storage and selection via localStorage.
 */

import type { Deck } from './battle-rules';
import { validateDeck } from './battle-rules';
import { getOwnedCardIds } from './inventory';

const DECK_STORAGE_KEY = 'inspired-mile-decks';
const ACTIVE_DECK_KEY = 'inspired-mile-active-deck';

export function getSavedDecks(): Deck[] {
  try {
    const raw = localStorage.getItem(DECK_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveDeck(deck: Deck): { success: boolean; errors: string[] } {
  const validation = validateDeck(deck);
  if (!validation.valid) return { success: false, errors: validation.errors };

  // Check all cards are owned
  const owned = getOwnedCardIds();
  const allCards = [...deck.characters, ...deck.relics, ...deck.potions];
  const unowned = allCards.filter(id => !owned.has(id));
  if (unowned.length > 0) {
    return { success: false, errors: [`You don't own: ${unowned.join(', ')}`] };
  }

  const decks = getSavedDecks();
  const idx = decks.findIndex(d => d.name === deck.name);
  if (idx >= 0) {
    decks[idx] = deck;
  } else {
    decks.push(deck);
  }

  localStorage.setItem(DECK_STORAGE_KEY, JSON.stringify(decks));
  return { success: true, errors: [] };
}

export function deleteDeck(name: string): void {
  const decks = getSavedDecks().filter(d => d.name !== name);
  localStorage.setItem(DECK_STORAGE_KEY, JSON.stringify(decks));

  // Clear active if deleted
  if (getActiveDeckName() === name) {
    localStorage.removeItem(ACTIVE_DECK_KEY);
  }
}

export function getActiveDeckName(): string | null {
  return localStorage.getItem(ACTIVE_DECK_KEY);
}

export function getActiveDeck(): Deck | null {
  const name = getActiveDeckName();
  if (!name) return null;
  return getSavedDecks().find(d => d.name === name) ?? null;
}

export function setActiveDeck(name: string): void {
  const deck = getSavedDecks().find(d => d.name === name);
  if (deck) {
    localStorage.setItem(ACTIVE_DECK_KEY, name);
  }
}

export function clearActiveDeck(): void {
  localStorage.removeItem(ACTIVE_DECK_KEY);
}
