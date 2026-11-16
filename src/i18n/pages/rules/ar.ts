/**
 * What cards do and what a deck may hold (src/lib/battle-rules.ts): Arabic.
 *
 * Same keys, {placeholders} and <b>/<a> marks as ./en.ts (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'rules.landIt': 'أتقنها لتزيد صنعتك بمقدار النصف.',
  'rules.relic': 'يعيرك كلمات القوة: {words}. استخدم {n} منها لتنال +{bonus} صنعة.',
  'rules.potion': 'تلعن أبيات خصمك التالية بلعنة {name}: {rule}',
  'rules.potion.letter': 'تلعن أبيات خصمك التالية بلعنة {name}: لا يجوز أن تحتوي أبياته على حرف واحد تحدده الجرعة عند توزيع المبارزة.',
  'rules.cost': 'كلفة الحبر: {n}.',
  'rules.synergy': '{house}، شخصيتان أو أكثر: {device} تضيف ثلاثة أرباع صنعتك بدل النصف.',
  'rules.deck.minCharacters': 'الشخصيات في الرزمة: {n} على الأقل.',
  'rules.deck.maxCharacters': 'الشخصيات في الرزمة: {n} على الأكثر.',
  'rules.deck.maxRelics': 'الآثار في الرزمة: {n} على الأكثر.',
  'rules.deck.maxPotions': 'الجرعات في الرزمة: {n} على الأكثر.',
  'rules.deck.totalMax': 'البطاقات في الرزمة: {n} على الأكثر.',
  'rules.deck.unknownCard': 'بطاقة غير معروفة: {id}',
  'rules.deck.notCharacter': '{card} ليست شخصية.',
  'rules.deck.notRelic': '{card} ليست أثرًا.',
  'rules.deck.notPotion': '{card} ليست جرعة.',
};

export default messages;
