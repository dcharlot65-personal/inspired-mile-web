// 한국어. 고정 용어: 학급, 교사, 학생, 과제, 참여 코드; 매물(마켓), 대진표(토너먼트), 크레딧; 시, 결투, 카드는 게임의 다른 부분과 같아요. 말투: 해요체.
// Page area "season": the Season Pass (/season).
// Where each term comes from and how these strings were checked: docs/language/pages-rest.md
const messages: Record<string, string> = {
  'season.meta.title': '시즌 패스',
  'season.meta.description': '시즌 패스 레벨을 올려 Inspired Mile의 보상을 잠금 해제하세요.',
  'season.badge': '시즌 {n}',
  'season.title': '시즌 패스',
  'season.intro': '배틀, 퀴즈, 도전 과제를 플레이해 XP를 얻으세요. 레벨이 오를 때마다 카드, 크레딧, 칭호가 잠금 해제돼요.',
  'season.introNow': '시즌 패스의 각 레벨은 카드, 크레딧 또는 칭호를 잠금 해제해요. 이 버전의 게임에서는 플레이해도 XP를 얻을 수 없어요.',
  'season.loading': '불러오는 중…',
  'season.level': '레벨',
  'season.xp': '{n} XP',
  'season.xpGain': '{n} XP',
  'season.next': '다음 레벨까지 {n} XP',
  'season.maxed': '최고 레벨에 도달했어요',
  'season.track': '보상 트랙',
  'season.track.empty': '이번 시즌에는 아직 보상이 없어요.',
  'season.reward.level': '레벨 {n}',
  'season.reward.pack': '카드 팩: {name}',
  'season.reward.card': '카드: {name}',
  'season.reward.title': '칭호: {name}',
  'season.reward.unknown': '보상: {name}',
  'season.reward.premium': '프리미엄',
  'season.claim': '받기',
  'season.claimed': '받음',
  'season.locked': '레벨 {n}에 도달하세요',
  'season.signIn': '로그인하면 시즌 패스 진행 상황을 모든 기기에서 이어갈 수 있어요.',
};

export default messages;
