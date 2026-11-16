/**
 * The collection page, its deck builder and card detail view: Arabic.
 *
 * Same keys, {placeholders} and <b>/<a> marks as ./en.ts (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'collection.meta.title': 'مجموعتي',
  'collection.meta.description': 'تصفّح مجموعة بطاقاتك في Inspired Mile: شخصيات وآثار وجرعات من أعظم أعمال شكسبير.',
  'collection.title': '<b>مجموعتي</b>',
  'collection.intro': 'مجموعة بطاقاتك من عالم شكسبير. البطاقات المقفلة تُكسَب في <a>ساحة اللعب</a>.',
  'collection.owned': 'البطاقات التي تملكها: <b>{owned}</b> / {total}',
  'collection.filter.all': 'الكل',
  'collection.filter.owned': 'ما أملكه',
  'collection.locked': 'مقفلة',
  'collection.world.title': 'بطاقات العالم',
  'collection.world.intro': 'شخصياتك تجوب العالم. اربح النزالات وأجب عن أسئلة المسابقات كلها لتفتح نسخ المدن.',
  'collection.world.empty': 'لا توجد نسخ حتى الآن. اربح ثلاثة نزالات متتالية أو أحرز نتيجة كاملة في المسابقة لتفتح أول بطاقة عالم لك!',
  'collection.deck.title': 'بناء الرزمة',
  'collection.deck.intro': 'الشخصيات: من {min} إلى {max}. الآثار: حتى {relics}. الجرعات: حتى {potions}. مجموع البطاقات: حتى {total}. انقر في الأعلى على البطاقات التي تملكها لإضافتها.',
  'collection.deck.namePlaceholder': 'اسم الرزمة…',
  'collection.deck.save': 'احفظ الرزمة',
  'collection.deck.clear': 'أفرغ',
  'collection.deck.addCharacters': 'انقر على شخصياتك لإضافتها',
  'collection.deck.addRelics': 'انقر على آثارك لإضافتها',
  'collection.deck.addPotions': 'انقر على جرعاتك لإضافتها',
  'collection.deck.synergies': 'التآزر الفعّال',
  'collection.deck.saved': 'الرزم المحفوظة',
  'collection.deck.none': 'لا رزم محفوظة حتى الآن.',
  'collection.deck.summary': 'الشخصيات: {characters} · الآثار: {relics} · الجرعات: {potions} · المجموع: {total}',
  'collection.deck.active': 'مفعّلة',
  'collection.deck.activate': 'فعّل',
  'collection.deck.edit': 'عدّل',
  'collection.deck.delete': 'احذف الرزمة {name}',
  'collection.deck.errorName': 'اكتب اسمًا للرزمة',
  'collection.deck.notOwned': 'لا تملك: {cards}',
  'collection.modal.passive': 'قدرة دائمة: {name}',
  'collection.modal.uses': 'مرات الاستخدام في النزال: {n}',
  'collection.modal.ar': 'اعرض بالواقع المعزَّز',
  'collection.modal.add': 'أضف إلى الرزمة',
  'collection.modal.close': 'إغلاق',
  'collection.achievements.title': 'الإنجازات',
  'collection.achievements.count': 'المفتوح منها: <b>{n}</b> / {total}',
};

export default messages;
