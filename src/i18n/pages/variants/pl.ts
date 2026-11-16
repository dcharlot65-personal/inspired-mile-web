/**
 * World cards: cities, their abilities, where a variant came from (src/lib/variants.ts): Polish.
 *
 * Same keys, {placeholders} and <b>/<a> marks as ./en.ts (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'variants.unlocked': 'Odblokowane warianty: <b>{n}</b>',
  'variants.count': 'Warianty: {n}',
  'variants.source.city-quest': 'Zadanie miejskie',
  'variants.source.battle-streak': 'Seria zwycięstw',
  'variants.source.trivia-mastery': 'Mistrzostwo w quizie',
  'variants.source.daily-travel': 'Codzienna podróż',
  'variants.source.event': 'Wydarzenie',
  'variants.ability.TKY.name': 'Neonowa precyzja',
  'variants.ability.TKY.why': 'Tokijska kultura precyzji',
  'variants.ability.LGS.name': 'Afrobeatowy flow',
  'variants.ability.LGS.why': 'Rytm afrobeats z Lagos',
  'variants.ability.BKN.name': 'Szef dzielnicy',
  'variants.ability.BKN.why': 'Nowojorska kultura docinków, kolebka bitew rapowych',
  'variants.ability.LDN.name': 'Na ziemi Barda',
  'variants.ability.LDN.why': 'Ojczyzna Szekspira',
  'variants.ability.MUM.name': 'Rytm Bollywood',
  'variants.ability.MUM.why': 'Poetyckie tradycje Mumbaju',
  'variants.ability.PAR.name': 'Wysoka strofa',
  'variants.ability.PAR.why': 'Francuska tradycja literacka',
  'variants.ability.SAO.name': 'Ogień faweli',
  'variants.ability.SAO.why': 'Brazylijski humor i improwizacja',
  'variants.ability.SEO.name': 'Kadencja koreańskiej fali',
  'variants.ability.SEO.why': 'Precyzja K-popu i seulska scena rapowa',
  'variants.ability.NRB.name': 'Dar opowiadacza',
  'variants.ability.NRB.why': 'Wschodnioafrykańska tradycja opowieści ustnej',
  'variants.ability.BER.name': 'Kabaretowe ostrze',
  'variants.ability.BER.why': 'Berlińska tradycja kabaretu i suchy humor',
  'variants.ability.MEX.name': 'Sztuka corrido',
  'variants.ability.MEX.why': 'Meksykańska tradycja poetycka',
  'variants.ability.CAI.name': 'Mądrość skryby',
  'variants.ability.CAI.why': 'Starożytna tradycja literacka',
  'variants.ability.ACC.name': 'Humor highlife',
  'variants.ability.ACC.why': 'Ghański highlife i cięty dowcip',
  'variants.ability.JHB.name': 'Wersy z Jozi',
  'variants.ability.JHB.why': 'Siła sceny rapowej Johannesburga',
  'variants.ability.MNL.name': 'Flow FlipTop',
  'variants.ability.MNL.why': 'Filipińska kultura bitew rapowych',
  'variants.ability.IST.name': 'Strofa z rozdroża',
  'variants.ability.IST.why': 'Tu Wschód spotyka Zachód w poezji',
  'variants.ability.TOR.name': 'Flow z Six',
  'variants.ability.TOR.why': 'Hip-hopowa dynastia Toronto',
  'variants.ability.SYD.name': 'Portowy zapał',
  'variants.ability.SYD.why': 'Bezceremonialny australijski humor',
  'variants.ability.OSA.name': 'Komedia z Kansai',
  'variants.ability.OSA.why': 'Osakijska tradycja komedii i gry słów',
  'variants.ability.KGN.name': 'Rytm dancehall',
  'variants.ability.KGN.why': 'Jamajski dancehall i poezja dub',
  'variants.city.TKY': 'Tokio', // CLDR 46.0.0 exemplarCity
  'variants.city.LGS': 'Lagos', // Wikidata Q8673 label
  'variants.city.BKN': 'Brooklyn', // Wikidata Q18419 label
  'variants.city.LDN': 'Londyn', // CLDR 46.0.0 exemplarCity
  'variants.city.MUM': 'Mumbaj', // Wikidata Q1156 label
  'variants.city.PAR': 'Paryż', // CLDR 46.0.0 exemplarCity
  'variants.city.SAO': 'São Paulo', // Wikidata Q174 label
  'variants.city.SEO': 'Seul', // CLDR 46.0.0 exemplarCity
  'variants.city.NRB': 'Nairobi', // Wikidata Q3870 label
  'variants.city.BER': 'Berlin', // Wikidata Q64 label
  'variants.city.MEX': 'Meksyk', // not from a source: see docs/language/pages-core
  'variants.city.CAI': 'Kair', // CLDR 46.0.0 exemplarCity
  'variants.city.ACC': 'Akra', // CLDR 46.0.0 exemplarCity
  'variants.city.JHB': 'Johannesburg', // Wikidata Q34647 label
  'variants.city.MNL': 'Manila', // Wikidata Q1461 label
  'variants.city.IST': 'Stambuł', // CLDR 46.0.0 exemplarCity
  'variants.city.TOR': 'Toronto', // Wikidata Q172 label
  'variants.city.SYD': 'Sydney', // Wikidata Q3130 label
  'variants.city.OSA': 'Osaka', // Wikidata Q35765 label
  'variants.city.KGN': 'Kingston', // Wikidata Q34692 label
  'variants.region.eurasia': 'Eurazja', // Wikidata Q5401 label
};

export default messages;
