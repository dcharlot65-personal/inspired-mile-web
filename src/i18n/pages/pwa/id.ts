// Bahasa Indonesia. Tombol Apple (Bagikan, “Tambah ke Layar Utama”) dan Android (Instal, Lain kali) memakai kata mereka sendiri. Kamu.
// Page area "pwa": the install guidance and the note on stored downloads (src/lib/pwa.ts), on every page.
// Where each term comes from and how these strings were checked: docs/language/pages-rest.md
const messages: Record<string, string> = {
  'pwa.install.regionLabel': 'Instal Sonnet Man',
  'pwa.install.title': 'Instal Sonnet Man dulu',
  'pwa.install.promptBody': 'Aplikasinya terbuka di layar penuh, dan di aplikasi yang terinstal, model yang sudah diunduh jauh lebih kecil kemungkinannya dihapus peramban.',
  'pwa.install.iosBody': 'Di iPhone dan iPad, aplikasi di Layar Utama tidak berbagi apa pun dengan tab ini. Tambahkan sebelum kamu masuk atau mengunduh model, atau kamu harus melakukan keduanya dua kali.',
  'pwa.install.iosStep1': 'Ketuk tombol Bagikan.',
  'pwa.install.iosStep2': 'Pilih “Tambah ke Layar Utama”.',
  'pwa.install.accept': 'Instal',
  'pwa.install.dismiss': 'Lain kali',
  'pwa.storage.kept': 'Tetap tersimpan di perangkat ini: {size}. Perambanmu tidak akan menghapusnya sendiri.',
  'pwa.storage.keptNoSize': 'Unduhanmu tetap tersimpan di perangkat ini. Perambanmu tidak akan menghapusnya sendiri.',
  'pwa.storage.atRisk': 'Disimpan di perangkat ini: {size}, tetapi perambanmu bisa menghapusnya jika ruang perangkat menipis atau kamu lama tidak kembali.',
  'pwa.storage.atRiskNoSize': 'Unduhanmu disimpan, tetapi perambanmu bisa menghapusnya jika ruang perangkat menipis atau kamu lama tidak kembali.',
  'pwa.storage.installHint': 'Menginstal aplikasi membantu menyimpannya.',
  'pwa.storage.lessThan': 'kurang dari {size}',
};

export default messages;
