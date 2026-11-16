import type { LanguagePack } from './index';

// Italian.
const pack: LanguagePack = {
  lang: 'it',
  acrostic: ['luna', 'rosa', 'mare', 'arte', 'fato', 'sole', 'amor'],
  forbidden: ['l', 'r', 's', 't', 'n', 'c'],
  relics: {
    'RL-001': ['teschio', 'burla', 'tomba', 'riso', 'polvere'],
    'RL-002': ['tempesta', 'incanto', 'bastone', 'isola', 'naufragio'],
    'RL-003': ['pugnale', 'sangue', 'sonno', 'visione', 'mano'],
    'RL-004': ['anello', 'giuramento', 'notte', 'esilio', 'bacio'],
    'RL-005': ['oro', 'scelta', 'clemenza', 'piombo', 'scrigno'],
    'RL-006': ['corona', 'trono', 'ambizione', 'strega', 're'],
    'RL-007': ['libro', 'tempesta', 'magia', 'pagina', 'naufragio'],
    'RL-008': ['lacrime', 'verità', 'figlia', 'nulla', 'cuore'],
    'RL-009': ['maschera', 'sogno', 'buffone', 'commedia', 'luna'],
  },
  written: {
    couplet: [
      'Le tue rime son candele nella notte\nLa mia è il sole, e le tue son già rotte',
      'Sali, povero attore, pavoneggia un’ora\nPoi guarda il tuo verso che già scolora',
    ],
    'quatrain-aabb': [
      'Vieni armato d’un ingegno prestato\nE ti stupisci che nessun colpo è andato\nHo visto re e buffoni su questa scena\nTu sei la nota a margine, e fai pena',
      'La gente è venuta a vedere una battaglia\nE il tuo verso è un soldato di paglia\nParla ancora, più forte, se hai coraggio\nIo rispondo ai tuoni; tu sei un miraggio',
    ],
    'quatrain-abab': [
      'Calcavo queste assi prima che tu nascessi\nIl mio verso era legge, il tuo rumore\nOra cala il sipario sui tuoi successi\nLa scena vuole un uomo, non un minore',
      'Il tuo verso entra zoppo, pare stanco\nE chiede al pubblico un po’ di pietà\nNon prendo a calci chi mi cade a fianco\nLo lascio lì seduto, e se ne va',
    ],
    tercet: [
      'Hai una lingua, lo ammetto, ma non l’arte\nVaga come un ubriaco nel buio\nE non arriva mai da nessuna parte',
      'E questo lo chiami verso? Io lo chiamo errore\nUna riga zoppa che implora riposo\nE io glielo concedo, per puro favore',
    ],
    anaphora: [
      'Mai ho sentito dire tanto su così poco\nMai un palco ha sopportato una voce così sottile\nMai più, credo, questa platea ti darà ascolto',
      'Parla, e le candele si scostano da te\nParla, e la platea conta le uscite\nParla, che io risponderò quando conterà',
    ],
    crescendo: [
      'Sei piccolo\nIl tuo verso lo è di più\nE io ho schiacciato cose ben più grandi di te prima di colazione',
      'Ascolta bene\nStanotte la scena è mia\nE ogni parola che ti esce di bocca è un altro chiodo nella tua sconfitta',
    ],
    epistrophe: [
      'Sei venuto per vincere e hai trovato la scena\nHai parlato una volta e hai perso la scena\nOra inchinati e lascia a me la scena',
      'Ti ho prestato orecchio e hai sprecato il tempo\nLa tua rima si è seccata prima del tempo\nOra non ti resta che perdere tempo',
    ],
    haiku: [
      'Il verso cade\nCome le foglie secche\nIl vento ride',
      'Voce lontana\nMi volto per sentirla\nEra il vento',
    ],
    'heroic-couplet': [
      'Il tuo verso è ombra sul muro\nIl mio è fuoco limpido e puro',
      'Porto tuoni, fulmini e fiamma\nTu hai un lume: che misero dramma',
    ],
  },
  acrosticLines: {
    l: ['La sala tace, e non è per rispetto', 'Lascia stare: il sipario cala su di te'],
    u: ['Un applauso per te: l’ultimo', 'Una volta ancora apri bocca invano'],
    n: ['Nessuno ha mai taciuto tanto per te', 'Non confondere il rumore col talento'],
    a: ['Ancora qui, ad aspettare la sconfitta', 'Adesso ascolta come suona un verso'],
    r: ['Rimare è scherma, e tu porti un cucchiaio', 'Ritirati, finché le porte sono aperte'],
    o: ['Ogni tuo verso muore a mezz’aria', 'Ora basta: il pubblico ha deciso'],
    s: ['Stanotte la scena ricorda solo me', 'Se questo è il tuo meglio, tieniti il resto'],
    m: ['Mio il palco, tuo il silenzio', 'Misura le parole, te ne restano poche'],
    e: ['E così finisce la lezione; portala a casa', 'Eppure insisti, piccola voce'],
    t: ['Tu parli svelto, ma la fretta non è ingegno', 'Tutto ciò che dici l’ho già detto meglio'],
    f: ['Fuggi, finché l’uscita è libera', 'Fiato sprecato, il tuo, da capo a fondo'],
  },
};

export default pack;
