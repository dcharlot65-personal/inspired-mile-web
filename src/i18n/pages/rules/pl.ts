/**
 * What cards do and what a deck may hold (src/lib/battle-rules.ts): Polish.
 *
 * Same keys, {placeholders} and <b>/<a> marks as ./en.ts (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'rules.landIt': 'Wykonaj go, a twój kunszt wzrośnie o połowę.',
  'rules.relic': 'Użycza słów mocy: {words}. Użyj {n} z nich, aby zyskać +{bonus} do kunsztu.',
  'rules.potion': 'Rzuca na następną strofę rywala klątwę {name}: {rule}',
  'rules.potion.letter': 'Rzuca na następną strofę rywala klątwę {name}: jego strofa nie może zawierać jednej litery, którą mikstura wskazuje przy rozdaniu pojedynku.',
  'rules.cost': 'Koszt w atramencie: {n}.',
  'rules.synergy': '{house}, co najmniej dwie postacie: {device} dodaje trzy czwarte kunsztu zamiast połowy.',
  'rules.deck.minCharacters': 'Postacie w talii: co najmniej {n}.',
  'rules.deck.maxCharacters': 'Postacie w talii: najwyżej {n}.',
  'rules.deck.maxRelics': 'Relikwie w talii: najwyżej {n}.',
  'rules.deck.maxPotions': 'Mikstury w talii: najwyżej {n}.',
  'rules.deck.totalMax': 'Karty w talii: najwyżej {n}.',
  'rules.deck.unknownCard': 'Nieznana karta: {id}',
  'rules.deck.notCharacter': 'Karta {card} nie jest postacią.',
  'rules.deck.notRelic': 'Karta {card} nie jest relikwią.',
  'rules.deck.notPotion': 'Karta {card} nie jest miksturą.',
};

export default messages;
