/**
 * Card Catalog — Master list of all cards in the Inspired Mile universe.
 * This is the single source of truth for card data across all pages.
 */

export type CardType = 'Character' | 'Relic' | 'Potion';
export type Rarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';
export type House = 'Montague' | 'Capulet' | 'Danish Court' | 'Forest of Arden' | 'Legendary' | 'Relic' | 'Potion';

export interface Card {
  id: string;
  name: string;
  house: House;
  type: CardType;
  atk: number;
  def: number;
  hp: number;
  rarity: Rarity;
  element: string;
  quote: string;
  gradient: string;
  border: string;
  icon: string;
  scene: string;
  image?: string;
}

export const CARD_CATALOG: Card[] = [
  {
    id: 'SM-001', name: 'The Sonnet Man', house: 'Legendary', type: 'Character',
    atk: 95, def: 80, hp: 100, rarity: 'Legendary', element: 'Fire',
    quote: "Shall I compare thee to a summer's day?",
    gradient: 'from-gold-500/20 to-crimson-500/20', border: 'border-gold-500/40',
    icon: '\u2694',
    scene: 'A grand stage materializes. The Sonnet Man steps forward from a golden spotlight, microphone in hand. Shakespeare\'s words transform into hip-hop bars as the crowd cheers.',
    image: '/images/cards/sm-001.webp',
  },
  {
    id: 'MO-001', name: 'Romeo', house: 'Montague', type: 'Character',
    atk: 75, def: 60, hp: 85, rarity: 'Rare', element: 'Passion',
    quote: 'But soft, what light through yonder window breaks?',
    gradient: 'from-crimson-500/20 to-rose-500/20', border: 'border-crimson-500/30',
    icon: '\u2665',
    scene: 'A moonlit balcony scene unfolds. Romeo reaches upward as Juliet appears above. Rose petals drift through the air. The scene pulses with a warm crimson glow.',
    image: '/images/cards/mo-001.webp',
  },
  {
    id: 'CA-001', name: 'Juliet', house: 'Capulet', type: 'Character',
    atk: 70, def: 75, hp: 90, rarity: 'Rare', element: 'Grace',
    quote: "What's in a name? That which we call a rose...",
    gradient: 'from-blue-500/20 to-indigo-500/20', border: 'border-blue-500/30',
    icon: '\u{1F339}',
    scene: 'The Capulet garden blooms in moonlight. Juliet stands among roses, her eyes bright with defiance. A nightingale sings from the branches above.',
    image: '/images/cards/ca-001.webp',
  },
  {
    id: 'DC-001', name: 'Hamlet', house: 'Danish Court', type: 'Character',
    atk: 85, def: 70, hp: 95, rarity: 'Epic', element: 'Shadow',
    quote: 'To be, or not to be, that is the question.',
    gradient: 'from-purple-500/20 to-violet-500/20', border: 'border-purple-500/30',
    icon: '\u2620',
    scene: 'The castle of Elsinore emerges from shadow. Hamlet stands at the battlements, Yorick\'s skull hovering beside him. A spectral figure appears on the ramparts above.',
    image: '/images/cards/dc-001.webp',
  },
  {
    id: 'DC-002', name: 'Ophelia', house: 'Danish Court', type: 'Character',
    atk: 55, def: 85, hp: 80, rarity: 'Rare', element: 'Water',
    quote: "There's rosemary, that's for remembrance.",
    gradient: 'from-cyan-500/20 to-teal-500/20', border: 'border-cyan-500/30',
    icon: '\u{1F33F}',
    scene: 'A gentle stream winds through a willow grove. Ophelia floats among wildflowers, whispering forgotten verses. Petals circle in the current.',
    image: '/images/cards/dc-002.webp',
  },
  {
    id: 'MO-002', name: 'Mercutio', house: 'Montague', type: 'Character',
    atk: 80, def: 55, hp: 75, rarity: 'Rare', element: 'Wind',
    quote: 'A plague on both your houses!',
    gradient: 'from-orange-500/20 to-amber-500/20', border: 'border-orange-500/30',
    icon: '\u{1F5E1}',
    scene: 'A Verona street erupts in chaos. Mercutio dances between blades, laughing in the face of danger. Sparks fly from clashing steel.',
    image: '/images/cards/mo-002.webp',
  },
  {
    id: 'FA-001', name: 'Puck', house: 'Forest of Arden', type: 'Character',
    atk: 65, def: 65, hp: 70, rarity: 'Uncommon', element: 'Trickster',
    quote: 'Lord, what fools these mortals be!',
    gradient: 'from-emerald-500/20 to-green-500/20', border: 'border-emerald-500/30',
    icon: '\u{1F3AD}',
    scene: 'The enchanted forest shimmers with mischief. Puck darts between ancient oaks, leaving trails of pixie dust. Sleeping mortals dream strange dreams below.',
    image: '/images/cards/fa-001.webp',
  },
  {
    id: 'FA-002', name: 'Titania', house: 'Forest of Arden', type: 'Character',
    atk: 60, def: 90, hp: 85, rarity: 'Epic', element: 'Nature',
    quote: 'Come, sit thee down upon this flowery bed.',
    gradient: 'from-lime-500/20 to-emerald-500/20', border: 'border-lime-500/30',
    icon: '\u{1F451}',
    scene: 'A throne of living vines rises from the forest floor. Titania commands her fairy court as fireflies illuminate the canopy. Nature itself bows to her will.',
    image: '/images/cards/fa-002.webp',
  },
  {
    id: 'RL-001', name: "Yorick's Skull", house: 'Relic', type: 'Relic',
    atk: 0, def: 0, hp: 0, rarity: 'Rare', element: 'Death',
    quote: 'Alas, poor Yorick! I knew him, Horatio.',
    gradient: 'from-gray-500/20 to-slate-500/20', border: 'border-gray-500/30',
    icon: '\u{1F480}',
    scene: 'A skull rests on velvet in a dim crypt. Ghostly laughter echoes as memories of the court jester flicker like candlelight.',
    image: '/images/cards/rl-001.webp',
  },
  {
    id: 'RL-002', name: "Prospero's Staff", house: 'Relic', type: 'Relic',
    atk: 0, def: 0, hp: 0, rarity: 'Legendary', element: 'Arcane',
    quote: 'Now my charms are all o\'erthrown.',
    gradient: 'from-indigo-500/20 to-purple-500/20', border: 'border-indigo-500/30',
    icon: '\u{1FA84}',
    scene: 'A gnarled staff crackles with arcane energy. The tempest swirls around it as Prospero whispers his final spell. Lightning splits the sky.',
    image: '/images/cards/rl-002.webp',
  },
  {
    id: 'PT-001', name: 'Love Potion', house: 'Potion', type: 'Potion',
    atk: 0, def: 0, hp: 0, rarity: 'Common', element: 'Enchantment',
    quote: 'The course of true love never did run smooth.',
    gradient: 'from-pink-500/20 to-rose-500/20', border: 'border-pink-500/30',
    icon: '\u{1F48E}',
    scene: 'A glowing vial pulses with rose-colored light. Hearts drift upward from its surface as a sweet melody fills the air.',
    image: '/images/cards/pt-001.webp',
  },
  {
    id: 'PT-002', name: "Witches' Brew", house: 'Potion', type: 'Potion',
    atk: 0, def: 0, hp: 0, rarity: 'Uncommon', element: 'Dark',
    quote: 'Double, double toil and trouble.',
    gradient: 'from-green-500/20 to-lime-500/20', border: 'border-green-700/30',
    icon: '\u2696',
    scene: 'A bubbling cauldron belches green smoke. Three shadowy figures circle it, chanting. Eyes glow from the dark woods beyond.',
  },
];

export const RARITY_COLORS: Record<Rarity, string> = {
  Common: 'text-obsidian-400 bg-obsidian-700/50',
  Uncommon: 'text-emerald-400 bg-emerald-500/20',
  Rare: 'text-blue-400 bg-blue-500/20',
  Epic: 'text-purple-400 bg-purple-500/20',
  Legendary: 'text-gold-400 bg-gold-500/20',
};

/** Rarity weights for pack opening (higher = more likely) */
export const RARITY_WEIGHTS: Record<Rarity, number> = {
  Common: 50,
  Uncommon: 30,
  Rare: 15,
  Epic: 4,
  Legendary: 1,
};

export function getCardById(id: string): Card | undefined {
  return CARD_CATALOG.find(c => c.id === id);
}

export function getCardsByType(type: CardType): Card[] {
  return CARD_CATALOG.filter(c => c.type === type);
}

export function getCardsByHouse(house: House): Card[] {
  return CARD_CATALOG.filter(c => c.house === house);
}

export function getCardsByRarity(rarity: Rarity): Card[] {
  return CARD_CATALOG.filter(c => c.rarity === rarity);
}

/** Pick a random card weighted by rarity */
export function drawRandomCard(): Card {
  const totalWeight = Object.values(RARITY_WEIGHTS).reduce((a, b) => a + b, 0);
  let roll = Math.random() * totalWeight;

  let selectedRarity: Rarity = 'Common';
  for (const [rarity, weight] of Object.entries(RARITY_WEIGHTS)) {
    roll -= weight;
    if (roll <= 0) {
      selectedRarity = rarity as Rarity;
      break;
    }
  }

  const pool = getCardsByRarity(selectedRarity);
  if (pool.length === 0) return CARD_CATALOG[0];
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Draw multiple random cards for a pack */
export function drawPack(count: number): Card[] {
  const cards: Card[] = [];
  for (let i = 0; i < count; i++) {
    cards.push(drawRandomCard());
  }
  return cards;
}
