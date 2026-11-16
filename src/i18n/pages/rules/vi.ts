/**
 * What cards do and what a deck may hold (src/lib/battle-rules.ts): Vietnamese.
 *
 * Same keys, {placeholders} and <b>/<a> marks as ./en.ts (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'rules.landIt': 'Làm được thì tay nghề của bạn tăng thêm một nửa.',
  'rules.relic': 'Cho mượn từ quyền năng: {words}. Dùng {n} từ trong số đó để được +{bonus} tay nghề.',
  'rules.potion': 'Nguyền bài thơ kế tiếp của đối thủ bằng {name}: {rule}',
  'rules.potion.letter': 'Nguyền bài thơ kế tiếp của đối thủ bằng {name}: bài thơ của họ không được chứa một chữ cái, do thuốc phép chỉ định khi trận đấu được chia bài.',
  'rules.cost': 'Tốn mực: {n}.',
  'rules.synergy': '{house}, từ hai nhân vật trở lên: {device} cộng ba phần tư vào tay nghề của bạn thay vì một nửa.',
  'rules.deck.minCharacters': 'Nhân vật trong bộ bài: ít nhất {n}.',
  'rules.deck.maxCharacters': 'Nhân vật trong bộ bài: nhiều nhất {n}.',
  'rules.deck.maxRelics': 'Bảo vật trong bộ bài: nhiều nhất {n}.',
  'rules.deck.maxPotions': 'Thuốc phép trong bộ bài: nhiều nhất {n}.',
  'rules.deck.totalMax': 'Lá bài trong bộ bài: nhiều nhất {n}.',
  'rules.deck.unknownCard': 'Lá bài không xác định: {id}',
  'rules.deck.notCharacter': '{card} không phải là nhân vật.',
  'rules.deck.notRelic': '{card} không phải là bảo vật.',
  'rules.deck.notPotion': '{card} không phải là thuốc phép.',
};

export default messages;
