/**
 * The collection page, its deck builder and card detail view: English.
 *
 * The reference: every other language has exactly these keys, with the same {placeholders}
 * and the same <b>/<a> marks (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'collection.meta.title': 'My Collection',
  'collection.meta.description': "Browse your Inspired Mile card collection: characters, relics, and potions from Shakespeare's greatest works.",
  'collection.title': 'My <b>Collection</b>',
  'collection.intro': 'Your Shakespeare card collection. Locked cards can be earned in the <a>Playground</a>.',
  'collection.owned': 'Cards owned: <b>{owned}</b> / {total}',
  'collection.filter.all': 'All',
  'collection.filter.owned': 'Owned',
  'collection.locked': 'Locked',
  'collection.world.title': 'World Cards',
  'collection.world.intro': 'Your characters travel the globe. Win battles and ace trivia to unlock city variants.',
  'collection.world.empty': 'No variants yet. Win three battles in a row or get a perfect trivia score to unlock your first World Card!',
  'collection.deck.title': 'Deck Builder',
  'collection.deck.intro': 'Characters: {min} to {max}. Relics: up to {relics}. Potions: up to {potions}. Cards in all: up to {total}. Click the cards you own above to add them.',
  'collection.deck.namePlaceholder': 'Deck name…',
  'collection.deck.save': 'Save Deck',
  'collection.deck.clear': 'Clear',
  'collection.deck.addCharacters': 'Click owned characters to add',
  'collection.deck.addRelics': 'Click owned relics to add',
  'collection.deck.addPotions': 'Click owned potions to add',
  'collection.deck.synergies': 'Active Synergies',
  'collection.deck.saved': 'Saved Decks',
  'collection.deck.none': 'No saved decks yet.',
  'collection.deck.summary': 'Characters: {characters} · Relics: {relics} · Potions: {potions} · Total: {total}',
  'collection.deck.active': 'Active',
  'collection.deck.activate': 'Activate',
  'collection.deck.edit': 'Edit',
  'collection.deck.delete': 'Delete deck {name}',
  'collection.deck.errorName': 'Enter a deck name',
  'collection.deck.notOwned': "You don't own: {cards}",
  'collection.modal.passive': 'Passive: {name}',
  'collection.modal.uses': 'Uses per battle: {n}',
  'collection.modal.ar': 'View in AR',
  'collection.modal.add': 'Add to Deck',
  'collection.modal.close': 'Close',
  'collection.achievements.title': 'Achievements',
  'collection.achievements.count': 'Unlocked: <b>{n}</b> / {total}',
};

export default messages;
