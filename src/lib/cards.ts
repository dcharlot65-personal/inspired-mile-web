/**
 * Card Catalog — Master list of all cards in the Inspired Mile universe.
 * This is the single source of truth for card data across all pages.
 */

export type CardType = 'Character' | 'Relic' | 'Potion';
export type Rarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';
export type House = 'Montague' | 'Capulet' | 'Danish Court' | 'Forest of Arden' | 'Verona Court' | 'The Tempest' | 'Legendary' | 'Relic' | 'Potion';

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
    image: '/images/cards/pt-002.webp',
  },

  // --- V1: Verona Court ---
  {
    id: 'VC-001', name: 'Prince Escalus', house: 'Verona Court', type: 'Character',
    atk: 70, def: 85, hp: 95, rarity: 'Epic', element: 'Justice',
    quote: 'If ever you disturb our streets again, your lives shall pay the forfeit of the peace.',
    gradient: 'from-amber-500/20 to-yellow-500/20', border: 'border-amber-500/30',
    icon: '\u{1F451}',
    scene: 'The Prince stands on the steps of Verona\'s palace, his voice commanding silence over the feuding crowd. A golden scepter burns with authority.',
    image: '/images/cards/vc-001.webp',
  },
  {
    id: 'VC-002', name: 'Friar Lawrence', house: 'Verona Court', type: 'Character',
    atk: 35, def: 80, hp: 90, rarity: 'Uncommon', element: 'Earth',
    quote: 'These violent delights have violent ends.',
    gradient: 'from-stone-500/20 to-amber-500/20', border: 'border-stone-500/30',
    icon: '\u{1F33F}',
    scene: 'A candlelit cell in a monastery. The Friar tends his garden of herbs and poisons, wisdom etched into his weathered face.',
    image: '/images/cards/vc-002.webp',
  },
  {
    id: 'VC-003', name: 'The Nurse', house: 'Verona Court', type: 'Character',
    atk: 30, def: 70, hp: 85, rarity: 'Common', element: 'Loyalty',
    quote: 'I am the drudge and toil in your delight.',
    gradient: 'from-rose-500/20 to-stone-500/20', border: 'border-rose-500/30',
    icon: '\u{1F9D1}',
    scene: 'A warm kitchen in the Capulet house. The Nurse bustles with fierce devotion, a secret letter tucked in her apron.',
    image: '/images/cards/vc-003.webp',
  },

  // --- V1: The Tempest ---
  {
    id: 'TP-001', name: 'Prospero', house: 'The Tempest', type: 'Character',
    atk: 90, def: 85, hp: 90, rarity: 'Epic', element: 'Storm',
    quote: 'We are such stuff as dreams are made on.',
    gradient: 'from-blue-500/20 to-indigo-500/20', border: 'border-blue-500/30',
    icon: '\u{26A1}',
    scene: 'An island shrouded in tempest. Prospero raises his hands as lightning obeys his will, the sea churning at his command.',
    image: '/images/cards/tp-001.webp',
  },
  {
    id: 'TP-002', name: 'Ariel', house: 'The Tempest', type: 'Character',
    atk: 70, def: 75, hp: 65, rarity: 'Rare', element: 'Air',
    quote: 'All hail, great master! Grave sir, hail!',
    gradient: 'from-sky-500/20 to-cyan-500/20', border: 'border-sky-500/30',
    icon: '\u{1F4A8}',
    scene: 'A shimmering spirit dissolves into wind and light, reforming as music. Ariel dances between the visible and invisible.',
    image: '/images/cards/tp-002.webp',
  },
  {
    id: 'TP-003', name: 'Caliban', house: 'The Tempest', type: 'Character',
    atk: 75, def: 45, hp: 80, rarity: 'Uncommon', element: 'Beast',
    quote: 'This island\'s mine, by Sycorax my mother.',
    gradient: 'from-stone-500/20 to-green-500/20', border: 'border-stone-700/30',
    icon: '\u{1F43A}',
    scene: 'A cave mouth on a wild shore. Caliban crouches among the rocks, eyes burning with resentment and primal intelligence.',
    image: '/images/cards/tp-003.webp',
  },

  // --- V1: Existing Houses Expanded ---
  {
    id: 'MO-003', name: 'Benvolio', house: 'Montague', type: 'Character',
    atk: 55, def: 70, hp: 75, rarity: 'Common', element: 'Peace',
    quote: 'I do but keep the peace. Put up thy sword.',
    gradient: 'from-sky-500/20 to-blue-500/20', border: 'border-sky-500/30',
    icon: '\u{1F54A}',
    scene: 'A Verona plaza at dawn. Benvolio stands between drawn swords, his open hands the only weapon against the gathering storm.',
    image: '/images/cards/mo-003.webp',
  },
  {
    id: 'CA-002', name: 'Tybalt', house: 'Capulet', type: 'Character',
    atk: 88, def: 50, hp: 70, rarity: 'Rare', element: 'Fire',
    quote: 'What, drawn, and talk of peace? I hate the word.',
    gradient: 'from-red-500/20 to-orange-500/20', border: 'border-red-500/30',
    icon: '\u{1F525}',
    scene: 'A Verona alley ablaze with torchlight. Tybalt draws his rapier with lethal grace, his eyes fixed on his enemy.',
    image: '/images/cards/ca-002.webp',
  },
  {
    id: 'DC-003', name: 'King Claudius', house: 'Danish Court', type: 'Character',
    atk: 80, def: 60, hp: 85, rarity: 'Rare', element: 'Poison',
    quote: 'My words fly up, my thoughts remain below.',
    gradient: 'from-emerald-500/20 to-yellow-500/20', border: 'border-emerald-700/30',
    icon: '\u{1F40D}',
    scene: 'The throne room of Elsinore, draped in false splendor. Claudius grips the crown, a vial of poison hidden in his robes.',
    image: '/images/cards/dc-003.webp',
  },
  {
    id: 'FA-003', name: 'Oberon', house: 'Forest of Arden', type: 'Character',
    atk: 75, def: 80, hp: 85, rarity: 'Epic', element: 'Moonlight',
    quote: 'Ill met by moonlight, proud Titania.',
    gradient: 'from-violet-500/20 to-indigo-500/20', border: 'border-violet-500/30',
    icon: '\u{1F319}',
    scene: 'A moonlit glade deep in the enchanted forest. Oberon materializes from shadow, his crown of antlers catching silver light.',
    image: '/images/cards/fa-003.webp',
  },

  // --- V1: New Relics & Potions ---
  {
    id: 'RL-003', name: 'Dagger of the Mind', house: 'Relic', type: 'Relic',
    atk: 0, def: 0, hp: 0, rarity: 'Uncommon', element: 'Illusion',
    quote: 'Is this a dagger which I see before me?',
    gradient: 'from-red-500/20 to-gray-500/20', border: 'border-red-700/30',
    icon: '\u{1F5E1}',
    scene: 'A spectral dagger floats in darkness, its blade dripping with phantom blood. Macbeth\'s hand reaches but can never grasp it.',
    image: '/images/cards/rl-003.webp',
  },
  {
    id: 'PT-003', name: "Puck's Flower Juice", house: 'Potion', type: 'Potion',
    atk: 0, def: 0, hp: 0, rarity: 'Common', element: 'Mischief',
    quote: 'I\'ll put a girdle round about the earth in forty minutes.',
    gradient: 'from-violet-500/20 to-fuchsia-500/20', border: 'border-violet-500/30',
    icon: '\u{1F33C}',
    scene: 'A crushed purple flower drips iridescent nectar into a waiting palm. Wherever it falls, eyes change — and hearts follow.',
    image: '/images/cards/pt-003.webp',
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
