/**
 * Generate the full variant catalog JSON.
 *
 * Run: npx tsx scripts/generate-variant-catalog.ts
 *
 * Outputs: src/data/variant-catalog.json
 * - "hero" variants: 18 chars × 12 cities = 216 (canonical combos with art)
 * - Full catalog stats printed to console
 */

import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { CARD_CATALOG } from '../src/lib/cards';
import {
  CITY_CATALOG,
  SKIN_TONES,
  type WorldCity,
  type CardVariant,
  buildVariant,
  buildHeroVariant,
  getCharacterCards,
  getAllCities,
} from '../src/lib/variants';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUTPUT_PATH = resolve(__dirname, '../src/data/variant-catalog.json');

// ---------------------------------------------------------------------------
// Generate hero variants (one canonical combo per character per city)
// ---------------------------------------------------------------------------

const characters = getCharacterCards();
const cities = getAllCities();

console.log(`Characters: ${characters.length}`);
console.log(`Cities: ${cities.length}`);
console.log(`Hero variants: ${characters.length * cities.length}`);

const heroVariants: CardVariant[] = [];

for (const card of characters) {
  for (const city of cities) {
    heroVariants.push(buildHeroVariant(card, city));
  }
}

// ---------------------------------------------------------------------------
// Calculate full combinatorial stats
// ---------------------------------------------------------------------------

let totalCombinations = 0;
for (const city of cities) {
  const config = CITY_CATALOG[city];
  const combosPerCity = config.attireOptions.length * config.hairstyleOptions.length * SKIN_TONES.length;
  totalCombinations += characters.length * combosPerCity;
}

console.log(`\nFull combinatorial space: ${totalCombinations.toLocaleString()} variants`);
console.log(`Hero set (with art): ${heroVariants.length}`);

// ---------------------------------------------------------------------------
// Write output
// ---------------------------------------------------------------------------

const catalog = {
  version: '2.0',
  generatedAt: new Date().toISOString(),
  stats: {
    characters: characters.length,
    cities: cities.length,
    heroVariants: heroVariants.length,
    totalCombinations,
  },
  cities: Object.fromEntries(
    cities.map(city => [city, {
      code: CITY_CATALOG[city].code,
      region: CITY_CATALOG[city].region,
      ability: CITY_CATALOG[city].ability,
      attireOptions: CITY_CATALOG[city].attireOptions,
      hairstyleOptions: CITY_CATALOG[city].hairstyleOptions,
    }])
  ),
  heroVariants,
};

writeFileSync(OUTPUT_PATH, JSON.stringify(catalog, null, 2));
console.log(`\nWritten to: ${OUTPUT_PATH}`);
console.log(`File size: ~${(JSON.stringify(catalog).length / 1024).toFixed(0)} KB`);
