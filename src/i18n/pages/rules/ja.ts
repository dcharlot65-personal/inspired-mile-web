/**
 * What cards do and what a deck may hold (src/lib/battle-rules.ts): Japanese.
 *
 * Same keys, {placeholders} and <b>/<a> marks as ./en.ts (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'rules.landIt': '決めると、技巧にその半分が加わります。',
  'rules.relic': '力の言葉を貸してくれます：{words}。このうち{n}つを使うと技巧 +{bonus}。',
  'rules.potion': '相手の次の詩に「{name}」の呪いをかけます：{rule}',
  'rules.potion.letter': '相手の次の詩に「{name}」の呪いをかけます：相手の詩には、ある一文字を使えません。どの文字かは、決闘が配られるときに薬が示します。',
  'rules.cost': 'インクの消費：{n}。',
  'rules.synergy': '{house}の登場人物が二人以上：{device}で加わる技巧が、半分ではなく四分の三になります。',
  'rules.deck.minCharacters': 'デッキの登場人物：{n}以上。',
  'rules.deck.maxCharacters': 'デッキの登場人物：{n}まで。',
  'rules.deck.maxRelics': 'デッキの遺物：{n}まで。',
  'rules.deck.maxPotions': 'デッキの薬：{n}まで。',
  'rules.deck.totalMax': 'デッキのカード：{n}まで。',
  'rules.deck.unknownCard': '不明なカード：{id}',
  'rules.deck.notCharacter': '{card}は登場人物ではありません。',
  'rules.deck.notRelic': '{card}は遺物ではありません。',
  'rules.deck.notPotion': '{card}は薬ではありません。',
};

export default messages;
