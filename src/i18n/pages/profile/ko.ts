/**
 * The profile page: Korean.
 *
 * Same keys, {placeholders} and <b>/<a> marks as ./en.ts (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'profile.meta.description': '내 전적, 업적, 컬렉션, 순위표 순위를 확인하세요.',
  'profile.title': '플레이어 <b>프로필</b>',
  'profile.intro': 'Inspired Mile 세계에서 쌓은 진행 상황, 업적, 컬렉션을 확인하세요.',
  'profile.guest': '게스트 플레이어',
  'profile.local': '이 기기에서만 플레이하고 있어요. 로그인하면 진행 상황을 동기화할 수 있어요.',
  'profile.signedInAs': '{email}(으)로 로그인됨',
  'profile.stat.wins': '배틀 승리',
  'profile.stat.battles': '전체 배틀',
  'profile.stat.winRate': '승률',
  'profile.stat.highScore': '최고 점수',
  'profile.stat.cards': '카드 (종류 / 전체)',
  'profile.stat.trivia': '퀴즈 정답',
  'profile.achievements': '업적',
  'profile.byHouse': '가문별 카드',
  'profile.byRarity': '희귀도별 카드',
  'profile.collectFirst': '카드를 모으면 분포를 볼 수 있어요',
  'profile.leaderboard.title': '세계 순위표',
  'profile.leaderboard.loading': '순위표를 불러오는 중…',
  'profile.leaderboard.empty': '아직 온라인 결투에서 이긴 사람이 없어요. 이기면 여기에 표시돼요.',
  'profile.leaderboard.note': '서버가 판정한 온라인 결투만 집계해요. 혼자 한 결투는 내 기기에 남아요.',
  'profile.leaderboard.player': '플레이어',
  'profile.leaderboard.wins': '승리',
  'profile.leaderboard.battles': '배틀',
  'profile.leaderboard.best': '최고',
  'profile.leaderboard.you': '{name} (나)',
  'profile.leaderboard.unavailable': '순위표를 사용할 수 없어요',
  'profile.leaderboard.unavailableBody': '서비스를 준비하고 있어요. 잠시 후 다시 확인해 주세요.',
  'profile.leaderboard.failed': '순위표를 불러오지 못했어요.',
  'profile.recent.title': '최근 활동',
  'profile.recent.cards': '최근 카드',
  'profile.recent.noCards': '아직 얻은 카드가 없어요.',
  'profile.recent.achievements': '최근 업적',
  'profile.recent.noAchievements': '아직 달성한 업적이 없어요.',
};

export default messages;
