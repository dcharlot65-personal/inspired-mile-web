// Italiano. Termini fissi: classe, insegnante, studente (scritto «studente o studentessa» dove serve), compito, codice di accesso; annuncio (mercato), tabellone (torneo), crediti; strofa, duello, carta come nel resto del gioco. Si dà del tu.
// Page area "season": the Season Pass (/season).
// Where each term comes from and how these strings were checked: docs/language/pages-rest.md
const messages: Record<string, string> = {
  'season.meta.title': 'Pass stagionale',
  'season.meta.description': 'Fai salire di livello il tuo Pass stagionale per sbloccare ricompense in Inspired Mile.',
  'season.badge': 'Stagione {n}',
  'season.title': 'Pass stagionale',
  'season.intro': 'Gioca battaglie, quiz e sfide per guadagnare XP. Ogni nuovo livello sblocca carte, crediti e titoli.',
  'season.introNow': 'Ogni livello del Pass stagionale sblocca carte, crediti o titoli. In questa versione del gioco, giocare non fa guadagnare XP.',
  'season.loading': 'Caricamento…',
  'season.level': 'Livello',
  'season.xp': '{n} XP',
  'season.xpGain': '{n} XP',
  'season.next': 'Mancano {n} XP al prossimo livello',
  'season.maxed': 'Livello massimo raggiunto',
  'season.track': 'Percorso delle ricompense',
  'season.track.empty': 'Questa stagione non ha ancora ricompense.',
  'season.reward.level': 'Livello {n}',
  'season.reward.pack': 'Bustina di carte: {name}',
  'season.reward.card': 'Carta: {name}',
  'season.reward.title': 'Titolo: {name}',
  'season.reward.unknown': 'Ricompensa: {name}',
  'season.reward.premium': 'Premium',
  'season.claim': 'Riscatta',
  'season.claimed': 'Riscattata',
  'season.locked': 'Raggiungi il livello {n}',
  'season.signIn': 'Accedi per conservare i progressi del tuo Pass stagionale su tutti i dispositivi.',
};

export default messages;
