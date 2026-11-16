/**
 * World cards: cities, their abilities, where a variant came from (src/lib/variants.ts): Vietnamese.
 *
 * Same keys, {placeholders} and <b>/<a> marks as ./en.ts (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'variants.unlocked': 'Biến thể đã mở khoá: <b>{n}</b>',
  'variants.count': 'Biến thể: {n}',
  'variants.cities': 'Thành phố đã khám phá: <b>{n}</b> / {total}',
  'variants.source.city-quest': 'Nhiệm vụ thành phố',
  'variants.source.battle-streak': 'Chuỗi thắng',
  'variants.source.trivia-mastery': 'Tinh thông đố vui',
  'variants.source.daily-travel': 'Chuyến đi hằng ngày',
  'variants.source.event': 'Sự kiện',
  'variants.ability.TKY.name': 'Chính xác kiểu neon',
  'variants.ability.TKY.why': 'Văn hoá chuộng sự chính xác của Tokyo',
  'variants.ability.LGS.name': 'Nhịp điệu Afrobeat',
  'variants.ability.LGS.why': 'Tiết tấu Afrobeats của Lagos',
  'variants.ability.BKN.name': 'Trùm khu phố',
  'variants.ability.BKN.why': 'Văn hoá cà khịa của New York, cái nôi của đấu rap',
  'variants.ability.LDN.name': 'Sân nhà của Thi sĩ',
  'variants.ability.LDN.why': 'Quê hương của Shakespeare',
  'variants.ability.MUM.name': 'Tiết tấu Bollywood',
  'variants.ability.MUM.why': 'Các truyền thống thi ca của Mumbai',
  'variants.ability.PAR.name': 'Thơ thượng hạng',
  'variants.ability.PAR.why': 'Truyền thống văn học Pháp',
  'variants.ability.SAO.name': 'Lửa favela',
  'variants.ability.SAO.why': 'Sự hài hước và ứng tác của Brazil',
  'variants.ability.SEO.name': 'Nhịp làn sóng Hàn',
  'variants.ability.SEO.why': 'Sự chính xác của K-pop và giới rap Seoul',
  'variants.ability.NRB.name': 'Tài kể chuyện',
  'variants.ability.NRB.why': 'Truyền thống kể chuyện truyền miệng của Đông Phi',
  'variants.ability.BER.name': 'Nét sắc cabaret',
  'variants.ability.BER.why': 'Truyền thống cabaret của Berlin và lối hài hước tỉnh khô',
  'variants.ability.MEX.name': 'Nghề corrido',
  'variants.ability.MEX.why': 'Truyền thống thi ca Mexico',
  'variants.ability.CAI.name': 'Trí tuệ của người chép sách',
  'variants.ability.CAI.why': 'Một truyền thống văn học cổ xưa',
  'variants.ability.ACC.name': 'Hài hước highlife',
  'variants.ability.ACC.why': 'Nhạc highlife của Ghana và sự sắc sảo',
  'variants.ability.JHB.name': 'Câu rap Jozi',
  'variants.ability.JHB.why': 'Sức nóng của giới rap Johannesburg',
  'variants.ability.MNL.name': 'Nhịp điệu FlipTop',
  'variants.ability.MNL.why': 'Văn hoá đấu rap của Philippines',
  'variants.ability.IST.name': 'Thơ nơi ngã tư',
  'variants.ability.IST.why': 'Nơi Đông và Tây gặp nhau trong thơ',
  'variants.ability.TOR.name': 'Nhịp điệu The Six',
  'variants.ability.TOR.why': 'Triều đại hip hop của Toronto',
  'variants.ability.SYD.name': 'Khí thế bến cảng',
  'variants.ability.SYD.why': 'Lối hài hước bất cần của nước Úc',
  'variants.ability.OSA.name': 'Hài kịch Kansai',
  'variants.ability.OSA.why': 'Truyền thống hài kịch và chơi chữ của Ōsaka',
  'variants.ability.KGN.name': 'Tiết tấu dancehall',
  'variants.ability.KGN.why': 'Dancehall Jamaica và thơ dub',
  'variants.city.TKY': 'Tokyo', // Wikidata Q1490 label
  'variants.city.LGS': 'Lagos', // Wikidata Q8673 label
  'variants.city.BKN': 'Brooklyn', // Wikidata Q18419 label
  'variants.city.LDN': 'Luân Đôn', // Wikidata Q84 label
  'variants.city.MUM': 'Mumbai', // Wikidata Q1156 label
  'variants.city.PAR': 'Paris', // Wikidata Q90 label
  'variants.city.SAO': 'São Paulo', // Wikidata Q174 label
  'variants.city.SEO': 'Seoul', // Wikidata Q8684 label
  'variants.city.NRB': 'Nairobi', // Wikidata Q3870 label
  'variants.city.BER': 'Berlin', // Wikidata Q64 label
  'variants.city.MEX': 'Thành phố México', // Wikidata Q1489 label
  'variants.city.CAI': 'Cairo', // Wikidata Q85 label
  'variants.city.ACC': 'Accra', // Wikidata Q3761 label
  'variants.city.JHB': 'Johannesburg', // Wikidata Q34647 label
  'variants.city.MNL': 'Manila', // Wikidata Q1461 label
  'variants.city.IST': 'Istanbul', // Wikidata Q406 label
  'variants.city.TOR': 'Toronto', // Wikidata Q172 label
  'variants.city.SYD': 'Sydney', // Wikidata Q3130 label
  'variants.city.OSA': 'Ōsaka', // Wikidata Q35765 label
  'variants.city.KGN': 'Kingston', // Wikidata Q34692 label
  'variants.region.eurasia': 'Lục địa Á-Âu', // Wikidata Q5401 label
  'variants.region.142': 'Châu Á', // CLDR 46.0.0 territory 142
  'variants.region.150': 'Châu Âu', // CLDR 46.0.0 territory 150
  'variants.region.009': 'Châu Đại Dương', // CLDR 46.0.0 territory 009
  'variants.region.029': 'Ca-ri-bê', // CLDR 46.0.0 territory 029
  'variants.region.003': 'Bắc Mỹ', // CLDR 46.0.0 territory 003
  'variants.region.013': 'Trung Mỹ', // CLDR 46.0.0 territory 013
  'variants.region.005': 'Nam Mỹ', // CLDR 46.0.0 territory 005
  'variants.region.011': 'Tây Phi', // CLDR 46.0.0 territory 011
  'variants.region.014': 'Đông Phi', // CLDR 46.0.0 territory 014
  'variants.region.015': 'Bắc Phi', // CLDR 46.0.0 territory 015
  'variants.region.018': 'Miền Nam Châu Phi', // CLDR 46.0.0 territory 018
  'variants.region.030': 'Đông Á', // CLDR 46.0.0 territory 030
  'variants.region.034': 'Nam Á', // CLDR 46.0.0 territory 034
  'variants.region.035': 'Đông Nam Á', // CLDR 46.0.0 territory 035
};

export default messages;
