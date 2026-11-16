/**
 * Words printed on every card: types, houses, elements, stats (src/lib/cards.ts): English.
 *
 * The reference: every other language has exactly these keys, with the same {placeholders}
 * and the same <b>/<a> marks (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'card-terms.type.character': 'Character',
  'card-terms.type.relic': 'Relic',
  'card-terms.type.potion': 'Potion',
  'card-terms.types.character': 'Characters',
  'card-terms.types.relic': 'Relics',
  'card-terms.types.potion': 'Potions',
  'card-terms.stat.atk': 'ATK',
  'card-terms.stat.def': 'DEF',
  'card-terms.stat.hp': 'HP',
  'card-terms.house.montague': 'Montague',
  'card-terms.house.capulet': 'Capulet',
  'card-terms.house.danish-court': 'Danish Court',
  'card-terms.house.forest-of-arden': 'Forest of Arden',
  'card-terms.house.verona-court': 'Verona Court',
  'card-terms.house.the-tempest': 'The Tempest', // Wikidata Q86440 label
  'card-terms.house.scottish-court': 'Scottish Court',
  'card-terms.house.illyria': 'Illyria', // Wikidata Q32047 label
  'card-terms.house.rome': 'Rome', // Wikidata Q220 label
  'card-terms.house.legendary': 'Legendary',
  'card-terms.house.relic': 'Relic',
  'card-terms.house.potion': 'Potion',
  'card-terms.house.lake-district': 'Lake District', // Wikidata Q211778 label
  'card-terms.house.gothic-circle': 'Gothic Circle',
  'card-terms.house.olympus': 'Olympus', // Wikidata Q70054479 label
  'card-terms.house.underworld': 'Underworld',
  'card-terms.element.air': 'Air',
  'card-terms.element.alchemy': 'Alchemy',
  'card-terms.element.ambition': 'Ambition',
  'card-terms.element.arcane': 'Arcane',
  'card-terms.element.authority': 'Authority',
  'card-terms.element.beast': 'Beast',
  'card-terms.element.beauty': 'Beauty',
  'card-terms.element.comedy': 'Comedy',
  'card-terms.element.compassion': 'Compassion',
  'card-terms.element.creation': 'Creation',
  'card-terms.element.cunning': 'Cunning',
  'card-terms.element.dark': 'Dark',
  'card-terms.element.darkness': 'Darkness',
  'card-terms.element.death': 'Death',
  'card-terms.element.devotion': 'Devotion',
  'card-terms.element.disguise': 'Disguise',
  'card-terms.element.duty': 'Duty',
  'card-terms.element.earth': 'Earth',
  'card-terms.element.enchantment': 'Enchantment',
  'card-terms.element.envy': 'Envy',
  'card-terms.element.fire': 'Fire',
  'card-terms.element.glory': 'Glory',
  'card-terms.element.grace': 'Grace',
  'card-terms.element.honor': 'Honor',
  'card-terms.element.illusion': 'Illusion',
  'card-terms.element.innocence': 'Innocence',
  'card-terms.element.justice': 'Justice',
  'card-terms.element.knowledge': 'Knowledge',
  'card-terms.element.light': 'Light',
  'card-terms.element.love': 'Love',
  'card-terms.element.loyalty': 'Loyalty',
  'card-terms.element.mischief': 'Mischief',
  'card-terms.element.moonlight': 'Moonlight',
  'card-terms.element.nature': 'Nature',
  'card-terms.element.ocean': 'Ocean',
  'card-terms.element.passion': 'Passion',
  'card-terms.element.peace': 'Peace',
  'card-terms.element.petrification': 'Petrification',
  'card-terms.element.poison': 'Poison',
  'card-terms.element.power': 'Power',
  'card-terms.element.prophecy': 'Prophecy',
  'card-terms.element.rebellion': 'Rebellion',
  'card-terms.element.rebirth': 'Rebirth',
  'card-terms.element.revolution': 'Revolution',
  'card-terms.element.rhetoric': 'Rhetoric',
  'card-terms.element.shadow': 'Shadow',
  'card-terms.element.sorrow': 'Sorrow',
  'card-terms.element.speed': 'Speed',
  'card-terms.element.storm': 'Storm',
  'card-terms.element.thunder': 'Thunder',
  'card-terms.element.transformation': 'Transformation',
  'card-terms.element.trickster': 'Trickster',
  'card-terms.element.vanity': 'Vanity',
  'card-terms.element.vision': 'Vision',
  'card-terms.element.water': 'Water',
  'card-terms.element.wind': 'Wind',
  'card-terms.element.wisdom': 'Wisdom',
  'card-terms.work.romeo-and-juliet': 'Romeo and Juliet', // Wikidata Q83186 label
  'card-terms.work.hamlet': 'Hamlet', // Wikidata Q41567 label
  'card-terms.work.as-you-like-it': 'As You Like It', // Wikidata Q237572 label
};

export default messages;
