/**
 * The collection page, its deck builder and card detail view: German.
 *
 * Same keys, {placeholders} and <b>/<a> marks as ./en.ts (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'collection.meta.title': 'Meine Sammlung',
  'collection.meta.description': 'Stöbere in deiner Kartensammlung von Inspired Mile: Figuren, Relikte und Tränke aus Shakespeares größten Werken.',
  'collection.title': 'Meine <b>Sammlung</b>',
  'collection.intro': 'Deine Shakespeare-Kartensammlung. Gesperrte Karten kannst du dir auf der <a>Spielwiese</a> verdienen.',
  'collection.owned': 'Karten im Besitz: <b>{owned}</b> / {total}',
  'collection.filter.all': 'Alle',
  'collection.filter.owned': 'Im Besitz',
  'collection.locked': 'Gesperrt',
  'collection.world.title': 'Weltkarten',
  'collection.world.intro': 'Deine Figuren reisen um den Globus. Schaffe ein fehlerfreies Quiz, um Stadtvarianten freizuschalten.',
  'collection.world.empty': 'Noch keine Varianten. Schaffe ein fehlerfreies Quiz, um deine erste Weltkarte freizuschalten!',
  'collection.deck.title': 'Deckbau',
  'collection.deck.intro': 'Figuren: {min} bis {max}. Relikte: bis zu {relics}. Tränke: bis zu {potions}. Karten insgesamt: bis zu {total}. Klick oben auf Karten, die du besitzt, um sie hinzuzufügen.',
  'collection.deck.namePlaceholder': 'Name des Decks\u00a0…',
  'collection.deck.save': 'Deck speichern',
  'collection.deck.clear': 'Leeren',
  'collection.deck.addCharacters': 'Klick auf deine Figuren, um sie hinzuzufügen',
  'collection.deck.addRelics': 'Klick auf deine Relikte, um sie hinzuzufügen',
  'collection.deck.addPotions': 'Klick auf deine Tränke, um sie hinzuzufügen',
  'collection.deck.synergies': 'Aktive Synergien',
  'collection.deck.saved': 'Gespeicherte Decks',
  'collection.deck.none': 'Noch keine gespeicherten Decks.',
  'collection.deck.summary': 'Figuren: {characters} · Relikte: {relics} · Tränke: {potions} · Gesamt: {total}',
  'collection.deck.active': 'Aktiv',
  'collection.deck.activate': 'Aktivieren',
  'collection.deck.edit': 'Bearbeiten',
  'collection.deck.delete': 'Deck {name} löschen',
  'collection.deck.errorName': 'Gib dem Deck einen Namen',
  'collection.deck.notOwned': 'Das besitzt du nicht: {cards}',
  'collection.modal.passive': 'Passiv: {name}',
  'collection.modal.uses': 'Einsätze pro Kampf: {n}',
  'collection.modal.ar': 'In AR ansehen',
  'collection.modal.add': 'Zum Deck hinzufügen',
  'collection.modal.close': 'Schließen',
  'collection.achievements.title': 'Erfolge',
  'collection.achievements.count': 'Freigeschaltet: <b>{n}</b> / {total}',
};

export default messages;
