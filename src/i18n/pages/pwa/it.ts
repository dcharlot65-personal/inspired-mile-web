// Italiano. Pulsanti di Apple (Condividi, “Aggiungi alla schermata Home”) e di Android (Installa, Non ora) con le loro parole. Tu.
// Page area "pwa": the install guidance and the note on stored downloads (src/lib/pwa.ts), on every page.
// Where each term comes from and how these strings were checked: docs/language/pages-rest.md
const messages: Record<string, string> = {
  'pwa.install.regionLabel': 'Installa Sonnet Man',
  'pwa.install.title': 'Prima installa Sonnet Man',
  'pwa.install.promptBody': 'Si apre a schermo intero, e in un’app installata è molto meno probabile che il browser cancelli un modello scaricato.',
  'pwa.install.iosBody': 'Su iPhone e iPad l’app nella schermata Home non condivide nulla con questa scheda. Aggiungila prima di accedere o di scaricare un modello, altrimenti dovrai fare tutto due volte.',
  'pwa.install.iosStep1': 'Tocca il pulsante Condividi.',
  'pwa.install.iosStep2': 'Scegli “Aggiungi alla schermata Home”.',
  'pwa.install.accept': 'Installa',
  'pwa.install.dismiss': 'Non ora',
  'pwa.storage.kept': 'Conservati su questo dispositivo: {size}. Il browser non li cancellerà di sua iniziativa.',
  'pwa.storage.keptNoSize': 'Il tuo download è conservato su questo dispositivo. Il browser non lo cancellerà di sua iniziativa.',
  'pwa.storage.atRisk': 'Salvati su questo dispositivo: {size}, ma il browser potrebbe cancellarli se il dispositivo resta senza spazio o se non torni per un po’.',
  'pwa.storage.atRiskNoSize': 'Il tuo download è salvato, ma il browser potrebbe cancellarlo se il dispositivo resta senza spazio o se non torni per un po’.',
  'pwa.storage.installHint': 'Installare l’app aiuta a conservare i dati.',
  'pwa.storage.lessThan': 'meno di {size}',
};

export default messages;
