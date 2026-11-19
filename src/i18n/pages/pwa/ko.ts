// 한국어. Apple 버튼(공유, ‘홈 화면에 추가’)과 Android 버튼(설치, 나중에)은 각자의 표기. 해요체.
// Page area "pwa": the install guidance and the note on stored downloads (src/lib/pwa.ts), on every page.
// Where each term comes from and how these strings were checked: docs/language/pages-rest.md
const messages: Record<string, string> = {
  'pwa.install.regionLabel': 'Sonnet Man 설치',
  'pwa.install.title': '먼저 Sonnet Man을 설치하세요',
  'pwa.install.promptBody': '전체 화면으로 열리고, 설치한 앱에서는 내려받은 모델을 브라우저가 지울 가능성이 훨씬 낮아요.',
  'pwa.install.iosBody': 'iPhone과 iPad에서는 홈 화면의 앱이 이 탭과 아무것도 공유하지 않아요. 로그인하거나 모델을 내려받기 전에 추가하세요. 그러지 않으면 두 가지를 모두 두 번 해야 해요.',
  'pwa.install.iosStep1': '공유 버튼을 탭하세요.',
  'pwa.install.iosStep2': '‘홈 화면에 추가’를 선택하세요.',
  'pwa.install.accept': '설치',
  'pwa.install.dismiss': '나중에',
  'pwa.storage.kept': '이 기기에 보관된 데이터: {size}. 브라우저가 알아서 지우지 않아요.',
  'pwa.storage.keptNoSize': '내려받은 데이터가 이 기기에 보관되어 있어요. 브라우저가 알아서 지우지 않아요.',
  'pwa.storage.atRisk': '이 기기에 저장된 데이터: {size}. 하지만 기기 공간이 부족하거나 한동안 들어오지 않으면 브라우저가 지울 수 있어요.',
  'pwa.storage.atRiskNoSize': '내려받은 데이터가 저장되어 있지만, 기기 공간이 부족하거나 한동안 들어오지 않으면 브라우저가 지울 수 있어요.',
  'pwa.storage.installHint': '앱을 설치하면 보관하는 데 도움이 돼요.',
  'pwa.storage.lessThan': '{size} 미만',
};

export default messages;
