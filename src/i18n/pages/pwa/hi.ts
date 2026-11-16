// हिन्दी। Apple (“शेयर करें”, “होम स्क्रीन पर जोड़ें”) और Android (इंस्टॉल करें, अभी नहीं) के बटन उन्हीं के शब्दों में। आप।
// Page area "pwa": the install guidance and the note on stored downloads (src/lib/pwa.ts), on every page.
// Where each term comes from and how these strings were checked: docs/language/pages-rest.md
const messages: Record<string, string> = {
  'pwa.install.regionLabel': 'Sonnet Man इंस्टॉल करें',
  'pwa.install.title': 'पहले Sonnet Man इंस्टॉल करें',
  'pwa.install.promptBody': 'यह पूरी स्क्रीन पर खुलता है, और इंस्टॉल किए गए ऐप में ब्राउज़र द्वारा डाउनलोड किया गया मॉडल मिटाए जाने की संभावना बहुत कम होती है।',
  'pwa.install.iosBody': 'iPhone और iPad पर होम स्क्रीन वाला ऐप इस टैब के साथ कुछ भी साझा नहीं करता। साइन इन करने या मॉडल डाउनलोड करने से पहले उसे जोड़ लें, वरना आपको दोनों काम दो बार करने होंगे।',
  'pwa.install.iosStep1': '“शेयर करें” बटन पर टैप करें।',
  'pwa.install.iosStep2': '“होम स्क्रीन पर जोड़ें” चुनें।',
  'pwa.install.accept': 'इंस्टॉल करें',
  'pwa.install.dismiss': 'अभी नहीं',
  'pwa.storage.kept': 'इस डिवाइस पर {size} सुरक्षित रखा गया है। आपका ब्राउज़र इसे अपने आप नहीं मिटाएगा।',
  'pwa.storage.keptNoSize': 'आपका डाउनलोड इस डिवाइस पर सुरक्षित रखा गया है। आपका ब्राउज़र इसे अपने आप नहीं मिटाएगा।',
  'pwa.storage.atRisk': 'इस डिवाइस पर {size} रखा गया है, लेकिन अगर डिवाइस में जगह कम पड़े या आप कुछ समय तक न आएँ, तो आपका ब्राउज़र इसे मिटा सकता है।',
  'pwa.storage.atRiskNoSize': 'आपका डाउनलोड रखा गया है, लेकिन अगर डिवाइस में जगह कम पड़े या आप कुछ समय तक न आएँ, तो आपका ब्राउज़र इसे मिटा सकता है।',
  'pwa.storage.installHint': 'ऐप इंस्टॉल करने से इसे बचाए रखने में मदद मिलती है।',
  'pwa.storage.lessThan': '{size} से कम',
};

export default messages;
