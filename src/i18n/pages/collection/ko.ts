/**
 * The collection page, its deck builder and card detail view: Korean.
 *
 * Same keys, {placeholders} and <b>/<a> marks as ./en.ts (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'collection.meta.title': '내 컬렉션',
  'collection.meta.description': 'Inspired Mile 카드 컬렉션을 둘러보세요. 셰익스피어의 위대한 작품에서 온 등장인물, 유물, 물약이 있어요.',
  'collection.title': '내 <b>컬렉션</b>',
  'collection.intro': '내 셰익스피어 카드 컬렉션이에요. 잠긴 카드는 <a>놀이터</a>에서 얻을 수 있어요.',
  'collection.owned': '보유 카드: <b>{owned}</b> / {total}',
  'collection.filter.all': '전체',
  'collection.filter.owned': '보유',
  'collection.locked': '잠김',
  'collection.world.title': '월드 카드',
  'collection.world.intro': '내 등장인물들이 세계를 여행해요. 퀴즈를 모두 맞혀 도시 변형을 열어 보세요.',
  'collection.world.empty': '아직 변형이 없어요. 퀴즈를 모두 맞히면 첫 월드 카드가 열려요!',
  'collection.deck.title': '덱 만들기',
  'collection.deck.intro': '등장인물: {min}~{max}. 유물: 최대 {relics}. 물약: 최대 {potions}. 전체 카드: 최대 {total}. 위에서 보유한 카드를 클릭하면 추가돼요.',
  'collection.deck.namePlaceholder': '덱 이름…',
  'collection.deck.save': '덱 저장',
  'collection.deck.clear': '비우기',
  'collection.deck.addCharacters': '보유한 등장인물을 클릭해 추가하세요',
  'collection.deck.addRelics': '보유한 유물을 클릭해 추가하세요',
  'collection.deck.addPotions': '보유한 물약을 클릭해 추가하세요',
  'collection.deck.synergies': '활성 시너지',
  'collection.deck.saved': '저장한 덱',
  'collection.deck.none': '아직 저장한 덱이 없어요.',
  'collection.deck.summary': '등장인물: {characters} · 유물: {relics} · 물약: {potions} · 합계: {total}',
  'collection.deck.active': '사용 중',
  'collection.deck.activate': '사용하기',
  'collection.deck.edit': '편집',
  'collection.deck.delete': '덱 {name} 삭제',
  'collection.deck.errorName': '덱 이름을 입력하세요',
  'collection.deck.notOwned': '보유하지 않은 카드: {cards}',
  'collection.modal.passive': '패시브: {name}',
  'collection.modal.uses': '배틀당 사용 횟수: {n}',
  'collection.modal.ar': 'AR로 보기',
  'collection.modal.add': '덱에 추가',
  'collection.modal.close': '닫기',
  'collection.achievements.title': '업적',
  'collection.achievements.count': '달성: <b>{n}</b> / {total}',
};

export default messages;
