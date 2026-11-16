/**
 * What cards do and what a deck may hold (src/lib/battle-rules.ts): Thai.
 *
 * Same keys, {placeholders} and <b>/<a> marks as ./en.ts (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'rules.landIt': 'ทำให้สำเร็จแล้วฝีมือของคุณจะเพิ่มขึ้นอีกครึ่งหนึ่ง',
  'rules.relic': 'ให้ยืมคำทรงพลัง: {words} ใช้ {n} คำจากในนี้เพื่อรับ +{bonus} ฝีมือ',
  'rules.potion': 'สาปบทกลอนถัดไปของคู่ต่อสู้ด้วย {name}: {rule}',
  'rules.potion.letter': 'สาปบทกลอนถัดไปของคู่ต่อสู้ด้วย {name}: บทกลอนของคู่ต่อสู้ห้ามมีตัวอักษรหนึ่งตัว ซึ่งยาวิเศษจะระบุเมื่อแจกการประชัน',
  'rules.cost': 'ใช้หมึก: {n}',
  'rules.synergy': '{house} ตั้งแต่สองตัวละครขึ้นไป: {device} เพิ่มฝีมือของคุณสามในสี่แทนที่จะเป็นครึ่งหนึ่ง',
  'rules.deck.minCharacters': 'ตัวละครในสำรับ: อย่างน้อย {n}',
  'rules.deck.maxCharacters': 'ตัวละครในสำรับ: ไม่เกิน {n}',
  'rules.deck.maxRelics': 'ของวิเศษในสำรับ: ไม่เกิน {n}',
  'rules.deck.maxPotions': 'ยาวิเศษในสำรับ: ไม่เกิน {n}',
  'rules.deck.totalMax': 'การ์ดในสำรับ: ไม่เกิน {n}',
  'rules.deck.unknownCard': 'การ์ดที่ไม่รู้จัก: {id}',
  'rules.deck.notCharacter': '{card} ไม่ใช่ตัวละคร',
  'rules.deck.notRelic': '{card} ไม่ใช่ของวิเศษ',
  'rules.deck.notPotion': '{card} ไม่ใช่ยาวิเศษ',
};

export default messages;
