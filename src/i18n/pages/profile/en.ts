/**
 * The profile page: English.
 *
 * The reference: every other language has exactly these keys, with the same {placeholders}
 * and the same <b>/<a> marks (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'profile.meta.description': 'View your player stats, achievements, collection, and leaderboard ranking.',
  'profile.title': 'Player <b>Profile</b>',
  'profile.intro': 'Track your progress, achievements, and collection across the Inspired Mile universe.',
  'profile.guest': 'Guest Player',
  'profile.local': 'Playing locally. Sign in to sync your progress.',
  'profile.signedInAs': 'Signed in as {email}',
  'profile.stat.wins': 'Battle Wins',
  'profile.stat.battles': 'Total Battles',
  'profile.stat.winRate': 'Win Rate',
  'profile.stat.highScore': 'Highest Score',
  'profile.stat.cards': 'Cards (unique / total)',
  'profile.stat.trivia': 'Trivia Correct',
  'profile.achievements': 'Achievements',
  'profile.byHouse': 'Cards by House',
  'profile.byRarity': 'Cards by Rarity',
  'profile.collectFirst': 'Collect cards to see breakdown',
  'profile.leaderboard.title': 'Global Leaderboard',
  'profile.leaderboard.loading': 'Loading leaderboard…',
  'profile.leaderboard.empty': 'Nobody has won an online duel yet. Win one to appear here.',
  'profile.leaderboard.note': 'Online duels only, as the server judged them. Solo duels stay on your device.',
  'profile.leaderboard.player': 'Player',
  'profile.leaderboard.wins': 'Wins',
  'profile.leaderboard.battles': 'Battles',
  'profile.leaderboard.best': 'Best',
  'profile.leaderboard.you': '{name} (you)',
  'profile.leaderboard.unavailable': 'Leaderboard Unavailable',
  'profile.leaderboard.unavailableBody': 'The backend service is being set up. Check back shortly.',
  'profile.leaderboard.failed': 'Failed to load leaderboard.',
  'profile.recent.title': 'Recent Activity',
  'profile.recent.cards': 'Latest Cards',
  'profile.recent.noCards': 'No cards acquired yet.',
  'profile.recent.achievements': 'Latest Achievements',
  'profile.recent.noAchievements': 'No achievements unlocked yet.',
};

export default messages;
