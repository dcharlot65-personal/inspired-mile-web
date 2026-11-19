/**
 * The collection page, its deck builder and card detail view: Hindi.
 *
 * Same keys, {placeholders} and <b>/<a> marks as ./en.ts (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'collection.meta.title': 'मेरा संग्रह',
  'collection.meta.description': 'अपना Inspired Mile कार्ड संग्रह देखें: शेक्सपीयर की महानतम रचनाओं के पात्र, अवशेष और काढ़े।',
  'collection.title': 'मेरा <b>संग्रह</b>',
  'collection.intro': 'आपका शेक्सपीयर कार्ड संग्रह। बंद कार्ड <a>खेल के मैदान</a> में कमाए जा सकते हैं।',
  'collection.owned': 'आपके पास कार्ड: <b>{owned}</b> / {total}',
  'collection.filter.all': 'सभी',
  'collection.filter.owned': 'मेरे पास',
  'collection.locked': 'बंद',
  'collection.world.title': 'विश्व कार्ड',
  'collection.world.intro': 'आपके पात्र दुनिया घूमते हैं। प्रश्नोत्तरी में पूरे अंक लाएँ, ताकि शहरों के संस्करण खुलें।',
  'collection.world.empty': 'अभी कोई संस्करण नहीं है। प्रश्नोत्तरी में पूरे अंक लाएँ, और अपना पहला विश्व कार्ड खोलें!',
  'collection.deck.title': 'डेक बनाएँ',
  'collection.deck.intro': 'पात्र: {min} से {max}। अवशेष: अधिकतम {relics}। काढ़े: अधिकतम {potions}। कुल कार्ड: अधिकतम {total}। जोड़ने के लिए ऊपर अपने कार्डों पर क्लिक करें।',
  'collection.deck.namePlaceholder': 'डेक का नाम…',
  'collection.deck.save': 'डेक सहेजें',
  'collection.deck.clear': 'ख़ाली करें',
  'collection.deck.addCharacters': 'जोड़ने के लिए अपने पात्रों पर क्लिक करें',
  'collection.deck.addRelics': 'जोड़ने के लिए अपने अवशेषों पर क्लिक करें',
  'collection.deck.addPotions': 'जोड़ने के लिए अपने काढ़ों पर क्लिक करें',
  'collection.deck.synergies': 'सक्रिय मेल',
  'collection.deck.saved': 'सहेजे गए डेक',
  'collection.deck.none': 'अभी कोई डेक सहेजा नहीं गया है।',
  'collection.deck.summary': 'पात्र: {characters} · अवशेष: {relics} · काढ़े: {potions} · कुल: {total}',
  'collection.deck.active': 'सक्रिय',
  'collection.deck.activate': 'सक्रिय करें',
  'collection.deck.edit': 'बदलें',
  'collection.deck.delete': 'डेक {name} हटाएँ',
  'collection.deck.errorName': 'डेक का नाम लिखें',
  'collection.deck.notOwned': 'ये कार्ड आपके पास नहीं हैं: {cards}',
  'collection.modal.passive': 'स्थायी क्षमता: {name}',
  'collection.modal.uses': 'हर युद्ध में उपयोग: {n}',
  'collection.modal.ar': 'एआर में देखें',
  'collection.modal.add': 'डेक में जोड़ें',
  'collection.modal.close': 'बंद करें',
  'collection.achievements.title': 'उपलब्धियाँ',
  'collection.achievements.count': 'हासिल: <b>{n}</b> / {total}',
};

export default messages;
