// العربية. أزرار Apple (مشاركة، «إضافة إلى الشاشة الرئيسية») وAndroid (تثبيت، ليس الآن) بألفاظها. خطاب المفرد كما في بقية اللعبة.
// Page area "pwa": the install guidance and the note on stored downloads (src/lib/pwa.ts), on every page.
// Where each term comes from and how these strings were checked: docs/language/pages-rest.md
const messages: Record<string, string> = {
  'pwa.install.regionLabel': 'تثبيت Sonnet Man',
  'pwa.install.title': 'ثبّت Sonnet Man أولًا',
  'pwa.install.promptBody': 'يُفتح بملء الشاشة، ويقلّ كثيرًا احتمال أن يحذف المتصفح نموذجًا منزَّلًا في تطبيق مثبَّت.',
  'pwa.install.iosBody': 'على iPhone وiPad لا يشارك تطبيق الشاشة الرئيسية هذا التبويب أي شيء. أضِفه قبل تسجيل الدخول أو تنزيل نموذج، وإلا فستفعل الأمرين مرتين.',
  'pwa.install.iosStep1': 'اضغط على زر مشاركة.',
  'pwa.install.iosStep2': 'اختر «إضافة إلى الشاشة الرئيسية».',
  'pwa.install.accept': 'تثبيت',
  'pwa.install.dismiss': 'ليس الآن',
  'pwa.storage.kept': 'محفوظ على هذا الجهاز: {size}. لن يحذفه متصفحك من تلقاء نفسه.',
  'pwa.storage.keptNoSize': 'ما نزّلته محفوظ على هذا الجهاز. لن يحذفه متصفحك من تلقاء نفسه.',
  'pwa.storage.atRisk': 'مخزَّن على هذا الجهاز: {size}، لكن قد يحذفه متصفحك إذا ضاقت مساحة الجهاز أو غبتَ مدة.',
  'pwa.storage.atRiskNoSize': 'ما نزّلته مخزَّن، لكن قد يحذفه متصفحك إذا ضاقت مساحة الجهاز أو غبتَ مدة.',
  'pwa.storage.installHint': 'تثبيت التطبيق يساعد على الاحتفاظ به.',
  'pwa.storage.lessThan': 'أقل من {size}',
};

export default messages;
