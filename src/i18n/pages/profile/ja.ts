/**
 * The profile page: Japanese.
 *
 * Same keys, {placeholders} and <b>/<a> marks as ./en.ts (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'profile.meta.description': 'あなたの戦績、実績、コレクション、ランキングの順位を確認できます。',
  'profile.title': 'プレイヤー<b>プロフィール</b>',
  'profile.intro': 'Inspired Mileの世界での進み具合、実績、コレクションを確認できます。',
  'profile.guest': 'ゲストプレイヤー',
  'profile.local': 'この端末だけで遊んでいます。サインインすると進み具合を同期できます。',
  'profile.signedInAs': '{email}でサインイン中',
  'profile.stat.wins': 'バトルの勝利数',
  'profile.stat.battles': 'バトルの総数',
  'profile.stat.winRate': '勝率',
  'profile.stat.highScore': '最高得点',
  'profile.stat.cards': 'カード（種類 / 総数）',
  'profile.stat.trivia': 'クイズの正解数',
  'profile.achievements': '実績',
  'profile.byHouse': '家門別のカード',
  'profile.byRarity': 'レアリティ別のカード',
  'profile.collectFirst': 'カードを集めると内訳が表示されます',
  'profile.leaderboard.title': '世界ランキング',
  'profile.leaderboard.loading': 'ランキングを読み込んでいます…',
  'profile.leaderboard.empty': 'ランキングのデータはまだありません。バトルに勝つとここに載ります！',
  'profile.leaderboard.player': 'プレイヤー',
  'profile.leaderboard.wins': '勝利',
  'profile.leaderboard.battles': 'バトル',
  'profile.leaderboard.best': 'ベスト',
  'profile.leaderboard.you': '{name}（あなた）',
  'profile.leaderboard.unavailable': 'ランキングは利用できません',
  'profile.leaderboard.unavailableBody': 'サービスを準備しています。少ししてからもう一度ご覧ください。',
  'profile.leaderboard.failed': 'ランキングを読み込めませんでした。',
  'profile.recent.title': '最近のアクティビティ',
  'profile.recent.cards': '最近のカード',
  'profile.recent.noCards': '手に入れたカードはまだありません。',
  'profile.recent.achievements': '最近の実績',
  'profile.recent.noAchievements': '解除した実績はまだありません。',
};

export default messages;
