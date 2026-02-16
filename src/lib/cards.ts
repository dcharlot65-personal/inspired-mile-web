/**
 * Card Catalog — Master list of all cards in the Inspired Mile universe.
 * This is the single source of truth for card data across all pages.
 */

export type CardType = 'Character' | 'Relic' | 'Potion';
export type Rarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';
export type House = 'Montague' | 'Capulet' | 'Danish Court' | 'Forest of Arden' | 'Verona Court' | 'The Tempest' | 'Scottish Court' | 'Illyria' | 'Rome' | 'Legendary' | 'Relic' | 'Potion';

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

  // --- V2: Scottish Court (Macbeth) ---
  {
    id: 'SC-001', name: 'Macbeth', house: 'Scottish Court', type: 'Character',
    atk: 88, def: 65, hp: 90, rarity: 'Epic', element: 'Ambition',
    quote: 'I dare do all that may become a man; who dares do more is none.',
    gradient: 'from-red-500/20 to-stone-500/20', border: 'border-red-700/30',
    icon: '\u{1F451}',
    scene: 'A bloodstained throne room in Dunsinane. Macbeth grips his sword with trembling hands, the crown heavy on his brow. Birnam Wood stirs on the distant hill.',
    image: '/images/cards/sc-001.webp',
  },
  {
    id: 'SC-002', name: 'Lady Macbeth', house: 'Scottish Court', type: 'Character',
    atk: 80, def: 55, hp: 75, rarity: 'Rare', element: 'Darkness',
    quote: 'Come, you spirits that tend on mortal thoughts, unsex me here.',
    gradient: 'from-zinc-500/20 to-red-500/20', border: 'border-zinc-500/30',
    icon: '\u{1F56F}',
    scene: 'A candlelit chamber in the Scottish castle. Lady Macbeth paces the cold stones, wringing phantom bloodstains from her hands. Shadows cling to her like a second skin.',
    image: '/images/cards/sc-002.webp',
  },
  {
    id: 'SC-003', name: 'Banquo', house: 'Scottish Court', type: 'Character',
    atk: 65, def: 75, hp: 80, rarity: 'Uncommon', element: 'Prophecy',
    quote: 'Thou shalt get kings, though thou be none.',
    gradient: 'from-slate-500/20 to-blue-500/20', border: 'border-slate-500/30',
    icon: '\u{1F47B}',
    scene: 'A misty Scottish heath at twilight. Banquo stands resolute as three spectral figures whisper destinies into the wind. His ghost will haunt the living.',
    image: '/images/cards/sc-003.webp',
  },

  // --- V2: Illyria (Twelfth Night) ---
  {
    id: 'IL-001', name: 'Viola', house: 'Illyria', type: 'Character',
    atk: 70, def: 80, hp: 85, rarity: 'Rare', element: 'Disguise',
    quote: 'I am not what I am.',
    gradient: 'from-teal-500/20 to-blue-500/20', border: 'border-teal-500/30',
    icon: '\u{1F3AD}',
    scene: 'A windswept Illyrian shore. Viola pulls a sailor\'s cap over her cropped hair, twin identities shimmering in her eyes. The sea whispers secrets of her lost brother.',
    image: '/images/cards/il-001.webp',
  },
  {
    id: 'IL-002', name: 'Malvolio', house: 'Illyria', type: 'Character',
    atk: 50, def: 65, hp: 70, rarity: 'Uncommon', element: 'Vanity',
    quote: 'Some are born great, some achieve greatness, and some have greatness thrust upon them.',
    gradient: 'from-yellow-500/20 to-amber-500/20', border: 'border-yellow-500/30',
    icon: '\u{1F9E6}',
    scene: 'A sunlit garden in Olivia\'s estate. Malvolio struts in garish yellow stockings, cross-gartered and grinning, clutching a forged love letter to his chest.',
    image: '/images/cards/il-002.webp',
  },
  {
    id: 'IL-003', name: 'Olivia', house: 'Illyria', type: 'Character',
    atk: 55, def: 85, hp: 90, rarity: 'Rare', element: 'Grace',
    quote: 'Love sought is good, but given unsought, is better.',
    gradient: 'from-indigo-500/20 to-cyan-500/20', border: 'border-indigo-500/30',
    icon: '\u{1F338}',
    scene: 'A veiled countess in mourning lifts her veil to reveal breathtaking beauty. Olivia\'s garden blooms with jasmine and lavender as the disguised messenger steals her heart.',
    image: '/images/cards/il-003.webp',
  },

  // --- V2: Rome (Julius Caesar) ---
  {
    id: 'RM-001', name: 'Brutus', house: 'Rome', type: 'Character',
    atk: 80, def: 75, hp: 90, rarity: 'Epic', element: 'Honor',
    quote: 'Not that I loved Caesar less, but that I loved Rome more.',
    gradient: 'from-amber-500/20 to-stone-500/20', border: 'border-amber-700/30',
    icon: '\u{1F3DB}',
    scene: 'The Roman Senate, marble pillars stained crimson. Brutus stands among the conspirators, his blade still trembling. The weight of the republic rests on his bloodied hands.',
    image: '/images/cards/rm-001.webp',
  },
  {
    id: 'RM-002', name: 'Cassius', house: 'Rome', type: 'Character',
    atk: 85, def: 55, hp: 75, rarity: 'Rare', element: 'Envy',
    quote: 'The fault, dear Brutus, is not in our stars, but in ourselves.',
    gradient: 'from-emerald-500/20 to-zinc-500/20', border: 'border-emerald-700/30',
    icon: '\u{1F5E1}',
    scene: 'A torchlit Roman alley at midnight. Cassius leans close, whispering sedition with a lean and hungry look. Forged letters spill from his toga.',
    image: '/images/cards/rm-002.webp',
  },
  {
    id: 'RM-003', name: 'Mark Antony', house: 'Rome', type: 'Character',
    atk: 90, def: 70, hp: 85, rarity: 'Epic', element: 'Rhetoric',
    quote: 'Friends, Romans, countrymen, lend me your ears!',
    gradient: 'from-red-500/20 to-amber-500/20', border: 'border-red-500/30',
    icon: '\u{1F525}',
    scene: 'The Roman Forum erupts in fury. Mark Antony holds Caesar\'s bloodied cloak aloft before the mob, his words turning grief into fire. The republic crumbles with every syllable.',
    image: '/images/cards/rm-003.webp',
  },

  // --- V2: Existing Houses Expanded ---
  {
    id: 'MO-004', name: 'Lord Montague', house: 'Montague', type: 'Character',
    atk: 45, def: 60, hp: 70, rarity: 'Common', element: 'Authority',
    quote: 'Many a morning hath he there been seen, with tears augmenting the fresh morning dew.',
    gradient: 'from-blue-500/20 to-slate-500/20', border: 'border-blue-500/30',
    icon: '\u{1F3F0}',
    scene: 'The Montague estate at dawn. Lord Montague watches from a high window as his son wanders the misty orchards below, lovesick and unreachable.',
    image: '/images/cards/mo-004.webp',
  },
  {
    id: 'CA-003', name: 'Lady Capulet', house: 'Capulet', type: 'Character',
    atk: 50, def: 70, hp: 75, rarity: 'Uncommon', element: 'Ambition',
    quote: 'Marry, that marry is the very theme I came to talk of.',
    gradient: 'from-fuchsia-500/20 to-rose-500/20', border: 'border-fuchsia-500/30',
    icon: '\u{1F48D}',
    scene: 'The Capulet great hall draped in silk. Lady Capulet arranges her daughter\'s fate like flowers in a vase, ambition glittering behind every gracious smile.',
    image: '/images/cards/ca-003.webp',
  },
  {
    id: 'DC-004', name: 'Horatio', house: 'Danish Court', type: 'Character',
    atk: 50, def: 80, hp: 85, rarity: 'Uncommon', element: 'Loyalty',
    quote: 'Now cracks a noble heart. Good night, sweet prince.',
    gradient: 'from-slate-500/20 to-purple-500/20', border: 'border-slate-500/30',
    icon: '\u{1F91D}',
    scene: 'The battlements of Elsinore in the cold hour before dawn. Horatio stands vigil beside Hamlet, the one true friend in a court of serpents.',
    image: '/images/cards/dc-004.webp',
  },
  {
    id: 'FA-004', name: 'Bottom', house: 'Forest of Arden', type: 'Character',
    atk: 40, def: 55, hp: 65, rarity: 'Common', element: 'Comedy',
    quote: 'I have had a most rare vision. I have had a dream, past the wit of man.',
    gradient: 'from-amber-500/20 to-green-500/20', border: 'border-amber-500/30',
    icon: '\u{1F434}',
    scene: 'A forest clearing aglow with fairy light. Bottom wears an ass\'s head with bewildered dignity as Titania drapes him in garlands. The fairies stifle their laughter.',
    image: '/images/cards/fa-004.webp',
  },
  {
    id: 'VC-004', name: 'Paris', house: 'Verona Court', type: 'Character',
    atk: 60, def: 65, hp: 70, rarity: 'Uncommon', element: 'Duty',
    quote: 'These times of woe afford no time to woo.',
    gradient: 'from-sky-500/20 to-amber-500/20', border: 'border-sky-500/30',
    icon: '\u{1F396}',
    scene: 'The churchyard of Verona at dusk. Paris lays flowers at Juliet\'s tomb, unaware of the desperate lover who approaches from the shadows.',
    image: '/images/cards/vc-004.webp',
  },
  {
    id: 'TP-004', name: 'Miranda', house: 'The Tempest', type: 'Character',
    atk: 45, def: 75, hp: 80, rarity: 'Uncommon', element: 'Innocence',
    quote: 'O brave new world, that has such people in it!',
    gradient: 'from-cyan-500/20 to-rose-500/20', border: 'border-cyan-500/30',
    icon: '\u{1F31F}',
    scene: 'A pristine beach on Prospero\'s island. Miranda sees the shipwrecked sailors for the first time, her eyes wide with wonder at a world she never knew existed.',
    image: '/images/cards/tp-004.webp',
  },

  // --- V2: New Relics ---
  {
    id: 'RL-004', name: "Romeo's Ring", house: 'Relic', type: 'Relic',
    atk: 0, def: 0, hp: 0, rarity: 'Rare', element: 'Devotion',
    quote: 'My bounty is as boundless as the sea, my love as deep.',
    gradient: 'from-rose-500/20 to-gold-500/20', border: 'border-rose-500/30',
    icon: '\u{1F48D}',
    scene: 'A golden ring rests on a stone balcony ledge, catching moonlight. Inscribed inside is a vow that outlasts death itself. Rose petals spiral around it in an unseen wind.',
    image: '/images/cards/rl-004.webp',
  },
  {
    id: 'RL-005', name: "Portia's Casket", house: 'Relic', type: 'Relic',
    atk: 0, def: 0, hp: 0, rarity: 'Uncommon', element: 'Wisdom',
    quote: 'All that glisters is not gold.',
    gradient: 'from-amber-500/20 to-zinc-500/20', border: 'border-amber-500/30',
    icon: '\u{1F4E6}',
    scene: 'Three caskets gleam in a candlelit chamber -- gold, silver, and lead. The lead casket hums with quiet truth, rewarding those wise enough to see past appearances.',
    image: '/images/cards/rl-005.webp',
  },
  {
    id: 'RL-006', name: "Macbeth's Crown", house: 'Relic', type: 'Relic',
    atk: 0, def: 0, hp: 0, rarity: 'Epic', element: 'Power',
    quote: 'Uneasy lies the head that wears a crown.',
    gradient: 'from-red-500/20 to-yellow-500/20', border: 'border-red-700/30',
    icon: '\u{1F451}',
    scene: 'A tarnished Scottish crown sits on a bloodstained pillow. It pulses with dark ambition, whispering promises of glory to any hand that dares reach for it.',
    image: '/images/cards/rl-006.webp',
  },
  {
    id: 'RL-007', name: 'The Tempest Codex', house: 'Relic', type: 'Relic',
    atk: 0, def: 0, hp: 0, rarity: 'Rare', element: 'Knowledge',
    quote: 'I\'ll drown my book.',
    gradient: 'from-indigo-500/20 to-blue-500/20', border: 'border-indigo-500/30',
    icon: '\u{1F4D6}',
    scene: 'An ancient tome bound in sea-weathered leather floats above a stone altar. Its pages turn by themselves, each one summoning a different storm.',
    image: '/images/cards/rl-007.webp',
  },
  {
    id: 'RL-008', name: "Cordelia's Tears", house: 'Relic', type: 'Relic',
    atk: 0, def: 0, hp: 0, rarity: 'Rare', element: 'Compassion',
    quote: 'O dear father, it is thy business that I go about.',
    gradient: 'from-cyan-500/20 to-blue-500/20', border: 'border-cyan-500/30',
    icon: '\u{1F4A7}',
    scene: 'A crystal vial holds tears that shimmer like captured starlight. Each drop carries the sorrow of a daughter who loved too truly and spoke too plainly.',
    image: '/images/cards/rl-008.webp',
  },
  {
    id: 'RL-009', name: "Bottom's Mask", house: 'Relic', type: 'Relic',
    atk: 0, def: 0, hp: 0, rarity: 'Uncommon', element: 'Transformation',
    quote: 'Bless thee, Bottom! Thou art translated!',
    gradient: 'from-amber-500/20 to-emerald-500/20', border: 'border-amber-500/30',
    icon: '\u{1F3AD}',
    scene: 'A donkey-headed mask hangs from a mossy branch in the fairy wood. Whoever dons it sees the world through enchanted eyes -- and becomes irresistible to fairy queens.',
    image: '/images/cards/rl-009.webp',
  },

  // --- V2: New Potions ---
  {
    id: 'PT-004', name: 'Mandrake Root', house: 'Potion', type: 'Potion',
    atk: 0, def: 0, hp: 0, rarity: 'Common', element: 'Earth',
    quote: 'Not poppy, nor mandragora, nor all the drowsy syrups of the world.',
    gradient: 'from-stone-500/20 to-green-500/20', border: 'border-stone-500/30',
    icon: '\u{1FAB4}',
    scene: 'A gnarled root shaped like a screaming figure is unearthed by candlelight. Soil crumbles away to reveal its twisted, ancient power. The apothecary handles it with trembling reverence.',
    image: '/images/cards/pt-004.webp',
  },
  {
    id: 'PT-005', name: "Oberon's Dew", house: 'Potion', type: 'Potion',
    atk: 0, def: 0, hp: 0, rarity: 'Rare', element: 'Enchantment',
    quote: 'Fetch me that flower; the herb I showed thee once.',
    gradient: 'from-violet-500/20 to-emerald-500/20', border: 'border-violet-500/30',
    icon: '\u{2728}',
    scene: 'A dewdrop clings to a moonlit orchid, glowing with otherworldly violet light. One drop upon sleeping eyelids and the dreamer falls in love with the first creature they see.',
    image: '/images/cards/pt-005.webp',
  },
  {
    id: 'PT-006', name: 'Hemlock Tincture', house: 'Potion', type: 'Potion',
    atk: 0, def: 0, hp: 0, rarity: 'Uncommon', element: 'Poison',
    quote: 'Upon my secure hour thy uncle stole, with juice of cursed hebona in a vial.',
    gradient: 'from-green-500/20 to-zinc-500/20', border: 'border-green-700/30',
    icon: '\u{2620}',
    scene: 'A black glass vial weeps green vapor in a darkened corridor. The tincture within has toppled kings and shattered dynasties, one silent drop at a time.',
    image: '/images/cards/pt-006.webp',
  },
  {
    id: 'PT-007', name: 'Mistletoe Extract', house: 'Potion', type: 'Potion',
    atk: 0, def: 0, hp: 0, rarity: 'Common', element: 'Nature',
    quote: 'In the cauldron boil and bake; eye of newt and toe of frog.',
    gradient: 'from-lime-500/20 to-green-500/20', border: 'border-lime-500/30',
    icon: '\u{1F33F}',
    scene: 'Pale berries glisten among dark evergreen leaves, harvested under a winter moon. The extract hums with the quiet, persistent magic of the natural world.',
    image: '/images/cards/pt-007.webp',
  },
  {
    id: 'PT-008', name: "Mermaid's Tears", house: 'Potion', type: 'Potion',
    atk: 0, def: 0, hp: 0, rarity: 'Rare', element: 'Ocean',
    quote: 'Full fathom five thy father lies; of his bones are coral made.',
    gradient: 'from-blue-500/20 to-cyan-500/20', border: 'border-blue-500/30',
    icon: '\u{1F30A}',
    scene: 'A pearl-stoppered flask holds luminous blue liquid that shifts like a living sea. Within it, tiny coral formations grow and dissolve. It smells of salt and forgotten voyages.',
    image: '/images/cards/pt-008.webp',
  },
  {
    id: 'PT-009', name: "Apothecary's Elixir", house: 'Potion', type: 'Potion',
    atk: 0, def: 0, hp: 0, rarity: 'Uncommon', element: 'Alchemy',
    quote: 'Put this in any liquid thing you will, and drink it off; and, if you had the strength of twenty men, it would dispatch you straight.',
    gradient: 'from-amber-500/20 to-red-500/20', border: 'border-amber-700/30',
    icon: '\u{2697}',
    scene: 'A dusty apothecary shop in Mantua\'s poorest quarter. A desperate elixir glows amber in a cracked vial, potent enough to bridge the gap between life and death.',
    image: '/images/cards/pt-009.webp',
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

// --- Premium Pack Tiers ---

export type PackTier = 'standard' | 'rare' | 'epic';

export interface PackTierInfo {
  tier: PackTier;
  name: string;
  cardCount: number;
  guaranteedRarity: Rarity | null;
  cost: number; // in credits
  description: string;
}

export const PACK_TIERS: PackTierInfo[] = [
  { tier: 'standard', name: 'Standard Pack', cardCount: 3, guaranteedRarity: null, cost: 50, description: '3 random cards' },
  { tier: 'rare', name: 'Rare Pack', cardCount: 5, guaranteedRarity: 'Rare', cost: 150, description: '5 cards, 1 Rare guaranteed' },
  { tier: 'epic', name: 'Epic Pack', cardCount: 5, guaranteedRarity: 'Epic', cost: 400, description: '5 cards, 1 Epic guaranteed' },
];

/** Draw a pack by tier with guaranteed rarity */
export function drawPackByTier(tier: PackTier): Card[] {
  const info = PACK_TIERS.find(t => t.tier === tier);
  if (!info) return drawPack(3);

  const cards: Card[] = [];

  // Add guaranteed card first
  if (info.guaranteedRarity) {
    const pool = getCardsByRarity(info.guaranteedRarity);
    if (pool.length > 0) {
      cards.push(pool[Math.floor(Math.random() * pool.length)]);
    }
  }

  // Fill remaining slots with random cards
  while (cards.length < info.cardCount) {
    cards.push(drawRandomCard());
  }

  return cards;
}
