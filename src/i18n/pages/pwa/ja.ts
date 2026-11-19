// 日本語。Apple のボタン（共有、「ホーム画面に追加」）と Android のボタン（インストール、後で）はそれぞれの表記。です・ます体。
// Page area "pwa": the install guidance and the note on stored downloads (src/lib/pwa.ts), on every page.
// Where each term comes from and how these strings were checked: docs/language/pages-rest.md
const messages: Record<string, string> = {
  'pwa.install.regionLabel': 'Sonnet Manをインストール',
  'pwa.install.title': 'まずSonnet Manをインストールしてください',
  'pwa.install.promptBody': '全画面で開きます。インストールしたアプリでは、ダウンロードしたモデルがブラウザに消去されることがずっと少なくなります。',
  'pwa.install.iosBody': 'iPhoneとiPadでは、ホーム画面のアプリはこのタブと何も共有しません。サインインやモデルのダウンロードの前に追加してください。そうしないと、どちらも二度行うことになります。',
  'pwa.install.iosStep1': '共有ボタンをタップします。',
  'pwa.install.iosStep2': '「ホーム画面に追加」を選びます。',
  'pwa.install.accept': 'インストール',
  'pwa.install.dismiss': '後で',
  'pwa.storage.kept': 'この端末に{size}を保持しています。ブラウザが勝手に消去することはありません。',
  'pwa.storage.keptNoSize': 'ダウンロードしたデータはこの端末に保持されています。ブラウザが勝手に消去することはありません。',
  'pwa.storage.atRisk': 'この端末に{size}を保存していますが、端末の空き容量が足りなくなったり、しばらくアクセスしなかったりすると、ブラウザが消去することがあります。',
  'pwa.storage.atRiskNoSize': 'ダウンロードしたデータは保存されていますが、端末の空き容量が足りなくなったり、しばらくアクセスしなかったりすると、ブラウザが消去することがあります。',
  'pwa.storage.installHint': 'アプリをインストールすると残りやすくなります。',
  'pwa.storage.lessThan': '{size}未満',
};

export default messages;
