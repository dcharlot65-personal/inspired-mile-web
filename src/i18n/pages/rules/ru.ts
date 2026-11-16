/**
 * What cards do and what a deck may hold (src/lib/battle-rules.ts): Russian.
 *
 * Same keys, {placeholders} and <b>/<a> marks as ./en.ts (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'rules.landIt': 'Выполни приём, и мастерство вырастет в полтора раза.',
  'rules.relic': 'Даёт слова силы: {words}. Используй {n} из них, чтобы получить +{bonus} к мастерству.',
  'rules.potion': 'Накладывает на следующую строфу соперника проклятие «{name}»: {rule}',
  'rules.potion.letter': 'Накладывает на следующую строфу соперника проклятие «{name}»: в его строфе не должно быть одной буквы, которую зелье называет при раздаче дуэли.',
  'rules.cost': 'Цена в чернилах: {n}.',
  'rules.synergy': '{house}, не меньше двух персонажей: {device} добавляет три четверти мастерства вместо половины.',
  'rules.deck.minCharacters': 'Персонажей в колоде: не меньше {n}.',
  'rules.deck.maxCharacters': 'Персонажей в колоде: не больше {n}.',
  'rules.deck.maxRelics': 'Реликвий в колоде: не больше {n}.',
  'rules.deck.maxPotions': 'Зелий в колоде: не больше {n}.',
  'rules.deck.totalMax': 'Карт в колоде: не больше {n}.',
  'rules.deck.unknownCard': 'Неизвестная карта: {id}',
  'rules.deck.notCharacter': 'Карта «{card}» не является персонажем.',
  'rules.deck.notRelic': 'Карта «{card}» не является реликвией.',
  'rules.deck.notPotion': 'Карта «{card}» не является зельем.',
};

export default messages;
