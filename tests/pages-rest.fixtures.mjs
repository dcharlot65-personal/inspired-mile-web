// What the pages of tests/pages-rest.spec.ts and scripts/pages-rest/shots.mjs are shown:
// the six localised pages, and API answers that fill every list on them, so that the
// strings built in script (counts, dates, states, badges) are on screen to be checked.
//
// The data is what a server could really send: names typed by people (one of them Arabic,
// to see a right-to-left name inside a left-to-right page and the reverse), card numbers,
// states and formats as the Rust handlers spell them.

export const LOCALES = ['en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'ru', 'ar', 'hi', 'zh', 'ja', 'ko', 'vi', 'th', 'id'];

/**
 * Strings of the page areas that rightly read the same as English, by key: '*' for every
 * language (a pattern with no words of its own), or the languages that share the word or keep
 * the abbreviation. Read by both src/i18n/pages-rest.test.ts (a string the same as English and
 * not listed here is untranslated) and tests/pages-rest.spec.ts (the English a page in another
 * language must not show). Keep it short: each entry is a string no check looks at.
 */
export const SAME_AS_ENGLISH = {
  'tour.option': '*', // "{name} ({status})"
  'season.xp': '*', // "{n} XP"
  'season.xpGain': '*',
  'viewer.fps': ['es', 'de', 'it', 'pt', 'hi', 'ja', 'ko', 'id'], // "fps" is kept
  'classroom.list.code': ['de'],
  'market.status.active': ['fr'],
  'tour.match.live': ['de'],
  'tour.col.status': ['de', 'pl', 'id'],
  'tour.label.format': ['pl', 'id'],
  'tour.bye': ['it', 'id'], // Italian tennis and Indonesian sport both say "bye" (Wikidata Q1268659)
  'season.reward.premium': ['fr', 'de', 'it', 'pt', 'pl', 'id'],
  'season.level': ['id'],
  'season.reward.level': ['id'],
  'vr.card.desktop.title': ['de', 'it'],
  'offline.pageTitle': ['de', 'it', 'pt', 'pl'],
  'offline.link.collection': ['fr'],
  'offline.link.home': ['it'],
};

/** May the string under `key` read the same as English in `locale`? */
export function mayMatchEnglish(key, locale) {
  const allowed = SAME_AS_ENGLISH[key];
  return allowed === '*' || (Array.isArray(allowed) && allowed.includes(locale));
}

/** Each page: its path, the page areas it loads, where its title comes from, and how to tell its data has been drawn. */
export const PAGES = [
  { name: 'classroom', path: '/classroom', areas: ['classroom', 'shared'], titleKey: 'classroom.meta.title', descriptionKey: 'classroom.meta.description', ready: '#classrooms-list [data-id]' },
  { name: 'marketplace', path: '/marketplace', areas: ['marketplace', 'shared'], titleKey: 'nav.marketplace', descriptionKey: 'market.meta.description', ready: '#listings-grid .buy-btn' },
  { name: 'tournaments', path: '/tournaments', areas: ['tournaments', 'shared'], titleKey: 'nav.tournaments', descriptionKey: 'tour.meta.description', ready: '#tournament-list .view-bracket-btn' },
  { name: 'season', path: '/season', areas: ['season', 'shared'], titleKey: 'season.meta.title', descriptionKey: 'season.meta.description', ready: '#reward-track .claim-btn' },
  { name: 'viewer', path: '/viewer', areas: ['viewer'], titleKey: 'nav.viewer', descriptionKey: 'viewer.meta.description', ready: '#card-select option[value="DC-001"]' },
  { name: 'vr', path: '/vr', areas: ['viewer'], titleKey: 'nav.vr', descriptionKey: 'vr.meta.description', ready: '#vr-canvas' },
];

export const DATA = {
  classrooms: [
    { id: 1, name: 'Class 9B', join_code: 'QWERTY', member_count: 3, created_at: '2026-11-02T08:00:00Z' },
    { id: 2, name: 'مسرح شكسبير', join_code: 'ABCDEF', member_count: 1, created_at: '2026-11-05T08:00:00Z' },
    { id: 3, name: 'Hamlet lesen', join_code: 'ZXCVBN', member_count: 11, created_at: '2026-11-06T08:00:00Z' },
  ],
  members: [
    { user_id: '00000000-0000-0000-0000-000000000001', username: 'viola', role: 'teacher', joined_at: '2026-11-02T08:00:00Z' },
    { user_id: '00000000-0000-0000-0000-000000000002', username: 'sebastian', role: 'student', joined_at: '2026-11-03T08:00:00Z' },
    { user_id: '00000000-0000-0000-0000-000000000003', username: 'أوليفيا', role: 'student', joined_at: '2026-11-03T09:00:00Z' },
  ],
  assignments: [
    { id: 1, title: 'Sonnet 18', assignment_type: 'trivia', created_at: '2026-11-10T09:00:00Z' },
    { id: 2, title: 'Macbeth, acte I', assignment_type: 'challenge', created_at: '2026-11-11T09:00:00Z' },
    { id: 3, title: 'Verona', assignment_type: 'battle', created_at: '2026-11-12T09:00:00Z' },
  ],
  listings: [
    { id: 'l1', seller_id: 's1', seller_username: 'viola', card_id: 'MO-001', listing_type: 'sale', price_credits: 1, wanted_card_ids: [], status: 'active', created_at: '2026-11-12T10:00:00Z' },
    { id: 'l2', seller_id: 's2', seller_username: 'أوليفيا', card_id: 'CA-001', listing_type: 'sale', price_credits: 100000, wanted_card_ids: [], status: 'active', created_at: '2026-11-13T10:00:00Z' },
    { id: 'l3', seller_id: 's3', seller_username: 'sebastian', card_id: 'DC-001', listing_type: 'trade', price_credits: null, wanted_card_ids: ['RL-001', 'PT-002', 'MO-002'], status: 'active', created_at: '2026-11-14T10:00:00Z' },
  ],
  tournaments: [
    { id: 't1', name: 'Verona Open', format: 'single_elimination', max_players: 8, status: 'registration', starts_at: '2026-12-01T18:00:00Z', created_at: '2026-11-01T00:00:00Z', entry_count: 5 },
    { id: 't2', name: 'كأس إلسينور', format: 'round_robin', max_players: 1000, status: 'in_progress', starts_at: '2026-11-15T18:00:00Z', created_at: '2026-11-01T00:00:00Z', entry_count: 1000 },
    { id: 't3', name: 'Globe 2026', format: 'single_elimination', max_players: 4, status: 'completed', starts_at: '2026-10-01T18:00:00Z', created_at: '2026-09-01T00:00:00Z', entry_count: 4 },
  ],
  bracket: [
    { id: 'm1', round: 1, match_order: 1, player1_id: 'p1', player1_name: 'viola', player2_id: 'p2', player2_name: 'sebastian', winner_id: 'p1', status: 'completed', room_id: null },
    { id: 'm2', round: 1, match_order: 2, player1_id: 'p3', player1_name: 'أوليفيا', player2_id: null, player2_name: null, winner_id: 'p3', status: 'completed', room_id: null },
    { id: 'm3', round: 2, match_order: 1, player1_id: 'p1', player1_name: 'viola', player2_id: 'p3', player2_name: 'أوليفيا', winner_id: null, status: 'in_progress', room_id: null },
    { id: 'm4', round: 3, match_order: 1, player1_id: null, player1_name: null, player2_id: null, player2_name: null, winner_id: null, status: 'pending', room_id: null },
  ],
  leaderboard: [
    { user_id: 'p1', username: 'viola', wins: 2, losses: 0, eliminated: false },
    { user_id: 'p3', username: 'أوليفيا', wins: 1, losses: 0, eliminated: false },
    { user_id: 'p2', username: 'sebastian', wins: 0, losses: 1, eliminated: true },
  ],
  season: {
    season: { id: 2, name: 'Midsummer', start_date: '2026-11-01', end_date: '2026-12-31', max_level: 30 },
    xp: 1250,
    level: 3,
    xp_to_next: 150,
  },
  rewards: [
    { level: 1, reward_type: 'credits', reward_value: '100', is_premium: false, claimed: true },
    { level: 2, reward_type: 'pack', reward_value: 'Globe', is_premium: false, claimed: false },
    { level: 3, reward_type: 'title', reward_value: 'Bard', is_premium: true, claimed: false },
    { level: 5, reward_type: 'card', reward_value: 'MO-003', is_premium: false, claimed: false },
    { level: 10, reward_type: 'credits', reward_value: '2500', is_premium: true, claimed: false },
    { level: 20, reward_type: 'relic', reward_value: 'Yorick', is_premium: false, claimed: false },
  ],
};

/** Every word of the fixture data, for the test that looks for leftover English: these are data, not interface. */
export const DATA_TEXT = JSON.stringify(DATA);

const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

/**
 * Answer the API routes these pages call. Everything else (sign-in state, and so on) goes on
 * to the real API behind the dev server.
 *
 * `fail` makes every one of these routes answer as a broken server does on main today:
 * status 500 and a body that describes the database.
 */
export async function mockApi(page, { fail = false } = {}) {
  const BROKEN = { status: 500, contentType: 'text/plain', body: 'DB error: error returned from database: relation "classrooms" does not exist' };
  const routes = [
    [/\/api\/v1\/classroom$/, DATA.classrooms],
    [/\/api\/v1\/classroom\/\d+\/members$/, DATA.members],
    [/\/api\/v1\/classroom\/\d+\/assignments$/, DATA.assignments],
    [/\/api\/v1\/marketplace$/, DATA.listings],
    [/\/api\/v1\/tournaments$/, DATA.tournaments],
    [/\/api\/v1\/tournaments\/[^/]+\/bracket$/, DATA.bracket],
    [/\/api\/v1\/tournaments\/[^/]+\/leaderboard$/, DATA.leaderboard],
    [/\/api\/v1\/seasons\/current$/, DATA.season],
    [/\/api\/v1\/seasons\/rewards$/, DATA.rewards],
  ];
  for (const [pattern, body] of routes) {
    await page.route(pattern, (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      return route.fulfill(fail ? BROKEN : json(body));
    });
  }
}

/** Start the page in a language, past the age gate, as a returning visitor who chose it. */
export async function startIn(page, locale) {
  await page.addInitScript((l) => {
    localStorage.setItem('inspired-mile-age-verified', 'adult');
    localStorage.setItem('inspired-mile-locale', l);
  }, locale);
}
