/**
 * The collection page, its deck builder and card detail view: Indonesian.
 *
 * Same keys, {placeholders} and <b>/<a> marks as ./en.ts (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'collection.meta.title': 'Koleksiku',
  'collection.meta.description': 'Jelajahi koleksi kartu Inspired Mile milikmu: tokoh, relik, dan ramuan dari karya-karya terbesar Shakespeare.',
  'collection.title': '<b>Koleksiku</b>',
  'collection.intro': 'Koleksi kartu Shakespeare milikmu. Kartu yang terkunci bisa diraih di <a>Arena bermain</a>.',
  'collection.owned': 'Kartu yang kamu miliki: <b>{owned}</b> / {total}',
  'collection.filter.all': 'Semua',
  'collection.filter.owned': 'Dimiliki',
  'collection.locked': 'Terkunci',
  'collection.world.title': 'Kartu dunia',
  'collection.world.intro': 'Tokoh-tokohmu menjelajahi dunia. Menangkan pertarungan dan jawab semua kuis dengan benar untuk membuka varian kota.',
  'collection.world.empty': 'Belum ada varian. Menangkan tiga pertarungan berturut-turut atau raih nilai sempurna di kuis untuk membuka kartu dunia pertamamu!',
  'collection.deck.title': 'Penyusun dek',
  'collection.deck.intro': 'Tokoh: {min} sampai {max}. Relik: paling banyak {relics}. Ramuan: paling banyak {potions}. Jumlah kartu: paling banyak {total}. Klik kartu yang kamu miliki di atas untuk menambahkannya.',
  'collection.deck.namePlaceholder': 'Nama dek…',
  'collection.deck.save': 'Simpan dek',
  'collection.deck.clear': 'Kosongkan',
  'collection.deck.addCharacters': 'Klik tokoh yang kamu miliki untuk menambahkannya',
  'collection.deck.addRelics': 'Klik relik yang kamu miliki untuk menambahkannya',
  'collection.deck.addPotions': 'Klik ramuan yang kamu miliki untuk menambahkannya',
  'collection.deck.synergies': 'Sinergi aktif',
  'collection.deck.saved': 'Dek tersimpan',
  'collection.deck.none': 'Belum ada dek yang tersimpan.',
  'collection.deck.summary': 'Tokoh: {characters} · Relik: {relics} · Ramuan: {potions} · Jumlah: {total}',
  'collection.deck.active': 'Aktif',
  'collection.deck.activate': 'Aktifkan',
  'collection.deck.edit': 'Ubah',
  'collection.deck.delete': 'Hapus dek {name}',
  'collection.deck.errorName': 'Tulis nama dek',
  'collection.deck.notOwned': 'Kamu belum memiliki: {cards}',
  'collection.modal.passive': 'Pasif: {name}',
  'collection.modal.uses': 'Pemakaian per pertarungan: {n}',
  'collection.modal.ar': 'Lihat dalam AR',
  'collection.modal.add': 'Tambahkan ke dek',
  'collection.modal.close': 'Tutup',
  'collection.achievements.title': 'Pencapaian',
  'collection.achievements.count': 'Terbuka: <b>{n}</b> / {total}',
};

export default messages;
