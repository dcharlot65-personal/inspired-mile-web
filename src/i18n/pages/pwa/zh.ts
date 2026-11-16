// 简体中文。Apple 的按钮（“共享”“添加到主屏幕”）和 Android 的按钮（安装、以后再说）用它们自己的说法。
// Page area "pwa": the install guidance and the note on stored downloads (src/lib/pwa.ts), on every page.
// Where each term comes from and how these strings were checked: docs/language/pages-rest.md
const messages: Record<string, string> = {
  'pwa.install.regionLabel': '安装 Sonnet Man',
  'pwa.install.title': '先安装 Sonnet Man',
  'pwa.install.promptBody': '它会全屏打开，而且在已安装的应用中，下载的模型被浏览器清除的可能性要小得多。',
  'pwa.install.iosBody': '在 iPhone 和 iPad 上，主屏幕上的应用与这个标签页不共享任何内容。请在登录或下载模型之前添加它，否则这两件事都得做两遍。',
  'pwa.install.iosStep1': '轻点“共享”按钮。',
  'pwa.install.iosStep2': '选择“添加到主屏幕”。',
  'pwa.install.accept': '安装',
  'pwa.install.dismiss': '以后再说',
  'pwa.storage.kept': '已在这台设备上保留 {size}。浏览器不会自行清除。',
  'pwa.storage.keptNoSize': '你下载的内容已保留在这台设备上。浏览器不会自行清除。',
  'pwa.storage.atRisk': '已在这台设备上存储 {size}，但如果设备空间不足，或你一段时间没有回来，浏览器可能会清除这些内容。',
  'pwa.storage.atRiskNoSize': '你下载的内容已存储，但如果设备空间不足，或你一段时间没有回来，浏览器可能会清除这些内容。',
  'pwa.storage.installHint': '安装此应用有助于保留这些内容。',
  'pwa.storage.lessThan': '不到 {size}',
};

export default messages;
