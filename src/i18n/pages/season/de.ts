// Deutsch. Feste Begriffe: Klasse, Lehrkraft, Schülerinnen und Schüler, Aufgabe, Beitrittscode; Angebot (Marktplatz), Turnierbaum, Credits; Strophe, Duell, Karte wie im übrigen Spiel. Anrede: du.
// Page area "season": the Season Pass (/season).
// Where each term comes from and how these strings were checked: docs/language/pages-rest.md
const messages: Record<string, string> = {
  'season.meta.title': 'Saisonpass',
  'season.meta.description': 'Steigere die Stufe deines Saisonpasses und schalte Belohnungen in Inspired Mile frei.',
  'season.badge': 'Saison {n}',
  'season.title': 'Saisonpass',
  'season.intro': 'Spiel Kämpfe, Quiz und Herausforderungen, um XP zu sammeln. Jede neue Stufe schaltet Karten, Credits und Titel frei.',
  'season.loading': 'Wird geladen\u00a0…',
  'season.level': 'Stufe',
  'season.xp': '{n} XP',
  'season.xpGain': '{n} XP',
  'season.next': 'Noch {n} XP bis zur nächsten Stufe',
  'season.maxed': 'Höchste Stufe erreicht',
  'season.track': 'Belohnungspfad',
  'season.track.empty': 'Für diese Saison gibt es noch keine Belohnungen.',
  'season.reward.level': 'Stufe {n}',
  'season.reward.pack': 'Kartenpackung: {name}',
  'season.reward.card': 'Karte: {name}',
  'season.reward.title': 'Titel: {name}',
  'season.reward.unknown': 'Belohnung: {name}',
  'season.reward.premium': 'Premium',
  'season.claim': 'Abholen',
  'season.claimed': 'Abgeholt',
  'season.locked': 'Erreiche Stufe {n}',
  'season.signIn': 'Melde dich an, damit dein Saisonpass-Fortschritt auf allen Geräten erhalten bleibt.',
};

export default messages;
