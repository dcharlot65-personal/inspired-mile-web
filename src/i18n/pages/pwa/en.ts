// English: the reference. Every other language has exactly these keys and {placeholders}.
// Page area "pwa": the install guidance and the note on stored downloads (src/lib/pwa.ts), on every page.
// Where each term comes from and how these strings were checked: docs/language/pages-rest.md
const messages: Record<string, string> = {
  'pwa.install.regionLabel': 'Install Sonnet Man',
  'pwa.install.title': 'Install Sonnet Man first',
  'pwa.install.promptBody': 'It opens full screen, and an installed app is far less likely to have a downloaded model cleared by the browser.',
  'pwa.install.iosBody': 'On iPhone and iPad the Home Screen app shares nothing with this tab. Add it before you sign in or download a model, or you will do both twice.',
  'pwa.install.iosStep1': 'Tap the Share button.',
  'pwa.install.iosStep2': 'Choose “Add to Home Screen”.',
  'pwa.install.accept': 'Install',
  'pwa.install.dismiss': 'Not now',
  'pwa.storage.kept': '{size} kept on this device. Your browser will not clear it on its own.',
  'pwa.storage.keptNoSize': 'Your download is kept on this device. Your browser will not clear it on its own.',
  'pwa.storage.atRisk': '{size} stored, but your browser may clear this if the device runs short of space or you stay away for a while.',
  'pwa.storage.atRiskNoSize': 'Your download is stored, but your browser may clear this if the device runs short of space or you stay away for a while.',
  'pwa.storage.installHint': 'Installing the app helps keep it.',
  'pwa.storage.lessThan': 'Less than {size}',
};

export default messages;
