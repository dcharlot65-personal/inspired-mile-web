/**
 * World cards: cities, their abilities, where a variant came from (src/lib/variants.ts): English.
 *
 * The reference: every other language has exactly these keys, with the same {placeholders}
 * and the same <b>/<a> marks (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'variants.unlocked': 'Variants unlocked: <b>{n}</b>',
  'variants.count': 'Variants: {n}',
  'variants.cities': 'Cities discovered: <b>{n}</b> / {total}',
  'variants.source.city-quest': 'City quest',
  'variants.source.battle-streak': 'Battle streak',
  'variants.source.trivia-mastery': 'Trivia mastery',
  'variants.source.daily-travel': 'Daily travel',
  'variants.source.event': 'Event',
  'variants.ability.TKY.name': 'Neon Precision',
  'variants.ability.TKY.why': "Tokyo's culture of precision",
  'variants.ability.LGS.name': 'Afrobeat Flow',
  'variants.ability.LGS.why': 'The rhythm of Lagos Afrobeats',
  'variants.ability.BKN.name': 'Borough Boss',
  'variants.ability.BKN.why': "New York's roast culture, birthplace of battle rap",
  'variants.ability.LDN.name': "Bard's Home Turf",
  'variants.ability.LDN.why': 'The home of Shakespeare',
  'variants.ability.MUM.name': 'Bollywood Rhythm',
  'variants.ability.MUM.why': "Mumbai's poetic traditions",
  'variants.ability.PAR.name': 'Haute Verse',
  'variants.ability.PAR.why': 'The French literary tradition',
  'variants.ability.SAO.name': 'Favela Fire',
  'variants.ability.SAO.why': 'Brazilian humor and improvisation',
  'variants.ability.SEO.name': 'K-Wave Cadence',
  'variants.ability.SEO.why': "K-pop precision and Seoul's rap scene",
  'variants.ability.NRB.name': "Storyteller's Gift",
  'variants.ability.NRB.why': "East Africa's tradition of oral storytelling",
  'variants.ability.BER.name': 'Cabaret Edge',
  'variants.ability.BER.why': "Berlin's cabaret tradition and dry humor",
  'variants.ability.MEX.name': 'Corrido Craft',
  'variants.ability.MEX.why': 'The Mexican poetic tradition',
  'variants.ability.CAI.name': "Scribe's Wisdom",
  'variants.ability.CAI.why': 'An ancient literary tradition',
  'variants.ability.ACC.name': 'Highlife Humor',
  'variants.ability.ACC.why': 'Ghanaian highlife and sharp wit',
  'variants.ability.JHB.name': 'Jozi Bars',
  'variants.ability.JHB.why': "The intensity of Johannesburg's rap scene",
  'variants.ability.MNL.name': 'FlipTop Flow',
  'variants.ability.MNL.why': 'Filipino rap battle culture',
  'variants.ability.IST.name': 'Crossroads Verse',
  'variants.ability.IST.why': 'Where East meets West in poetry',
  'variants.ability.TOR.name': 'Six Flow',
  'variants.ability.TOR.why': "Toronto's hip-hop dynasty",
  'variants.ability.SYD.name': 'Harbour Hustle',
  'variants.ability.SYD.why': 'Irreverent Australian humor',
  'variants.ability.OSA.name': 'Kansai Comedy',
  'variants.ability.OSA.why': "Osaka's tradition of comedy and wordplay",
  'variants.ability.KGN.name': 'Dancehall Rhythm',
  'variants.ability.KGN.why': 'Jamaican dancehall and dub poetry',
  'variants.city.TKY': 'Tokyo', // Wikidata Q1490 label
  'variants.city.LGS': 'Lagos', // Wikidata Q8673 label
  'variants.city.BKN': 'Brooklyn', // Wikidata Q18419 label
  'variants.city.LDN': 'London', // Wikidata Q84 label
  'variants.city.MUM': 'Mumbai', // Wikidata Q1156 label
  'variants.city.PAR': 'Paris', // Wikidata Q90 label
  'variants.city.SAO': 'São Paulo', // Wikidata Q174 label
  'variants.city.SEO': 'Seoul', // Wikidata Q8684 label
  'variants.city.NRB': 'Nairobi', // Wikidata Q3870 label
  'variants.city.BER': 'Berlin', // Wikidata Q64 label
  'variants.city.MEX': 'Mexico City', // Wikidata Q1489 label
  'variants.city.CAI': 'Cairo', // Wikidata Q85 label
  'variants.city.ACC': 'Accra', // Wikidata Q3761 label
  'variants.city.JHB': 'Johannesburg', // Wikidata Q34647 label
  'variants.city.MNL': 'Manila', // Wikidata Q1461 label
  'variants.city.IST': 'Istanbul', // Wikidata Q406 label
  'variants.city.TOR': 'Toronto', // Wikidata Q172 label
  'variants.city.SYD': 'Sydney', // Wikidata Q3130 label
  'variants.city.OSA': 'Osaka', // Wikidata Q35765 label
  'variants.city.KGN': 'Kingston', // Wikidata Q34692 label
  'variants.region.eurasia': 'Eurasia', // Wikidata Q5401 label
  'variants.region.142': 'Asia', // CLDR 46.0.0 territory 142
  'variants.region.150': 'Europe', // CLDR 46.0.0 territory 150
  'variants.region.009': 'Oceania', // CLDR 46.0.0 territory 009
  'variants.region.029': 'Caribbean', // CLDR 46.0.0 territory 029
  'variants.region.003': 'North America', // CLDR 46.0.0 territory 003
  'variants.region.013': 'Central America', // CLDR 46.0.0 territory 013
  'variants.region.005': 'South America', // CLDR 46.0.0 territory 005
  'variants.region.011': 'Western Africa', // CLDR 46.0.0 territory 011
  'variants.region.014': 'Eastern Africa', // CLDR 46.0.0 territory 014
  'variants.region.015': 'Northern Africa', // CLDR 46.0.0 territory 015
  'variants.region.018': 'Southern Africa', // CLDR 46.0.0 territory 018
  'variants.region.030': 'Eastern Asia', // CLDR 46.0.0 territory 030
  'variants.region.034': 'Southern Asia', // CLDR 46.0.0 territory 034
  'variants.region.035': 'Southeast Asia', // CLDR 46.0.0 territory 035
};

export default messages;
