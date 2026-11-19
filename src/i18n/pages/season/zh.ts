// 简体中文。固定用语：班级、教师、学生、作业、加入码；挂单（市场）、对阵表（锦标赛）、点数（credits）；诗、对决、卡牌与游戏其他部分一致。称呼：你。
// Page area "season": the Season Pass (/season).
// Where each term comes from and how these strings were checked: docs/language/pages-rest.md
const messages: Record<string, string> = {
  'season.meta.title': '赛季通行证',
  'season.meta.description': '提升赛季通行证的等级，解锁 Inspired Mile 的奖励。',
  'season.badge': '第 {n} 赛季',
  'season.title': '赛季通行证',
  'season.intro': '参加对战、问答和挑战来获得 XP。每升一级都会解锁卡牌、点数和称号。',
  'season.loading': '加载中…',
  'season.level': '等级',
  'season.xp': '{n} XP',
  'season.xpGain': '{n} XP',
  'season.next': '距离下一级还差 {n} XP',
  'season.maxed': '已达到最高等级',
  'season.track': '奖励之路',
  'season.track.empty': '本赛季还没有奖励。',
  'season.reward.level': '第 {n} 级',
  'season.reward.pack': '卡包：{name}',
  'season.reward.card': '卡牌：{name}',
  'season.reward.title': '称号：{name}',
  'season.reward.unknown': '奖励：{name}',
  'season.reward.premium': '高级',
  'season.claim': '领取',
  'season.claimed': '已领取',
  'season.locked': '达到第 {n} 级后解锁',
  'season.signIn': '登录后，你的赛季通行证进度会保存在所有设备上。',
};

export default messages;
