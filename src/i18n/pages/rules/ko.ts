/**
 * What cards do and what a deck may hold (src/lib/battle-rules.ts): Korean.
 *
 * Same keys, {placeholders} and <b>/<a> marks as ./en.ts (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'rules.landIt': '성공하면 기교에 그 절반이 더해져요.',
  'rules.relic': '힘의 낱말을 빌려줘요: {words}. 이 가운데 {n}개를 쓰면 기교 +{bonus}.',
  'rules.potion': '상대의 다음 시에 {name} 저주를 걸어요: {rule}',
  'rules.potion.letter': '상대의 다음 시에 {name} 저주를 걸어요: 상대의 시에는 글자 하나를 쓸 수 없어요. 어떤 글자인지는 결투를 나눌 때 물약이 알려 줘요.',
  'rules.cost': '잉크 소모: {n}.',
  'rules.synergy': '{house} 등장인물이 둘 이상: {device}이(가) 기교에 절반이 아니라 4분의 3을 더해요.',
  'rules.deck.minCharacters': '덱의 등장인물: 최소 {n}.',
  'rules.deck.maxCharacters': '덱의 등장인물: 최대 {n}.',
  'rules.deck.maxRelics': '덱의 유물: 최대 {n}.',
  'rules.deck.maxPotions': '덱의 물약: 최대 {n}.',
  'rules.deck.totalMax': '덱의 카드: 최대 {n}.',
  'rules.deck.unknownCard': '알 수 없는 카드: {id}',
  'rules.deck.notCharacter': '{card}: 등장인물 카드가 아니에요.',
  'rules.deck.notRelic': '{card}: 유물 카드가 아니에요.',
  'rules.deck.notPotion': '{card}: 물약 카드가 아니에요.',
};

export default messages;
