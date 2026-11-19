/**
 * The collection page, its deck builder and card detail view: Thai.
 *
 * Same keys, {placeholders} and <b>/<a> marks as ./en.ts (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'collection.meta.title': 'คอลเลกชันของฉัน',
  'collection.meta.description': 'ดูคอลเลกชันการ์ด Inspired Mile ของคุณ: ตัวละคร ของวิเศษ และยาวิเศษจากผลงานชิ้นเอกของเชกสเปียร์',
  'collection.title': '<b>คอลเลกชัน</b>ของฉัน',
  'collection.intro': 'คอลเลกชันการ์ดเชกสเปียร์ของคุณ การ์ดที่ยังล็อกอยู่รับได้ที่<a>สนามเล่น</a>',
  'collection.owned': 'การ์ดที่คุณมี: <b>{owned}</b> / {total}',
  'collection.filter.all': 'ทั้งหมด',
  'collection.filter.owned': 'ที่มีอยู่',
  'collection.locked': 'ล็อกอยู่',
  'collection.world.title': 'การ์ดโลก',
  'collection.world.intro': 'ตัวละครของคุณเดินทางรอบโลก ชนะการประชันและตอบควิซให้ถูกทุกข้อเพื่อปลดล็อกการ์ดแบบเมืองต่าง ๆ',
  'collection.world.empty': 'ยังไม่มีการ์ดแบบเมือง ชนะการประชันสามครั้งติดกันหรือทำควิซได้คะแนนเต็ม เพื่อปลดล็อกการ์ดโลกใบแรกของคุณ!',
  'collection.deck.title': 'จัดสำรับ',
  'collection.deck.intro': 'ตัวละคร: {min} ถึง {max} ของวิเศษ: ไม่เกิน {relics} ยาวิเศษ: ไม่เกิน {potions} การ์ดทั้งหมด: ไม่เกิน {total} คลิกการ์ดที่คุณมีด้านบนเพื่อเพิ่มลงสำรับ',
  'collection.deck.namePlaceholder': 'ชื่อสำรับ…',
  'collection.deck.save': 'บันทึกสำรับ',
  'collection.deck.clear': 'ล้าง',
  'collection.deck.addCharacters': 'คลิกตัวละครที่คุณมีเพื่อเพิ่ม',
  'collection.deck.addRelics': 'คลิกของวิเศษที่คุณมีเพื่อเพิ่ม',
  'collection.deck.addPotions': 'คลิกยาวิเศษที่คุณมีเพื่อเพิ่ม',
  'collection.deck.synergies': 'พลังร่วมที่ทำงานอยู่',
  'collection.deck.saved': 'สำรับที่บันทึกไว้',
  'collection.deck.none': 'ยังไม่มีสำรับที่บันทึกไว้',
  'collection.deck.summary': 'ตัวละคร: {characters} · ของวิเศษ: {relics} · ยาวิเศษ: {potions} · รวม: {total}',
  'collection.deck.active': 'ใช้อยู่',
  'collection.deck.activate': 'ใช้สำรับนี้',
  'collection.deck.edit': 'แก้ไข',
  'collection.deck.delete': 'ลบสำรับ {name}',
  'collection.deck.errorName': 'กรุณาใส่ชื่อสำรับ',
  'collection.deck.notOwned': 'คุณยังไม่มี: {cards}',
  'collection.modal.passive': 'ความสามารถติดตัว: {name}',
  'collection.modal.uses': 'จำนวนครั้งที่ใช้ได้ต่อการประชัน: {n}',
  'collection.modal.ar': 'ดูแบบ AR',
  'collection.modal.add': 'เพิ่มลงสำรับ',
  'collection.modal.close': 'ปิด',
  'collection.achievements.title': 'ความสำเร็จ',
  'collection.achievements.count': 'ปลดล็อกแล้ว: <b>{n}</b> / {total}',
};

export default messages;
