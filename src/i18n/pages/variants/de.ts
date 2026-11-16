/**
 * World cards: cities, their abilities, where a variant came from (src/lib/variants.ts): German.
 *
 * Same keys, {placeholders} and <b>/<a> marks as ./en.ts (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'variants.unlocked': 'Freigeschaltete Varianten: <b>{n}</b>',
  'variants.count': 'Varianten: {n}',
  'variants.source.city-quest': 'Stadtquest',
  'variants.source.battle-streak': 'Siegesserie',
  'variants.source.trivia-mastery': 'Quizmeisterschaft',
  'variants.source.daily-travel': 'Tägliche Reise',
  'variants.source.event': 'Event',
  'variants.ability.TKY.name': 'Neonpräzision',
  'variants.ability.TKY.why': 'Tokios Kultur der Präzision',
  'variants.ability.LGS.name': 'Afrobeat-Flow',
  'variants.ability.LGS.why': 'Der Rhythmus der Afrobeats aus Lagos',
  'variants.ability.BKN.name': 'Boss des Viertels',
  'variants.ability.BKN.why': 'New Yorks Kultur des Spotts, Geburtsort des Battle-Rap',
  'variants.ability.LDN.name': 'Heimspiel des Barden',
  'variants.ability.LDN.why': 'Die Heimat Shakespeares',
  'variants.ability.MUM.name': 'Bollywood-Rhythmus',
  'variants.ability.MUM.why': 'Mumbais dichterische Traditionen',
  'variants.ability.PAR.name': 'Haute Strophe',
  'variants.ability.PAR.why': 'Die französische Literaturtradition',
  'variants.ability.SAO.name': 'Favela-Feuer',
  'variants.ability.SAO.why': 'Brasilianischer Humor und Improvisation',
  'variants.ability.SEO.name': 'K-Wave-Kadenz',
  'variants.ability.SEO.why': 'Die Präzision des K-Pop und Seouls Rap-Szene',
  'variants.ability.NRB.name': 'Gabe des Erzählers',
  'variants.ability.NRB.why': 'Ostafrikas Tradition des mündlichen Erzählens',
  'variants.ability.BER.name': 'Kabarett-Schärfe',
  'variants.ability.BER.why': 'Berlins Kabarett-Tradition und trockener Humor',
  'variants.ability.MEX.name': 'Kunst des Corrido',
  'variants.ability.MEX.why': 'Die mexikanische Dichtungstradition',
  'variants.ability.CAI.name': 'Weisheit des Schreibers',
  'variants.ability.CAI.why': 'Eine uralte Literaturtradition',
  'variants.ability.ACC.name': 'Highlife-Humor',
  'variants.ability.ACC.why': 'Ghanaischer Highlife und scharfer Witz',
  'variants.ability.JHB.name': 'Jozi-Bars',
  'variants.ability.JHB.why': 'Die Wucht der Rap-Szene von Johannesburg',
  'variants.ability.MNL.name': 'FlipTop-Flow',
  'variants.ability.MNL.why': 'Die philippinische Kultur der Rap-Battles',
  'variants.ability.IST.name': 'Strophe am Scheideweg',
  'variants.ability.IST.why': 'Wo Ost und West sich in der Dichtung begegnen',
  'variants.ability.TOR.name': 'Six-Flow',
  'variants.ability.TOR.why': 'Torontos Hip-Hop-Dynastie',
  'variants.ability.SYD.name': 'Hafen-Schwung',
  'variants.ability.SYD.why': 'Respektloser australischer Humor',
  'variants.ability.OSA.name': 'Kansai-Komik',
  'variants.ability.OSA.why': 'Osakas Tradition der Komik und des Wortspiels',
  'variants.ability.KGN.name': 'Dancehall-Rhythmus',
  'variants.ability.KGN.why': 'Jamaikanischer Dancehall und Dub-Poesie',
  'variants.city.TKY': 'Tokio', // CLDR 46.0.0 exemplarCity
  'variants.city.LGS': 'Lagos', // Wikidata Q8673 label
  'variants.city.BKN': 'Brooklyn', // Wikidata Q18419 label
  'variants.city.LDN': 'London', // Wikidata Q84 label
  'variants.city.MUM': 'Mumbai', // Wikidata Q1156 label
  'variants.city.PAR': 'Paris', // Wikidata Q90 label
  'variants.city.SAO': 'São Paulo', // CLDR 46.0.0 exemplarCity
  'variants.city.SEO': 'Seoul', // Wikidata Q8684 label
  'variants.city.NRB': 'Nairobi', // Wikidata Q3870 label
  'variants.city.BER': 'Berlin', // Wikidata Q64 label
  'variants.city.MEX': 'Mexiko-Stadt', // CLDR 46.0.0 exemplarCity
  'variants.city.CAI': 'Kairo', // CLDR 46.0.0 exemplarCity
  'variants.city.ACC': 'Accra', // Wikidata Q3761 label
  'variants.city.JHB': 'Johannesburg', // Wikidata Q34647 label
  'variants.city.MNL': 'Manila', // Wikidata Q1461 label
  'variants.city.IST': 'Istanbul', // Wikidata Q406 label
  'variants.city.TOR': 'Toronto', // Wikidata Q172 label
  'variants.city.SYD': 'Sydney', // Wikidata Q3130 label
  'variants.city.OSA': 'Osaka', // Wikidata Q35765 label
  'variants.city.KGN': 'Kingston', // Wikidata Q34692 label
  'variants.region.eurasia': 'Eurasien', // Wikidata Q5401 label
};

export default messages;
