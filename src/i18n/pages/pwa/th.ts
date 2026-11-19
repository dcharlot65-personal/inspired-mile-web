// ไทย ปุ่มของ Apple (แชร์, “เพิ่มไปยังหน้าจอโฮม”) และของ Android (ติดตั้ง, ไว้ทีหลัง) ใช้คำของผู้ผลิตเอง
// Page area "pwa": the install guidance and the note on stored downloads (src/lib/pwa.ts), on every page.
// Where each term comes from and how these strings were checked: docs/language/pages-rest.md
const messages: Record<string, string> = {
  'pwa.install.regionLabel': 'ติดตั้ง Sonnet Man',
  'pwa.install.title': 'ติดตั้ง Sonnet Man ก่อน',
  'pwa.install.promptBody': 'แอปจะเปิดเต็มหน้าจอ และในแอปที่ติดตั้งแล้ว เบราว์เซอร์มีโอกาสลบโมเดลที่ดาวน์โหลดไว้น้อยกว่ามาก',
  'pwa.install.iosBody': 'บน iPhone และ iPad แอปบนหน้าจอโฮมไม่ได้ใช้อะไรร่วมกับแท็บนี้เลย ให้เพิ่มก่อนลงชื่อเข้าใช้หรือดาวน์โหลดโมเดล ไม่เช่นนั้นคุณจะต้องทำทั้งสองอย่างสองครั้ง',
  'pwa.install.iosStep1': 'แตะปุ่มแชร์',
  'pwa.install.iosStep2': 'เลือก “เพิ่มไปยังหน้าจอโฮม”',
  'pwa.install.accept': 'ติดตั้ง',
  'pwa.install.dismiss': 'ไว้ทีหลัง',
  'pwa.storage.kept': 'ข้อมูล {size} ถูกเก็บไว้ในอุปกรณ์เครื่องนี้ เบราว์เซอร์จะไม่ลบเอง',
  'pwa.storage.keptNoSize': 'ข้อมูลที่คุณดาวน์โหลดถูกเก็บไว้ในอุปกรณ์เครื่องนี้ เบราว์เซอร์จะไม่ลบเอง',
  'pwa.storage.atRisk': 'ข้อมูล {size} ถูกบันทึกไว้แล้ว แต่เบราว์เซอร์อาจลบได้หากพื้นที่ในอุปกรณ์ไม่พอหรือคุณไม่ได้เข้ามาสักพัก',
  'pwa.storage.atRiskNoSize': 'ข้อมูลที่คุณดาวน์โหลดถูกบันทึกไว้แล้ว แต่เบราว์เซอร์อาจลบได้หากพื้นที่ในอุปกรณ์ไม่พอหรือคุณไม่ได้เข้ามาสักพัก',
  'pwa.storage.installHint': 'การติดตั้งแอปช่วยให้เก็บข้อมูลไว้ได้',
  'pwa.storage.lessThan': 'ไม่ถึง {size}',
};

export default messages;
