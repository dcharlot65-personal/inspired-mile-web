/**
 * The collection page, its deck builder and card detail view: Chinese (Simplified).
 *
 * Same keys, {placeholders} and <b>/<a> marks as ./en.ts (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'collection.meta.title': '我的收藏',
  'collection.meta.description': '浏览你的 Inspired Mile 卡牌收藏：来自莎士比亚最伟大作品的角色、圣物和药水。',
  'collection.title': '我的<b>收藏</b>',
  'collection.intro': '你的莎士比亚卡牌收藏。未解锁的卡牌可以在<a>游乐场</a>赢得。',
  'collection.owned': '已拥有卡牌：<b>{owned}</b> / {total}',
  'collection.filter.all': '全部',
  'collection.filter.owned': '已拥有',
  'collection.locked': '未解锁',
  'collection.world.title': '世界卡',
  'collection.world.intro': '你的角色周游世界。在问答中全部答对，就能解锁城市变体。',
  'collection.world.empty': '还没有变体。在问答中全部答对，就能解锁你的第一张世界卡！',
  'collection.deck.title': '组建牌组',
  'collection.deck.intro': '角色：{min} 至 {max}。圣物：最多 {relics}。药水：最多 {potions}。卡牌总数：最多 {total}。点击上方你拥有的卡牌即可加入。',
  'collection.deck.namePlaceholder': '牌组名称…',
  'collection.deck.save': '保存牌组',
  'collection.deck.clear': '清空',
  'collection.deck.addCharacters': '点击你拥有的角色即可加入',
  'collection.deck.addRelics': '点击你拥有的圣物即可加入',
  'collection.deck.addPotions': '点击你拥有的药水即可加入',
  'collection.deck.synergies': '生效的协同',
  'collection.deck.saved': '已保存的牌组',
  'collection.deck.none': '还没有保存的牌组。',
  'collection.deck.summary': '角色：{characters} · 圣物：{relics} · 药水：{potions} · 合计：{total}',
  'collection.deck.active': '使用中',
  'collection.deck.activate': '启用',
  'collection.deck.edit': '编辑',
  'collection.deck.delete': '删除牌组 {name}',
  'collection.deck.errorName': '请输入牌组名称',
  'collection.deck.notOwned': '你还没有这些卡牌：{cards}',
  'collection.modal.passive': '被动：{name}',
  'collection.modal.uses': '每场对战可用次数：{n}',
  'collection.modal.ar': '用增强现实查看',
  'collection.modal.add': '加入牌组',
  'collection.modal.close': '关闭',
  'collection.achievements.title': '成就',
  'collection.achievements.count': '已解锁：<b>{n}</b> / {total}',
};

export default messages;
