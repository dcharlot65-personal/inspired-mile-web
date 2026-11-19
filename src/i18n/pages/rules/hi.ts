/**
 * What cards do and what a deck may hold (src/lib/battle-rules.ts): Hindi.
 *
 * Same keys, {placeholders} and <b>/<a> marks as ./en.ts (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'rules.landIt': 'इसे साध लें तो आपका शिल्प डेढ़ गुना हो जाता है।',
  'rules.relic': 'शक्ति-शब्द देता है: {words}। इनमें से {n} का प्रयोग करें और +{bonus} शिल्प पाएँ।',
  'rules.potion': 'आपके प्रतिद्वंद्वी की अगली कविता पर {name} का शाप डालता है: {rule}',
  'rules.potion.letter': 'आपके प्रतिद्वंद्वी की अगली कविता पर {name} का शाप डालता है: उनकी कविता में एक अक्षर नहीं आ सकता, जिसे काढ़ा द्वंद्व बँटते समय बताता है।',
  'rules.cost': 'स्याही की लागत: {n}।',
  'rules.synergy': '{house}, दो या अधिक पात्र: {device} आपके शिल्प में आधे की जगह तीन-चौथाई जोड़ता है।',
  'rules.deck.minCharacters': 'डेक में पात्र: कम से कम {n}।',
  'rules.deck.maxCharacters': 'डेक में पात्र: अधिकतम {n}।',
  'rules.deck.maxRelics': 'डेक में अवशेष: अधिकतम {n}।',
  'rules.deck.maxPotions': 'डेक में काढ़े: अधिकतम {n}।',
  'rules.deck.totalMax': 'डेक में कार्ड: अधिकतम {n}।',
  'rules.deck.unknownCard': 'अज्ञात कार्ड: {id}',
  'rules.deck.notCharacter': '{card} पात्र नहीं है।',
  'rules.deck.notRelic': '{card} अवशेष नहीं है।',
  'rules.deck.notPotion': '{card} काढ़ा नहीं है।',
};

export default messages;
