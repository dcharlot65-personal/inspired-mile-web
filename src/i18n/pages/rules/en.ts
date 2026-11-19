/**
 * What cards do and what a deck may hold (src/lib/battle-rules.ts): English.
 *
 * The reference: every other language has exactly these keys, with the same {placeholders}
 * and the same <b>/<a> marks (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'rules.landIt': 'Land it to add half again to your craft.',
  'rules.relic': 'Lends power words: {words}. Use {n} of them for +{bonus} craft.',
  'rules.potion': "Curses your opponent's next verse with {name}: {rule}",
  'rules.potion.letter': "Curses your opponent's next verse with {name}: their verse may not contain one letter, which the potion names when the duel is dealt.",
  'rules.cost': 'Ink cost: {n}.',
  'rules.synergy': '{house}, two or more characters: {device} adds three quarters to your craft instead of half.',
  'rules.deck.minCharacters': 'Characters in a deck: at least {n}.',
  'rules.deck.maxCharacters': 'Characters in a deck: at most {n}.',
  'rules.deck.maxRelics': 'Relics in a deck: at most {n}.',
  'rules.deck.maxPotions': 'Potions in a deck: at most {n}.',
  'rules.deck.totalMax': 'Cards in a deck: at most {n}.',
  'rules.deck.unknownCard': 'Unknown card: {id}',
  'rules.deck.notCharacter': '{card} is not a character.',
  'rules.deck.notRelic': '{card} is not a relic.',
  'rules.deck.notPotion': '{card} is not a potion.',
};

export default messages;
