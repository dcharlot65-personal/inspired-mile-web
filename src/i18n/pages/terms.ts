/**
 * The words that card and world-card data is shown under, in the interface
 * language: houses, elements, types, cities, regions, abilities, achievements.
 *
 * The data itself (src/lib/cards.ts, variants.ts, achievements.ts) keeps its
 * English identifiers; these functions turn an identifier into text. Each
 * needs its area loaded first (see ./runtime.ts): 'card-terms', 'variants' or
 * 'achievements'. A value with no message falls back to the identifier, so a
 * card added without a translation shows its English word rather than a key.
 *
 * Card names, quotations and scene texts are not here: they come from the card
 * data layer as they are.
 */
import { has, t } from '../index';
import { criterionName } from '../duel';
import type { Achievement, AchievementTier } from '../../lib/achievements';
import type { CardType, Rarity } from '../../lib/cards';
import { CITY_CATALOG, type VariantAcquisitionSource, type WorldCity } from '../../lib/variants';
import { num, tn } from './runtime';

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const orElse = (key: string, fallback: string) => (has(key) ? t(key) : fallback);

export function houseName(house: string): string {
  return orElse(`card-terms.house.${slug(house)}`, house);
}

export function elementName(element: string): string {
  return orElse(`card-terms.element.${slug(element)}`, element);
}

export function typeName(type: CardType): string {
  return orElse(`card-terms.type.${type.toLowerCase()}`, type);
}

/** The plural, for a heading or a filter ("Characters"). */
export function typesName(type: CardType): string {
  return orElse(`card-terms.types.${type.toLowerCase()}`, type);
}

export function rarityName(rarity: Rarity | string): string {
  return orElse(`rarity.${rarity.toLowerCase()}`, rarity);
}

export function statLabel(stat: 'atk' | 'def' | 'hp'): string {
  return t(`card-terms.stat.${stat}`);
}

export function cityName(city: WorldCity): string {
  return orElse(`variants.city.${CITY_CATALOG[city].code}`, city);
}

/**
 * The catalog's regions as UN M.49 codes. Their names are CLDR's territory names, kept in the
 * 'variants' area (variants.region.<code>) rather than asked of Intl.DisplayNames at run time:
 * Chromium's trimmed ICU data has no names for sub-regions and answers "011" for Western Africa.
 * Eurasia has no code; its name is a Wikidata label.
 */
const REGION_CODE: Record<string, string> = {
  Asia: '142',
  Europe: '150',
  Oceania: '009',
  Caribbean: '029',
  'North America': '003',
  'Central America': '013',
  'South America': '005',
  'West Africa': '011',
  'East Africa': '014',
  'North Africa': '015',
  'Southern Africa': '018',
  'East Asia': '030',
  'South Asia': '034',
  'Southeast Asia': '035',
  Eurasia: 'eurasia',
};

export function cityRegion(city: WorldCity): string {
  const region = CITY_CATALOG[city].region;
  return orElse(`variants.region.${REGION_CODE[region]}`, region);
}

export function abilityName(city: WorldCity): string {
  return orElse(`variants.ability.${CITY_CATALOG[city].code}.name`, CITY_CATALOG[city].ability.name);
}

/** What the city is known for, which is why it lends the bonus. */
export function abilityWhy(city: WorldCity): string {
  return orElse(`variants.ability.${CITY_CATALOG[city].code}.why`, CITY_CATALOG[city].ability.description);
}

/** "+2 wordplay", in the words the duel's verdict uses for the judge's criteria. */
export function abilityBonus(city: WorldCity): string {
  const { bonus, axis } = CITY_CATALOG[city].ability;
  return t('variant.bonus', { n: num(bonus), criterion: criterionName(axis) });
}

export function sourceName(source: VariantAcquisitionSource | string): string {
  return orElse(`variants.source.${source}`, source.replace(/-/g, ' '));
}

export function tierName(tier: AchievementTier | string): string {
  return orElse(`achievements.tier.${tier}`, tier);
}

export function achievementName(a: Pick<Achievement, 'id' | 'name'>): string {
  return orElse(`achievements.${a.id}.name`, a.name);
}

export function achievementDescription(a: Pick<Achievement, 'id' | 'description' | 'goal'>): string {
  const key = `achievements.${a.id}.description`;
  return has(key) ? tn(key, a.goal === undefined ? {} : { n: a.goal }) : a.description;
}

/**
 * Fill markup that names a piece of card data: data-term-house="Montague",
 * -element, -rarity, -type, -types (plural), -city. Pages built ahead of time
 * carry the English word and this attribute; the script calls this once the
 * areas are loaded and again when the language changes.
 */
export function applyTerms(root: ParentNode = document): void {
  const each = (attr: string, name: (value: string) => string) =>
    root.querySelectorAll<HTMLElement>(`[data-term-${attr}]`).forEach((el) => {
      el.textContent = name(el.getAttribute(`data-term-${attr}`)!);
    });
  each('house', houseName);
  each('element', elementName);
  each('rarity', rarityName);
  each('type', (v) => typeName(v as CardType));
  each('types', (v) => typesName(v as CardType));
  each('city', (v) => (v in CITY_CATALOG ? cityName(v as WorldCity) : v));
}
