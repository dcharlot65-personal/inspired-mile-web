// Polski. Stałe terminy: klasa, nauczyciel (zapis „nauczyciel lub nauczycielka” tam, gdzie się mieści), uczeń, zadanie, kod dołączenia; oferta (rynek), drabinka (turniej), kredyty; strofa, pojedynek, karta jak w reszcie gry. Zwracamy się na „ty”.
// Page area "season": the Season Pass (/season).
// Where each term comes from and how these strings were checked: docs/language/pages-rest.md
const messages: Record<string, string> = {
  'season.meta.title': 'Karnet sezonowy',
  'season.meta.description': 'Podnoś poziom karnetu sezonowego, aby odblokować nagrody w Inspired Mile.',
  'season.badge': 'Sezon {n}',
  'season.title': 'Karnet sezonowy',
  'season.intro': 'Graj w bitwy, quizy i wyzwania, aby zdobywać XP. Każdy nowy poziom odblokowuje karty, kredyty i tytuły.',
  'season.loading': 'Wczytywanie…',
  'season.level': 'Poziom',
  'season.xp': '{n} XP',
  'season.xpGain': '+{n} XP',
  'season.next': 'Do następnego poziomu brakuje {n} XP',
  'season.maxed': 'Osiągnięto najwyższy poziom',
  'season.track': 'Ścieżka nagród',
  'season.track.empty': 'Ten sezon nie ma jeszcze nagród.',
  'season.reward.level': 'Poziom {n}',
  'season.reward.pack': 'Paczka kart: {name}',
  'season.reward.card': 'Karta: {name}',
  'season.reward.title': 'Tytuł: {name}',
  'season.reward.unknown': 'Nagroda: {name}',
  'season.reward.premium': 'Premium',
  'season.claim': 'Odbierz',
  'season.claimed': 'Odebrano',
  'season.locked': 'Osiągnij poziom {n}',
  'season.signIn': 'Zaloguj się, aby zachować postępy karnetu sezonowego na wszystkich urządzeniach.',
};

export default messages;
