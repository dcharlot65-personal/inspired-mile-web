// Deutsch. Tasten von Apple („Teilen“, „Zu Home-Bildschirm hinzufügen“) und Android (Installieren, Nicht jetzt) mit deren eigenen Worten. Du.
// Page area "pwa": the install guidance and the note on stored downloads (src/lib/pwa.ts), on every page.
// Where each term comes from and how these strings were checked: docs/language/pages-rest.md
const messages: Record<string, string> = {
  'pwa.install.regionLabel': 'Sonnet Man installieren',
  'pwa.install.title': 'Installiere zuerst Sonnet Man',
  'pwa.install.promptBody': 'Die App öffnet sich im Vollbild, und bei einer installierten App ist es viel unwahrscheinlicher, dass der Browser ein heruntergeladenes Modell löscht.',
  'pwa.install.iosBody': 'Auf iPhone und iPad teilt die App auf dem Home-Bildschirm nichts mit diesem Tab. Füge sie hinzu, bevor du dich anmeldest oder ein Modell herunterlädst, sonst musst du beides zweimal tun.',
  'pwa.install.iosStep1': 'Tippe auf die Taste „Teilen“.',
  'pwa.install.iosStep2': 'Wähle „Zu Home-Bildschirm hinzufügen“.',
  'pwa.install.accept': 'Installieren',
  'pwa.install.dismiss': 'Nicht jetzt',
  'pwa.storage.kept': 'Dauerhaft auf diesem Gerät gespeichert: {size}. Dein Browser löscht das nicht von selbst.',
  'pwa.storage.keptNoSize': 'Dein Download ist dauerhaft auf diesem Gerät gespeichert. Dein Browser löscht ihn nicht von selbst.',
  'pwa.storage.atRisk': 'Auf diesem Gerät gespeichert: {size}. Dein Browser kann das aber löschen, wenn das Gerät wenig Speicherplatz hat oder du eine Weile nicht vorbeischaust.',
  'pwa.storage.atRiskNoSize': 'Dein Download ist gespeichert, aber dein Browser kann ihn löschen, wenn das Gerät wenig Speicherplatz hat oder du eine Weile nicht vorbeischaust.',
  'pwa.storage.installHint': 'Eine installierte App hilft, die Daten zu behalten.',
  'pwa.storage.lessThan': 'weniger als {size}',
};

export default messages;
