/**
 * The collection page, its deck builder and card detail view: Vietnamese.
 *
 * Same keys, {placeholders} and <b>/<a> marks as ./en.ts (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'collection.meta.title': 'Bộ sưu tập của tôi',
  'collection.meta.description': 'Xem bộ sưu tập thẻ bài Inspired Mile của bạn: nhân vật, bảo vật và thuốc phép từ những tác phẩm vĩ đại nhất của Shakespeare.',
  'collection.title': '<b>Bộ sưu tập</b> của tôi',
  'collection.intro': 'Bộ sưu tập thẻ bài Shakespeare của bạn. Những lá bài còn khoá có thể kiếm được ở <a>Sân chơi</a>.',
  'collection.owned': 'Lá bài bạn có: <b>{owned}</b> / {total}',
  'collection.filter.all': 'Tất cả',
  'collection.filter.owned': 'Đã có',
  'collection.locked': 'Còn khoá',
  'collection.world.title': 'Lá bài thế giới',
  'collection.world.intro': 'Các nhân vật của bạn chu du khắp địa cầu. Đạt điểm tuyệt đối ở đố vui để mở khoá các biến thể thành phố.',
  'collection.world.empty': 'Chưa có biến thể nào. Đạt điểm tuyệt đối ở đố vui để mở khoá lá bài thế giới đầu tiên!',
  'collection.deck.title': 'Xếp bộ bài',
  'collection.deck.intro': 'Nhân vật: từ {min} đến {max}. Bảo vật: tối đa {relics}. Thuốc phép: tối đa {potions}. Tổng số lá bài: tối đa {total}. Bấm vào những lá bài bạn có ở phía trên để thêm vào.',
  'collection.deck.namePlaceholder': 'Tên bộ bài…',
  'collection.deck.save': 'Lưu bộ bài',
  'collection.deck.clear': 'Xoá hết',
  'collection.deck.addCharacters': 'Bấm vào nhân vật bạn có để thêm',
  'collection.deck.addRelics': 'Bấm vào bảo vật bạn có để thêm',
  'collection.deck.addPotions': 'Bấm vào thuốc phép bạn có để thêm',
  'collection.deck.synergies': 'Cộng hưởng đang có hiệu lực',
  'collection.deck.saved': 'Bộ bài đã lưu',
  'collection.deck.none': 'Chưa có bộ bài nào được lưu.',
  'collection.deck.summary': 'Nhân vật: {characters} · Bảo vật: {relics} · Thuốc phép: {potions} · Tổng: {total}',
  'collection.deck.active': 'Đang dùng',
  'collection.deck.activate': 'Dùng bộ này',
  'collection.deck.edit': 'Sửa',
  'collection.deck.delete': 'Xoá bộ bài {name}',
  'collection.deck.errorName': 'Hãy nhập tên bộ bài',
  'collection.deck.notOwned': 'Bạn chưa có: {cards}',
  'collection.modal.passive': 'Nội tại: {name}',
  'collection.modal.uses': 'Số lần dùng mỗi trận đấu: {n}',
  'collection.modal.ar': 'Xem bằng AR',
  'collection.modal.add': 'Thêm vào bộ bài',
  'collection.modal.close': 'Đóng',
  'collection.achievements.title': 'Thành tựu',
  'collection.achievements.count': 'Đã mở khoá: <b>{n}</b> / {total}',
};

export default messages;
