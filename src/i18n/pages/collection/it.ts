/**
 * The collection page, its deck builder and card detail view: Italian.
 *
 * Same keys, {placeholders} and <b>/<a> marks as ./en.ts (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'collection.meta.title': 'La mia collezione',
  'collection.meta.description': 'Sfoglia la tua collezione di carte di Inspired Mile: personaggi, reliquie e pozioni dalle più grandi opere di Shakespeare.',
  'collection.title': 'La mia <b>collezione</b>',
  'collection.intro': 'La tua collezione di carte di Shakespeare. Le carte bloccate si guadagnano nell’<a>Area di gioco</a>.',
  'collection.owned': 'Carte possedute: <b>{owned}</b> / {total}',
  'collection.filter.all': 'Tutte',
  'collection.filter.owned': 'Possedute',
  'collection.locked': 'Bloccata',
  'collection.world.title': 'Carte del mondo',
  'collection.world.intro': 'I tuoi personaggi girano il mondo. Ottieni un punteggio perfetto al quiz per sbloccare le varianti delle città.',
  'collection.world.empty': 'Ancora nessuna variante. Ottieni un punteggio perfetto al quiz per sbloccare la tua prima carta del mondo!',
  'collection.deck.title': 'Costruzione del mazzo',
  'collection.deck.intro': 'Personaggi: da {min} a {max}. Reliquie: fino a {relics}. Pozioni: fino a {potions}. Carte in tutto: fino a {total}. Fai clic qui sopra sulle carte che possiedi per aggiungerle.',
  'collection.deck.namePlaceholder': 'Nome del mazzo…',
  'collection.deck.save': 'Salva il mazzo',
  'collection.deck.clear': 'Svuota',
  'collection.deck.addCharacters': 'Fai clic sui tuoi personaggi per aggiungerli',
  'collection.deck.addRelics': 'Fai clic sulle tue reliquie per aggiungerle',
  'collection.deck.addPotions': 'Fai clic sulle tue pozioni per aggiungerle',
  'collection.deck.synergies': 'Sinergie attive',
  'collection.deck.saved': 'Mazzi salvati',
  'collection.deck.none': 'Ancora nessun mazzo salvato.',
  'collection.deck.summary': 'Personaggi: {characters} · Reliquie: {relics} · Pozioni: {potions} · Totale: {total}',
  'collection.deck.active': 'Attivo',
  'collection.deck.activate': 'Attiva',
  'collection.deck.edit': 'Modifica',
  'collection.deck.delete': 'Elimina il mazzo {name}',
  'collection.deck.errorName': 'Dai un nome al mazzo',
  'collection.deck.notOwned': 'Non possiedi: {cards}',
  'collection.modal.passive': 'Passiva: {name}',
  'collection.modal.uses': 'Usi per battaglia: {n}',
  'collection.modal.ar': 'Guarda in AR',
  'collection.modal.add': 'Aggiungi al mazzo',
  'collection.modal.close': 'Chiudi',
  'collection.achievements.title': 'Obiettivi',
  'collection.achievements.count': 'Sbloccati: <b>{n}</b> / {total}',
};

export default messages;
