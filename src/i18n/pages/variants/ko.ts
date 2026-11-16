/**
 * World cards: cities, their abilities, where a variant came from (src/lib/variants.ts): Korean.
 *
 * Same keys, {placeholders} and <b>/<a> marks as ./en.ts (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'variants.unlocked': '열린 변형: <b>{n}</b>',
  'variants.count': '변형: {n}',
  'variants.source.city-quest': '도시 퀘스트',
  'variants.source.battle-streak': '연승',
  'variants.source.trivia-mastery': '퀴즈 정복',
  'variants.source.daily-travel': '매일 여행',
  'variants.source.event': '이벤트',
  'variants.ability.TKY.name': '네온의 정밀함',
  'variants.ability.TKY.why': '정밀함을 중시하는 도쿄의 문화',
  'variants.ability.LGS.name': '아프로비트 흐름',
  'variants.ability.LGS.why': '라고스 아프로비츠의 리듬',
  'variants.ability.BKN.name': '동네 대장',
  'variants.ability.BKN.why': '뉴욕의 디스 문화, 랩 배틀의 고향',
  'variants.ability.LDN.name': '시인의 안방',
  'variants.ability.LDN.why': '셰익스피어의 고향',
  'variants.ability.MUM.name': '볼리우드 리듬',
  'variants.ability.MUM.why': '뭄바이의 시 전통',
  'variants.ability.PAR.name': '오트 쿠튀르 시',
  'variants.ability.PAR.why': '프랑스의 문학 전통',
  'variants.ability.SAO.name': '파벨라의 불꽃',
  'variants.ability.SAO.why': '브라질의 유머와 즉흥',
  'variants.ability.SEO.name': '한류 가락',
  'variants.ability.SEO.why': 'K팝의 정밀함과 서울의 랩 신',
  'variants.ability.NRB.name': '이야기꾼의 재능',
  'variants.ability.NRB.why': '동아프리카의 구전 이야기 전통',
  'variants.ability.BER.name': '카바레의 날',
  'variants.ability.BER.why': '베를린의 카바레 전통과 건조한 유머',
  'variants.ability.MEX.name': '코리도의 솜씨',
  'variants.ability.MEX.why': '멕시코의 시 전통',
  'variants.ability.CAI.name': '서기의 지혜',
  'variants.ability.CAI.why': '오래된 문학 전통',
  'variants.ability.ACC.name': '하이라이프 유머',
  'variants.ability.ACC.why': '가나의 하이라이프와 날카로운 재치',
  'variants.ability.JHB.name': '조지의 랩 가사',
  'variants.ability.JHB.why': '요하네스버그 랩 신의 열기',
  'variants.ability.MNL.name': 'FlipTop 흐름',
  'variants.ability.MNL.why': '필리핀의 랩 배틀 문화',
  'variants.ability.IST.name': '갈림길의 시',
  'variants.ability.IST.why': '시 안에서 동양과 서양이 만나는 곳',
  'variants.ability.TOR.name': '더 식스의 흐름',
  'variants.ability.TOR.why': '토론토의 힙합 왕조',
  'variants.ability.SYD.name': '항구의 기세',
  'variants.ability.SYD.why': '격식을 따지지 않는 호주의 유머',
  'variants.ability.OSA.name': '간사이 코미디',
  'variants.ability.OSA.why': '오사카의 코미디와 말재간 전통',
  'variants.ability.KGN.name': '댄스홀 리듬',
  'variants.ability.KGN.why': '자메이카의 댄스홀과 더브 시',
  'variants.city.TKY': '도쿄', // CLDR 46.0.0 exemplarCity
  'variants.city.LGS': '라고스', // CLDR 46.0.0 exemplarCity
  'variants.city.BKN': '브루클린', // Wikidata Q18419 label
  'variants.city.LDN': '런던', // CLDR 46.0.0 exemplarCity
  'variants.city.MUM': '뭄바이', // Wikidata Q1156 label
  'variants.city.PAR': '파리', // CLDR 46.0.0 exemplarCity
  'variants.city.SAO': '상파울루', // CLDR 46.0.0 exemplarCity
  'variants.city.SEO': '서울', // CLDR 46.0.0 exemplarCity
  'variants.city.NRB': '나이로비', // CLDR 46.0.0 exemplarCity
  'variants.city.BER': '베를린', // CLDR 46.0.0 exemplarCity
  'variants.city.MEX': '멕시코 시티', // CLDR 46.0.0 exemplarCity
  'variants.city.CAI': '카이로', // CLDR 46.0.0 exemplarCity
  'variants.city.ACC': '아크라', // CLDR 46.0.0 exemplarCity
  'variants.city.JHB': '요하네스버그', // CLDR 46.0.0 exemplarCity
  'variants.city.MNL': '마닐라', // CLDR 46.0.0 exemplarCity
  'variants.city.IST': '이스탄불', // CLDR 46.0.0 exemplarCity
  'variants.city.TOR': '토론토', // CLDR 46.0.0 exemplarCity
  'variants.city.SYD': '시드니', // CLDR 46.0.0 exemplarCity
  'variants.city.OSA': '오사카시', // Wikidata Q35765 label
  'variants.city.KGN': '킹스턴', // Wikidata Q34692 label
  'variants.region.eurasia': '유라시아', // Wikidata Q5401 label
};

export default messages;
