/**
 * World cards: cities, their abilities, where a variant came from (src/lib/variants.ts): Russian.
 *
 * Same keys, {placeholders} and <b>/<a> marks as ./en.ts (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'variants.unlocked': 'Открыто вариантов: <b>{n}</b>',
  'variants.count': 'Вариантов: {n}',
  'variants.cities': 'Открыто городов: <b>{n}</b> / {total}',
  'variants.source.city-quest': 'Городское задание',
  'variants.source.battle-streak': 'Серия побед',
  'variants.source.trivia-mastery': 'Мастерство в викторине',
  'variants.source.daily-travel': 'Ежедневное путешествие',
  'variants.source.event': 'Событие',
  'variants.ability.TKY.name': 'Неоновая точность',
  'variants.ability.TKY.why': 'Токийская культура точности',
  'variants.ability.LGS.name': 'Афробит-флоу',
  'variants.ability.LGS.why': 'Ритм афробитс из Лагоса',
  'variants.ability.BKN.name': 'Хозяин района',
  'variants.ability.BKN.why': 'Нью-йоркская культура подколок, родина рэп-баттлов',
  'variants.ability.LDN.name': 'Родные стены Барда',
  'variants.ability.LDN.why': 'Родина Шекспира',
  'variants.ability.MUM.name': 'Ритм Болливуда',
  'variants.ability.MUM.why': 'Поэтические традиции Мумбаи',
  'variants.ability.PAR.name': 'Высокая строфа',
  'variants.ability.PAR.why': 'Французская литературная традиция',
  'variants.ability.SAO.name': 'Огонь фавелы',
  'variants.ability.SAO.why': 'Бразильский юмор и импровизация',
  'variants.ability.SEO.name': 'Каденция корейской волны',
  'variants.ability.SEO.why': 'Точность кей-попа и рэп-сцена Сеула',
  'variants.ability.NRB.name': 'Дар рассказчика',
  'variants.ability.NRB.why': 'Восточноафриканская традиция устного рассказа',
  'variants.ability.BER.name': 'Острота кабаре',
  'variants.ability.BER.why': 'Берлинская традиция кабаре и сухой юмор',
  'variants.ability.MEX.name': 'Искусство корридо',
  'variants.ability.MEX.why': 'Мексиканская поэтическая традиция',
  'variants.ability.CAI.name': 'Мудрость писца',
  'variants.ability.CAI.why': 'Древняя литературная традиция',
  'variants.ability.ACC.name': 'Юмор хайлайфа',
  'variants.ability.ACC.why': 'Ганский хайлайф и острый ум',
  'variants.ability.JHB.name': 'Строки Джози',
  'variants.ability.JHB.why': 'Накал рэп-сцены Йоханнесбурга',
  'variants.ability.MNL.name': 'Флоу FlipTop',
  'variants.ability.MNL.why': 'Филиппинская культура рэп-баттлов',
  'variants.ability.IST.name': 'Строфа перекрёстка',
  'variants.ability.IST.why': 'Там, где Восток встречается с Западом в поэзии',
  'variants.ability.TOR.name': 'Флоу «Шестёрки»',
  'variants.ability.TOR.why': 'Хип-хоп-династия Торонто',
  'variants.ability.SYD.name': 'Напор гавани',
  'variants.ability.SYD.why': 'Дерзкий австралийский юмор',
  'variants.ability.OSA.name': 'Комедия Кансая',
  'variants.ability.OSA.why': 'Осакская традиция комедии и игры слов',
  'variants.ability.KGN.name': 'Ритм дэнсхолла',
  'variants.ability.KGN.why': 'Ямайский дэнсхолл и даб-поэзия',
  'variants.city.TKY': 'Токио', // CLDR 46.0.0 exemplarCity
  'variants.city.LGS': 'Лагос', // CLDR 46.0.0 exemplarCity
  'variants.city.BKN': 'Бруклин', // Wikidata Q18419 label
  'variants.city.LDN': 'Лондон', // CLDR 46.0.0 exemplarCity
  'variants.city.MUM': 'Мумбаи', // Wikidata Q1156 label
  'variants.city.PAR': 'Париж', // CLDR 46.0.0 exemplarCity
  'variants.city.SAO': 'Сан-Паулу', // CLDR 46.0.0 exemplarCity
  'variants.city.SEO': 'Сеул', // CLDR 46.0.0 exemplarCity
  'variants.city.NRB': 'Найроби', // CLDR 46.0.0 exemplarCity
  'variants.city.BER': 'Берлин', // CLDR 46.0.0 exemplarCity
  'variants.city.MEX': 'Мехико', // CLDR 46.0.0 exemplarCity
  'variants.city.CAI': 'Каир', // CLDR 46.0.0 exemplarCity
  'variants.city.ACC': 'Аккра', // CLDR 46.0.0 exemplarCity
  'variants.city.JHB': 'Йоханнесбург', // CLDR 46.0.0 exemplarCity
  'variants.city.MNL': 'Манила', // CLDR 46.0.0 exemplarCity
  'variants.city.IST': 'Стамбул', // CLDR 46.0.0 exemplarCity
  'variants.city.TOR': 'Торонто', // CLDR 46.0.0 exemplarCity
  'variants.city.SYD': 'Сидней', // CLDR 46.0.0 exemplarCity
  'variants.city.OSA': 'Осака', // Wikidata Q35765 label
  'variants.city.KGN': 'Кингстон', // Wikidata Q34692 label
  'variants.region.eurasia': 'Евразия', // Wikidata Q5401 label
  'variants.region.142': 'Азия', // CLDR 46.0.0 territory 142
  'variants.region.150': 'Европа', // CLDR 46.0.0 territory 150
  'variants.region.009': 'Океания', // CLDR 46.0.0 territory 009
  'variants.region.029': 'Карибы', // CLDR 46.0.0 territory 029
  'variants.region.003': 'Северная Америка', // CLDR 46.0.0 territory 003
  'variants.region.013': 'Центральная Америка', // CLDR 46.0.0 territory 013
  'variants.region.005': 'Южная Америка', // CLDR 46.0.0 territory 005
  'variants.region.011': 'Западная Африка', // CLDR 46.0.0 territory 011
  'variants.region.014': 'Восточная Африка', // CLDR 46.0.0 territory 014
  'variants.region.015': 'Северная Африка', // CLDR 46.0.0 territory 015
  'variants.region.018': 'Южная Африка', // CLDR 46.0.0 territory 018
  'variants.region.030': 'Восточная Азия', // CLDR 46.0.0 territory 030
  'variants.region.034': 'Южная Азия', // CLDR 46.0.0 territory 034
  'variants.region.035': 'Юго-Восточная Азия', // CLDR 46.0.0 territory 035
};

export default messages;
