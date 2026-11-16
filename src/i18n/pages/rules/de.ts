/**
 * What cards do and what a deck may hold (src/lib/battle-rules.ts): German.
 *
 * Same keys, {placeholders} and <b>/<a> marks as ./en.ts (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'rules.landIt': 'Triff es, und dein Handwerk wächst um die Hälfte.',
  'rules.relic': 'Leiht Machtworte: {words}. Verwende {n} davon für +{bonus} Handwerk.',
  'rules.potion': 'Verflucht die nächste Strophe deines Gegners mit {name}: {rule}',
  'rules.potion.letter': 'Verflucht die nächste Strophe deines Gegners mit {name}: Seine Strophe darf einen Buchstaben nicht enthalten, den der Trank nennt, wenn das Duell ausgeteilt wird.',
  'rules.cost': 'Tintenkosten: {n}.',
  'rules.synergy': '{house}, zwei oder mehr Figuren: {device} bringt drei Viertel deines Handwerks statt der Hälfte.',
  'rules.deck.minCharacters': 'Figuren in einem Deck: mindestens {n}.',
  'rules.deck.maxCharacters': 'Figuren in einem Deck: höchstens {n}.',
  'rules.deck.maxRelics': 'Relikte in einem Deck: höchstens {n}.',
  'rules.deck.maxPotions': 'Tränke in einem Deck: höchstens {n}.',
  'rules.deck.totalMax': 'Karten in einem Deck: höchstens {n}.',
  'rules.deck.unknownCard': 'Unbekannte Karte: {id}',
  'rules.deck.notCharacter': '{card} ist keine Figur.',
  'rules.deck.notRelic': '{card} ist kein Relikt.',
  'rules.deck.notPotion': '{card} ist kein Trank.',
};

export default messages;
