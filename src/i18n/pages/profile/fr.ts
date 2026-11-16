/**
 * The profile page: French.
 *
 * Same keys, {placeholders} and <b>/<a> marks as ./en.ts (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'profile.meta.description': 'Consultez vos statistiques, vos succès, votre collection et votre place au classement.',
  'profile.title': '<b>Profil</b> du joueur',
  'profile.intro': 'Suivez votre progression, vos succès et votre collection dans l’univers d’Inspired Mile.',
  'profile.guest': 'Joueur invité',
  'profile.local': 'Vous jouez en local. Connectez-vous pour synchroniser votre progression.',
  'profile.signedInAs': 'Connecté avec {email}',
  'profile.stat.wins': 'Combats gagnés',
  'profile.stat.battles': 'Combats au total',
  'profile.stat.winRate': 'Taux de victoire',
  'profile.stat.highScore': 'Meilleur score',
  'profile.stat.cards': 'Cartes (différentes / au total)',
  'profile.stat.trivia': 'Bonnes réponses au quiz',
  'profile.achievements': 'Succès',
  'profile.byHouse': 'Cartes par maison',
  'profile.byRarity': 'Cartes par rareté',
  'profile.collectFirst': 'Obtenez des cartes pour voir la répartition',
  'profile.leaderboard.title': 'Classement mondial',
  'profile.leaderboard.loading': 'Chargement du classement…',
  'profile.leaderboard.empty': 'Pas encore de données au classement. Gagnez des combats pour y figurer !',
  'profile.leaderboard.player': 'Joueur',
  'profile.leaderboard.wins': 'Victoires',
  'profile.leaderboard.battles': 'Combats',
  'profile.leaderboard.best': 'Meilleur',
  'profile.leaderboard.you': '{name} (vous)',
  'profile.leaderboard.unavailable': 'Classement indisponible',
  'profile.leaderboard.unavailableBody': 'Le service est en cours de mise en place. Revenez bientôt.',
  'profile.leaderboard.failed': 'Impossible de charger le classement.',
  'profile.recent.title': 'Activité récente',
  'profile.recent.cards': 'Dernières cartes',
  'profile.recent.noCards': 'Aucune carte obtenue pour l’instant.',
  'profile.recent.achievements': 'Derniers succès',
  'profile.recent.noAchievements': 'Aucun succès débloqué pour l’instant.',
};

export default messages;
