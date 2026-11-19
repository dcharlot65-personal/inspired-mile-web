// 日本語。用語は固定：クラス、教員、生徒、課題、参加コード；出品（マーケット）、トーナメント表、クレジット；詩、決闘、カードはゲームのほかの部分と同じ。文体は「です・ます」。
// Page area "season": the Season Pass (/season).
// Where each term comes from and how these strings were checked: docs/language/pages-rest.md
const messages: Record<string, string> = {
  'season.meta.title': 'シーズンパス',
  'season.meta.description': 'シーズンパスのレベルを上げて、Inspired Mileの報酬を解除しましょう。',
  'season.badge': 'シーズン{n}',
  'season.title': 'シーズンパス',
  'season.intro': 'バトル、クイズ、チャレンジをプレイしてXPを獲得しましょう。レベルが上がるたびに、カード、クレジット、称号が解除されます。',
  'season.introNow': 'シーズンパスの各レベルで、カード、クレジット、称号のいずれかが解除されます。このバージョンのゲームでは、プレイしてもXPは獲得できません。',
  'season.loading': '読み込み中…',
  'season.level': 'レベル',
  'season.xp': '{n} XP',
  'season.xpGain': '{n} XP',
  'season.next': '次のレベルまであと {n} XP',
  'season.maxed': '最高レベルに到達しました',
  'season.track': '報酬トラック',
  'season.track.empty': 'このシーズンの報酬はまだありません。',
  'season.reward.level': 'レベル{n}',
  'season.reward.pack': 'カードパック：{name}',
  'season.reward.card': 'カード：{name}',
  'season.reward.title': '称号：{name}',
  'season.reward.unknown': '報酬：{name}',
  'season.reward.premium': 'プレミアム',
  'season.claim': '受け取る',
  'season.claimed': '受け取り済み',
  'season.locked': 'レベル{n}で解除',
  'season.signIn': 'サインインすると、シーズンパスの進行状況をどの端末でも引き継げます。',
};

export default messages;
