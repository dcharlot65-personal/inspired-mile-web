/**
 * The collection page, its deck builder and card detail view: Polish.
 *
 * Same keys, {placeholders} and <b>/<a> marks as ./en.ts (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'collection.meta.title': 'Moja kolekcja',
  'collection.meta.description': 'Przeglądaj swoją kolekcję kart Inspired Mile: postacie, relikwie i mikstury z największych dzieł Szekspira.',
  'collection.title': 'Moja <b>kolekcja</b>',
  'collection.intro': 'Twoja kolekcja kart z Szekspira. Zablokowane karty zdobędziesz tutaj: <a>Plac zabaw</a>.',
  'collection.owned': 'Posiadane karty: <b>{owned}</b> / {total}',
  'collection.filter.all': 'Wszystkie',
  'collection.filter.owned': 'Posiadane',
  'collection.locked': 'Zablokowana',
  'collection.world.title': 'Karty świata',
  'collection.world.intro': 'Twoje postacie podróżują po świecie. Zdobądź komplet punktów w quizie, aby odblokować warianty miast.',
  'collection.world.empty': 'Nie masz jeszcze wariantów. Zdobądź komplet punktów w quizie, aby odblokować pierwszą kartę świata!',
  'collection.deck.title': 'Budowanie talii',
  'collection.deck.intro': 'Postacie: od {min} do {max}. Relikwie: najwyżej {relics}. Mikstury: najwyżej {potions}. Karty łącznie: najwyżej {total}. Kliknij powyżej posiadane karty, aby je dodać.',
  'collection.deck.namePlaceholder': 'Nazwa talii…',
  'collection.deck.save': 'Zapisz talię',
  'collection.deck.clear': 'Wyczyść',
  'collection.deck.addCharacters': 'Kliknij posiadane postacie, aby je dodać',
  'collection.deck.addRelics': 'Kliknij posiadane relikwie, aby je dodać',
  'collection.deck.addPotions': 'Kliknij posiadane mikstury, aby je dodać',
  'collection.deck.synergies': 'Aktywne synergie',
  'collection.deck.saved': 'Zapisane talie',
  'collection.deck.none': 'Nie ma jeszcze zapisanych talii.',
  'collection.deck.summary': 'Postacie: {characters} · Relikwie: {relics} · Mikstury: {potions} · Razem: {total}',
  'collection.deck.active': 'Aktywna',
  'collection.deck.activate': 'Aktywuj',
  'collection.deck.edit': 'Edytuj',
  'collection.deck.delete': 'Usuń talię {name}',
  'collection.deck.errorName': 'Wpisz nazwę talii',
  'collection.deck.notOwned': 'Nie masz tych kart: {cards}',
  'collection.modal.passive': 'Zdolność bierna: {name}',
  'collection.modal.uses': 'Użycia na bitwę: {n}',
  'collection.modal.ar': 'Zobacz w AR',
  'collection.modal.add': 'Dodaj do talii',
  'collection.modal.close': 'Zamknij',
  'collection.achievements.title': 'Osiągnięcia',
  'collection.achievements.count': 'Odblokowane: <b>{n}</b> / {total}',
};

export default messages;
