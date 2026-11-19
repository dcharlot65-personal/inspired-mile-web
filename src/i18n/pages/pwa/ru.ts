// Русский. Кнопки Apple («Поделиться», «На экран „Домой“») и Android («Установить», «Не сейчас») их собственными словами. На «ты».
// Page area "pwa": the install guidance and the note on stored downloads (src/lib/pwa.ts), on every page.
// Where each term comes from and how these strings were checked: docs/language/pages-rest.md
const messages: Record<string, string> = {
  'pwa.install.regionLabel': 'Установить Sonnet Man',
  'pwa.install.title': 'Сначала установи Sonnet Man',
  'pwa.install.promptBody': 'Приложение открывается на весь экран, и у установленного приложения браузер гораздо реже удаляет загруженную модель.',
  'pwa.install.iosBody': 'На iPhone и iPad приложение с экрана «Домой» ничего не делит с этой вкладкой. Добавь его до того, как войдёшь или загрузишь модель, иначе придётся делать и то и другое дважды.',
  'pwa.install.iosStep1': 'Коснись кнопки «Поделиться».',
  'pwa.install.iosStep2': 'Выбери «На экран „Домой“».',
  'pwa.install.accept': 'Установить',
  'pwa.install.dismiss': 'Не сейчас',
  'pwa.storage.kept': 'Сохранено на этом устройстве: {size}. Браузер не удалит это сам.',
  'pwa.storage.keptNoSize': 'Загруженное сохранено на этом устройстве. Браузер не удалит его сам.',
  'pwa.storage.atRisk': 'Хранится на этом устройстве: {size}. Но браузер может это удалить, если на устройстве не хватит места или ты долго не будешь заходить.',
  'pwa.storage.atRiskNoSize': 'Загруженное хранится на устройстве, но браузер может его удалить, если на устройстве не хватит места или ты долго не будешь заходить.',
  'pwa.storage.installHint': 'Установленное приложение помогает это сохранить.',
  'pwa.storage.lessThan': 'меньше {size}',
};

export default messages;
