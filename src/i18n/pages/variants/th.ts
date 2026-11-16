/**
 * World cards: cities, their abilities, where a variant came from (src/lib/variants.ts): Thai.
 *
 * Same keys, {placeholders} and <b>/<a> marks as ./en.ts (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'variants.unlocked': 'การ์ดแบบเมืองที่ปลดล็อกแล้ว: <b>{n}</b>',
  'variants.count': 'การ์ดแบบเมือง: {n}',
  'variants.source.city-quest': 'ภารกิจประจำเมือง',
  'variants.source.battle-streak': 'ชนะต่อเนื่อง',
  'variants.source.trivia-mastery': 'เชี่ยวชาญควิซ',
  'variants.source.daily-travel': 'การเดินทางรายวัน',
  'variants.source.event': 'กิจกรรมพิเศษ',
  'variants.ability.TKY.name': 'ความแม่นยำแห่งแสงนีออน',
  'variants.ability.TKY.why': 'วัฒนธรรมความแม่นยำของโตเกียว',
  'variants.ability.LGS.name': 'ความลื่นไหลแบบแอโฟรบีต',
  'variants.ability.LGS.why': 'จังหวะแอโฟรบีตส์ของลากอส',
  'variants.ability.BKN.name': 'เจ้าถิ่นประจำย่าน',
  'variants.ability.BKN.why': 'วัฒนธรรมการแซวของนิวยอร์ก ต้นกำเนิดแร็ปแบตเทิล',
  'variants.ability.LDN.name': 'ถิ่นของกวี',
  'variants.ability.LDN.why': 'บ้านเกิดของเชกสเปียร์',
  'variants.ability.MUM.name': 'จังหวะบอลลีวูด',
  'variants.ability.MUM.why': 'ขนบกวีนิพนธ์ของมุมไบ',
  'variants.ability.PAR.name': 'บทกลอนชั้นสูง',
  'variants.ability.PAR.why': 'ขนบวรรณกรรมฝรั่งเศส',
  'variants.ability.SAO.name': 'ไฟแห่งฟาเวลา',
  'variants.ability.SAO.why': 'อารมณ์ขันและการด้นสดแบบบราซิล',
  'variants.ability.SEO.name': 'ลีลากระแสเกาหลี',
  'variants.ability.SEO.why': 'ความแม่นยำของเคป๊อปและวงการแร็ปของโซล',
  'variants.ability.NRB.name': 'พรสวรรค์ของนักเล่าเรื่อง',
  'variants.ability.NRB.why': 'ขนบการเล่าเรื่องมุขปาฐะของแอฟริกาตะวันออก',
  'variants.ability.BER.name': 'คมแบบคาบาเรต์',
  'variants.ability.BER.why': 'ขนบคาบาเรต์ของเบอร์ลินและอารมณ์ขันหน้าตาย',
  'variants.ability.MEX.name': 'ฝีมือกอร์ริโด',
  'variants.ability.MEX.why': 'ขนบกวีนิพนธ์ของเม็กซิโก',
  'variants.ability.CAI.name': 'ปัญญาของอาลักษณ์',
  'variants.ability.CAI.why': 'ขนบวรรณกรรมอันเก่าแก่',
  'variants.ability.ACC.name': 'อารมณ์ขันแบบไฮไลฟ์',
  'variants.ability.ACC.why': 'ดนตรีไฮไลฟ์ของกานาและไหวพริบอันเฉียบคม',
  'variants.ability.JHB.name': 'ท่อนแร็ปแห่งโจซี',
  'variants.ability.JHB.why': 'ความเข้มข้นของวงการแร็ปในโจฮันเนสเบอร์ก',
  'variants.ability.MNL.name': 'ความลื่นไหลแบบ FlipTop',
  'variants.ability.MNL.why': 'วัฒนธรรมแร็ปแบตเทิลของฟิลิปปินส์',
  'variants.ability.IST.name': 'บทกลอนแห่งทางแยก',
  'variants.ability.IST.why': 'ที่ซึ่งตะวันออกพบตะวันตกในกวีนิพนธ์',
  'variants.ability.TOR.name': 'ความลื่นไหลแห่ง The Six',
  'variants.ability.TOR.why': 'ราชวงศ์ฮิปฮอปของโทรอนโต',
  'variants.ability.SYD.name': 'ความฮึกเหิมแห่งอ่าว',
  'variants.ability.SYD.why': 'อารมณ์ขันแบบไม่ไว้หน้าของออสเตรเลีย',
  'variants.ability.OSA.name': 'ตลกคันไซ',
  'variants.ability.OSA.why': 'ขนบตลกและการเล่นคำของโอซากะ',
  'variants.ability.KGN.name': 'จังหวะแดนซ์ฮอลล์',
  'variants.ability.KGN.why': 'แดนซ์ฮอลล์ของจาเมกาและกวีนิพนธ์ดั๊บ',
  'variants.city.TKY': 'โตเกียว', // CLDR 46.0.0 exemplarCity
  'variants.city.LGS': 'ลากอส', // CLDR 46.0.0 exemplarCity
  'variants.city.BKN': 'บรุกลิน', // Wikidata Q18419 label
  'variants.city.LDN': 'ลอนดอน', // CLDR 46.0.0 exemplarCity
  'variants.city.MUM': 'มุมไบ', // Wikidata Q1156 label
  'variants.city.PAR': 'ปารีส', // CLDR 46.0.0 exemplarCity
  'variants.city.SAO': 'เซาเปาลู', // CLDR 46.0.0 exemplarCity
  'variants.city.SEO': 'โซล', // CLDR 46.0.0 exemplarCity
  'variants.city.NRB': 'ไนโรเบีย', // CLDR 46.0.0 exemplarCity
  'variants.city.BER': 'เบอร์ลิน', // CLDR 46.0.0 exemplarCity
  'variants.city.MEX': 'เม็กซิโกซิตี', // CLDR 46.0.0 exemplarCity
  'variants.city.CAI': 'ไคโร', // CLDR 46.0.0 exemplarCity
  'variants.city.ACC': 'อักกรา', // CLDR 46.0.0 exemplarCity
  'variants.city.JHB': 'โจฮันเนสเบอร์ก', // CLDR 46.0.0 exemplarCity
  'variants.city.MNL': 'มะนิลา', // CLDR 46.0.0 exemplarCity
  'variants.city.IST': 'อิสตันบูล', // CLDR 46.0.0 exemplarCity
  'variants.city.TOR': 'โทรอนโต', // CLDR 46.0.0 exemplarCity
  'variants.city.SYD': 'ซิดนีย์', // CLDR 46.0.0 exemplarCity
  'variants.city.OSA': 'โอซากะ', // Wikidata Q35765 label
  'variants.city.KGN': 'คิงส์ตัน', // Wikidata Q34692 label
  'variants.region.eurasia': 'ทวีปยูเรเชีย', // Wikidata Q5401 label
};

export default messages;
