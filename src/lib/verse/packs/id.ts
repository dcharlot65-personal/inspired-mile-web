import type { LanguagePack } from './index';

// Indonesian. End rhyme as pantun uses it.
const pack: LanguagePack = {
  lang: 'id',
  acrostic: ['raja', 'kata', 'api', 'bulan', 'laut', 'nasib'],
  forbidden: ['n', 'r', 't', 'k', 's', 'i'],
  relics: {
    'RL-001': ['tengkorak', 'lelucon', 'kubur', 'tawa', 'debu'],
    'RL-002': ['badai', 'mantra', 'tongkat', 'pulau', 'tenggelam'],
    'RL-003': ['belati', 'darah', 'tidur', 'bayangan', 'tangan'],
    'RL-004': ['cincin', 'sumpah', 'malam', 'terbuang', 'ciuman'],
    'RL-005': ['emas', 'pilihan', 'ampun', 'timah', 'peti'],
    'RL-006': ['mahkota', 'takhta', 'ambisi', 'penyihir', 'raja'],
    'RL-007': ['kitab', 'badai', 'sihir', 'halaman', 'tenggelam'],
    'RL-008': ['air mata', 'kebenaran', 'putri', 'hampa', 'hati'],
    'RL-009': ['topeng', 'mimpi', 'badut', 'sandiwara', 'bulan'],
  },
  written: {
    couplet: [
      'Syairmu hanya lilin di tengah malam\nSyairku matahari, dan kau tenggelam',
      'Naiklah, pemain malang, berlagaklah sejenak\nLalu lihat syairmu layu tak berjejak',
    ],
    'quatrain-aabb': [
      'Kau datang bersenjata akal pinjaman\nLalu heran pukulanmu tak jadi ancaman\nSudah kulihat raja dan badut di panggung ini\nKau hanya catatan kaki yang tak berarti',
      'Penonton datang ingin melihat pertarungan\nTapi baitmu hanya sisa hidangan\nBicaralah lagi, lebih lantang, kalau berani\nAku menjawab badai; kau cuma angin sepi',
    ],
    'quatrain-abab': [
      'Aku menapak panggung ini sebelum kau merangkak\nSyairku hukum, syairmu sekadar bising\nKini dengar tirai turun dan lilin retak\nPanggung butuh petarung, bukan anak yang pusing',
      'Baitmu masuk terpincang dengan satu kaki\nMengemis belas kasihan dari penonton\nAku tak menendang orang yang sudah mati\nKubiarkan saja ia duduk menonton',
    ],
    tercet: [
      'Kau punya lidah, kuakui, tapi bukan seni\nIa berkeliaran seperti pemabuk di gelap\nDan tak pernah sampai ke satu pun hati',
      'Itu kau sebut syair? Kusebut kekeliruan\nSebaris pincang yang memohon diakhiri\nDan aku cukup murah hati memberi ampunan',
    ],
    anaphora: [
      'Belum pernah kudengar begitu banyak kata tentang begitu sedikit\nBelum pernah panggung menanggung suara setipis ini\nBelum tentu penonton ini mau mendengarmu lagi',
      'Bicaralah, dan lilin-lilin menjauh darimu\nBicaralah, dan penonton menghitung pintu keluar\nBicaralah, dan aku menjawab bila sudah perlu',
    ],
    crescendo: [
      'Kau kecil\nSyairmu lebih kecil lagi\nDan aku sudah meremukkan yang jauh lebih besar darimu sebelum sarapan',
      'Dengar ini\nMalam ini panggung milikku\nDan tiap kata yang keluar dari mulutmu adalah satu paku lagi bagi kekalahanmu',
    ],
    epistrophe: [
      'Kau datang untuk menang dan menemukan panggung\nKau bicara sekali dan kehilangan panggung\nKini membungkuklah dan serahkan padaku panggung',
      'Kupinjamkan telinga, kau membuang waktu\nRimamu kering sebelum waktu\nKini yang tersisa bagimu hanya membuang waktu',
    ],
    haiku: [
      'Syairmu gugur\nTak ada yang memungut\nDibawa angin',
      'Suara jauh\nKupalingkan kepala\nTernyata angin',
    ],
    'heroic-couplet': [
      'Syairmu cuma bayang di tembok\nSyairku api, terang dan elok',
      'Kubawa guntur, petir, dan nyala\nKau bawa lilin kecil, sia-sia',
    ],
  },
  acrosticLines: {
    r: ['Rima itu pedang, dan kau membawa sendok', 'Rasanya penonton sudah memutuskan'],
    a: ['Aku masih di sini, kau masih menunggu kalah', 'Akhirnya terdengar juga bunyi kekalahanmu'],
    j: ['Jangan samakan lantang dengan bagus', 'Jauh di sana mungkin ada yang mau bertepuk'],
    k: ['Kau bicara banyak, tak satu pun berarti', 'Kata-katamu mengkhianatimu, seperti biasa'],
    t: ['Tirai turun, dan turunnya menimpamu', 'Tak pernah penonton sesunyi ini untukmu'],
    p: ['Pulanglah, selagi pintu masih terbuka', 'Panggung ini malam ini hanya mengingatku'],
    i: ['Inikah yang terbaik darimu? Simpan sisanya', 'Ingat baik-baik, takkan kuulang'],
    b: ['Baitku yang terburuk setara baitmu yang terbaik', 'Berlututlah, putusan sudah dijatuhkan'],
    u: ['Ucapanmu tiba terlambat, lagi-lagi', 'Untuk apa bersuara kalau hanya gema?'],
    l: ['Lidahmu cepat, tapi cepat bukanlah cerdik', 'Lihatlah, lilin pun enggan menyala untukmu'],
    n: ['Nah, begitulah pelajaran berakhir; bawalah pulang', 'Nyalimu besar, baitmu kecil: kisah lama'],
    s: ['Sekali lagi kau membuka mulut sia-sia', 'Sudahlah, raja pun pernah kalah dariku'],
  },
};

export default pack;
