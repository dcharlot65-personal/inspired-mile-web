/**
 * The collection page, its deck builder and card detail view: Portuguese (Brazil).
 *
 * Same keys, {placeholders} and <b>/<a> marks as ./en.ts (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'collection.meta.title': 'Minha coleção',
  'collection.meta.description': 'Explore a sua coleção de cartas do Inspired Mile: personagens, relíquias e poções das maiores obras de Shakespeare.',
  'collection.title': 'Minha <b>coleção</b>',
  'collection.intro': 'Sua coleção de cartas de Shakespeare. As cartas bloqueadas podem ser ganhas na <a>Área de jogo</a>.',
  'collection.owned': 'Cartas que você tem: <b>{owned}</b> / {total}',
  'collection.filter.all': 'Todas',
  'collection.filter.owned': 'Minhas',
  'collection.locked': 'Bloqueada',
  'collection.world.title': 'Cartas do mundo',
  'collection.world.intro': 'Seus personagens viajam pelo planeta. Faça uma pontuação perfeita no quiz para desbloquear variantes de cidades.',
  'collection.world.empty': 'Ainda não há variantes. Faça uma pontuação perfeita no quiz para desbloquear a sua primeira carta do mundo!',
  'collection.deck.title': 'Montagem de baralhos',
  'collection.deck.intro': 'Personagens: de {min} a {max}. Relíquias: até {relics}. Poções: até {potions}. Cartas no total: até {total}. Clique acima nas cartas que você tem para adicioná-las.',
  'collection.deck.namePlaceholder': 'Nome do baralho…',
  'collection.deck.save': 'Salvar baralho',
  'collection.deck.clear': 'Limpar',
  'collection.deck.addCharacters': 'Clique nos seus personagens para adicioná-los',
  'collection.deck.addRelics': 'Clique nas suas relíquias para adicioná-las',
  'collection.deck.addPotions': 'Clique nas suas poções para adicioná-las',
  'collection.deck.synergies': 'Sinergias ativas',
  'collection.deck.saved': 'Baralhos salvos',
  'collection.deck.none': 'Ainda não há baralhos salvos.',
  'collection.deck.summary': 'Personagens: {characters} · Relíquias: {relics} · Poções: {potions} · Total: {total}',
  'collection.deck.active': 'Ativo',
  'collection.deck.activate': 'Ativar',
  'collection.deck.edit': 'Editar',
  'collection.deck.delete': 'Excluir o baralho {name}',
  'collection.deck.errorName': 'Dê um nome ao baralho',
  'collection.deck.notOwned': 'Você não tem: {cards}',
  'collection.modal.passive': 'Passiva: {name}',
  'collection.modal.uses': 'Usos por batalha: {n}',
  'collection.modal.ar': 'Ver em RA',
  'collection.modal.add': 'Adicionar ao baralho',
  'collection.modal.close': 'Fechar',
  'collection.achievements.title': 'Conquistas',
  'collection.achievements.count': 'Desbloqueadas: <b>{n}</b> / {total}',
};

export default messages;
