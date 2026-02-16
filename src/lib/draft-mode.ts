/**
 * Draft Mode — Draw from a random pool, snake draft picks, then battle.
 * Each player gets 5 characters + 1 relic + 1 potion.
 */

import { CARD_CATALOG, type Card } from './cards';

export interface DraftPool {
  characters: Card[];
  relics: Card[];
  potions: Card[];
}

export interface DraftState {
  pool: DraftPool;
  playerPicks: Card[];
  opponentPicks: Card[];
  currentPicker: 'player' | 'opponent';
  pickNumber: number;
  phase: 'characters' | 'relics' | 'potions' | 'complete';
}

/** Generate a random draft pool: 12 characters, 4 relics, 4 potions */
export function generateDraftPool(): DraftPool {
  const characters = CARD_CATALOG.filter(c => c.type === 'Character');
  const relics = CARD_CATALOG.filter(c => c.type === 'Relic');
  const potions = CARD_CATALOG.filter(c => c.type === 'Potion');

  return {
    characters: shuffle(characters).slice(0, 12),
    relics: shuffle(relics).slice(0, 4),
    potions: shuffle(potions).slice(0, 4),
  };
}

/** Initialize a new draft state */
export function initDraft(): DraftState {
  return {
    pool: generateDraftPool(),
    playerPicks: [],
    opponentPicks: [],
    currentPicker: 'player', // Player picks first
    pickNumber: 0,
    phase: 'characters',
  };
}

/** Make a pick from the pool. Returns updated state. */
export function makePick(state: DraftState, cardId: string): DraftState {
  const newState = { ...state };
  let card: Card | undefined;

  if (state.phase === 'characters') {
    const idx = newState.pool.characters.findIndex(c => c.id === cardId);
    if (idx === -1) return state;
    card = newState.pool.characters.splice(idx, 1)[0];
  } else if (state.phase === 'relics') {
    const idx = newState.pool.relics.findIndex(c => c.id === cardId);
    if (idx === -1) return state;
    card = newState.pool.relics.splice(idx, 1)[0];
  } else if (state.phase === 'potions') {
    const idx = newState.pool.potions.findIndex(c => c.id === cardId);
    if (idx === -1) return state;
    card = newState.pool.potions.splice(idx, 1)[0];
  }

  if (!card) return state;

  if (newState.currentPicker === 'player') {
    newState.playerPicks.push(card);
  } else {
    newState.opponentPicks.push(card);
  }

  newState.pickNumber++;

  // Snake draft: alternating picks (1-2-2-1-2-2-...)
  const pickInPhase = newState.pickNumber;
  if (pickInPhase % 2 === 0) {
    newState.currentPicker = newState.currentPicker === 'player' ? 'opponent' : 'player';
  }

  // Phase transitions
  const playerChars = newState.playerPicks.filter(c => c.type === 'Character').length;
  const opponentChars = newState.opponentPicks.filter(c => c.type === 'Character').length;

  if (newState.phase === 'characters' && playerChars >= 5 && opponentChars >= 5) {
    newState.phase = 'relics';
    newState.pickNumber = 0;
    newState.currentPicker = 'player';
  } else if (newState.phase === 'relics') {
    const playerRelics = newState.playerPicks.filter(c => c.type === 'Relic').length;
    const opponentRelics = newState.opponentPicks.filter(c => c.type === 'Relic').length;
    if (playerRelics >= 1 && opponentRelics >= 1) {
      newState.phase = 'potions';
      newState.pickNumber = 0;
      newState.currentPicker = 'player';
    }
  } else if (newState.phase === 'potions') {
    const playerPotions = newState.playerPicks.filter(c => c.type === 'Potion').length;
    const opponentPotions = newState.opponentPicks.filter(c => c.type === 'Potion').length;
    if (playerPotions >= 1 && opponentPotions >= 1) {
      newState.phase = 'complete';
    }
  }

  return newState;
}

/** AI auto-pick: selects the highest ATK character available, or random relic/potion */
export function aiPick(state: DraftState): DraftState {
  let pool: Card[];
  if (state.phase === 'characters') pool = state.pool.characters;
  else if (state.phase === 'relics') pool = state.pool.relics;
  else if (state.phase === 'potions') pool = state.pool.potions;
  else return state;

  if (pool.length === 0) return state;

  // Pick highest ATK for characters, random for items
  const pick = state.phase === 'characters'
    ? pool.reduce((best, c) => (c.atk > best.atk ? c : best), pool[0])
    : pool[Math.floor(Math.random() * pool.length)];

  return makePick(state, pick.id);
}

/** Fisher-Yates shuffle */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
