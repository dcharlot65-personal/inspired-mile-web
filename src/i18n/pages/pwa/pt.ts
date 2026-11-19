// Português (Brasil). Botões da Apple (Compartilhar, “Adicionar à Tela de Início”) e do Android (Instalar, Agora não) com as palavras deles. Você.
// Page area "pwa": the install guidance and the note on stored downloads (src/lib/pwa.ts), on every page.
// Where each term comes from and how these strings were checked: docs/language/pages-rest.md
const messages: Record<string, string> = {
  'pwa.install.regionLabel': 'Instalar o Sonnet Man',
  'pwa.install.title': 'Instale o Sonnet Man primeiro',
  'pwa.install.promptBody': 'Ele abre em tela cheia, e num app instalado é muito menos provável que o navegador apague um modelo baixado.',
  'pwa.install.iosBody': 'No iPhone e no iPad, o app da Tela de Início não compartilha nada com esta aba. Adicione-o antes de entrar ou baixar um modelo, ou você terá de fazer as duas coisas duas vezes.',
  'pwa.install.iosStep1': 'Toque no botão Compartilhar.',
  'pwa.install.iosStep2': 'Escolha “Adicionar à Tela de Início”.',
  'pwa.install.accept': 'Instalar',
  'pwa.install.dismiss': 'Agora não',
  'pwa.storage.kept': 'Guardado neste dispositivo: {size}. Seu navegador não vai apagar isso por conta própria.',
  'pwa.storage.keptNoSize': 'Seu download está guardado neste dispositivo. Seu navegador não vai apagá-lo por conta própria.',
  'pwa.storage.atRisk': 'Salvo neste dispositivo: {size}. Mas seu navegador pode apagar isso se o dispositivo ficar sem espaço ou se você passar um tempo sem voltar.',
  'pwa.storage.atRiskNoSize': 'Seu download está salvo, mas seu navegador pode apagá-lo se o dispositivo ficar sem espaço ou se você passar um tempo sem voltar.',
  'pwa.storage.installHint': 'Instalar o app ajuda a guardar os dados.',
  'pwa.storage.lessThan': 'menos de {size}',
};

export default messages;
