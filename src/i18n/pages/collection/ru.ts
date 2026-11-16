/**
 * The collection page, its deck builder and card detail view: Russian.
 *
 * Same keys, {placeholders} and <b>/<a> marks as ./en.ts (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'collection.meta.title': 'Моя коллекция',
  'collection.meta.description': 'Просматривай свою коллекцию карт Inspired Mile: персонажи, реликвии и зелья из величайших произведений Шекспира.',
  'collection.title': 'Моя <b>коллекция</b>',
  'collection.intro': 'Твоя коллекция карт по Шекспиру. Закрытые карты можно заработать здесь: <a>Площадка</a>.',
  'collection.owned': 'Карт в коллекции: <b>{owned}</b> / {total}',
  'collection.filter.all': 'Все',
  'collection.filter.owned': 'Мои',
  'collection.locked': 'Закрыта',
  'collection.world.title': 'Карты мира',
  'collection.world.intro': 'Твои персонажи путешествуют по планете. Побеждай в битвах и проходи викторины без ошибок, чтобы открывать варианты городов.',
  'collection.world.empty': 'Вариантов пока нет. Выиграй три битвы подряд или пройди викторину без единой ошибки, чтобы открыть свою первую карту мира!',
  'collection.deck.title': 'Сборка колоды',
  'collection.deck.intro': 'Персонажи: от {min} до {max}. Реликвии: не больше {relics}. Зелья: не больше {potions}. Всего карт: не больше {total}. Нажимай выше на свои карты, чтобы добавить их.',
  'collection.deck.namePlaceholder': 'Название колоды…',
  'collection.deck.save': 'Сохранить колоду',
  'collection.deck.clear': 'Очистить',
  'collection.deck.addCharacters': 'Нажимай на своих персонажей, чтобы добавить их',
  'collection.deck.addRelics': 'Нажимай на свои реликвии, чтобы добавить их',
  'collection.deck.addPotions': 'Нажимай на свои зелья, чтобы добавить их',
  'collection.deck.synergies': 'Активные синергии',
  'collection.deck.saved': 'Сохранённые колоды',
  'collection.deck.none': 'Сохранённых колод пока нет.',
  'collection.deck.summary': 'Персонажи: {characters} · Реликвии: {relics} · Зелья: {potions} · Всего: {total}',
  'collection.deck.active': 'Активна',
  'collection.deck.activate': 'Сделать активной',
  'collection.deck.edit': 'Изменить',
  'collection.deck.delete': 'Удалить колоду {name}',
  'collection.deck.errorName': 'Введи название колоды',
  'collection.deck.notOwned': 'У тебя нет этих карт: {cards}',
  'collection.modal.passive': 'Пассивная способность: {name}',
  'collection.modal.uses': 'Применений за битву: {n}',
  'collection.modal.ar': 'Посмотреть в AR',
  'collection.modal.add': 'Добавить в колоду',
  'collection.modal.close': 'Закрыть',
  'collection.achievements.title': 'Достижения',
  'collection.achievements.count': 'Открыто: <b>{n}</b> / {total}',
};

export default messages;
