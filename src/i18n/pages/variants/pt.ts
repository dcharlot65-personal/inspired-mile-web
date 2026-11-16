/**
 * World cards: cities, their abilities, where a variant came from (src/lib/variants.ts): Portuguese (Brazil).
 *
 * Same keys, {placeholders} and <b>/<a> marks as ./en.ts (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'variants.unlocked': 'Variantes desbloqueadas: <b>{n}</b>',
  'variants.count': 'Variantes: {n}',
  'variants.cities': 'Cidades descobertas: <b>{n}</b> / {total}',
  'variants.source.city-quest': 'Missão de cidade',
  'variants.source.battle-streak': 'Sequência de vitórias',
  'variants.source.trivia-mastery': 'Domínio do quiz',
  'variants.source.daily-travel': 'Viagem diária',
  'variants.source.event': 'Evento',
  'variants.ability.TKY.name': 'Precisão de neon',
  'variants.ability.TKY.why': 'A cultura da precisão de Tóquio',
  'variants.ability.LGS.name': 'Flow afrobeat',
  'variants.ability.LGS.why': 'O ritmo do afrobeats de Lagos',
  'variants.ability.BKN.name': 'Chefe do bairro',
  'variants.ability.BKN.why': 'A cultura da zoeira de Nova York, berço das batalhas de rap',
  'variants.ability.LDN.name': 'Na casa do Bardo',
  'variants.ability.LDN.why': 'A terra de Shakespeare',
  'variants.ability.MUM.name': 'Ritmo de Bollywood',
  'variants.ability.MUM.why': 'As tradições poéticas de Bombaim',
  'variants.ability.PAR.name': 'Alta estrofe',
  'variants.ability.PAR.why': 'A tradição literária francesa',
  'variants.ability.SAO.name': 'Fogo da favela',
  'variants.ability.SAO.why': 'O humor e o improviso brasileiros',
  'variants.ability.SEO.name': 'Cadência da onda coreana',
  'variants.ability.SEO.why': 'A precisão do K-pop e a cena de rap de Seul',
  'variants.ability.NRB.name': 'Dom do contador de histórias',
  'variants.ability.NRB.why': 'A tradição de narrativa oral da África Oriental',
  'variants.ability.BER.name': 'Fio de cabaré',
  'variants.ability.BER.why': 'A tradição do cabaré berlinense e o humor seco',
  'variants.ability.MEX.name': 'Arte do corrido',
  'variants.ability.MEX.why': 'A tradição poética mexicana',
  'variants.ability.CAI.name': 'Sabedoria do escriba',
  'variants.ability.CAI.why': 'Uma tradição literária milenar',
  'variants.ability.ACC.name': 'Humor highlife',
  'variants.ability.ACC.why': 'O highlife ganês e uma sagacidade afiada',
  'variants.ability.JHB.name': 'Barras de Jozi',
  'variants.ability.JHB.why': 'A intensidade da cena de rap de Joanesburgo',
  'variants.ability.MNL.name': 'Flow FlipTop',
  'variants.ability.MNL.why': 'A cultura filipina das batalhas de rap',
  'variants.ability.IST.name': 'Estrofe da encruzilhada',
  'variants.ability.IST.why': 'Onde Oriente e Ocidente se encontram na poesia',
  'variants.ability.TOR.name': 'Flow do Six',
  'variants.ability.TOR.why': 'A dinastia do hip-hop de Toronto',
  'variants.ability.SYD.name': 'Gingado do porto',
  'variants.ability.SYD.why': 'O humor irreverente da Austrália',
  'variants.ability.OSA.name': 'Comédia de Kansai',
  'variants.ability.OSA.why': 'A tradição de comédia e trocadilhos de Osaka',
  'variants.ability.KGN.name': 'Ritmo dancehall',
  'variants.ability.KGN.why': 'O dancehall jamaicano e a poesia dub',
  'variants.city.TKY': 'Tóquio', // CLDR 46.0.0 exemplarCity
  'variants.city.LGS': 'Lagos', // Wikidata Q8673 label (pt)
  'variants.city.BKN': 'Brooklyn', // Wikidata Q18419 label (pt-br)
  'variants.city.LDN': 'Londres', // CLDR 46.0.0 exemplarCity
  'variants.city.MUM': 'Bombaim', // Wikidata Q1156 label (pt-br)
  'variants.city.PAR': 'Paris', // Wikidata Q90 label (pt-br)
  'variants.city.SAO': 'São Paulo', // CLDR 46.0.0 exemplarCity
  'variants.city.SEO': 'Seul', // CLDR 46.0.0 exemplarCity
  'variants.city.NRB': 'Nairóbi', // CLDR 46.0.0 exemplarCity
  'variants.city.BER': 'Berlim', // CLDR 46.0.0 exemplarCity
  'variants.city.MEX': 'Cidade do México', // CLDR 46.0.0 exemplarCity
  'variants.city.CAI': 'Cairo', // Wikidata Q85 label (pt-br)
  'variants.city.ACC': 'Acra', // CLDR 46.0.0 exemplarCity
  'variants.city.JHB': 'Joanesburgo', // CLDR 46.0.0 exemplarCity
  'variants.city.MNL': 'Manila', // Wikidata Q1461 label (pt-br)
  'variants.city.IST': 'Istambul', // CLDR 46.0.0 exemplarCity
  'variants.city.TOR': 'Toronto', // Wikidata Q172 label (pt-br)
  'variants.city.SYD': 'Sydney', // Wikidata Q3130 label (pt-br)
  'variants.city.OSA': 'Osaka', // Wikidata Q35765 label (pt-br)
  'variants.city.KGN': 'Kingston', // Wikidata Q34692 label (pt-br)
  'variants.region.eurasia': 'Eurásia', // Wikidata Q5401 label (pt-br)
  'variants.region.142': 'Ásia', // CLDR 46.0.0 territory 142
  'variants.region.150': 'Europa', // CLDR 46.0.0 territory 150
  'variants.region.009': 'Oceania', // CLDR 46.0.0 territory 009
  'variants.region.029': 'Caribe', // CLDR 46.0.0 territory 029
  'variants.region.003': 'América do Norte', // CLDR 46.0.0 territory 003
  'variants.region.013': 'América Central', // CLDR 46.0.0 territory 013
  'variants.region.005': 'América do Sul', // CLDR 46.0.0 territory 005
  'variants.region.011': 'África Ocidental', // CLDR 46.0.0 territory 011
  'variants.region.014': 'África Oriental', // CLDR 46.0.0 territory 014
  'variants.region.015': 'África Setentrional', // CLDR 46.0.0 territory 015
  'variants.region.018': 'África Meridional', // CLDR 46.0.0 territory 018
  'variants.region.030': 'Ásia Oriental', // CLDR 46.0.0 territory 030
  'variants.region.034': 'Ásia Meridional', // CLDR 46.0.0 territory 034
  'variants.region.035': 'Sudeste Asiático', // CLDR 46.0.0 territory 035
};

export default messages;
