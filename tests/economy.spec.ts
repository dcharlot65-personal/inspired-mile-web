import { test, expect, type Browser, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { E2E } from './e2e-env';
import { CARD_CATALOG } from '../src/lib/cards';

/**
 * The server is the authority over the economy and the rankings (owner, 2026-11-19;
 * docs/ECONOMY.md). Each test here is one way a client could mint, move or claim what it should
 * not, played against the real API on a real Postgres (tests/start-backend.sh) and read back
 * from the API and the database. Nothing is mocked.
 *
 * Every test is written against what a client can send, not against the new routes alone, so
 * this file also runs against the API as it was before (c22b035a): there each exploit test fails
 * because the exploit works (the run is recorded in docs/ECONOMY.md, "Evidence").
 */

const API = `http://127.0.0.1:${E2E.apiPort}/api/v1`;
const API_LOG = path.join(E2E.workDir, 'api.log');
const STARTER = ['SM-001', 'MO-001', 'CA-001'];

let counter = 0;
const unique = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}${++counter}`;
/** Each account its own network, so no per-network limit of one test trips another. */
function uniqueIp(): string {
  const n = () => 1 + Math.floor(Math.random() * 253);
  return `10.${n()}.${n()}.${n()}`;
}

function psqlBinary(): string {
  for (const candidate of ['/opt/homebrew/opt/postgresql@18/bin/psql', '/opt/homebrew/bin/psql', '/usr/local/bin/psql', '/usr/bin/psql']) {
    if (existsSync(candidate)) return candidate;
  }
  return 'psql';
}

/** SQL on the test database; rows come back as `|`-separated lines. Only for setting a scene and reading it back. */
function sql(statement: string): string {
  return execFileSync(
    psqlBinary(),
    ['-h', '127.0.0.1', '-p', String(E2E.pgPort), '-U', E2E.dbUser, '-d', E2E.dbName, '-At', '-v', 'ON_ERROR_STOP=1', '-c', statement],
    { encoding: 'utf8' },
  ).trim();
}

interface Answer { status: number; body: any; text: string }

/** A signed-in account, talking to the API directly (no cookie jar: it sends its own cookie). */
interface Account { id: string; email: string; token: string; ip: string; call(method: string, route: string, body?: unknown): Promise<Answer> }

function loggedCodes(email: string): string[] {
  if (!existsSync(API_LOG)) return [];
  const re = new RegExp(`DEV_EMAIL_LOG sign-in code for ${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} is (\\d{6})`, 'g');
  return [...readFileSync(API_LOG, 'utf8').matchAll(re)].map((m) => m[1]);
}

async function raw(method: string, url: string, headers: Record<string, string>, body?: unknown): Promise<{ res: Response; text: string }> {
  const res = await fetch(url, {
    method,
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { res, text: await res.text() };
}

/** A new account, created with an emailed code. */
async function account(tier: 'adult' | 'teen' = 'adult'): Promise<Account> {
  const email = `econ-${unique()}@example.test`;
  const ip = uniqueIp();
  const asked = await raw('POST', `${API}/auth/email/request`, { 'CF-Connecting-IP': ip }, { email, age_tier: tier });
  expect(asked.res.status, asked.text).toBe(200);
  const codeCookie = asked.res.headers.getSetCookie().map((c) => c.match(/^im_code=([^;]*)/)?.[1]).find(Boolean);
  let codes: string[] = [];
  await expect.poll(() => (codes = loggedCodes(email)).length, { timeout: 10000 }).toBeGreaterThan(0);
  const verified = await raw('POST', `${API}/auth/email/verify`, { 'CF-Connecting-IP': ip, ...(codeCookie ? { Cookie: `im_code=${codeCookie}` } : {}) }, { email, code: codes[codes.length - 1] });
  expect(verified.res.status, verified.text).toBe(200);
  const token = verified.res.headers.getSetCookie().map((c) => c.match(/^im_token=([^;]*)/)?.[1]).find(Boolean);
  expect(token, 'the account is signed in').toBeTruthy();
  const id = JSON.parse(verified.text).user.id as string;
  return {
    id, email, token: token!, ip,
    async call(method, route, body) {
      const { res, text } = await raw(method, `${API}${route}`, { Cookie: `im_token=${token}`, 'CF-Connecting-IP': ip }, body);
      let parsed: any = null;
      try { parsed = JSON.parse(text); } catch { /* plain text */ }
      return { status: res.status, body: parsed, text };
    },
  };
}

const ok = (a: Answer) => a.status >= 200 && a.status < 300;
const credits = async (who: Account): Promise<number> => (await who.call('GET', '/credits')).body.credits;
const held = async (who: Account): Promise<string[]> => ((await who.call('GET', '/inventory')).body as Array<{ card_id: string }>).map((c) => c.card_id);
/** Put a card in an account's server collection, as if the server had given it. */
const giveCard = (who: Account, cardId: string) => sql(`INSERT INTO owned_cards (user_id, card_id, source) VALUES ('${who.id}', '${cardId}', 'e2e')`);
const giveCredits = (who: Account, n: number) => sql(`UPDATE player_stats SET credits = ${n} WHERE user_id = '${who.id}'`);

/** A seat at the table: a browser page on the site's origin with this account's cookie, and its game socket. */
interface Seat { page: Page; close(): Promise<void>; send(m: unknown): Promise<void>; next(type: string, count?: number): Promise<any> }

async function seat(browser: Browser, who: Account): Promise<Seat> {
  const context = await browser.newContext({ baseURL: E2E.webOrigin });
  await context.addCookies([{ name: 'im_token', value: who.token, url: E2E.webOrigin }]);
  const page = await context.newPage();
  await page.goto('/manifest.json');
  const opened = await page.evaluate(() => new Promise<boolean>((resolve) => {
    const w = window as unknown as { mp: { ws: WebSocket; got: unknown[] } };
    const ws = new WebSocket(`${location.origin.replace(/^http/, 'ws')}/api/v1/multiplayer/ws`);
    w.mp = { ws, got: [] };
    ws.onmessage = (m) => w.mp.got.push(JSON.parse(m.data));
    ws.onopen = () => resolve(true);
    ws.onclose = () => resolve(false);
  }));
  expect(opened, 'the game socket opens').toBe(true);
  return {
    page,
    close: () => context.close(),
    send: (m) => page.evaluate((msg) => (window as unknown as { mp: { ws: WebSocket } }).mp.ws.send(JSON.stringify(msg)), m),
    async next(type, count = 1) {
      let found: any[] = [];
      await expect.poll(async () => {
        found = (await page.evaluate(() => (window as unknown as { mp: { got: any[] } }).mp.got)).filter((e) => e.type === type);
        return found.length;
      }, { message: `waiting for ${type}`, timeout: 15000 }).toBeGreaterThanOrEqual(count);
      return found[count - 1];
    },
  };
}

/** A match between two accounts in a room, ended at once by `loser` forfeiting. */
async function playToForfeit(browser: Browser, roomId: string, winner: Account, loser: Account) {
  const [w, l] = [await seat(browser, winner), await seat(browser, loser)];
  try {
    await w.send({ type: 'join_room', room_id: roomId, deck: STARTER, lang: 'en' });
    await l.send({ type: 'join_room', room_id: roomId, deck: STARTER, lang: 'en' });
    await w.next('match_start');
    await l.next('match_start');
    await l.send({ type: 'forfeit' });
    expect((await w.next('match_complete')).winner).toBe('you');
  } finally {
    await w.close();
    await l.close();
  }
}

test.describe('the server is the authority over the economy and the rankings', () => {
  test('credits: a client cannot name its amount; each solo source pays a fixed amount up to its daily cap', async () => {
    const ann = await account();
    const named = await ann.call('POST', '/credits/earn', { source: 'trivia', amount: 1000 });
    expect(named.status, named.text).toBe(400);
    expect(await credits(ann), 'naming an amount earned nothing').toBe(0);

    const paid: number[] = [];
    for (let i = 0; i < 4; i++) {
      const r = await ann.call('POST', '/credits/earn', { source: 'trivia' });
      expect(r.status, r.text).toBe(200);
      paid.push(r.body.granted);
    }
    expect(paid, 'trivia pays 30, three times a day').toEqual([30, 30, 30, 0]);
    expect(await credits(ann)).toBe(90);
    expect((await ann.call('POST', '/credits/earn', { source: 'jackpot' })).status, 'a source the server does not know').toBe(400);

    // Credits are spent only on what the server sells at its own price.
    const spent = await ann.call('POST', '/credits/spend', { amount: 1, reason: 'anything' });
    expect(ok(spent), `spend answered ${spent.status}`).toBe(false);
    expect(await credits(ann)).toBe(90);
    expect(sql(`SELECT string_agg(amount || ':' || source, ',' ORDER BY id) FROM credit_transactions WHERE user_id = '${ann.id}'`)).toBe('30:trivia,30:trivia,30:trivia');
  });

  test('credits: requests sent at once cannot pass a daily cap together', async () => {
    const ann = await account();
    const answers = await Promise.all(Array.from({ length: 12 }, () => ann.call('POST', '/credits/earn', { source: 'trivia' })));
    expect(answers.every((a) => a.status === 200), answers.map((a) => a.status).join(',')).toBe(true);
    expect(await credits(ann), 'three trivia rounds a day pay, however many arrive at once').toBe(90);
    expect(Number(sql(`SELECT COUNT(*) FROM credit_transactions WHERE user_id = '${ann.id}'`))).toBe(3);
  });

  test('season XP: a client cannot name its amount; solo XP is capped too', async () => {
    sql(`INSERT INTO seasons (name, start_date, end_date, max_level, active)
         SELECT 'E2E season', NOW() - INTERVAL '1 day', NOW() + INTERVAL '30 days', 30, TRUE
         WHERE NOT EXISTS (SELECT 1 FROM seasons WHERE active)`);
    const ann = await account();
    const named = await ann.call('POST', '/seasons/xp', { source: 'trivia', amount: 1000 });
    expect(named.status, named.text).toBe(400);
    let xp = 0;
    for (let i = 0; i < 4; i++) {
      const r = await ann.call('POST', '/seasons/xp', { source: 'trivia' });
      expect(r.status, r.text).toBe(200);
      xp = r.body.xp;
    }
    expect(xp, 'trivia pays 50 XP, three times a day').toBe(150);
  });

  test('stats: a client cannot raise its record, and solo numbers never reach the public leaderboard', async () => {
    const ann = await account();
    const raised = await ann.call('POST', '/stats', { battle_wins: 999999, total_battles: 999999, highest_score: 999999 });
    expect(ok(raised), `POST /stats answered ${raised.status}`).toBe(false);
    const board = (await (await fetch(`${API}/stats/leaderboard`)).json()) as Array<{ user_id: string }>;
    expect(board.some((e) => e.user_id === ann.id), 'the account is not on the leaderboard').toBe(false);
  });

  test('achievements: naming one unlocks nothing; the account holds only what the server can verify', async () => {
    const ann = await account();
    const claimed = await ann.call('POST', '/stats/achievements', { achievement_ids: ['completionist', 'legend-50-wins', 'scholar'] });
    expect(ok(claimed), `claiming answered ${claimed.status}`).toBe(false);
    const mine = ((await ann.call('GET', '/stats/achievements')).body as Array<{ achievement_id: string }>).map((a) => a.achievement_id);
    for (const id of ['completionist', 'legend-50-wins', 'scholar']) expect(mine).not.toContain(id);
  });

  test('cards: a client cannot add a card, and a long card id or source is a 400, never a 500', async () => {
    const ann = await account();
    const added = await ann.call('POST', '/inventory/add', { card_id: 'OL-001', source: 'e2e' });
    expect(ok(added), `adding answered ${added.status}`).toBe(false);
    expect(await held(ann)).not.toContain('OL-001');

    const longId = 'ABCDEFGHIJKLMNOPQRS'; // 19: past owned_cards.card_id (16)
    const longSource = 's'.repeat(40); // past owned_cards.source (32)
    for (const [route, body] of [
      ['/inventory/add', { card_id: longId, source: 'e2e' }],
      ['/inventory/add', { card_id: 'DC-001', source: longSource }],
      ['/migrate/sync', { cards: [{ card_id: longId, acquired_at: null, source: longSource }], stats: zeroStats(), achievements: [] }],
    ] as const) {
      const r = await ann.call('POST', route, body);
      expect(r.status, `${route} ${JSON.stringify(body).slice(0, 60)}`).not.toBe(500);
      expect(ok(r), `${route} took it`).toBe(false);
    }
    for (const [route, body] of [
      ['/migrate/import', { cards: [longId] }],
      ['/marketplace/list', { card_id: 'X'.repeat(20), listing_type: 'sale', price_credits: 10 }],
    ] as const) {
      const r = await ann.call('POST', route, body);
      expect(r.status, `${route}: ${r.text}`).toBe(400);
    }
  });

  test("cards: a device's collection comes over once, capped, the rarest first", async () => {
    const ann = await account();
    const everything = CARD_CATALOG.map((c) => c.id);
    // The old upload: every card, as often as asked.
    const copied = await ann.call('POST', '/migrate/sync', {
      cards: everything.map((card_id) => ({ card_id, acquired_at: null, source: 'migration' })),
      stats: zeroStats(), achievements: [],
    });
    expect(ok(copied), `the old upload answered ${copied.status}`).toBe(false);
    expect(await held(ann), 'nothing came over that way').toEqual([]);

    const imported = await ann.call('POST', '/migrate/import', { cards: [...everything, ...everything] });
    expect(imported.status, imported.text).toBe(200);
    const take: string[] = imported.body.imported;
    const rarity = (id: string) => CARD_CATALOG.find((c) => c.id === id)!.rarity;
    expect(take.length).toBe(20);
    expect(take.filter((id) => rarity(id) === 'Legendary').length).toBeLessThanOrEqual(1);
    expect(take.filter((id) => rarity(id) === 'Epic').length).toBeLessThanOrEqual(2);
    expect(take.filter((id) => rarity(id) === 'Rare').length).toBeLessThanOrEqual(5);
    expect(take.some((id) => STARTER.includes(id)), 'starter characters are held already').toBe(false);
    expect((await held(ann)).sort()).toEqual([...take].sort());

    const again = await ann.call('POST', '/migrate/import', { cards: everything });
    expect(again.status, again.text).toBe(409);
    expect((await held(ann)).length).toBe(20);
    expect((await ann.call('GET', '/migrate/status')).body.migrated).toBe(true);
  });

  test('online: an account cannot field a character it does not hold', async ({ browser }) => {
    const ann = await account();
    // Every way a client once had of putting Hamlet in its own record.
    await ann.call('POST', '/inventory/add', { card_id: 'DC-001', source: 'e2e' });
    await ann.call('POST', '/migrate/sync', { cards: [{ card_id: 'DC-001', acquired_at: null, source: 'e2e' }], stats: zeroStats(), achievements: [] });
    const room = await ann.call('POST', '/multiplayer/create-private');
    expect(room.status, room.text).toBe(200);
    const s = await seat(browser, ann);
    try {
      await s.send({ type: 'join_room', room_id: room.body.room_id, deck: ['DC-001', 'MO-001', 'CA-001'], lang: 'en' });
      expect((await s.next('error')).code).toBe('card_not_held');
    } finally {
      await s.close();
    }
  });

  test('packs: the server opens them at its own price, and the free ones are once', async () => {
    const ann = await account();
    expect((await ann.call('POST', '/inventory/packs', { tier: 'standard', price: 1 })).status, 'a client cannot name the price').toBe(400);
    const broke = await ann.call('POST', '/inventory/packs', { tier: 'standard' });
    expect(broke.status, broke.text).toBe(400);
    expect(broke.text).toBe('Insufficient credits');
    expect((await ann.call('POST', '/inventory/packs', { tier: 'platinum' })).status).toBe(400);

    for (let i = 0; i < 3; i++) await ann.call('POST', '/credits/earn', { source: 'solo_win' });
    const bought = await ann.call('POST', '/inventory/packs', { tier: 'rare' });
    expect(bought.status, bought.text).toBe(200);
    expect(bought.body.cards).toHaveLength(5);
    expect(['Rare', 'Epic', 'Legendary']).toContain(CARD_CATALOG.find((c) => c.id === bought.body.cards[0].card_id)!.rarity);
    expect(bought.body.credits).toBe(0);
    expect(sql(`SELECT amount || ':' || source FROM credit_transactions WHERE user_id = '${ann.id}' AND direction = 'spend'`)).toBe('150:pack_rare');

    const starter = await ann.call('POST', '/inventory/claim', { kind: 'starter' });
    expect(starter.status, starter.text).toBe(200);
    expect(starter.body.cards).toHaveLength(3);
    expect((await ann.call('POST', '/inventory/claim', { kind: 'starter' })).status, 'the starter pack is once').toBe(409);
    expect((await ann.call('POST', '/inventory/claim', { kind: 'daily' })).body.cards).toHaveLength(1);
    expect((await ann.call('POST', '/inventory/claim', { kind: 'daily' })).status, 'the daily pack is once a day').toBe(409);
    const status = (await ann.call('GET', '/inventory/status')).body;
    expect([status.starter_claimed, status.daily_available]).toEqual([true, false]);
    expect((await held(ann)).length).toBe(5 + 3 + 1);
    expect(Number(sql(`SELECT packs_opened FROM player_stats WHERE user_id = '${ann.id}'`))).toBe(3);
  });

  test('market: a purchase moves the credits and the card', async () => {
    const [seller, buyer] = [await account(), await account()];
    giveCard(seller, 'DC-001');
    giveCredits(buyer, 100);
    const listing = await seller.call('POST', '/marketplace/list', { card_id: 'DC-001', listing_type: 'sale', price_credits: 40 });
    expect(listing.status, listing.text).toBe(200);
    // One copy, one listing: it is locked to the first.
    const twice = await seller.call('POST', '/marketplace/list', { card_id: 'DC-001', listing_type: 'sale', price_credits: 30 });
    expect(twice.status, `a second listing of one card: ${twice.text}`).toBe(400);

    const bought = await buyer.call('POST', `/marketplace/${listing.body.id}/buy`);
    expect(bought.status, bought.text).toBe(200);
    expect(await credits(buyer), 'the buyer paid').toBe(60);
    expect(await credits(seller), 'the seller was paid').toBe(40);
    expect(await held(seller), 'the seller no longer holds the card').not.toContain('DC-001');
    expect(await held(buyer)).toEqual(['DC-001']);
    expect(sql(`SELECT string_agg(direction || ':' || amount || ':' || source, ',') FROM credit_transactions WHERE user_id IN ('${buyer.id}', '${seller.id}')`).split(',').sort())
      .toEqual(['earn:40:market_sale', 'spend:40:market_buy']);

    const again = await buyer.call('POST', `/marketplace/${listing.body.id}/buy`);
    expect(again.status, again.text).toBe(400);
    expect(await credits(buyer)).toBe(60);
    // A trade listing (a card for cards) is not offered: nothing would move the buyer's card.
    giveCard(seller, 'MO-002');
    expect((await seller.call('POST', '/marketplace/list', { card_id: 'MO-002', listing_type: 'trade', wanted_card_ids: ['DC-001'] })).status).toBe(400);
  });

  test('market: two buyers at once: one buys, the other keeps their credits; nobody buys their own', async () => {
    const [seller, b1, b2] = [await account(), await account(), await account()];
    giveCard(seller, 'DC-002');
    giveCredits(b1, 50);
    giveCredits(b2, 50);
    const listing = (await seller.call('POST', '/marketplace/list', { card_id: 'DC-002', listing_type: 'sale', price_credits: 50 })).body;
    expect((await seller.call('POST', `/marketplace/${listing.id}/buy`)).status, 'not your own').toBe(400);
    const answers = await Promise.all([b1, b2].map((b) => b.call('POST', `/marketplace/${listing.id}/buy`)));
    expect(answers.map((a) => a.status).sort()).toEqual([200, 400]);
    expect([await credits(b1), await credits(b2)].sort()).toEqual([0, 50]);
    expect(await credits(seller)).toBe(50);
    expect([...(await held(b1)), ...(await held(b2))]).toEqual(['DC-002']);
  });

  test('market: a listed card is locked: it cannot take the stage online; a cancel unlocks it', async ({ browser }) => {
    const ann = await account();
    giveCard(ann, 'DC-001');
    const listing = (await ann.call('POST', '/marketplace/list', { card_id: 'DC-001', listing_type: 'sale', price_credits: 10 })).body;
    const deck = ['DC-001', 'MO-001', 'CA-001'];
    const room = (await ann.call('POST', '/multiplayer/create-private')).body;
    const s = await seat(browser, ann);
    try {
      await s.send({ type: 'join_room', room_id: room.room_id, deck, lang: 'en' });
      expect((await s.next('error')).code, 'a card on sale cannot be fielded').toBe('card_not_held');
      expect((await ann.call('POST', `/marketplace/${listing.id}/cancel`)).status).toBe(200);
      await s.send({ type: 'join_room', room_id: room.room_id, deck, lang: 'en' });
      expect((await s.next('room_joined')).room_id).toBe(room.room_id);
    } finally {
      await s.close();
    }
    // And it can be listed again.
    expect((await ann.call('POST', '/marketplace/list', { card_id: 'DC-001', listing_type: 'sale', price_credits: 10 })).status).toBe(200);
  });

  test("market: a teen's purchases stay within the daily limit", async () => {
    const [seller, teen] = [await account(), await account('teen')];
    giveCard(seller, 'DC-003');
    giveCredits(teen, 1000);
    const listing = (await seller.call('POST', '/marketplace/list', { card_id: 'DC-003', listing_type: 'sale', price_credits: 250 })).body;
    const refused = await teen.call('POST', `/marketplace/${listing.id}/buy`);
    expect(refused.status, refused.text).toBe(403);
    expect(refused.text).toMatch(/^Daily spending limit reached /);
    expect(await credits(teen)).toBe(1000);
    expect(await held(teen)).toEqual([]);
    expect((await seller.call('GET', `/marketplace/${listing.id}`)).body.status).toBe('active');
  });

  test('tournaments: no participant names the winner; the match is decided by the room the server judged', async ({ browser }) => {
    test.setTimeout(Math.max(test.info().timeout, 90000));
    const [ann, bob] = [await account(), await account()];
    const made = await ann.call('POST', '/tournaments/create', { name: `E2E ${unique()}`, starts_at: new Date(Date.now() + 4000).toISOString(), max_players: 2 });
    expect(made.status, made.text).toBe(200);
    const t = made.body.id as string;
    for (const who of [ann, bob]) expect((await who.call('POST', `/tournaments/${t}/register`)).status).toBe(200);
    let match: any;
    await expect.poll(async () => {
      match = ((await ann.call('GET', `/tournaments/${t}/bracket`)).body as any[])[0];
      return match?.status;
    }, { message: 'the scheduler draws the bracket', timeout: 45000 }).toBe('pending');

    // Either player naming a winner decides nothing.
    const named = await ann.call('POST', `/tournaments/${t}/matches/${match.id}/complete`, { winner_id: ann.id });
    expect(ok(named), `naming the winner answered ${named.status}`).toBe(false);
    expect(((await ann.call('GET', `/tournaments/${t}/bracket`)).body as any[])[0].winner_id).toBeNull();
    // Nor does pointing the match at a room id of one's choosing (until 2026-11-19 a database error).
    const pointed = await ann.call('POST', `/tournaments/${t}/matches/${match.id}/complete`, { winner_id: ann.id, battle_room_id: crypto.randomUUID() });
    expect(pointed.status, 'never a 500').not.toBe(500);
    expect(ok(pointed)).toBe(false);

    // The match's room: the same for both players.
    const roomA = await ann.call('POST', `/tournaments/${t}/matches/${match.id}/room`);
    expect(roomA.status, roomA.text).toBe(200);
    const roomB = await bob.call('POST', `/tournaments/${t}/matches/${match.id}/room`);
    expect(roomB.body.room_id).toBe(roomA.body.room_id);
    const stranger = await account();
    expect((await stranger.call('POST', `/tournaments/${t}/matches/${match.id}/room`)).status).toBe(403);

    await playToForfeit(browser, roomA.body.room_id, bob, ann);
    await expect.poll(async () => ((await ann.call('GET', `/tournaments/${t}/bracket`)).body as any[])[0].status, { timeout: 15000 }).toBe('completed');
    const decided = ((await ann.call('GET', `/tournaments/${t}/bracket`)).body as any[])[0];
    expect(decided.winner_id).toBe(bob.id);
    expect(decided.room_id, 'the match points at the stored result').toBe(roomA.body.room_id);
    expect(sql(`SELECT winner_id || '|' || end_reason FROM battle_rooms WHERE id = '${roomA.body.room_id}'`)).toBe(`${bob.id}|forfeit`);
    expect((await ann.call('GET', `/tournaments/${t}`)).body.status).toBe('completed');
    const standings = (await ann.call('GET', `/tournaments/${t}/leaderboard`)).body as any[];
    expect(standings.find((e) => e.user_id === bob.id)).toMatchObject({ wins: 1, losses: 0, eliminated: false });
    expect(standings.find((e) => e.user_id === ann.id)).toMatchObject({ wins: 0, losses: 1, eliminated: true });
  });

  test('rankings: a match the server judged is stored; a win is a match; it is the leaderboard and pays within caps', async ({ browser }) => {
    const [ann, bob] = [await account(), await account()];
    const room = (await ann.call('POST', '/multiplayer/create-private')).body;
    await playToForfeit(browser, room.room_id, ann, bob);
    await expect.poll(async () => (await ann.call('GET', '/stats')).body?.online?.wins, { message: 'the result is stored', timeout: 15000 }).toBe(1);
    expect((await ann.call('GET', '/stats')).body.online).toMatchObject({ wins: 1, losses: 0, draws: 0, matches: 1 });
    expect((await bob.call('GET', '/stats')).body.online).toMatchObject({ wins: 0, losses: 1, matches: 1 });
    expect(sql(`SELECT COUNT(*) FROM battle_rooms WHERE id = '${room.room_id}' AND state = 'completed'`)).toBe('1');

    const board = (await (await fetch(`${API}/stats/leaderboard`)).json()) as any[];
    expect(board.find((e) => e.user_id === ann.id)).toMatchObject({ battle_wins: 1, total_battles: 1 });
    expect(board.some((e) => e.user_id === bob.id), 'no win, no place').toBe(false);

    const achieved = async (who: typeof ann) => ((await who.call('GET', '/stats/achievements')).body as any[]).map((a) => a.achievement_id);
    expect(await achieved(ann)).toEqual(expect.arrayContaining(['first-blood', 'opening-act']));
    expect(await achieved(bob)).toContain('opening-act');
    expect(await achieved(bob)).not.toContain('first-blood');
    expect(await credits(ann), 'an online win pays 50').toBe(50);
    expect(await credits(bob)).toBe(0);

    // A pair trading wins is paid for three a day.
    for (let i = 0; i < 3; i++) {
      const r = (await ann.call('POST', '/multiplayer/create-private')).body;
      await playToForfeit(browser, r.room_id, ann, bob);
    }
    await expect.poll(async () => (await ann.call('GET', '/stats')).body.online.wins, { timeout: 15000 }).toBe(4);
    expect(await credits(ann), 'the fourth win over one opponent in a day pays nothing').toBe(150);
  });

  test('referral: the answer promises nothing the server does not give, and the reward is logged', async () => {
    const [ref, friend] = [await account(), await account()];
    const code = (await ref.call('GET', '/referral')).body.code;
    const redeemed = await friend.call('POST', '/referral/redeem', { code });
    expect(redeemed.status, redeemed.text).toBe(200);
    expect(redeemed.body.message).not.toMatch(/pack/i);
    expect(redeemed.body.packs_granted).toBe(0);
    expect(redeemed.body.referrer_credits).toBe(100);
    expect(await credits(ref)).toBe(100);
    expect(await credits(friend)).toBe(0);
    expect(sql(`SELECT amount || ':' || source FROM credit_transactions WHERE user_id = '${ref.id}'`)).toBe('100:referral');
  });
});

function zeroStats() {
  return { battle_wins: 0, total_battles: 0, total_rounds: 0, highest_score: 0, trivia_correct: 0, trivia_perfect: 0, challenges_completed: 0, unique_cards: 0, total_cards: 0, packs_opened: 0 };
}
