// Español. Botones de Apple (Compartir, “Añadir a pantalla de inicio”) y de Android (Instalar, Ahora no) con sus propias palabras. Tuteo.
// Page area "pwa": the install guidance and the note on stored downloads (src/lib/pwa.ts), on every page.
// Where each term comes from and how these strings were checked: docs/language/pages-rest.md
const messages: Record<string, string> = {
  'pwa.install.regionLabel': 'Instalar Sonnet Man',
  'pwa.install.title': 'Instala Sonnet Man primero',
  'pwa.install.promptBody': 'Se abre a pantalla completa, y en una app instalada es mucho menos probable que el navegador borre un modelo descargado.',
  'pwa.install.iosBody': 'En el iPhone y el iPad, la app de la pantalla de inicio no comparte nada con esta pestaña. Añádela antes de iniciar sesión o descargar un modelo, o tendrás que hacer las dos cosas dos veces.',
  'pwa.install.iosStep1': 'Toca el botón Compartir.',
  'pwa.install.iosStep2': 'Elige “Añadir a pantalla de inicio”.',
  'pwa.install.accept': 'Instalar',
  'pwa.install.dismiss': 'Ahora no',
  'pwa.storage.kept': 'Se conservan {size} en este dispositivo. Tu navegador no los borrará por su cuenta.',
  'pwa.storage.keptNoSize': 'Tu descarga se conserva en este dispositivo. Tu navegador no la borrará por su cuenta.',
  'pwa.storage.atRisk': 'Se han guardado {size}, pero tu navegador puede borrarlos si el dispositivo se queda sin espacio o si pasas un tiempo sin volver.',
  'pwa.storage.atRiskNoSize': 'Tu descarga está guardada, pero tu navegador puede borrarla si el dispositivo se queda sin espacio o si pasas un tiempo sin volver.',
  'pwa.storage.installHint': 'Si instalas la app, es más probable que se conserve.',
  'pwa.storage.lessThan': 'menos de {size}',
};

export default messages;
