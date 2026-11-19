/**
 * World cards: cities, their abilities, where a variant came from (src/lib/variants.ts): French.
 *
 * Same keys, {placeholders} and <b>/<a> marks as ./en.ts (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'variants.unlocked': 'Variantes débloquées\u00a0: <b>{n}</b>',
  'variants.count': 'Variantes\u00a0: {n}',
  'variants.cities': 'Villes découvertes\u00a0: <b>{n}</b> / {total}',
  'variants.source.city-quest': 'Quête de ville',
  'variants.source.battle-streak': 'Série de victoires',
  'variants.source.trivia-mastery': 'Maîtrise du quiz',
  'variants.source.daily-travel': 'Voyage quotidien',
  'variants.source.event': 'Événement',
  'variants.ability.TKY.name': 'Précision néon',
  'variants.ability.TKY.why': 'La culture de la précision de Tokyo',
  'variants.ability.LGS.name': 'Flow afrobeat',
  'variants.ability.LGS.why': 'Le rythme de l’afrobeats de Lagos',
  'variants.ability.BKN.name': 'Patron du quartier',
  'variants.ability.BKN.why': 'La culture new-yorkaise de la vanne, berceau des battles de rap',
  'variants.ability.LDN.name': 'Sur les terres du Barde',
  'variants.ability.LDN.why': 'La patrie de Shakespeare',
  'variants.ability.MUM.name': 'Rythme de Bollywood',
  'variants.ability.MUM.why': 'Les traditions poétiques de Bombay',
  'variants.ability.PAR.name': 'Haute strophe',
  'variants.ability.PAR.why': 'La tradition littéraire française',
  'variants.ability.SAO.name': 'Feu de la favela',
  'variants.ability.SAO.why': 'L’humour et l’improvisation du Brésil',
  'variants.ability.SEO.name': 'Cadence de la vague coréenne',
  'variants.ability.SEO.why': 'La précision de la K-pop et la scène rap de Séoul',
  'variants.ability.NRB.name': 'Don du conteur',
  'variants.ability.NRB.why': 'La tradition du conte oral d’Afrique de l’Est',
  'variants.ability.BER.name': 'Tranchant du cabaret',
  'variants.ability.BER.why': 'La tradition du cabaret berlinois et son humour pince-sans-rire',
  'variants.ability.MEX.name': 'Art du corrido',
  'variants.ability.MEX.why': 'La tradition poétique mexicaine',
  'variants.ability.CAI.name': 'Sagesse du scribe',
  'variants.ability.CAI.why': 'Une tradition littéraire millénaire',
  'variants.ability.ACC.name': 'Humour highlife',
  'variants.ability.ACC.why': 'Le highlife ghanéen et un esprit acéré',
  'variants.ability.JHB.name': 'Mesures de Jozi',
  'variants.ability.JHB.why': 'L’intensité de la scène rap de Johannesbourg',
  'variants.ability.MNL.name': 'Flow FlipTop',
  'variants.ability.MNL.why': 'La culture philippine des battles de rap',
  'variants.ability.IST.name': 'Strophe du carrefour',
  'variants.ability.IST.why': 'Là où l’Orient et l’Occident se rencontrent en poésie',
  'variants.ability.TOR.name': 'Flow du Six',
  'variants.ability.TOR.why': 'La dynastie hip-hop de Toronto',
  'variants.ability.SYD.name': 'Fougue du port',
  'variants.ability.SYD.why': 'L’humour irrévérencieux de l’Australie',
  'variants.ability.OSA.name': 'Comédie du Kansai',
  'variants.ability.OSA.why': 'La tradition comique et les jeux de mots d’Osaka',
  'variants.ability.KGN.name': 'Rythme dancehall',
  'variants.ability.KGN.why': 'Le dancehall jamaïcain et la poésie dub',
  'variants.city.TKY': 'Tokyo', // Wikidata Q1490 label
  'variants.city.LGS': 'Lagos', // Wikidata Q8673 label
  'variants.city.BKN': 'Brooklyn', // Wikidata Q18419 label
  'variants.city.LDN': 'Londres', // CLDR 46.0.0 exemplarCity
  'variants.city.MUM': 'Bombay', // Wikidata Q1156 label
  'variants.city.PAR': 'Paris', // Wikidata Q90 label
  'variants.city.SAO': 'São Paulo', // CLDR 46.0.0 exemplarCity
  'variants.city.SEO': 'Séoul', // CLDR 46.0.0 exemplarCity
  'variants.city.NRB': 'Nairobi', // Wikidata Q3870 label
  'variants.city.BER': 'Berlin', // Wikidata Q64 label
  'variants.city.MEX': 'Mexico', // CLDR 46.0.0 exemplarCity
  'variants.city.CAI': 'Le Caire', // CLDR 46.0.0 exemplarCity
  'variants.city.ACC': 'Accra', // Wikidata Q3761 label
  'variants.city.JHB': 'Johannesbourg', // Wikidata Q34647 label
  'variants.city.MNL': 'Manille', // CLDR 46.0.0 exemplarCity
  'variants.city.IST': 'Istanbul', // Wikidata Q406 label
  'variants.city.TOR': 'Toronto', // Wikidata Q172 label
  'variants.city.SYD': 'Sydney', // Wikidata Q3130 label
  'variants.city.OSA': 'Osaka', // Wikidata Q35765 label
  'variants.city.KGN': 'Kingston', // Wikidata Q34692 label
  'variants.region.eurasia': 'Eurasie', // Wikidata Q5401 label
  'variants.region.142': 'Asie', // CLDR 46.0.0 territory 142
  'variants.region.150': 'Europe', // CLDR 46.0.0 territory 150
  'variants.region.009': 'Océanie', // CLDR 46.0.0 territory 009
  'variants.region.029': 'Caraïbes', // CLDR 46.0.0 territory 029
  'variants.region.003': 'Amérique du Nord', // CLDR 46.0.0 territory 003
  'variants.region.013': 'Amérique centrale', // CLDR 46.0.0 territory 013
  'variants.region.005': 'Amérique du Sud', // CLDR 46.0.0 territory 005
  'variants.region.011': 'Afrique occidentale', // CLDR 46.0.0 territory 011
  'variants.region.014': 'Afrique orientale', // CLDR 46.0.0 territory 014
  'variants.region.015': 'Afrique septentrionale', // CLDR 46.0.0 territory 015
  'variants.region.018': 'Afrique australe', // CLDR 46.0.0 territory 018
  'variants.region.030': 'Asie de l’Est', // CLDR 46.0.0 territory 030
  'variants.region.034': 'Asie du Sud', // CLDR 46.0.0 territory 034
  'variants.region.035': 'Asie du Sud-Est', // CLDR 46.0.0 territory 035
};

export default messages;
