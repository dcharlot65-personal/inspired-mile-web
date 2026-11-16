/**
 * World cards: cities, their abilities, where a variant came from (src/lib/variants.ts): Spanish.
 *
 * Same keys, {placeholders} and <b>/<a> marks as ./en.ts (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'variants.unlocked': 'Variantes desbloqueadas: <b>{n}</b>',
  'variants.count': 'Variantes: {n}',
  'variants.cities': 'Ciudades descubiertas: <b>{n}</b> / {total}',
  'variants.source.city-quest': 'Misión de ciudad',
  'variants.source.battle-streak': 'Racha de batallas',
  'variants.source.trivia-mastery': 'Dominio de las preguntas',
  'variants.source.daily-travel': 'Viaje diario',
  'variants.source.event': 'Evento',
  'variants.ability.TKY.name': 'Precisión de neón',
  'variants.ability.TKY.why': 'La cultura de la precisión de Tokio',
  'variants.ability.LGS.name': 'Flujo afrobeat',
  'variants.ability.LGS.why': 'El ritmo del afrobeats de Lagos',
  'variants.ability.BKN.name': 'Jefe del barrio',
  'variants.ability.BKN.why': 'La cultura de la burla de Nueva York, cuna de las batallas de rap',
  'variants.ability.LDN.name': 'La casa del Bardo',
  'variants.ability.LDN.why': 'El hogar de Shakespeare',
  'variants.ability.MUM.name': 'Ritmo de Bollywood',
  'variants.ability.MUM.why': 'Las tradiciones poéticas de Bombay',
  'variants.ability.PAR.name': 'Alta estrofa',
  'variants.ability.PAR.why': 'La tradición literaria francesa',
  'variants.ability.SAO.name': 'Fuego de favela',
  'variants.ability.SAO.why': 'El humor y la improvisación de Brasil',
  'variants.ability.SEO.name': 'Cadencia de la ola coreana',
  'variants.ability.SEO.why': 'La precisión del K-pop y la escena de rap de Seúl',
  'variants.ability.NRB.name': 'Don del narrador',
  'variants.ability.NRB.why': 'La tradición de narración oral de África Oriental',
  'variants.ability.BER.name': 'Filo de cabaré',
  'variants.ability.BER.why': 'La tradición del cabaré berlinés y su humor seco',
  'variants.ability.MEX.name': 'Arte del corrido',
  'variants.ability.MEX.why': 'La tradición poética mexicana',
  'variants.ability.CAI.name': 'Sabiduría del escriba',
  'variants.ability.CAI.why': 'Una tradición literaria milenaria',
  'variants.ability.ACC.name': 'Humor highlife',
  'variants.ability.ACC.why': 'El highlife ghanés y un ingenio afilado',
  'variants.ability.JHB.name': 'Barras de Jozi',
  'variants.ability.JHB.why': 'La intensidad de la escena de rap de Johannesburgo',
  'variants.ability.MNL.name': 'Flujo FlipTop',
  'variants.ability.MNL.why': 'La cultura filipina de las batallas de rap',
  'variants.ability.IST.name': 'Estrofa de la encrucijada',
  'variants.ability.IST.why': 'Donde Oriente y Occidente se encuentran en la poesía',
  'variants.ability.TOR.name': 'Flujo del Six',
  'variants.ability.TOR.why': 'La dinastía del hip-hop de Toronto',
  'variants.ability.SYD.name': 'Brío del puerto',
  'variants.ability.SYD.why': 'El humor irreverente de Australia',
  'variants.ability.OSA.name': 'Comedia de Kansai',
  'variants.ability.OSA.why': 'La tradición de comedia y juegos de palabras de Osaka',
  'variants.ability.KGN.name': 'Ritmo dancehall',
  'variants.ability.KGN.why': 'El dancehall jamaicano y la poesía dub',
  'variants.city.TKY': 'Tokio', // CLDR 46.0.0 exemplarCity
  'variants.city.LGS': 'Lagos', // Wikidata Q8673 label
  'variants.city.BKN': 'Brooklyn', // Wikidata Q18419 label
  'variants.city.LDN': 'Londres', // CLDR 46.0.0 exemplarCity
  'variants.city.MUM': 'Bombay', // Wikidata Q1156 label
  'variants.city.PAR': 'París', // CLDR 46.0.0 exemplarCity
  'variants.city.SAO': 'São Paulo', // CLDR 46.0.0 exemplarCity
  'variants.city.SEO': 'Seúl', // CLDR 46.0.0 exemplarCity
  'variants.city.NRB': 'Nairobi', // Wikidata Q3870 label
  'variants.city.BER': 'Berlín', // CLDR 46.0.0 exemplarCity
  'variants.city.MEX': 'Ciudad de México', // CLDR 46.0.0 exemplarCity
  'variants.city.CAI': 'El Cairo', // CLDR 46.0.0 exemplarCity
  'variants.city.ACC': 'Acra', // CLDR 46.0.0 exemplarCity
  'variants.city.JHB': 'Johannesburgo', // CLDR 46.0.0 exemplarCity
  'variants.city.MNL': 'Manila', // Wikidata Q1461 label
  'variants.city.IST': 'Estambul', // CLDR 46.0.0 exemplarCity
  'variants.city.TOR': 'Toronto', // Wikidata Q172 label
  'variants.city.SYD': 'Sídney', // CLDR 46.0.0 exemplarCity
  'variants.city.OSA': 'Osaka', // Wikidata Q35765 label
  'variants.city.KGN': 'Kingston', // Wikidata Q34692 label
  'variants.region.eurasia': 'Eurasia', // Wikidata Q5401 label
  'variants.region.142': 'Asia', // CLDR 46.0.0 territory 142
  'variants.region.150': 'Europa', // CLDR 46.0.0 territory 150
  'variants.region.009': 'Oceanía', // CLDR 46.0.0 territory 009
  'variants.region.029': 'Caribe', // CLDR 46.0.0 territory 029
  'variants.region.003': 'América del Norte', // CLDR 46.0.0 territory 003
  'variants.region.013': 'Centroamérica', // CLDR 46.0.0 territory 013
  'variants.region.005': 'Sudamérica', // CLDR 46.0.0 territory 005
  'variants.region.011': 'África occidental', // CLDR 46.0.0 territory 011
  'variants.region.014': 'África oriental', // CLDR 46.0.0 territory 014
  'variants.region.015': 'África septentrional', // CLDR 46.0.0 territory 015
  'variants.region.018': 'África meridional', // CLDR 46.0.0 territory 018
  'variants.region.030': 'Asia oriental', // CLDR 46.0.0 territory 030
  'variants.region.034': 'Asia meridional', // CLDR 46.0.0 territory 034
  'variants.region.035': 'Sudeste asiático', // CLDR 46.0.0 territory 035
};

export default messages;
