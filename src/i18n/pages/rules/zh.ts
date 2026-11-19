/**
 * What cards do and what a deck may hold (src/lib/battle-rules.ts): Chinese (Simplified).
 *
 * Same keys, {placeholders} and <b>/<a> marks as ./en.ts (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'rules.landIt': '做到它，技艺再加一半。',
  'rules.relic': '借给你力量之词：{words}。用上其中 {n} 个，技艺 +{bonus}。',
  'rules.potion': '用{name}诅咒对手的下一首诗：{rule}',
  'rules.potion.letter': '用{name}诅咒对手的下一首诗：对方的诗里不能出现某一个字母，具体是哪个字母，由药水在对决发牌时指定。',
  'rules.cost': '墨水消耗：{n}。',
  'rules.synergy': '{house}，两个或更多角色：{device}为你的技艺加四分之三，而不是一半。',
  'rules.deck.minCharacters': '牌组中的角色：至少 {n}。',
  'rules.deck.maxCharacters': '牌组中的角色：最多 {n}。',
  'rules.deck.maxRelics': '牌组中的圣物：最多 {n}。',
  'rules.deck.maxPotions': '牌组中的药水：最多 {n}。',
  'rules.deck.totalMax': '牌组中的卡牌：最多 {n}。',
  'rules.deck.unknownCard': '未知卡牌：{id}',
  'rules.deck.notCharacter': '{card} 不是角色。',
  'rules.deck.notRelic': '{card} 不是圣物。',
  'rules.deck.notPotion': '{card} 不是药水。',
};

export default messages;
