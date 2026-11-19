/**
 * What cards do and what a deck may hold (src/lib/battle-rules.ts): Indonesian.
 *
 * Same keys, {placeholders} and <b>/<a> marks as ./en.ts (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'rules.landIt': 'Wujudkan untuk menambah keahlianmu setengahnya lagi.',
  'rules.relic': 'Meminjamkan kata sakti: {words}. Pakai {n} di antaranya untuk mendapat +{bonus} keahlian.',
  'rules.potion': 'Mengutuk syair lawanmu berikutnya dengan {name}: {rule}',
  'rules.potion.letter': 'Mengutuk syair lawanmu berikutnya dengan {name}: syair mereka tidak boleh memuat satu huruf, yang disebutkan ramuan saat duel dibagikan.',
  'rules.cost': 'Biaya tinta: {n}.',
  'rules.synergy': '{house}, dua tokoh atau lebih: {device} menambah tiga perempat keahlianmu, bukan setengah.',
  'rules.deck.minCharacters': 'Tokoh dalam dek: paling sedikit {n}.',
  'rules.deck.maxCharacters': 'Tokoh dalam dek: paling banyak {n}.',
  'rules.deck.maxRelics': 'Relik dalam dek: paling banyak {n}.',
  'rules.deck.maxPotions': 'Ramuan dalam dek: paling banyak {n}.',
  'rules.deck.totalMax': 'Kartu dalam dek: paling banyak {n}.',
  'rules.deck.unknownCard': 'Kartu tidak dikenal: {id}',
  'rules.deck.notCharacter': '{card} bukan tokoh.',
  'rules.deck.notRelic': '{card} bukan relik.',
  'rules.deck.notPotion': '{card} bukan ramuan.',
};

export default messages;
