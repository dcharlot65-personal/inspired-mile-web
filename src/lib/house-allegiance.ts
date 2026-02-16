/**
 * House Allegiance — Choose and represent a Shakespeare house.
 * Provides passive bonuses and weekly leaderboard participation.
 */

import type { House } from './cards';

export type AllegianceHouse = 'Montague' | 'Capulet' | 'Danish Court' | 'Forest of Arden' | 'Verona Court' | 'The Tempest' | 'Scottish Court' | 'Illyria' | 'Rome';

export interface HouseInfo {
  name: AllegianceHouse;
  motto: string;
  bonusAxis: string;
  bonusAmount: number;
  color: string;
  icon: string;
}

export const HOUSES: HouseInfo[] = [
  { name: 'Montague', motto: 'Love conquers all', bonusAxis: 'Flow', bonusAmount: 1, color: 'from-blue-500 to-blue-700', icon: '\u2694\uFE0F' },
  { name: 'Capulet', motto: 'Honor above all', bonusAxis: 'Wordplay', bonusAmount: 1, color: 'from-red-500 to-red-700', icon: '\uD83D\uDDE1\uFE0F' },
  { name: 'Danish Court', motto: 'To thine own self be true', bonusAxis: 'Depth', bonusAmount: 1, color: 'from-indigo-500 to-indigo-700', icon: '\uD83D\uDC51' },
  { name: 'Forest of Arden', motto: 'All the world\'s a stage', bonusAxis: 'Creativity', bonusAmount: 1, color: 'from-emerald-500 to-emerald-700', icon: '\uD83C\uDF3F' },
  { name: 'Verona Court', motto: 'Justice tempered with mercy', bonusAxis: 'Wit', bonusAmount: 1, color: 'from-amber-500 to-amber-700', icon: '\u2696\uFE0F' },
  { name: 'The Tempest', motto: 'We are such stuff as dreams', bonusAxis: 'Flow', bonusAmount: 1, color: 'from-cyan-500 to-cyan-700', icon: '\u26A1' },
  { name: 'Scottish Court', motto: 'By the pricking of my thumbs', bonusAxis: 'Wit', bonusAmount: 2, color: 'from-purple-500 to-purple-700', icon: '\uD83D\uDD2E' },
  { name: 'Illyria', motto: 'If music be the food of love', bonusAxis: 'Flow', bonusAmount: 2, color: 'from-pink-500 to-pink-700', icon: '\uD83C\uDFB6' },
  { name: 'Rome', motto: 'The fault is not in our stars', bonusAxis: 'Wordplay', bonusAmount: 2, color: 'from-yellow-500 to-yellow-700', icon: '\uD83C\uDFDB\uFE0F' },
];

const STORAGE_KEY = 'inspired-mile-house';

/** Get the player's chosen house */
export function getHouseAllegiance(): AllegianceHouse | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY) as AllegianceHouse | null;
}

/** Set the player's house allegiance (one-time choice) */
export function setHouseAllegiance(house: AllegianceHouse): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, house);

  window.dispatchEvent(new CustomEvent('house-chosen', { detail: { house } }));
}

/** Get house info by name */
export function getHouseInfo(house: AllegianceHouse): HouseInfo | undefined {
  return HOUSES.find(h => h.name === house);
}

/** Check if player has chosen a house */
export function hasChosenHouse(): boolean {
  return getHouseAllegiance() !== null;
}

/** Get the bonus for the player's house */
export function getHouseBonus(): { axis: string; amount: number } | null {
  const house = getHouseAllegiance();
  if (!house) return null;
  const info = getHouseInfo(house);
  if (!info) return null;
  return { axis: info.bonusAxis, amount: info.bonusAmount };
}
