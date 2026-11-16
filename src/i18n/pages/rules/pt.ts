/**
 * What cards do and what a deck may hold (src/lib/battle-rules.ts): Portuguese (Brazil).
 *
 * Same keys, {placeholders} and <b>/<a> marks as ./en.ts (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'rules.landIt': 'Acerte para somar mais metade ao seu ofício.',
  'rules.relic': 'Empresta palavras de poder: {words}. Use {n} delas para ganhar +{bonus} de ofício.',
  'rules.potion': 'Amaldiçoa a próxima estrofe do seu adversário com {name}: {rule}',
  'rules.potion.letter': 'Amaldiçoa a próxima estrofe do seu adversário com {name}: a estrofe dele não pode conter uma letra, que a poção indica quando o duelo é distribuído.',
  'rules.cost': 'Custo de tinta: {n}.',
  'rules.synergy': '{house}, dois ou mais personagens: {device} soma três quartos ao seu ofício em vez de metade.',
  'rules.deck.minCharacters': 'Personagens em um baralho: no mínimo {n}.',
  'rules.deck.maxCharacters': 'Personagens em um baralho: no máximo {n}.',
  'rules.deck.maxRelics': 'Relíquias em um baralho: no máximo {n}.',
  'rules.deck.maxPotions': 'Poções em um baralho: no máximo {n}.',
  'rules.deck.totalMax': 'Cartas em um baralho: no máximo {n}.',
  'rules.deck.unknownCard': 'Carta desconhecida: {id}',
  'rules.deck.notCharacter': '{card} não é um personagem.',
  'rules.deck.notRelic': '{card} não é uma relíquia.',
  'rules.deck.notPotion': '{card} não é uma poção.',
};

export default messages;
