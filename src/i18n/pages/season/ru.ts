// Русский. Постоянные термины: класс, учитель, ученик (где помещается, «ученик или ученица»), задание, код класса; объявление (рынок), турнирная сетка, кредиты; строфа, дуэль, карта как в остальной игре. Обращение на «ты», без указания рода.
// Page area "season": the Season Pass (/season).
// Where each term comes from and how these strings were checked: docs/language/pages-rest.md
const messages: Record<string, string> = {
  'season.meta.title': 'Сезонный пропуск',
  'season.meta.description': 'Повышай уровень сезонного пропуска, чтобы открывать награды в Inspired Mile.',
  'season.badge': 'Сезон {n}',
  'season.title': 'Сезонный пропуск',
  'season.intro': 'Играй в битвы, викторины и испытания, чтобы получать XP. Каждый новый уровень открывает карты, кредиты и титулы.',
  'season.loading': 'Загрузка…',
  'season.level': 'Уровень',
  'season.xp': '{n} XP',
  'season.xpGain': '{n} XP',
  'season.next': 'До следующего уровня: {n} XP',
  'season.maxed': 'Достигнут высший уровень',
  'season.track': 'Путь наград',
  'season.track.empty': 'В этом сезоне пока нет наград.',
  'season.reward.level': 'Уровень {n}',
  'season.reward.pack': 'Набор карт: {name}',
  'season.reward.card': 'Карта: {name}',
  'season.reward.title': 'Титул: {name}',
  'season.reward.unknown': 'Награда: {name}',
  'season.reward.premium': 'Премиум',
  'season.claim': 'Забрать',
  'season.claimed': 'Получено',
  'season.locked': 'Достигни уровня {n}',
  'season.signIn': 'Войди, чтобы прогресс сезонного пропуска сохранялся на всех устройствах.',
};

export default messages;
