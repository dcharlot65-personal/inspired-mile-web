/**
 * World cards: cities, their abilities, where a variant came from (src/lib/variants.ts): Japanese.
 *
 * Same keys, {placeholders} and <b>/<a> marks as ./en.ts (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'variants.unlocked': '解除したバリエーション：<b>{n}</b>',
  'variants.count': 'バリエーション：{n}',
  'variants.source.city-quest': '都市クエスト',
  'variants.source.battle-streak': '連勝',
  'variants.source.trivia-mastery': 'クイズの達人',
  'variants.source.daily-travel': '毎日の旅',
  'variants.source.event': 'イベント',
  'variants.ability.TKY.name': 'ネオンの精密さ',
  'variants.ability.TKY.why': '東京の精密さを尊ぶ文化',
  'variants.ability.LGS.name': 'アフロビートの流れ',
  'variants.ability.LGS.why': 'ラゴスのアフロビーツのリズム',
  'variants.ability.BKN.name': '街区のボス',
  'variants.ability.BKN.why': 'ニューヨークの毒舌文化、ラップバトル発祥の地',
  'variants.ability.LDN.name': '詩人の本拠地',
  'variants.ability.LDN.why': 'シェイクスピアの故郷',
  'variants.ability.MUM.name': 'ボリウッドのリズム',
  'variants.ability.MUM.why': 'ムンバイの詩の伝統',
  'variants.ability.PAR.name': 'オートクチュールの詩',
  'variants.ability.PAR.why': 'フランス文学の伝統',
  'variants.ability.SAO.name': 'ファヴェーラの炎',
  'variants.ability.SAO.why': 'ブラジルのユーモアと即興',
  'variants.ability.SEO.name': '韓流のカデンツ',
  'variants.ability.SEO.why': 'K-POPの精密さとソウルのラップシーン',
  'variants.ability.NRB.name': '語り部の才',
  'variants.ability.NRB.why': '東アフリカの口承の語りの伝統',
  'variants.ability.BER.name': 'カバレットの切れ味',
  'variants.ability.BER.why': 'ベルリンのカバレットの伝統と乾いたユーモア',
  'variants.ability.MEX.name': 'コリードの技',
  'variants.ability.MEX.why': 'メキシコの詩の伝統',
  'variants.ability.CAI.name': '書記の知恵',
  'variants.ability.CAI.why': '古代から続く文学の伝統',
  'variants.ability.ACC.name': 'ハイライフのユーモア',
  'variants.ability.ACC.why': 'ガーナのハイライフと鋭い機知',
  'variants.ability.JHB.name': 'ジョジのバース',
  'variants.ability.JHB.why': 'ヨハネスブルグのラップシーンの熱量',
  'variants.ability.MNL.name': 'FlipTopの流れ',
  'variants.ability.MNL.why': 'フィリピンのラップバトル文化',
  'variants.ability.IST.name': '十字路の詩',
  'variants.ability.IST.why': '詩のなかで東と西が出会う場所',
  'variants.ability.TOR.name': 'ザ・シックスの流れ',
  'variants.ability.TOR.why': 'トロントのヒップホップの系譜',
  'variants.ability.SYD.name': '港の勢い',
  'variants.ability.SYD.why': 'オーストラリアの遠慮のないユーモア',
  'variants.ability.OSA.name': '関西のお笑い',
  'variants.ability.OSA.why': '大阪のお笑いと言葉遊びの伝統',
  'variants.ability.KGN.name': 'ダンスホールのリズム',
  'variants.ability.KGN.why': 'ジャマイカのダンスホールとダブ・ポエトリー',
  'variants.city.TKY': '東京', // CLDR 46.0.0 exemplarCity
  'variants.city.LGS': 'ラゴス', // CLDR 46.0.0 exemplarCity
  'variants.city.BKN': 'ブルックリン区', // Wikidata Q18419 label
  'variants.city.LDN': 'ロンドン', // CLDR 46.0.0 exemplarCity
  'variants.city.MUM': 'ムンバイ', // Wikidata Q1156 label
  'variants.city.PAR': 'パリ', // CLDR 46.0.0 exemplarCity
  'variants.city.SAO': 'サンパウロ', // CLDR 46.0.0 exemplarCity
  'variants.city.SEO': 'ソウル', // CLDR 46.0.0 exemplarCity
  'variants.city.NRB': 'ナイロビ', // CLDR 46.0.0 exemplarCity
  'variants.city.BER': 'ベルリン', // CLDR 46.0.0 exemplarCity
  'variants.city.MEX': 'メキシコシティー', // CLDR 46.0.0 exemplarCity
  'variants.city.CAI': 'カイロ', // CLDR 46.0.0 exemplarCity
  'variants.city.ACC': 'アクラ', // CLDR 46.0.0 exemplarCity
  'variants.city.JHB': 'ヨハネスブルグ', // CLDR 46.0.0 exemplarCity
  'variants.city.MNL': 'マニラ', // CLDR 46.0.0 exemplarCity
  'variants.city.IST': 'イスタンブール', // CLDR 46.0.0 exemplarCity
  'variants.city.TOR': 'トロント', // CLDR 46.0.0 exemplarCity
  'variants.city.SYD': 'シドニー', // CLDR 46.0.0 exemplarCity
  'variants.city.OSA': '大阪市', // Wikidata Q35765 label
  'variants.city.KGN': 'キングストン', // Wikidata Q34692 label
  'variants.region.eurasia': 'ユーラシア', // Wikidata Q5401 label
};

export default messages;
