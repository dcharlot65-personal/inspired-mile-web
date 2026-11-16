/**
 * What cards do and what a deck may hold (src/lib/battle-rules.ts): Italian.
 *
 * Same keys, {placeholders} and <b>/<a> marks as ./en.ts (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'rules.landIt': 'Mettilo a segno per aggiungere la metà al tuo mestiere.',
  'rules.relic': 'Presta parole di potere: {words}. Usane {n} per ottenere +{bonus} di mestiere.',
  'rules.potion': 'Maledice la prossima strofa del tuo avversario con {name}: {rule}',
  'rules.potion.letter': 'Maledice la prossima strofa del tuo avversario con {name}: la sua strofa non può contenere una lettera, che la pozione indica quando il duello viene distribuito.',
  'rules.cost': 'Costo in inchiostro: {n}.',
  'rules.synergy': '{house}, due o più personaggi: {device} aggiunge tre quarti al tuo mestiere invece della metà.',
  'rules.deck.minCharacters': 'Personaggi in un mazzo: almeno {n}.',
  'rules.deck.maxCharacters': 'Personaggi in un mazzo: al massimo {n}.',
  'rules.deck.maxRelics': 'Reliquie in un mazzo: al massimo {n}.',
  'rules.deck.maxPotions': 'Pozioni in un mazzo: al massimo {n}.',
  'rules.deck.totalMax': 'Carte in un mazzo: al massimo {n}.',
  'rules.deck.unknownCard': 'Carta sconosciuta: {id}',
  'rules.deck.notCharacter': '{card} non è un personaggio.',
  'rules.deck.notRelic': '{card} non è una reliquia.',
  'rules.deck.notPotion': '{card} non è una pozione.',
};

export default messages;
