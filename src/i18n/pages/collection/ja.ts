/**
 * The collection page, its deck builder and card detail view: Japanese.
 *
 * Same keys, {placeholders} and <b>/<a> marks as ./en.ts (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'collection.meta.title': 'マイコレクション',
  'collection.meta.description': 'Inspired Mileのカードコレクションを見てみましょう。シェイクスピアの名作から生まれた登場人物、遺物、薬がそろっています。',
  'collection.title': 'マイ<b>コレクション</b>',
  'collection.intro': 'あなたのシェイクスピアカードのコレクションです。ロックされたカードは<a>プレイグラウンド</a>で手に入ります。',
  'collection.owned': '持っているカード：<b>{owned}</b> / {total}',
  'collection.filter.all': 'すべて',
  'collection.filter.owned': '所持',
  'collection.locked': 'ロック中',
  'collection.world.title': 'ワールドカード',
  'collection.world.intro': 'あなたの登場人物たちが世界を旅します。クイズに全問正解して、都市のバリエーションを解除しましょう。',
  'collection.world.empty': 'バリエーションはまだありません。クイズに全問正解すると、最初のワールドカードを解除できます！',
  'collection.deck.title': 'デッキ構築',
  'collection.deck.intro': '登場人物：{min}〜{max}。遺物：{relics}まで。薬：{potions}まで。カードの合計：{total}まで。上の一覧で持っているカードをクリックすると追加できます。',
  'collection.deck.namePlaceholder': 'デッキ名…',
  'collection.deck.save': 'デッキを保存',
  'collection.deck.clear': 'クリア',
  'collection.deck.addCharacters': '持っている登場人物をクリックして追加',
  'collection.deck.addRelics': '持っている遺物をクリックして追加',
  'collection.deck.addPotions': '持っている薬をクリックして追加',
  'collection.deck.synergies': '発動中のシナジー',
  'collection.deck.saved': '保存したデッキ',
  'collection.deck.none': '保存したデッキはまだありません。',
  'collection.deck.summary': '登場人物：{characters} · 遺物：{relics} · 薬：{potions} · 合計：{total}',
  'collection.deck.active': '使用中',
  'collection.deck.activate': '使用する',
  'collection.deck.edit': '編集',
  'collection.deck.delete': 'デッキ「{name}」を削除',
  'collection.deck.errorName': 'デッキ名を入力してください',
  'collection.deck.notOwned': '持っていないカード：{cards}',
  'collection.modal.passive': 'パッシブ：{name}',
  'collection.modal.uses': '1バトルあたりの使用回数：{n}',
  'collection.modal.ar': 'ARで見る',
  'collection.modal.add': 'デッキに追加',
  'collection.modal.close': '閉じる',
  'collection.achievements.title': '実績',
  'collection.achievements.count': '解除済み：<b>{n}</b> / {total}',
};

export default messages;
