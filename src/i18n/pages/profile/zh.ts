/**
 * The profile page: Chinese (Simplified).
 *
 * Same keys, {placeholders} and <b>/<a> marks as ./en.ts (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'profile.meta.description': '查看你的战绩、成就、收藏和排行榜名次。',
  'profile.title': '玩家<b>资料</b>',
  'profile.intro': '在 Inspired Mile 的世界里记录你的进度、成就和收藏。',
  'profile.guest': '访客玩家',
  'profile.local': '你正在本机游玩。登录后可同步进度。',
  'profile.signedInAs': '已登录：{email}',
  'profile.stat.wins': '对战胜场',
  'profile.stat.battles': '对战总数',
  'profile.stat.winRate': '胜率',
  'profile.stat.highScore': '最高得分',
  'profile.stat.cards': '卡牌（不同 / 总数）',
  'profile.stat.trivia': '问答答对数',
  'profile.achievements': '成就',
  'profile.byHouse': '各家族卡牌',
  'profile.byRarity': '各稀有度卡牌',
  'profile.collectFirst': '收集卡牌后可查看分布',
  'profile.leaderboard.title': '全球排行榜',
  'profile.leaderboard.loading': '正在加载排行榜…',
  'profile.leaderboard.empty': '还没有人赢过在线对决。赢一场即可出现在这里。',
  'profile.leaderboard.note': '只计算服务器裁定的在线对决。单人对决留在你的设备上。',
  'profile.leaderboard.player': '玩家',
  'profile.leaderboard.wins': '胜场',
  'profile.leaderboard.battles': '对战',
  'profile.leaderboard.best': '最佳',
  'profile.leaderboard.you': '{name}（你）',
  'profile.leaderboard.unavailable': '排行榜暂不可用',
  'profile.leaderboard.unavailableBody': '服务正在搭建中，请稍后再来。',
  'profile.leaderboard.failed': '排行榜加载失败。',
  'profile.recent.title': '近期动态',
  'profile.recent.cards': '最新卡牌',
  'profile.recent.noCards': '还没有获得卡牌。',
  'profile.recent.achievements': '最新成就',
  'profile.recent.noAchievements': '还没有解锁成就。',
};

export default messages;
