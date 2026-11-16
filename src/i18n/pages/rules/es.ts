/**
 * What cards do and what a deck may hold (src/lib/battle-rules.ts): Spanish.
 *
 * Same keys, {placeholders} and <b>/<a> marks as ./en.ts (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'rules.landIt': 'Lógralo para sumar la mitad más a tu oficio.',
  'rules.relic': 'Presta palabras de poder: {words}. Usa {n} de ellas para sumar +{bonus} de oficio.',
  'rules.potion': 'Maldice la próxima estrofa de tu rival con {name}: {rule}',
  'rules.potion.letter': 'Maldice la próxima estrofa de tu rival con {name}: su estrofa no puede contener una letra, que la poción nombra cuando se reparte el duelo.',
  'rules.cost': 'Coste de tinta: {n}.',
  'rules.synergy': '{house}, dos o más personajes: {device} suma tres cuartos a tu oficio en lugar de la mitad.',
  'rules.deck.minCharacters': 'Personajes en un mazo: al menos {n}.',
  'rules.deck.maxCharacters': 'Personajes en un mazo: como máximo {n}.',
  'rules.deck.maxRelics': 'Reliquias en un mazo: como máximo {n}.',
  'rules.deck.maxPotions': 'Pociones en un mazo: como máximo {n}.',
  'rules.deck.totalMax': 'Cartas en un mazo: como máximo {n}.',
  'rules.deck.unknownCard': 'Carta desconocida: {id}',
  'rules.deck.notCharacter': '{card} no es un personaje.',
  'rules.deck.notRelic': '{card} no es una reliquia.',
  'rules.deck.notPotion': '{card} no es una poción.',
};

export default messages;
