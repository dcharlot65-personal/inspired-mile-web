/**
 * The collection page, its deck builder and card detail view: French.
 *
 * Same keys, {placeholders} and <b>/<a> marks as ./en.ts (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'collection.meta.title': 'Ma collection',
  'collection.meta.description': 'Parcourez votre collection de cartes Inspired Mile : personnages, reliques et potions tirés des plus grandes œuvres de Shakespeare.',
  'collection.title': 'Ma <b>collection</b>',
  'collection.intro': 'Votre collection de cartes Shakespeare. Les cartes verrouillées se gagnent sur le <a>Terrain de jeu</a>.',
  'collection.owned': 'Cartes possédées : <b>{owned}</b> / {total}',
  'collection.filter.all': 'Toutes',
  'collection.filter.owned': 'Possédées',
  'collection.locked': 'Verrouillée',
  'collection.world.title': 'Cartes du monde',
  'collection.world.intro': 'Vos personnages parcourent le globe. Gagnez des combats et réussissez les quiz pour débloquer des variantes de villes.',
  'collection.world.empty': 'Aucune variante pour l’instant. Gagnez trois combats d’affilée ou obtenez un score parfait au quiz pour débloquer votre première carte du monde !',
  'collection.deck.title': 'Composition du jeu',
  'collection.deck.intro': 'Personnages : de {min} à {max}. Reliques : jusqu’à {relics}. Potions : jusqu’à {potions}. Cartes au total : jusqu’à {total}. Cliquez ci-dessus sur les cartes que vous possédez pour les ajouter.',
  'collection.deck.namePlaceholder': 'Nom du jeu…',
  'collection.deck.save': 'Enregistrer le jeu',
  'collection.deck.clear': 'Vider',
  'collection.deck.addCharacters': 'Cliquez sur vos personnages pour les ajouter',
  'collection.deck.addRelics': 'Cliquez sur vos reliques pour les ajouter',
  'collection.deck.addPotions': 'Cliquez sur vos potions pour les ajouter',
  'collection.deck.synergies': 'Synergies actives',
  'collection.deck.saved': 'Jeux enregistrés',
  'collection.deck.none': 'Aucun jeu enregistré pour l’instant.',
  'collection.deck.summary': 'Personnages : {characters} · Reliques : {relics} · Potions : {potions} · Total : {total}',
  'collection.deck.active': 'Actif',
  'collection.deck.activate': 'Activer',
  'collection.deck.edit': 'Modifier',
  'collection.deck.delete': 'Supprimer le jeu {name}',
  'collection.deck.errorName': 'Donnez un nom au jeu',
  'collection.deck.notOwned': 'Vous ne possédez pas : {cards}',
  'collection.modal.passive': 'Passif : {name}',
  'collection.modal.uses': 'Utilisations par combat : {n}',
  'collection.modal.ar': 'Voir en RA',
  'collection.modal.add': 'Ajouter au jeu',
  'collection.modal.close': 'Fermer',
  'collection.achievements.title': 'Succès',
  'collection.achievements.count': 'Débloqués : <b>{n}</b> / {total}',
};

export default messages;
