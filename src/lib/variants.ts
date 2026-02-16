/**
 * World Card Variant System — Shakespeare characters travel through time and global cities.
 *
 * Each variant is a cosmetic skin for a base card that changes visual appearance
 * and grants a passive city ability in battle. Variants are defined by 4 axes:
 * City, Attire, Hairstyle, and Skin Tone.
 *
 * Only Character cards get variants — Relics and Potions do not.
 * Combinatorial space: chars × 20 cities × 4 attires × 4 hairstyles × 6 tones
 */

import type { Card } from './cards';
import { CARD_CATALOG } from './cards';
import type { BattleAxis } from './battle-rules';
export type { BattleAxis };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WorldCity =
  | 'Tokyo' | 'Lagos' | 'Brooklyn' | 'London'
  | 'Mumbai' | 'Paris' | 'Sao Paulo' | 'Seoul'
  | 'Nairobi' | 'Berlin' | 'Mexico City' | 'Cairo'
  | 'Accra' | 'Johannesburg' | 'Manila' | 'Istanbul'
  | 'Toronto' | 'Sydney' | 'Osaka' | 'Kingston';

export type SkinTone = 'light' | 'light-medium' | 'medium' | 'medium-dark' | 'dark' | 'deep';

export type VariantAcquisitionSource =
  | 'city-quest'
  | 'battle-streak'
  | 'trivia-mastery'
  | 'daily-travel'
  | 'event';

export interface CityAbility {
  city: WorldCity;
  axis: BattleAxis;
  bonus: number;
  name: string;
  description: string;
}

export interface CityConfig {
  code: string;
  region: string;
  ability: CityAbility;
  attireOptions: string[];
  hairstyleOptions: string[];
  scenePrefix: string;
}

export interface CardVariant {
  variantId: string;
  baseCardId: string;
  city: WorldCity;
  attire: string;
  hairstyle: string;
  skinTone: SkinTone;
  ability: CityAbility;
  scene: string;
  image?: string;
}

export interface OwnedVariant {
  variantId: string;
  baseCardId: string;
  acquiredAt: number;
  source: VariantAcquisitionSource;
}

// ---------------------------------------------------------------------------
// Skin Tones
// ---------------------------------------------------------------------------

export const SKIN_TONES: { id: SkinTone; label: string; prompt: string }[] = [
  { id: 'light', label: 'Light', prompt: 'light skin tone' },
  { id: 'light-medium', label: 'Light Medium', prompt: 'light-medium skin tone' },
  { id: 'medium', label: 'Medium', prompt: 'medium skin tone' },
  { id: 'medium-dark', label: 'Medium Dark', prompt: 'medium-dark skin tone' },
  { id: 'dark', label: 'Dark', prompt: 'dark skin tone' },
  { id: 'deep', label: 'Deep', prompt: 'deep dark skin tone' },
];

// ---------------------------------------------------------------------------
// City Catalog — 12 Global Hip-Hop/Culture Hubs
// ---------------------------------------------------------------------------

export const CITY_CATALOG: Record<WorldCity, CityConfig> = {
  Tokyo: {
    code: 'TKY',
    region: 'Asia',
    ability: {
      city: 'Tokyo',
      axis: 'wordplay',
      bonus: 2,
      name: 'Neon Precision',
      description: 'Tokyo\'s precision culture: +2 Wordplay',
    },
    attireOptions: ['streetwear', 'techwear', 'harajuku', 'formal-kimono'],
    hairstyleOptions: ['top-knot', 'visual-kei', 'buzzcut', 'flowing'],
    scenePrefix: 'Neon-lit Shibuya crossing at night, towering LED screens, rain-slicked streets.',
  },

  Lagos: {
    code: 'LGS',
    region: 'West Africa',
    ability: {
      city: 'Lagos',
      axis: 'flow',
      bonus: 2,
      name: 'Afrobeat Flow',
      description: 'Lagos Afrobeats rhythm: +2 Flow',
    },
    attireOptions: ['afro-punk', 'agbada-modern', 'ankara-streetwear', 'lagos-tech'],
    hairstyleOptions: ['natural-afro', 'braids', 'faded', 'locs'],
    scenePrefix: 'Vibrant Lagos market street at golden hour, colorful murals, bustling energy.',
  },

  Brooklyn: {
    code: 'BKN',
    region: 'North America',
    ability: {
      city: 'Brooklyn',
      axis: 'wit',
      bonus: 2,
      name: 'Borough Boss',
      description: 'NYC roast culture, battle rap birthplace: +2 Wit',
    },
    attireOptions: ['hip-hop-classic', 'brooklyn-streetwear', 'fitted-cap-era', 'artsy-williamsburg'],
    hairstyleOptions: ['high-top-fade', 'cornrows', 'caesar', 'freeform-locs'],
    scenePrefix: 'Brooklyn rooftop at sunset, Manhattan skyline behind, graffiti-covered water towers.',
  },

  London: {
    code: 'LDN',
    region: 'Europe',
    ability: {
      city: 'London',
      axis: 'shakespeare',
      bonus: 2,
      name: "Bard's Home Turf",
      description: 'Home of Shakespeare: +2 Shakespeare',
    },
    attireOptions: ['grime-streetwear', 'savile-row-modern', 'punk-heritage', 'tracksuit-uk'],
    hairstyleOptions: ['skin-fade', 'textured-crop', 'dreadlocks', 'slicked-back'],
    scenePrefix: 'Moody London alley near the Globe Theatre, fog and neon, brick and steel.',
  },

  Mumbai: {
    code: 'MUM',
    region: 'South Asia',
    ability: {
      city: 'Mumbai',
      axis: 'flow',
      bonus: 2,
      name: 'Bollywood Rhythm',
      description: 'Mumbai\'s poetic traditions: +2 Flow',
    },
    attireOptions: ['gully-streetwear', 'kurta-modern', 'bollywood-glam', 'mumbai-tech'],
    hairstyleOptions: ['undercut', 'wavy-medium', 'buzz-pattern', 'long-flowing'],
    scenePrefix: 'Neon-lit Mumbai street at night, auto-rickshaws, Dharavi art meets Bollywood glamour.',
  },

  Paris: {
    code: 'PAR',
    region: 'Europe',
    ability: {
      city: 'Paris',
      axis: 'wordplay',
      bonus: 2,
      name: 'Haute Verse',
      description: 'French literary tradition: +2 Wordplay',
    },
    attireOptions: ['haute-streetwear', 'parisian-chic', 'banlieue-style', 'avant-garde'],
    hairstyleOptions: ['french-crop', 'messy-curls', 'shaved-sides', 'afro-parisian'],
    scenePrefix: 'Parisian rooftop overlooking the Eiffel Tower at dusk, street art and high fashion.',
  },

  'Sao Paulo': {
    code: 'SAO',
    region: 'South America',
    ability: {
      city: 'Sao Paulo',
      axis: 'wit',
      bonus: 2,
      name: 'Favela Fire',
      description: 'Brazilian humor and improv: +2 Wit',
    },
    attireOptions: ['favela-streetwear', 'carnival-inspired', 'brazilian-skate', 'tropical-formal'],
    hairstyleOptions: ['tight-curls', 'mohawk', 'braided-back', 'natural-volume'],
    scenePrefix: 'Sao Paulo street corner, vivid graffiti murals, tropical trees meeting concrete.',
  },

  Seoul: {
    code: 'SEO',
    region: 'East Asia',
    ability: {
      city: 'Seoul',
      axis: 'flow',
      bonus: 2,
      name: 'K-Wave Cadence',
      description: 'K-pop precision and rap scene: +2 Flow',
    },
    attireOptions: ['k-streetwear', 'idol-stage', 'hanbok-modern', 'seoul-techwear'],
    hairstyleOptions: ['two-block', 'dyed-platinum', 'comma-hair', 'mullet-modern'],
    scenePrefix: 'Neon Seoul district at night, K-pop billboards, cherry blossoms meet cyberpunk.',
  },

  Nairobi: {
    code: 'NRB',
    region: 'East Africa',
    ability: {
      city: 'Nairobi',
      axis: 'shakespeare',
      bonus: 2,
      name: "Storyteller's Gift",
      description: 'East African oral storytelling tradition: +2 Shakespeare',
    },
    attireOptions: ['nairobi-streetwear', 'maasai-modern', 'afro-futurism', 'safari-chic'],
    hairstyleOptions: ['short-natural', 'bantu-knots', 'sisterlocks', 'tapered-fade'],
    scenePrefix: 'Nairobi skyline at golden hour, acacia trees, modern glass towers meet red earth.',
  },

  Berlin: {
    code: 'BER',
    region: 'Europe',
    ability: {
      city: 'Berlin',
      axis: 'wit',
      bonus: 2,
      name: 'Cabaret Edge',
      description: 'Berlin cabaret tradition and dry humor: +2 Wit',
    },
    attireOptions: ['techno-streetwear', 'brutalist-fashion', 'berlin-punk', 'minimalist-german'],
    hairstyleOptions: ['industrial-buzz', 'asymmetric-cut', 'bleached-spikes', 'long-straight'],
    scenePrefix: 'Berlin warehouse district, industrial art, concrete and neon, the Wall in the background.',
  },

  'Mexico City': {
    code: 'MEX',
    region: 'Central America',
    ability: {
      city: 'Mexico City',
      axis: 'wordplay',
      bonus: 2,
      name: 'Corrido Craft',
      description: 'Mexican poetic tradition: +2 Wordplay',
    },
    attireOptions: ['cdmx-streetwear', 'lucha-inspired', 'charro-modern', 'muralism-fashion'],
    hairstyleOptions: ['slicked-pompadour', 'curly-fringe', 'shaved-design', 'long-braided'],
    scenePrefix: 'Mexico City zocalo at twilight, Day of the Dead murals, colonial meets modern.',
  },

  Cairo: {
    code: 'CAI',
    region: 'North Africa',
    ability: {
      city: 'Cairo',
      axis: 'shakespeare',
      bonus: 2,
      name: "Scribe's Wisdom",
      description: 'Ancient literary tradition: +2 Shakespeare',
    },
    attireOptions: ['cairo-streetwear', 'pharaonic-modern', 'desert-tech', 'arabic-formal'],
    hairstyleOptions: ['close-crop', 'textured-waves', 'headwrap-style', 'natural-thick'],
    scenePrefix: 'Cairo at dusk, pyramids in the distance, bustling modern streets, golden sand tones.',
  },

  Accra: {
    code: 'ACC',
    region: 'West Africa',
    ability: {
      city: 'Accra',
      axis: 'wit',
      bonus: 2,
      name: 'Highlife Humor',
      description: 'Ghanaian highlife and sharp wit: +2 Wit',
    },
    attireOptions: ['kente-streetwear', 'accra-urban', 'afro-modern', 'gold-coast-chic'],
    hairstyleOptions: ['flat-top', 'twisted-locs', 'shape-up', 'natural-curls'],
    scenePrefix: 'Accra beachfront at sunset, colorful fishing boats, vibrant market stalls, palm trees.',
  },

  Johannesburg: {
    code: 'JHB',
    region: 'Southern Africa',
    ability: {
      city: 'Johannesburg',
      axis: 'wordplay',
      bonus: 2,
      name: 'Jozi Bars',
      description: 'Johannesburg rap scene intensity: +2 Wordplay',
    },
    attireOptions: ['jozi-streetwear', 'madiba-modern', 'soweto-chic', 'gold-rush-style'],
    hairstyleOptions: ['high-fade', 'box-braids', 'clean-shave', 'afro-pick'],
    scenePrefix: 'Johannesburg skyline, mining headgear silhouettes, vibrant Maboneng street art.',
  },

  Manila: {
    code: 'MNL',
    region: 'Southeast Asia',
    ability: {
      city: 'Manila',
      axis: 'flow',
      bonus: 2,
      name: 'FlipTop Flow',
      description: 'Filipino rap battle culture: +2 Flow',
    },
    attireOptions: ['manila-streetwear', 'barong-modern', 'jeepney-punk', 'pacific-island'],
    hairstyleOptions: ['undercut-textured', 'slicked-side', 'crew-cut', 'long-layered'],
    scenePrefix: 'Manila at night, neon jeepneys, street vendors, colonial architecture meets urban grit.',
  },

  Istanbul: {
    code: 'IST',
    region: 'Eurasia',
    ability: {
      city: 'Istanbul',
      axis: 'shakespeare',
      bonus: 2,
      name: 'Crossroads Verse',
      description: 'Where East meets West in poetry: +2 Shakespeare',
    },
    attireOptions: ['istanbul-streetwear', 'ottoman-modern', 'bazaar-chic', 'bosphorus-formal'],
    hairstyleOptions: ['tapered-sides', 'curly-medium', 'swept-back', 'textured-fringe'],
    scenePrefix: 'Istanbul at golden hour, minarets and modern skyline, the Bosphorus glittering below.',
  },

  Toronto: {
    code: 'TOR',
    region: 'North America',
    ability: {
      city: 'Toronto',
      axis: 'flow',
      bonus: 2,
      name: 'Six Flow',
      description: 'Toronto hip-hop dynasty: +2 Flow',
    },
    attireOptions: ['toronto-streetwear', 'six-varsity', 'canadian-techwear', 'multicultural-blend'],
    hairstyleOptions: ['line-up', 'curly-top', 'braided-crown', 'buzz-fade'],
    scenePrefix: 'Toronto CN Tower at twilight, Drake-era vibes, snow-dusted streets meet urban heat.',
  },

  Sydney: {
    code: 'SYD',
    region: 'Oceania',
    ability: {
      city: 'Sydney',
      axis: 'wit',
      bonus: 2,
      name: 'Harbour Hustle',
      description: 'Australian irreverent humor: +2 Wit',
    },
    attireOptions: ['sydney-streetwear', 'surf-urban', 'outback-modern', 'harbour-formal'],
    hairstyleOptions: ['beach-waves', 'undercut-long', 'cropped-natural', 'bleached-tips'],
    scenePrefix: 'Sydney Opera House at dusk, harbour bridge lights, street art laneways, coastal energy.',
  },

  Osaka: {
    code: 'OSA',
    region: 'Asia',
    ability: {
      city: 'Osaka',
      axis: 'wit',
      bonus: 2,
      name: 'Kansai Comedy',
      description: 'Osaka comedy tradition and wordplay: +2 Wit',
    },
    attireOptions: ['osaka-streetwear', 'dotonbori-neon', 'kansai-casual', 'takoyaki-punk'],
    hairstyleOptions: ['wolf-cut', 'dyed-accent', 'messy-natural', 'shaggy-layers'],
    scenePrefix: 'Osaka Dotonbori at night, giant neon signs, bustling food stalls, river reflections.',
  },

  Kingston: {
    code: 'KGN',
    region: 'Caribbean',
    ability: {
      city: 'Kingston',
      axis: 'flow',
      bonus: 2,
      name: 'Dancehall Rhythm',
      description: 'Jamaican dancehall and dub poetry: +2 Flow',
    },
    attireOptions: ['kingston-streetwear', 'rasta-modern', 'dancehall-glam', 'caribbean-casual'],
    hairstyleOptions: ['dreadlocks', 'finger-coils', 'temple-fade', 'free-form-natural'],
    scenePrefix: 'Kingston waterfront, Blue Mountains in the background, sound system speakers, tropical colors.',
  },
};

// ---------------------------------------------------------------------------
// Variant ID Encoding / Decoding
// ---------------------------------------------------------------------------

/**
 * Build a variant ID from components.
 * Format: {baseCardId}-{cityCode}-{attireIdx}-{hairIdx}-{toneIdx}
 * Example: MO-001-TKY-00-01-02
 */
export function encodeVariantId(
  baseCardId: string,
  city: WorldCity,
  attireIdx: number,
  hairIdx: number,
  toneIdx: number,
): string {
  const cityCode = CITY_CATALOG[city].code;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${baseCardId}-${cityCode}-${pad(attireIdx)}-${pad(hairIdx)}-${pad(toneIdx)}`;
}

/**
 * Decode a variant ID into its components.
 */
export function decodeVariantId(variantId: string): {
  baseCardId: string;
  cityCode: string;
  attireIdx: number;
  hairIdx: number;
  toneIdx: number;
} | null {
  // Format: XX-NNN-CCC-AA-HH-TT  (e.g., MO-001-TKY-00-01-02)
  const match = variantId.match(/^([A-Z]{2}-\d{3})-([A-Z]{3})-(\d{2})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return {
    baseCardId: match[1],
    cityCode: match[2],
    attireIdx: parseInt(match[3], 10),
    hairIdx: parseInt(match[4], 10),
    toneIdx: parseInt(match[5], 10),
  };
}

/**
 * Look up the city by its 3-letter code.
 */
export function getCityByCode(code: string): WorldCity | null {
  for (const [city, config] of Object.entries(CITY_CATALOG)) {
    if (config.code === code) return city as WorldCity;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Variant Generation
// ---------------------------------------------------------------------------

/**
 * Build a single CardVariant from its components.
 */
export function buildVariant(
  baseCard: Card,
  city: WorldCity,
  attireIdx: number,
  hairIdx: number,
  toneIdx: number,
): CardVariant {
  const config = CITY_CATALOG[city];
  const attire = config.attireOptions[attireIdx] || config.attireOptions[0];
  const hairstyle = config.hairstyleOptions[hairIdx] || config.hairstyleOptions[0];
  const tone = SKIN_TONES[toneIdx] || SKIN_TONES[2]; // default medium

  const variantId = encodeVariantId(baseCard.id, city, attireIdx, hairIdx, toneIdx);

  const scene = [
    config.scenePrefix,
    `${baseCard.name} from Shakespeare, reimagined in modern hip-hop style.`,
    `Wearing ${attire.replace(/-/g, ' ')} clothing, ${hairstyle.replace(/-/g, ' ')} hairstyle, ${tone.prompt}.`,
    'Collectible card game art, dramatic lighting, detailed character portrait.',
  ].join(' ');

  return {
    variantId,
    baseCardId: baseCard.id,
    city,
    attire,
    hairstyle,
    skinTone: tone.id,
    ability: config.ability,
    scene,
    image: `/images/variants/${variantId}.webp`,
  };
}

/**
 * Build the "hero" variant for a character in a given city.
 * Uses the first attire, first hairstyle, and medium skin tone as defaults.
 */
export function buildHeroVariant(baseCard: Card, city: WorldCity): CardVariant {
  return buildVariant(baseCard, city, 0, 0, 2); // attire[0], hair[0], medium tone
}

/**
 * Get all Character cards from the catalog (the 18 that get variants).
 */
export function getCharacterCards(): Card[] {
  return CARD_CATALOG.filter(c => c.type === 'Character');
}

/**
 * Get all cities as an array.
 */
export function getAllCities(): WorldCity[] {
  return Object.keys(CITY_CATALOG) as WorldCity[];
}

/**
 * Generate all hero variants (18 chars × 12 cities = 216).
 */
export function generateHeroVariants(): CardVariant[] {
  const characters = getCharacterCards();
  const cities = getAllCities();
  const variants: CardVariant[] = [];

  for (const card of characters) {
    for (const city of cities) {
      variants.push(buildHeroVariant(card, city));
    }
  }

  return variants;
}

/**
 * Generate ALL possible variants for a single character.
 */
export function generateAllVariantsForCard(baseCard: Card): CardVariant[] {
  const cities = getAllCities();
  const variants: CardVariant[] = [];

  for (const city of cities) {
    const config = CITY_CATALOG[city];
    for (let a = 0; a < config.attireOptions.length; a++) {
      for (let h = 0; h < config.hairstyleOptions.length; h++) {
        for (let t = 0; t < SKIN_TONES.length; t++) {
          variants.push(buildVariant(baseCard, city, a, h, t));
        }
      }
    }
  }

  return variants;
}

// ---------------------------------------------------------------------------
// Variant Inventory (localStorage)
// ---------------------------------------------------------------------------

const VARIANT_STORAGE_KEY = 'inspired-mile-variants';

function getVariantInventory(): OwnedVariant[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(VARIANT_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveVariantInventory(variants: OwnedVariant[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(VARIANT_STORAGE_KEY, JSON.stringify(variants));
  } catch { /* quota exceeded */ }
}

/**
 * Add a variant to the player's collection.
 * Returns false if already owned (no duplicates for variants).
 */
export function unlockVariant(
  variantId: string,
  baseCardId: string,
  source: VariantAcquisitionSource,
): boolean {
  const inventory = getVariantInventory();
  if (inventory.some(v => v.variantId === variantId)) return false;

  inventory.push({
    variantId,
    baseCardId,
    acquiredAt: Date.now(),
    source,
  });
  saveVariantInventory(inventory);
  return true;
}

/**
 * Check if a specific variant is owned.
 */
export function hasVariant(variantId: string): boolean {
  return getVariantInventory().some(v => v.variantId === variantId);
}

/**
 * Get all owned variants.
 */
export function getOwnedVariants(): OwnedVariant[] {
  return getVariantInventory();
}

/**
 * Get owned variants for a specific base card.
 */
export function getVariantsForCard(baseCardId: string): OwnedVariant[] {
  return getVariantInventory().filter(v => v.baseCardId === baseCardId);
}

/**
 * Get unique cities the player has variants from.
 */
export function getUnlockedCities(): Set<WorldCity> {
  const variants = getVariantInventory();
  const cities = new Set<WorldCity>();
  for (const v of variants) {
    const decoded = decodeVariantId(v.variantId);
    if (decoded) {
      const city = getCityByCode(decoded.cityCode);
      if (city) cities.add(city);
    }
  }
  return cities;
}

/**
 * Get count of owned variants.
 */
export function getVariantCount(): number {
  return getVariantInventory().length;
}

/**
 * Award a random variant to the player for a specific city.
 * Picks a random owned character card and grants a random combo.
 * Returns the unlocked variant or null if none available.
 */
export function awardRandomVariant(
  ownedCardIds: Set<string>,
  source: VariantAcquisitionSource,
  preferredCity?: WorldCity,
): CardVariant | null {
  // Get character cards the player owns
  const ownedChars = CARD_CATALOG.filter(c => c.type === 'Character' && ownedCardIds.has(c.id));
  if (ownedChars.length === 0) return null;

  const cities = preferredCity ? [preferredCity] : getAllCities();
  const owned = getVariantInventory();
  const ownedSet = new Set(owned.map(v => v.variantId));

  // Try to find an unowned variant (up to 50 random attempts)
  for (let attempt = 0; attempt < 50; attempt++) {
    const card = ownedChars[Math.floor(Math.random() * ownedChars.length)];
    const city = cities[Math.floor(Math.random() * cities.length)];
    const config = CITY_CATALOG[city];
    const a = Math.floor(Math.random() * config.attireOptions.length);
    const h = Math.floor(Math.random() * config.hairstyleOptions.length);
    const t = Math.floor(Math.random() * SKIN_TONES.length);
    const variant = buildVariant(card, city, a, h, t);

    if (!ownedSet.has(variant.variantId)) {
      unlockVariant(variant.variantId, card.id, source);
      return variant;
    }
  }

  return null; // All tried variants already owned (extremely unlikely)
}

/**
 * Reset variant inventory (debug).
 */
export function resetVariants(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(VARIANT_STORAGE_KEY);
}
