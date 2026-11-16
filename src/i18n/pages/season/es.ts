// Español. Términos fijos: clase (el grupo), docente, estudiante, tarea, código de acceso; anuncio (mercado), cuadro (torneo), créditos; estrofa, duelo, carta como en el resto del juego. Tratamiento: tú.
// Page area "season": the Season Pass (/season).
// Where each term comes from and how these strings were checked: docs/language/pages-rest.md
const messages: Record<string, string> = {
  'season.meta.title': 'Pase de temporada',
  'season.meta.description': 'Sube de nivel tu Pase de temporada para desbloquear recompensas en Inspired Mile.',
  'season.badge': 'Temporada {n}',
  'season.title': 'Pase de temporada',
  'season.intro': 'Juega batallas, trivial y desafíos para ganar XP. Cada nuevo nivel desbloquea cartas, créditos y títulos.',
  'season.loading': 'Cargando…',
  'season.level': 'Nivel',
  'season.xp': '{n} XP',
  'season.xpGain': '+{n} XP',
  'season.next': 'Faltan {n} XP para el siguiente nivel',
  'season.maxed': 'Nivel máximo alcanzado',
  'season.track': 'Ruta de recompensas',
  'season.track.empty': 'Esta temporada todavía no tiene recompensas.',
  'season.reward.level': 'Nivel {n}',
  'season.reward.pack': 'Sobre de cartas: {name}',
  'season.reward.card': 'Carta: {name}',
  'season.reward.title': 'Título: {name}',
  'season.reward.unknown': 'Recompensa: {name}',
  'season.reward.premium': 'Prémium',
  'season.claim': 'Reclamar',
  'season.claimed': 'Reclamada',
  'season.locked': 'Alcanza el nivel {n}',
  'season.signIn': 'Inicia sesión para conservar el progreso de tu Pase de temporada en todos tus dispositivos.',
};

export default messages;
