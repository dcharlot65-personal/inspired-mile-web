/**
 * The collection page, its deck builder and card detail view: Spanish.
 *
 * Same keys, {placeholders} and <b>/<a> marks as ./en.ts (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'collection.meta.title': 'Mi colección',
  'collection.meta.description': 'Explora tu colección de cartas de Inspired Mile: personajes, reliquias y pociones de las grandes obras de Shakespeare.',
  'collection.title': 'Mi <b>colección</b>',
  'collection.intro': 'Tu colección de cartas de Shakespeare. Las cartas bloqueadas se ganan en la <a>Zona de juego</a>.',
  'collection.owned': 'Cartas en tu poder: <b>{owned}</b> / {total}',
  'collection.filter.all': 'Todas',
  'collection.filter.owned': 'Las mías',
  'collection.locked': 'Bloqueada',
  'collection.world.title': 'Cartas del mundo',
  'collection.world.intro': 'Tus personajes recorren el planeta. Gana batallas y arrasa en el Trivial para desbloquear variantes de ciudades.',
  'collection.world.empty': 'Aún no hay variantes. ¡Gana tres batallas seguidas o consigue una puntuación perfecta en el Trivial para desbloquear tu primera carta del mundo!',
  'collection.deck.title': 'Creador de mazos',
  'collection.deck.intro': 'Personajes: de {min} a {max}. Reliquias: hasta {relics}. Pociones: hasta {potions}. Cartas en total: hasta {total}. Haz clic arriba en las cartas que tienes para añadirlas.',
  'collection.deck.namePlaceholder': 'Nombre del mazo…',
  'collection.deck.save': 'Guardar mazo',
  'collection.deck.clear': 'Vaciar',
  'collection.deck.addCharacters': 'Haz clic en tus personajes para añadirlos',
  'collection.deck.addRelics': 'Haz clic en tus reliquias para añadirlas',
  'collection.deck.addPotions': 'Haz clic en tus pociones para añadirlas',
  'collection.deck.synergies': 'Sinergias activas',
  'collection.deck.saved': 'Mazos guardados',
  'collection.deck.none': 'Aún no hay mazos guardados.',
  'collection.deck.summary': 'Personajes: {characters} · Reliquias: {relics} · Pociones: {potions} · Total: {total}',
  'collection.deck.active': 'Activo',
  'collection.deck.activate': 'Activar',
  'collection.deck.edit': 'Editar',
  'collection.deck.delete': 'Eliminar el mazo {name}',
  'collection.deck.errorName': 'Escribe un nombre para el mazo',
  'collection.deck.notOwned': 'No tienes: {cards}',
  'collection.modal.passive': 'Pasiva: {name}',
  'collection.modal.uses': 'Usos por batalla: {n}',
  'collection.modal.ar': 'Ver en RA',
  'collection.modal.add': 'Añadir al mazo',
  'collection.modal.close': 'Cerrar',
  'collection.achievements.title': 'Logros',
  'collection.achievements.count': 'Desbloqueados: <b>{n}</b> / {total}',
};

export default messages;
