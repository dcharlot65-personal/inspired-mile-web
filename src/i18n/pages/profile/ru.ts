/**
 * The profile page: Russian.
 *
 * Same keys, {placeholders} and <b>/<a> marks as ./en.ts (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'profile.meta.description': 'Смотри свою статистику, достижения, коллекцию и место в таблице лидеров.',
  'profile.title': '<b>Профиль</b> игрока',
  'profile.intro': 'Следи за своим прогрессом, достижениями и коллекцией во вселенной Inspired Mile.',
  'profile.guest': 'Гость',
  'profile.local': 'Ты играешь локально. Войди, чтобы синхронизировать прогресс.',
  'profile.signedInAs': 'Вход выполнен: {email}',
  'profile.stat.wins': 'Побед в битвах',
  'profile.stat.battles': 'Всего битв',
  'profile.stat.winRate': 'Доля побед',
  'profile.stat.highScore': 'Лучший счёт',
  'profile.stat.cards': 'Карты (разных / всего)',
  'profile.stat.trivia': 'Верных ответов в викторине',
  'profile.achievements': 'Достижения',
  'profile.byHouse': 'Карты по домам',
  'profile.byRarity': 'Карты по редкости',
  'profile.collectFirst': 'Собери карты, чтобы увидеть распределение',
  'profile.leaderboard.title': 'Мировая таблица лидеров',
  'profile.leaderboard.loading': 'Загрузка таблицы лидеров…',
  'profile.leaderboard.empty': 'В таблице лидеров пока нет данных. Побеждай в битвах, чтобы попасть сюда!',
  'profile.leaderboard.player': 'Игрок',
  'profile.leaderboard.wins': 'Победы',
  'profile.leaderboard.battles': 'Битвы',
  'profile.leaderboard.best': 'Рекорд',
  'profile.leaderboard.you': '{name} (ты)',
  'profile.leaderboard.unavailable': 'Таблица лидеров недоступна',
  'profile.leaderboard.unavailableBody': 'Сервис сейчас настраивается. Загляни чуть позже.',
  'profile.leaderboard.failed': 'Не удалось загрузить таблицу лидеров.',
  'profile.recent.title': 'Недавняя активность',
  'profile.recent.cards': 'Последние карты',
  'profile.recent.noCards': 'Карт пока нет.',
  'profile.recent.achievements': 'Последние достижения',
  'profile.recent.noAchievements': 'Достижений пока нет.',
};

export default messages;
