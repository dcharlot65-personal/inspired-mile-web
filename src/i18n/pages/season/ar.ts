// العربية (فصحى مبسّطة). مصطلحات ثابتة: الصف، المعلّم، الطالب، الواجب، رمز الانضمام؛ العرض (السوق)، جدول البطولة، النقاط (credits)؛ الأبيات والمبارزة والبطاقة كما في بقية اللعبة. الخطاب بصيغة المخاطب المفرد.
// Page area "season": the Season Pass (/season).
// Where each term comes from and how these strings were checked: docs/language/pages-rest.md
const messages: Record<string, string> = {
  'season.meta.title': 'بطاقة الموسم',
  'season.meta.description': 'ارفع مستوى بطاقة الموسم لتفتح مكافآت في Inspired Mile.',
  'season.badge': 'الموسم {n}',
  'season.title': 'بطاقة الموسم',
  'season.intro': 'العب النزالات والمسابقات والتحديات لتكسب XP. كل مستوى جديد يفتح بطاقات ونقاطًا وألقابًا.',
  'season.introNow': 'كل مستوى في بطاقة الموسم يفتح بطاقات أو نقاطًا أو ألقابًا. في هذا الإصدار من اللعبة لا تكسب XP باللعب.',
  'season.loading': 'جارٍ التحميل…',
  'season.level': 'المستوى',
  'season.xp': '{n} XP',
  'season.xpGain': '{n} XP',
  'season.next': 'بقي {n} XP للمستوى التالي',
  'season.maxed': 'بلغت أعلى مستوى',
  'season.track': 'مسار المكافآت',
  'season.track.empty': 'لا توجد مكافآت لهذا الموسم بعد.',
  'season.reward.level': 'المستوى {n}',
  'season.reward.pack': 'حزمة بطاقات: {name}',
  'season.reward.card': 'بطاقة: {name}',
  'season.reward.title': 'لقب: {name}',
  'season.reward.unknown': 'مكافأة: {name}',
  'season.reward.premium': 'مميّزة',
  'season.claim': 'استلام',
  'season.claimed': 'تم الاستلام',
  'season.locked': 'ابلغ المستوى {n}',
  'season.signIn': 'سجّل الدخول ليبقى تقدّمك في بطاقة الموسم محفوظًا على كل أجهزتك.',
};

export default messages;
