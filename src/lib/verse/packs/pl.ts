import type { LanguagePack } from './index';

// Polish. Power words are in the nominative; a verse may use any case (see usesWord in ../devices).
const pack: LanguagePack = {
  lang: 'pl',
  acrostic: ['noc', 'los', 'sen', 'mrok', 'tron', 'rok', 'kres'],
  forbidden: ['o', 'r', 't', 'k', 'm', 'w'],
  relics: {
    'RL-001': ['czaszka', 'żart', 'grób', 'śmiech', 'proch'],
    'RL-002': ['burza', 'zaklęcie', 'laska', 'wyspa', 'toń'],
    'RL-003': ['sztylet', 'krew', 'sen', 'widmo', 'dłoń'],
    'RL-004': ['pierścień', 'przysięga', 'noc', 'wygnanie', 'pocałunek'],
    'RL-005': ['złoto', 'wybór', 'łaska', 'ołów', 'szkatuła'],
    'RL-006': ['korona', 'tron', 'ambicja', 'wiedźma', 'król'],
    'RL-007': ['księga', 'burza', 'magia', 'karta', 'toń'],
    'RL-008': ['łzy', 'prawda', 'córka', 'nic', 'serce'],
    'RL-009': ['maska', 'sen', 'błazen', 'sztuka', 'księżyc'],
  },
  written: {
    couplet: [
      'Twój rym to świeczka, co gaśnie o zmroku\nMój jest jak słońce, a ty stoisz w mroku',
      'Wejdź, biedny aktorze, pusz się przez godzinę\nPotem patrz, jak twój wiersz obraca się w ruinę',
    ],
    'quatrain-aabb': [
      'Przychodzisz zbrojny w dowcip pożyczony\nI dziwisz się, że żaden cios nie był trafiony\nWidziałem królów i błaznów na tej scenie\nTy jesteś przypisem, co budzi znużenie',
      'Tłum przyszedł tutaj oglądać bitwę\nA twój wiersz szepcze cichą modlitwę\nMów jeszcze raz, głośniej, jeśli masz odwagę\nJa odpowiadam burzom; ty tracisz równowagę',
    ],
    'quatrain-abab': [
      'Chodziłem po tych deskach, nim się urodziłeś\nMój wiersz był prawem, twój był tylko szumem\nSłysz, jak kurtyna spada, choć się nie skłoniłeś\nScena chce męża z sercem i rozumem',
      'Twój wiersz wchodzi, kulejąc na jedną nogę\nI prosi tłum o trochę litości\nNie kopię tego, kto zagradza drogę\nZostawiam go samego w ciemności',
    ],
    tercet: [
      'Masz język, przyznaję, lecz nie masz sztuki\nBłąka się jak pijany po ciemku\nI nie wyciąga z niczego nauki',
      'To nazywasz wierszem? Ja nazywam błędem\nKulawa linijka, co prosi o spoczynek\nA ja jej go daję, i to z całym względem',
    ],
    anaphora: [
      'Nigdy nie słyszałem tak wiele o tak niczym\nNigdy scena nie zniosła tak cienkiego głosu\nNigdy więcej, jak sądzę, ten tłum cię nie wysłucha',
      'Mów, a świece odchylają się od ciebie\nMów, a widownia liczy wyjścia\nMów, a ja odpowiem, gdy będzie warto',
    ],
    crescendo: [
      'Jesteś mały\nTwój wiersz jest jeszcze mniejszy\nA ja przed śniadaniem miażdżyłem rzeczy o wiele większe od ciebie',
      'Słuchaj uważnie\nDziś ta scena jest moja\nA każde słowo z twoich ust to kolejny gwóźdź do twojej klęski',
    ],
    epistrophe: [
      'Przyszedłeś wygrać i znalazłeś scenę\nPrzemówiłeś raz i straciłeś scenę\nTeraz się ukłoń i zostaw mi scenę',
      'Dałem ci posłuch, a ty zmarnowałeś czas\nTwój rym wysechł, zanim przyszedł czas\nTeraz możesz już tylko tracić czas',
    ],
    haiku: [
      'Twój wiersz opada\nNikt go z ziemi nie zbiera\nWiatr go rozwiewa',
      'Cichy głos z dala\nObracam głowę, słucham\nTo był tylko wiatr',
    ],
    'heroic-couplet': [
      'Twój wiersz to tylko cień na białej ścianie\nMój jest tym ogniem, co budzi świtanie',
      'Przyszedłem tu z gromem i płomieniem\nA ty stoisz ze świeczką i z drżeniem',
    ],
  },
  acrosticLines: {
    n: ['Nikt jeszcze nie milczał dla ciebie tak długo', 'Nie myl hałasu z talentem'],
    o: ['Oto koniec lekcji; zabierz ją do domu', 'Ostatnie brawa są dla mnie, nie dla ciebie'],
    c: ['Cisza po twoim wierszu mówi wszystko', 'Co to był za dźwięk? Ach, twoja klęska'],
    l: ['Lepiej zejdź, póki drzwi są otwarte', 'Lichy to rym, co sam siebie się wstydzi'],
    s: ['Słowa cię zawodzą, jak zawsze', 'Scena pamięta dziś tylko mnie'],
    e: ['Echo twoich wersów ziewa z nudów', 'E, to już wszystko? Tłum czekał na więcej'],
    m: ['Mój najgorszy wers wart jest twego najlepszego', 'Mierz słowa, bo niewiele ci ich zostało'],
    r: ['Rymować to fechtować się, a ty przyszedłeś z łyżką', 'Raz jeszcze otwierasz usta na próżno'],
    k: ['Klęknij, bo wyrok już zapadł', 'Królowie ze mną przegrywali; kimże ty jesteś?'],
    t: ['Twój język jest szybki, lecz pośpiech to nie dowcip', 'Tej nocy kurtyna opada na ciebie'],
  },
};

export default pack;
