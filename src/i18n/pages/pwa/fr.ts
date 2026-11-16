// Français. Boutons d’Apple (Partager, « Sur l’écran d’accueil ») et d’Android (Installer, Pas maintenant) avec leurs propres mots. Vouvoiement.
// Page area "pwa": the install guidance and the note on stored downloads (src/lib/pwa.ts), on every page.
// Where each term comes from and how these strings were checked: docs/language/pages-rest.md
const messages: Record<string, string> = {
  'pwa.install.regionLabel': 'Installer Sonnet Man',
  'pwa.install.title': 'Installez d’abord Sonnet Man',
  'pwa.install.promptBody': 'Elle s’ouvre en plein écran, et dans une app installée le navigateur risque bien moins d’effacer un modèle téléchargé.',
  'pwa.install.iosBody': 'Sur iPhone et iPad, l’app de l’écran d’accueil ne partage rien avec cet onglet. Ajoutez-la avant de vous connecter ou de télécharger un modèle\u00a0: sinon, il faudra refaire l’un et l’autre.',
  'pwa.install.iosStep1': 'Touchez le bouton Partager.',
  'pwa.install.iosStep2': 'Choisissez «\u00a0Sur l’écran d’accueil\u00a0».',
  'pwa.install.accept': 'Installer',
  'pwa.install.dismiss': 'Pas maintenant',
  'pwa.storage.kept': 'Téléchargement conservé sur cet appareil\u00a0: {size}. Votre navigateur ne l’effacera pas de lui-même.',
  'pwa.storage.keptNoSize': 'Votre téléchargement est conservé sur cet appareil. Votre navigateur ne l’effacera pas de lui-même.',
  'pwa.storage.atRisk': 'Téléchargement enregistré sur cet appareil\u00a0: {size}. Mais votre navigateur peut l’effacer si l’appareil manque d’espace ou si vous ne revenez pas pendant un certain temps.',
  'pwa.storage.atRiskNoSize': 'Votre téléchargement est enregistré, mais votre navigateur peut l’effacer si l’appareil manque d’espace ou si vous ne revenez pas pendant un certain temps.',
  'pwa.storage.installHint': 'Installer l’app aide à le conserver.',
  'pwa.storage.lessThan': 'moins de {size}',
};

export default messages;
