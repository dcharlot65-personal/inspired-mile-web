// ภาษาไทย คำที่ใช้คงที่: ชั้นเรียน, ครู, นักเรียน, งาน (assignment), รหัสเข้าร่วม; ประกาศ (ตลาด), สายการแข่งขัน (ทัวร์นาเมนต์), เครดิต; บทกลอน, การประชัน, การ์ด เหมือนส่วนอื่นของเกม เรียกผู้เล่นว่า “คุณ”
// Page area "season": the Season Pass (/season).
// Where each term comes from and how these strings were checked: docs/language/pages-rest.md
const messages: Record<string, string> = {
  'season.meta.title': 'ซีซันพาส',
  'season.meta.description': 'เพิ่มระดับซีซันพาสของคุณเพื่อปลดล็อกรางวัลใน Inspired Mile',
  'season.badge': 'ซีซัน {n}',
  'season.title': 'ซีซันพาส',
  'season.intro': 'เล่นการประชัน ควิซ และภารกิจท้าทายเพื่อรับ XP ทุกระดับใหม่จะปลดล็อกการ์ด เครดิต และฉายา',
  'season.loading': 'กำลังโหลด…',
  'season.level': 'ระดับ',
  'season.xp': '{n} XP',
  'season.xpGain': '+{n} XP',
  'season.next': 'อีก {n} XP จะถึงระดับถัดไป',
  'season.maxed': 'ถึงระดับสูงสุดแล้ว',
  'season.track': 'เส้นทางรางวัล',
  'season.track.empty': 'ซีซันนี้ยังไม่มีรางวัล',
  'season.reward.level': 'ระดับ {n}',
  'season.reward.pack': 'ซองการ์ด: {name}',
  'season.reward.card': 'การ์ด: {name}',
  'season.reward.title': 'ฉายา: {name}',
  'season.reward.unknown': 'รางวัล: {name}',
  'season.reward.premium': 'พรีเมียม',
  'season.claim': 'รับรางวัล',
  'season.claimed': 'รับแล้ว',
  'season.locked': 'ไปให้ถึงระดับ {n}',
  'season.signIn': 'เข้าสู่ระบบเพื่อเก็บความคืบหน้าซีซันพาสของคุณไว้ในทุกอุปกรณ์',
};

export default messages;
