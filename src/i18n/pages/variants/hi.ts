/**
 * World cards: cities, their abilities, where a variant came from (src/lib/variants.ts): Hindi.
 *
 * Same keys, {placeholders} and <b>/<a> marks as ./en.ts (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'variants.unlocked': 'खुले संस्करण: <b>{n}</b>',
  'variants.count': 'संस्करण: {n}',
  'variants.cities': 'खोजे गए शहर: <b>{n}</b> / {total}',
  'variants.source.city-quest': 'शहर की खोज',
  'variants.source.battle-streak': 'लगातार जीत',
  'variants.source.trivia-mastery': 'प्रश्नोत्तरी में महारत',
  'variants.source.daily-travel': 'रोज़ की यात्रा',
  'variants.source.event': 'आयोजन',
  'variants.ability.TKY.name': 'नियॉन सटीकता',
  'variants.ability.TKY.why': 'टोक्यो की सटीकता की संस्कृति',
  'variants.ability.LGS.name': 'एफ़्रोबीट प्रवाह',
  'variants.ability.LGS.why': 'लागोस के एफ़्रोबीट्स की लय',
  'variants.ability.BKN.name': 'मोहल्ले का सरदार',
  'variants.ability.BKN.why': 'न्यूयॉर्क की चुटकी लेने की संस्कृति, रैप बैटल की जन्मभूमि',
  'variants.ability.LDN.name': 'कवि का अपना घर',
  'variants.ability.LDN.why': 'शेक्सपियर का घर',
  'variants.ability.MUM.name': 'बॉलीवुड की लय',
  'variants.ability.MUM.why': 'मुम्बई की काव्य परंपराएँ',
  'variants.ability.PAR.name': 'ऊँचा पद',
  'variants.ability.PAR.why': 'फ़्रांसीसी साहित्यिक परंपरा',
  'variants.ability.SAO.name': 'फ़वेला की आग',
  'variants.ability.SAO.why': 'ब्राज़ील का हास्य और आशु-रचना',
  'variants.ability.SEO.name': 'कोरियाई लहर की ताल',
  'variants.ability.SEO.why': 'के-पॉप की सटीकता और सिओल का रैप जगत',
  'variants.ability.NRB.name': 'किस्सागो का वरदान',
  'variants.ability.NRB.why': 'पूर्वी अफ़्रीका की मौखिक कथा परंपरा',
  'variants.ability.BER.name': 'कैबरे की धार',
  'variants.ability.BER.why': 'बर्लिन की कैबरे परंपरा और रूखा हास्य',
  'variants.ability.MEX.name': 'कोरीदो का शिल्प',
  'variants.ability.MEX.why': 'मेक्सिको की काव्य परंपरा',
  'variants.ability.CAI.name': 'लिपिक की बुद्धिमत्ता',
  'variants.ability.CAI.why': 'एक प्राचीन साहित्यिक परंपरा',
  'variants.ability.ACC.name': 'हाइलाइफ़ हास्य',
  'variants.ability.ACC.why': 'घाना का हाइलाइफ़ संगीत और पैनी हाज़िरजवाबी',
  'variants.ability.JHB.name': 'जोज़ी की पंक्तियाँ',
  'variants.ability.JHB.why': 'जोहांसबर्ग के रैप जगत की तीव्रता',
  'variants.ability.MNL.name': 'FlipTop प्रवाह',
  'variants.ability.MNL.why': 'फ़िलीपींस की रैप बैटल संस्कृति',
  'variants.ability.IST.name': 'चौराहे का पद',
  'variants.ability.IST.why': 'जहाँ कविता में पूरब और पश्चिम मिलते हैं',
  'variants.ability.TOR.name': 'सिक्स का प्रवाह',
  'variants.ability.TOR.why': 'टोरंटो का हिप हॉप घराना',
  'variants.ability.SYD.name': 'बंदरगाह का जोश',
  'variants.ability.SYD.why': 'ऑस्ट्रेलिया का बेबाक हास्य',
  'variants.ability.OSA.name': 'कान्साई का हास्य',
  'variants.ability.OSA.why': 'ओसाका की हास्य और शब्द-क्रीड़ा की परंपरा',
  'variants.ability.KGN.name': 'डांसहॉल की लय',
  'variants.ability.KGN.why': 'जमैका का डांसहॉल और डब कविता',
  'variants.city.TKY': 'टोक्यो', // CLDR 46.0.0 exemplarCity
  'variants.city.LGS': 'लागोस', // CLDR 46.0.0 exemplarCity
  'variants.city.BKN': 'ब्रुकलीन', // Wikidata Q18419 label
  'variants.city.LDN': 'लंदन', // CLDR 46.0.0 exemplarCity
  'variants.city.MUM': 'मुम्बई', // Wikidata Q1156 label
  'variants.city.PAR': 'पेरिस', // CLDR 46.0.0 exemplarCity
  'variants.city.SAO': 'साओ पाउलो', // CLDR 46.0.0 exemplarCity
  'variants.city.SEO': 'सिओल', // CLDR 46.0.0 exemplarCity
  'variants.city.NRB': 'नैरोबी', // CLDR 46.0.0 exemplarCity
  'variants.city.BER': 'बर्लिन', // CLDR 46.0.0 exemplarCity
  'variants.city.MEX': 'मेक्सिको सिटी', // CLDR 46.0.0 exemplarCity
  'variants.city.CAI': 'कायरो', // CLDR 46.0.0 exemplarCity
  'variants.city.ACC': 'एक्रा', // CLDR 46.0.0 exemplarCity
  'variants.city.JHB': 'जोहांसबर्ग', // CLDR 46.0.0 exemplarCity
  'variants.city.MNL': 'मनीला', // CLDR 46.0.0 exemplarCity
  'variants.city.IST': 'इस्तांबुल', // CLDR 46.0.0 exemplarCity
  'variants.city.TOR': 'टोरंटो', // CLDR 46.0.0 exemplarCity
  'variants.city.SYD': 'सिडनी', // CLDR 46.0.0 exemplarCity
  'variants.city.OSA': 'ओसाका', // Wikidata Q35765 label
  'variants.city.KGN': 'किंग्सटन', // Wikidata Q34692 label
  'variants.region.eurasia': 'यूरेशिया', // Wikidata Q5401 label
  'variants.region.142': 'एशिया', // CLDR 46.0.0 territory 142
  'variants.region.150': 'यूरोप', // CLDR 46.0.0 territory 150
  'variants.region.009': 'ओशिआनिया', // CLDR 46.0.0 territory 009
  'variants.region.029': 'कैरिबियन', // CLDR 46.0.0 territory 029
  'variants.region.003': 'उत्तर अमेरिका', // CLDR 46.0.0 territory 003
  'variants.region.013': 'मध्य अमेरिका', // CLDR 46.0.0 territory 013
  'variants.region.005': 'दक्षिण अमेरिका', // CLDR 46.0.0 territory 005
  'variants.region.011': 'पश्चिमी अफ़्रीका', // CLDR 46.0.0 territory 011
  'variants.region.014': 'पूर्वी अफ़्रीका', // CLDR 46.0.0 territory 014
  'variants.region.015': 'उत्तरी अफ़्रीका', // CLDR 46.0.0 territory 015
  'variants.region.018': 'दक्षिणी अफ़्रीका', // CLDR 46.0.0 territory 018
  'variants.region.030': 'पूर्वी एशिया', // CLDR 46.0.0 territory 030
  'variants.region.034': 'दक्षिणी एशिया', // CLDR 46.0.0 territory 034
  'variants.region.035': 'दक्षिण-पूर्व एशिया', // CLDR 46.0.0 territory 035
};

export default messages;
