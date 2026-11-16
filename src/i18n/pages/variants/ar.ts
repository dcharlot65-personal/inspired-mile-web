/**
 * World cards: cities, their abilities, where a variant came from (src/lib/variants.ts): Arabic.
 *
 * Same keys, {placeholders} and <b>/<a> marks as ./en.ts (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'variants.unlocked': 'النسخ المفتوحة: <b>{n}</b>',
  'variants.count': 'النسخ: {n}',
  'variants.cities': 'المدن المكتشفة: <b>{n}</b> / {total}',
  'variants.source.city-quest': 'مهمة مدينة',
  'variants.source.battle-streak': 'سلسلة انتصارات',
  'variants.source.trivia-mastery': 'إتقان المسابقة',
  'variants.source.daily-travel': 'رحلة يومية',
  'variants.source.event': 'حدث',
  'variants.ability.TKY.name': 'دقة النيون',
  'variants.ability.TKY.why': 'ثقافة الدقة في طوكيو',
  'variants.ability.LGS.name': 'انسياب الأفروبيت',
  'variants.ability.LGS.why': 'إيقاع الأفروبيتس في لاغوس',
  'variants.ability.BKN.name': 'زعيم الحي',
  'variants.ability.BKN.why': 'ثقافة المناكفة في نيويورك، مهد نزالات الراب',
  'variants.ability.LDN.name': 'أرض الشاعر',
  'variants.ability.LDN.why': 'موطن شكسبير',
  'variants.ability.MUM.name': 'إيقاع بوليوود',
  'variants.ability.MUM.why': 'تقاليد مومباي الشعرية',
  'variants.ability.PAR.name': 'الأبيات الراقية',
  'variants.ability.PAR.why': 'التقليد الأدبي الفرنسي',
  'variants.ability.SAO.name': 'نار الفافيلا',
  'variants.ability.SAO.why': 'الفكاهة والارتجال في البرازيل',
  'variants.ability.SEO.name': 'إيقاع الموجة الكورية',
  'variants.ability.SEO.why': 'دقة الكيبوب ومشهد الراب في سول',
  'variants.ability.NRB.name': 'موهبة الحكّاء',
  'variants.ability.NRB.why': 'تقليد الحكاية الشفوية في شرق أفريقيا',
  'variants.ability.BER.name': 'حدّة الكباريه',
  'variants.ability.BER.why': 'تقليد الكباريه في برلين والفكاهة الجافة',
  'variants.ability.MEX.name': 'صنعة الكوريدو',
  'variants.ability.MEX.why': 'التقليد الشعري المكسيكي',
  'variants.ability.CAI.name': 'حكمة الكاتب',
  'variants.ability.CAI.why': 'تقليد أدبي عريق',
  'variants.ability.ACC.name': 'فكاهة الهايلايف',
  'variants.ability.ACC.why': 'موسيقى الهايلايف الغانية وسرعة البديهة',
  'variants.ability.JHB.name': 'أبيات جوزي',
  'variants.ability.JHB.why': 'حدّة مشهد الراب في جوهانسبرغ',
  'variants.ability.MNL.name': 'انسياب FlipTop',
  'variants.ability.MNL.why': 'ثقافة نزالات الراب الفلبينية',
  'variants.ability.IST.name': 'أبيات الملتقى',
  'variants.ability.IST.why': 'حيث يلتقي الشرق والغرب في الشعر',
  'variants.ability.TOR.name': 'انسياب The Six',
  'variants.ability.TOR.why': 'سلالة الهيب هوب في تورونتو',
  'variants.ability.SYD.name': 'حيوية الميناء',
  'variants.ability.SYD.why': 'الفكاهة الأسترالية الجريئة',
  'variants.ability.OSA.name': 'كوميديا كانساي',
  'variants.ability.OSA.why': 'تقليد الكوميديا والتلاعب بالألفاظ في أوساكا',
  'variants.ability.KGN.name': 'إيقاع الدانسهول',
  'variants.ability.KGN.why': 'الدانسهول الجامايكي وشعر الدَّب',
  'variants.city.TKY': 'طوكيو', // CLDR 46.0.0 exemplarCity
  'variants.city.LGS': 'لاغوس', // CLDR 46.0.0 exemplarCity
  'variants.city.BKN': 'بروكلين', // Wikidata Q18419 label
  'variants.city.LDN': 'لندن', // CLDR 46.0.0 exemplarCity
  'variants.city.MUM': 'مومباي', // Wikidata Q1156 label
  'variants.city.PAR': 'باريس', // CLDR 46.0.0 exemplarCity
  'variants.city.SAO': 'ساو باولو', // CLDR 46.0.0 exemplarCity
  'variants.city.SEO': 'سول', // CLDR 46.0.0 exemplarCity
  'variants.city.NRB': 'نيروبي', // CLDR 46.0.0 exemplarCity
  'variants.city.BER': 'برلين', // CLDR 46.0.0 exemplarCity
  'variants.city.MEX': 'مكسيكو سيتي', // CLDR 46.0.0 exemplarCity
  'variants.city.CAI': 'القاهرة', // CLDR 46.0.0 exemplarCity
  'variants.city.ACC': 'أكرا', // CLDR 46.0.0 exemplarCity
  'variants.city.JHB': 'جوهانسبرغ', // CLDR 46.0.0 exemplarCity
  'variants.city.MNL': 'مانيلا', // CLDR 46.0.0 exemplarCity
  'variants.city.IST': 'إسطنبول', // CLDR 46.0.0 exemplarCity
  'variants.city.TOR': 'تورونتو', // CLDR 46.0.0 exemplarCity
  'variants.city.SYD': 'سيدني', // CLDR 46.0.0 exemplarCity
  'variants.city.OSA': 'أوساكا', // Wikidata Q35765 label
  'variants.city.KGN': 'كينغستون', // Wikidata Q34692 label
  'variants.region.eurasia': 'أوراسيا', // Wikidata Q5401 label
  'variants.region.142': 'آسيا', // CLDR 46.0.0 territory 142
  'variants.region.150': 'أوروبا', // CLDR 46.0.0 territory 150
  'variants.region.009': 'أوقيانوسيا', // CLDR 46.0.0 territory 009
  'variants.region.029': 'الكاريبي', // CLDR 46.0.0 territory 029
  'variants.region.003': 'أمريكا الشمالية', // CLDR 46.0.0 territory 003
  'variants.region.013': 'أمريكا الوسطى', // CLDR 46.0.0 territory 013
  'variants.region.005': 'أمريكا الجنوبية', // CLDR 46.0.0 territory 005
  'variants.region.011': 'غرب أفريقيا', // CLDR 46.0.0 territory 011
  'variants.region.014': 'شرق أفريقيا', // CLDR 46.0.0 territory 014
  'variants.region.015': 'شمال أفريقيا', // CLDR 46.0.0 territory 015
  'variants.region.018': 'أفريقيا الجنوبية', // CLDR 46.0.0 territory 018
  'variants.region.030': 'شرق آسيا', // CLDR 46.0.0 territory 030
  'variants.region.034': 'جنوب آسيا', // CLDR 46.0.0 territory 034
  'variants.region.035': 'جنوب شرق آسيا', // CLDR 46.0.0 territory 035
};

export default messages;
