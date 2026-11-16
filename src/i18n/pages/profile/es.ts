/**
 * The profile page: Spanish.
 *
 * Same keys, {placeholders} and <b>/<a> marks as ./en.ts (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'profile.meta.description': 'Consulta tus estadísticas, tus logros, tu colección y tu puesto en la clasificación.',
  'profile.title': '<b>Perfil</b> del jugador',
  'profile.intro': 'Sigue tu progreso, tus logros y tu colección en el universo de Inspired Mile.',
  'profile.guest': 'Jugador invitado',
  'profile.local': 'Juegas en local. Inicia sesión para sincronizar tu progreso.',
  'profile.signedInAs': 'Sesión iniciada como {email}',
  'profile.stat.wins': 'Batallas ganadas',
  'profile.stat.battles': 'Batallas en total',
  'profile.stat.winRate': 'Porcentaje de victorias',
  'profile.stat.highScore': 'Mejor puntuación',
  'profile.stat.cards': 'Cartas (distintas / en total)',
  'profile.stat.trivia': 'Preguntas acertadas',
  'profile.achievements': 'Logros',
  'profile.byHouse': 'Cartas por casa',
  'profile.byRarity': 'Cartas por rareza',
  'profile.collectFirst': 'Consigue cartas para ver el desglose',
  'profile.leaderboard.title': 'Clasificación mundial',
  'profile.leaderboard.loading': 'Cargando la clasificación…',
  'profile.leaderboard.empty': 'Aún no hay datos en la clasificación. Gana batallas para aparecer aquí.',
  'profile.leaderboard.player': 'Jugador',
  'profile.leaderboard.wins': 'Victorias',
  'profile.leaderboard.battles': 'Batallas',
  'profile.leaderboard.best': 'Mejor',
  'profile.leaderboard.you': '{name} (tú)',
  'profile.leaderboard.unavailable': 'Clasificación no disponible',
  'profile.leaderboard.unavailableBody': 'El servicio se está preparando. Vuelve dentro de poco.',
  'profile.leaderboard.failed': 'No se pudo cargar la clasificación.',
  'profile.recent.title': 'Actividad reciente',
  'profile.recent.cards': 'Últimas cartas',
  'profile.recent.noCards': 'Aún no has conseguido cartas.',
  'profile.recent.achievements': 'Últimos logros',
  'profile.recent.noAchievements': 'Aún no has desbloqueado logros.',
};

export default messages;
