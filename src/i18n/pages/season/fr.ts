// Français. Termes fixes : classe, enseignant·e (écrit « enseignant ou enseignante »), élève, devoir, code d’accès ; annonce (marché), tableau (tournoi), crédits ; strophe, duel, carte comme dans le reste du jeu. Vouvoiement.
// Page area "season": the Season Pass (/season).
// Where each term comes from and how these strings were checked: docs/language/pages-rest.md
const messages: Record<string, string> = {
  'season.meta.title': 'Passe de saison',
  'season.meta.description': 'Faites monter le niveau de votre Passe de saison pour débloquer des récompenses dans Inspired Mile.',
  'season.badge': 'Saison {n}',
  'season.title': 'Passe de saison',
  'season.intro': 'Jouez des combats, des quiz et des défis pour gagner de l’XP. Chaque nouveau niveau débloque des cartes, des crédits et des titres.',
  'season.loading': 'Chargement…',
  'season.level': 'Niveau',
  'season.xp': '{n} XP',
  'season.xpGain': '+{n} XP',
  'season.next': 'Encore {n} XP avant le niveau suivant',
  'season.maxed': 'Niveau maximal atteint',
  'season.track': 'Parcours de récompenses',
  'season.track.empty': 'Cette saison n’a pas encore de récompenses.',
  'season.reward.level': 'Niveau {n}',
  'season.reward.pack': 'Paquet de cartes : {name}',
  'season.reward.card': 'Carte : {name}',
  'season.reward.title': 'Titre : {name}',
  'season.reward.unknown': 'Récompense : {name}',
  'season.reward.premium': 'Premium',
  'season.claim': 'Récupérer',
  'season.claimed': 'Récupérée',
  'season.locked': 'Atteignez le niveau {n}',
  'season.signIn': 'Connectez-vous pour conserver la progression de votre Passe de saison sur tous vos appareils.',
};

export default messages;
