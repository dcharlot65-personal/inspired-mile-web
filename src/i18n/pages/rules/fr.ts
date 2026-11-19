/**
 * What cards do and what a deck may hold (src/lib/battle-rules.ts): French.
 *
 * Same keys, {placeholders} and <b>/<a> marks as ./en.ts (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'rules.landIt': 'Réussissez-le pour ajouter la moitié de votre métier.',
  'rules.relic': 'Prête des mots de pouvoir\u00a0: {words}. Utilisez-en {n} pour gagner +{bonus} de métier.',
  'rules.potion': 'Maudit la prochaine strophe de votre adversaire avec {name}\u00a0: {rule}',
  'rules.potion.letter': 'Maudit la prochaine strophe de votre adversaire avec {name}\u00a0: sa strophe ne doit pas contenir une lettre, que la potion désigne à la distribution du duel.',
  'rules.cost': 'Coût en encre\u00a0: {n}.',
  'rules.synergy': '{house}, deux personnages ou plus\u00a0: {device} ajoute les trois quarts de votre métier au lieu de la moitié.',
  'rules.deck.minCharacters': 'Personnages dans un jeu\u00a0: au moins {n}.',
  'rules.deck.maxCharacters': 'Personnages dans un jeu\u00a0: au plus {n}.',
  'rules.deck.maxRelics': 'Reliques dans un jeu\u00a0: au plus {n}.',
  'rules.deck.maxPotions': 'Potions dans un jeu\u00a0: au plus {n}.',
  'rules.deck.totalMax': 'Cartes dans un jeu\u00a0: au plus {n}.',
  'rules.deck.unknownCard': 'Carte inconnue\u00a0: {id}',
  'rules.deck.notCharacter': '{card} n’est pas un personnage.',
  'rules.deck.notRelic': '{card} n’est pas une relique.',
  'rules.deck.notPotion': '{card} n’est pas une potion.',
};

export default messages;
