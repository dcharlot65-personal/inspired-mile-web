/**
 * World cards: cities, their abilities, where a variant came from (src/lib/variants.ts): Italian.
 *
 * Same keys, {placeholders} and <b>/<a> marks as ./en.ts (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'variants.unlocked': 'Varianti sbloccate: <b>{n}</b>',
  'variants.count': 'Varianti: {n}',
  'variants.source.city-quest': 'Missione di città',
  'variants.source.battle-streak': 'Serie di vittorie',
  'variants.source.trivia-mastery': 'Maestria nei quiz',
  'variants.source.daily-travel': 'Viaggio giornaliero',
  'variants.source.event': 'Evento',
  'variants.ability.TKY.name': 'Precisione al neon',
  'variants.ability.TKY.why': 'La cultura della precisione di Tokyo',
  'variants.ability.LGS.name': 'Flow afrobeat',
  'variants.ability.LGS.why': 'Il ritmo dell’afrobeats di Lagos',
  'variants.ability.BKN.name': 'Boss del quartiere',
  'variants.ability.BKN.why': 'La cultura newyorkese dello sfottò, culla delle battaglie rap',
  'variants.ability.LDN.name': 'In casa del Bardo',
  'variants.ability.LDN.why': 'La patria di Shakespeare',
  'variants.ability.MUM.name': 'Ritmo di Bollywood',
  'variants.ability.MUM.why': 'Le tradizioni poetiche di Mumbai',
  'variants.ability.PAR.name': 'Alta strofa',
  'variants.ability.PAR.why': 'La tradizione letteraria francese',
  'variants.ability.SAO.name': 'Fuoco di favela',
  'variants.ability.SAO.why': 'L’umorismo e l’improvvisazione del Brasile',
  'variants.ability.SEO.name': 'Cadenza dell’onda coreana',
  'variants.ability.SEO.why': 'La precisione del K-pop e la scena rap di Seul',
  'variants.ability.NRB.name': 'Dono del narratore',
  'variants.ability.NRB.why': 'La tradizione del racconto orale dell’Africa orientale',
  'variants.ability.BER.name': 'Lama da cabaret',
  'variants.ability.BER.why': 'La tradizione del cabaret berlinese e il suo umorismo asciutto',
  'variants.ability.MEX.name': 'Arte del corrido',
  'variants.ability.MEX.why': 'La tradizione poetica messicana',
  'variants.ability.CAI.name': 'Saggezza dello scriba',
  'variants.ability.CAI.why': 'Una tradizione letteraria antichissima',
  'variants.ability.ACC.name': 'Umorismo highlife',
  'variants.ability.ACC.why': 'L’highlife ghanese e un’arguzia tagliente',
  'variants.ability.JHB.name': 'Barre di Jozi',
  'variants.ability.JHB.why': 'L’intensità della scena rap di Johannesburg',
  'variants.ability.MNL.name': 'Flow FlipTop',
  'variants.ability.MNL.why': 'La cultura filippina delle battaglie rap',
  'variants.ability.IST.name': 'Strofa del crocevia',
  'variants.ability.IST.why': 'Dove Oriente e Occidente si incontrano nella poesia',
  'variants.ability.TOR.name': 'Flow del Six',
  'variants.ability.TOR.why': 'La dinastia hip hop di Toronto',
  'variants.ability.SYD.name': 'Slancio del porto',
  'variants.ability.SYD.why': 'L’umorismo irriverente dell’Australia',
  'variants.ability.OSA.name': 'Comicità del Kansai',
  'variants.ability.OSA.why': 'La tradizione comica e i giochi di parole di Osaka',
  'variants.ability.KGN.name': 'Ritmo dancehall',
  'variants.ability.KGN.why': 'La dancehall giamaicana e la poesia dub',
  'variants.city.TKY': 'Tokyo', // Wikidata Q1490 label
  'variants.city.LGS': 'Lagos', // Wikidata Q8673 label
  'variants.city.BKN': 'Brooklyn', // Wikidata Q18419 label
  'variants.city.LDN': 'Londra', // CLDR 46.0.0 exemplarCity
  'variants.city.MUM': 'Mumbai', // Wikidata Q1156 label
  'variants.city.PAR': 'Parigi', // CLDR 46.0.0 exemplarCity
  'variants.city.SAO': 'San Paolo', // CLDR 46.0.0 exemplarCity
  'variants.city.SEO': 'Seul', // CLDR 46.0.0 exemplarCity
  'variants.city.NRB': 'Nairobi', // Wikidata Q3870 label
  'variants.city.BER': 'Berlino', // CLDR 46.0.0 exemplarCity
  'variants.city.MEX': 'Città del Messico', // CLDR 46.0.0 exemplarCity
  'variants.city.CAI': 'Il Cairo', // CLDR 46.0.0 exemplarCity
  'variants.city.ACC': 'Accra', // Wikidata Q3761 label
  'variants.city.JHB': 'Johannesburg', // Wikidata Q34647 label
  'variants.city.MNL': 'Manila', // Wikidata Q1461 label
  'variants.city.IST': 'Istanbul', // Wikidata Q406 label
  'variants.city.TOR': 'Toronto', // Wikidata Q172 label
  'variants.city.SYD': 'Sydney', // Wikidata Q3130 label
  'variants.city.OSA': 'Osaka', // Wikidata Q35765 label
  'variants.city.KGN': 'Kingston', // Wikidata Q34692 label
  'variants.region.eurasia': 'Eurasia', // Wikidata Q5401 label
};

export default messages;
