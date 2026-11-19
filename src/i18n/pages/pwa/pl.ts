// Polski. Przyciski Apple (przycisk udostępniania, „Do ekranu głównego”) i Androida (Zainstaluj, Nie teraz) ich własnymi słowami. Ty.
// Page area "pwa": the install guidance and the note on stored downloads (src/lib/pwa.ts), on every page.
// Where each term comes from and how these strings were checked: docs/language/pages-rest.md
const messages: Record<string, string> = {
  'pwa.install.regionLabel': 'Zainstaluj Sonnet Man',
  'pwa.install.title': 'Najpierw zainstaluj Sonnet Man',
  'pwa.install.promptBody': 'Otwiera się na pełnym ekranie, a z zainstalowanej aplikacji przeglądarka znacznie rzadziej usuwa pobrany model.',
  'pwa.install.iosBody': 'Na iPhonie i iPadzie aplikacja z ekranu głównego nie dzieli niczego z tą kartą. Dodaj ją, zanim się zalogujesz lub pobierzesz model, bo inaczej zrobisz jedno i drugie dwa razy.',
  'pwa.install.iosStep1': 'Stuknij w przycisk udostępniania.',
  'pwa.install.iosStep2': 'Wybierz „Do ekranu głównego”.',
  'pwa.install.accept': 'Zainstaluj',
  'pwa.install.dismiss': 'Nie teraz',
  'pwa.storage.kept': 'Zachowane na tym urządzeniu: {size}. Przeglądarka nie usunie tego sama.',
  'pwa.storage.keptNoSize': 'Pobrane dane są zachowane na tym urządzeniu. Przeglądarka nie usunie ich sama.',
  'pwa.storage.atRisk': 'Zapisane na tym urządzeniu: {size}, ale przeglądarka może to usunąć, jeśli na urządzeniu zabraknie miejsca albo nie zajrzysz tu przez jakiś czas.',
  'pwa.storage.atRiskNoSize': 'Pobrane dane są zapisane, ale przeglądarka może je usunąć, jeśli na urządzeniu zabraknie miejsca albo nie zajrzysz tu przez jakiś czas.',
  'pwa.storage.installHint': 'Zainstalowana aplikacja pomaga zachować dane.',
  'pwa.storage.lessThan': 'mniej niż {size}',
};

export default messages;
