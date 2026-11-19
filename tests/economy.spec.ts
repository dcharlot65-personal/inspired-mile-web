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
interface Account {
  id: string; email: string; token: string; ip: string;
  call(method: string, route: string, body?: unknown): Promise<Answer>;
  /** The same request to the email-off API (same database), which waits only a few seconds for a
   *  tournament match's second player (tests/start-backend.sh). */
  callNoEmail(method: string, route: string, body?: unknown): Promise<Answer>;
}
const API_NO_EMAIL = `http://127.0.0.1:${E2E.apiNoEmailPort}/api/v1`;

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
  const send = async (base: string, method: string, route: string, body?: unknown): Promise<Answer> => {
    const { res, text } = await raw(method, `${base}${route}`, { Cookie: `im_token=${token}`, 'CF-Connecting-IP': ip }, body);
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch { /* plain text */ }
    return { status: res.status, body: parsed, text };
  };
  return {
    id, email, token: token!, ip,
    call: (method, route, body) => send(API, method, route, body),
    callNoEmail: (method, route, body) => send(API_NO_EMAIL, method, route, body),
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

async function seat(browser: Browser, who: Account, origin: string = E2E.webOrigin): Promise<Seat> {
  // On E2E.webNoEmailOrigin the game socket reaches the email-off API (its own rooms); the two
  // APIs share one database, so the account's cookie is good on both.
  const context = await browser.newContext({ baseURL: origin });
  await context.addCookies([{ name: 'im_token', value: who.token, url: origin }]);
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
    // The seller can afford the price, so a refusal can only be the own-listing rule (the first check
    // of 2026-11-19 removed that rule and this test still passed: the seller had no credits).
    giveCredits(seller, 500);
    const listing = (await seller.call('POST', '/marketplace/list', { card_id: 'DC-002', listing_type: 'sale', price_credits: 50 })).body;
    const own = await seller.call('POST', `/marketplace/${listing.id}/buy`);
    expect(own.status, 'not your own').toBe(400);
    expect(own.text).toBe('Cannot buy your own listing');
    expect(await credits(seller)).toBe(500);
    const answers = await Promise.all([b1, b2].map((b) => b.call('POST', `/marketplace/${listing.id}/buy`)));
    expect(answers.map((a) => a.status).sort()).toEqual([200, 400]);
    expect([await credits(b1), await credits(b2)].sort()).toEqual([0, 50]);
    expect(await credits(seller)).toBe(550);
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
      // Unlocked: it can be listed again, and once that is cancelled too, fielded.
      const again = await ann.call('POST', '/marketplace/list', { card_id: 'DC-001', listing_type: 'sale', price_credits: 10 });
      expect(again.status, again.text).toBe(200);
      expect((await ann.call('POST', `/marketplace/${again.body.id}/cancel`)).status).toBe(200);
      await s.send({ type: 'join_room', room_id: room.room_id, deck, lang: 'en' });
      expect((await s.next('room_joined')).room_id).toBe(room.room_id);
    } finally {
      await s.close();
    }
  });

  test('market and referrals: adult accounts only (owner, 2026-11-19); a teen spends within its daily limit', async () => {
    const [seller, teen] = [await account(), await account('teen')];
    giveCard(seller, 'DC-003');
    giveCard(teen, 'DC-004');
    giveCredits(teen, 1000);
    const listing = (await seller.call('POST', '/marketplace/list', { card_id: 'DC-003', listing_type: 'sale', price_credits: 25 })).body;
    const code = (await seller.call('GET', '/referral')).body.code;
    expect(code).toMatch(/^[A-Z0-9]{8}$/);
    // A teen account can neither browse, buy, list nor take part in referrals.
    for (const [method, route, body] of [
      ['GET', '/marketplace', undefined],
      ['GET', `/marketplace/${listing.id}`, undefined],
      ['POST', `/marketplace/${listing.id}/buy`, undefined],
      ['POST', '/marketplace/list', { card_id: 'DC-004', listing_type: 'sale', price_credits: 10 }],
      ['GET', '/referral', undefined],
      ['POST', '/referral/redeem', { code }],
    ] as const) {
      const r = await teen.call(method, route, body);
      expect([r.status, r.text], `${method} ${route}`).toEqual([403, 'For adult accounts only']);
    }
    expect(await credits(teen)).toBe(1000);
    expect(await held(teen)).toEqual(['DC-004']);
    expect((await seller.call('GET', `/marketplace/${listing.id}`)).body.status).toBe('active');
    expect(await credits(seller), 'no referral reward came from the teen').toBe(0);
    // Its own listings it may still see (an adult account later made teen can cancel them).
    expect((await teen.call('GET', '/marketplace/my')).status).toBe(200);

    // Packs: the teen limit holds every spend to 200 credits a UTC day.
    const epic = await teen.call('POST', '/inventory/packs', { tier: 'epic' });
    expect(epic.status, epic.text).toBe(403);
    expect(epic.text).toMatch(/^Daily spending limit reached /);
    for (let i = 0; i < 4; i++) expect((await teen.call('POST', '/inventory/packs', { tier: 'standard' })).status, `pack ${i + 1}`).toBe(200);
    expect((await teen.call('POST', '/inventory/packs', { tier: 'standard' })).status, 'the fifth 50-credit pack in a day').toBe(403);
    expect(await credits(teen)).toBe(800);
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
    expect(decided.decided_by).toBe('room');
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
    // Nor does it climb the leaderboard: it counts three wins a day over one opponent.
    const later = (await (await fetch(`${API}/stats/leaderboard`)).json()) as any[];
    expect(later.find((e) => e.user_id === ann.id)).toMatchObject({ battle_wins: 3, total_battles: 4 });
  });

  test('season rewards: each player claims each level once, and the reward is granted', async () => {
    sql(`INSERT INTO seasons (name, start_date, end_date, max_level, active)
         SELECT 'E2E season', NOW() - INTERVAL '1 day', NOW() + INTERVAL '30 days', 30, TRUE
         WHERE NOT EXISTS (SELECT 1 FROM seasons WHERE active)`);
    const season = sql(`SELECT id FROM seasons WHERE active ORDER BY id LIMIT 1`);
    sql(`INSERT INTO season_rewards (season_id, level, reward_type, reward_value)
         SELECT ${season}, 1, 'credits', '100' WHERE NOT EXISTS (SELECT 1 FROM season_rewards WHERE season_id = ${season} AND level = 1)`);
    sql(`INSERT INTO season_rewards (season_id, level, reward_type, reward_value)
         SELECT ${season}, 2, 'pack', 'standard' WHERE NOT EXISTS (SELECT 1 FROM season_rewards WHERE season_id = ${season} AND level = 2)`);
    const [ann, bob] = [await account(), await account()];
    for (const who of [ann, bob]) expect((await who.call('POST', '/seasons/xp', { source: 'daily' })).status).toBe(200);
    // Until 2026-11-19 the first player to claim a level claimed it for everyone.
    const first = await ann.call('POST', '/seasons/claim/1');
    expect(first.status, first.text).toBe(200);
    const second = await bob.call('POST', '/seasons/claim/1');
    expect(second.status, `another player's claim: ${second.text}`).toBe(200);
    expect([await credits(ann), await credits(bob)]).toEqual([100, 100]);
    expect((await ann.call('POST', '/seasons/claim/1')).status, 'once per player').toBe(400);
    expect(await credits(ann)).toBe(100);
    expect(sql(`SELECT amount || ':' || source FROM credit_transactions WHERE user_id = '${ann.id}'`)).toBe('100:season_reward');
    expect(((await bob.call('GET', '/seasons/rewards')).body as any[]).find((r) => r.level === 1).claimed).toBe(true);

    // Level 2 (400 XP) is reached with capped solo XP, and its pack is opened by the server.
    expect((await ann.call('POST', '/seasons/claim/2')).status, 'not reached yet').toBe(400);
    for (let i = 0; i < 3; i++) for (const source of ['trivia', 'solo_win']) await ann.call('POST', '/seasons/xp', { source });
    const pack = await ann.call('POST', '/seasons/claim/2');
    expect(pack.status, pack.text).toBe(200);
    expect(pack.body.cards).toHaveLength(3);
    expect((await held(ann)).length).toBe(3);
  });

  test('founding credits: granted once and logged, not refilled on every visit', async () => {
    const ann = await account();
    // An account from before LAUNCH_DATE (2026-04-01 in the harness).
    sql(`UPDATE users SET created_at = '2026-01-01' WHERE id = '${ann.id}'`);
    expect((await ann.call('GET', '/auth/me')).body.founding_player).toBe(true);
    expect(await credits(ann)).toBe(500);
    // Spent since (as a purchase would): the next visit does not fill it up again.
    sql(`UPDATE player_stats SET credits = 0 WHERE user_id = '${ann.id}'`);
    await ann.call('GET', '/auth/me');
    expect(await credits(ann)).toBe(0);
    expect(sql(`SELECT string_agg(amount || ':' || source, ',') FROM credit_transactions WHERE user_id = '${ann.id}'`)).toBe('500:founding');
  });

  test('tournaments: a size or a description out of bounds is a 400', async () => {
    const ann = await account();
    const at = new Date(Date.now() + 3600000).toISOString();
    for (const body of [
      { name: 'Too small', starts_at: at, max_players: 1 },
      { name: 'Too big', starts_at: at, max_players: 100000 },
      { name: 'Long', starts_at: at, description: 'x'.repeat(1001) },
    ]) {
      const r = await ann.call('POST', '/tournaments/create', body);
      expect(r.status, `${JSON.stringify(body).slice(0, 50)}: ${r.text}`).toBe(400);
    }
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

/** A tournament's matches, as the API gives them. */
async function bracketOf(who: Account, t: string): Promise<any[]> {
  return (await who.call('GET', `/tournaments/${t}/bracket`)).body as any[];
}
const matchAt = (matches: any[], round: number, order: number) => matches.find((m) => m.round === round && m.match_order === order);

/** A tournament of these players, in this order, drawn by the scheduler a few seconds after it is made. */
async function tournament(players: Account[], format: 'single_elimination' | 'round_robin' = 'single_elimination'): Promise<string> {
  const made = await players[0].call('POST', '/tournaments/create', {
    name: `E2E ${unique()}`, format, starts_at: new Date(Date.now() + 4000).toISOString(), max_players: players.length,
  });
  expect(made.status, made.text).toBe(200);
  for (const who of players) expect((await who.call('POST', `/tournaments/${made.body.id}/register`)).status).toBe(200);
  await expect.poll(async () => (await bracketOf(players[0], made.body.id)).length, { message: 'the scheduler draws the bracket', timeout: 45000 }).toBeGreaterThan(0);
  return made.body.id;
}

/** A tournament match played in its room to a forfeit by `loser`. */
async function playMatch(browser: Browser, t: string, matchId: string, winner: Account, loser: Account) {
  const room = await winner.call('POST', `/tournaments/${t}/matches/${matchId}/room`);
  expect(room.status, room.text).toBe(200);
  await playToForfeit(browser, room.body.room_id, winner, loser);
  await expect.poll(async () => (await bracketOf(winner, t)).find((m) => m.id === matchId)?.status, { message: 'the result is stored', timeout: 15000 }).toBe('completed');
}

/** Put a tournament's matches past their time to be played. Written so that it also runs against a
 *  database without the column (before migration 021): there it changes nothing. */
function overdue(t: string) {
  sql(`DO $$ BEGIN
         IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tournament_matches' AND column_name = 'play_by') THEN
           EXECUTE format('UPDATE tournament_matches SET play_by = NOW() - INTERVAL ''1 second'' WHERE tournament_id = %L', '${t}');
         END IF;
       END $$`);
}

test.describe('the second check of 2026-11-19', () => {
  test('tournaments: a bracket of six where the two byes play first still reaches its final', async ({ browser }) => {
    test.setTimeout(Math.max(test.info().timeout, 240000));
    const p = [await account(), await account(), await account(), await account(), await account(), await account()];
    const t = await tournament(p);
    let matches = await bracketOf(p[0], t);
    // Two byes (the first two to register), two first-round matches, and the byes' round-two match at once.
    expect(matches.map((m) => `${m.round}.${m.match_order}:${m.status}`).sort()).toEqual(['1.1:bye', '1.2:bye', '1.3:pending', '1.4:pending', '2.1:pending']);
    expect([matchAt(matches, 2, 1).player1_id, matchAt(matches, 2, 1).player2_id]).toEqual([p[0].id, p[1].id]);

    // The bye pair plays before round one is over. Until the second check this was taken for the
    // final: its winner went nowhere and the real final waited for ever with one player.
    await playMatch(browser, t, matchAt(matches, 2, 1).id, p[0], p[1]);
    matches = await bracketOf(p[0], t);
    expect((await p[0].call('GET', `/tournaments/${t}`)).body.status).toBe('in_progress');
    await playMatch(browser, t, matchAt(matches, 1, 3).id, p[2], p[3]);
    await playMatch(browser, t, matchAt(await bracketOf(p[0], t), 1, 4).id, p[4], p[5]);
    await playMatch(browser, t, matchAt(await bracketOf(p[0], t), 2, 2).id, p[2], p[4]);

    const final = matchAt(await bracketOf(p[0], t), 3, 1);
    expect(final, 'the final exists').toBeDefined();
    expect([final.player1_id, final.player2_id, final.status]).toEqual([p[0].id, p[2].id, 'pending']);
    expect(final.play_by, 'its time to be played starts when both players are known').toBeTruthy();
    await playMatch(browser, t, final.id, p[2], p[0]);
    expect((await p[0].call('GET', `/tournaments/${t}`)).body.status).toBe('completed');
    const standings = (await p[0].call('GET', `/tournaments/${t}/leaderboard`)).body as any[];
    expect(standings.filter((e) => !e.eliminated).map((e) => e.user_id)).toEqual([p[2].id]);
  });

  test('tournaments: a match nobody plays is decided at its deadline, so the tournament does not stall', async () => {
    test.setTimeout(Math.max(test.info().timeout, 120000));
    // Single elimination: somebody has to go through; with nobody having come, the server draws lots.
    const [ann, bob] = [await account(), await account()];
    const t = await tournament([ann, bob]);
    const match = (await bracketOf(ann, t))[0];
    expect(match.status).toBe('pending');
    overdue(t);
    await expect.poll(async () => (await bracketOf(ann, t))[0].status, { message: 'the scheduler decides the match', timeout: 20000 }).toBe('completed');
    const decided = (await bracketOf(ann, t))[0];
    expect(decided.decided_by).toBe('lot');
    expect([ann.id, bob.id]).toContain(decided.winner_id);
    expect((await ann.call('GET', `/tournaments/${t}`)).body.status).toBe('completed');
    // The time it had: two days from the draw (economy.json tournaments.match_hours).
    expect(Date.parse(match.play_by) - Date.now(), 'two days to play it').toBeGreaterThan(47 * 3600 * 1000);

    // Round robin: a match nobody played stands unplayed, and the tournament ends.
    const [cat, dan] = [await account(), await account()];
    const rr = await tournament([cat, dan], 'round_robin');
    overdue(rr);
    await expect.poll(async () => (await bracketOf(cat, rr))[0].status, { timeout: 20000 }).toBe('completed');
    expect((await bracketOf(cat, rr))[0]).toMatchObject({ winner_id: null, decided_by: 'unplayed' });
    expect((await cat.call('GET', `/tournaments/${rr}`)).body.status).toBe('completed');
  });

  test('tournaments: a player who waited for an opponent who never came wins the match at its deadline', async ({ browser }) => {
    test.setTimeout(Math.max(test.info().timeout, 120000));
    const [ann, bob] = [await account(), await account()];
    const t = await tournament([ann, bob]);
    const match = (await bracketOf(ann, t))[0];
    // Ann opens the match's room (on the API that waits a few seconds, not four minutes) and waits
    // there. Her seat is ready first: the room's clock starts when it is opened.
    const s = await seat(browser, ann, E2E.webNoEmailOrigin);
    const room = await ann.callNoEmail('POST', `/tournaments/${t}/matches/${match.id}/room`);
    expect(room.status, room.text).toBe(200);
    try {
      await s.send({ type: 'join_room', room_id: room.body.room_id, deck: STARTER, lang: 'en' });
      await s.next('room_joined');
      expect((await s.next('error')).code, 'bob never came').toBe('opponent_absent');
    } finally {
      await s.close();
    }
    // Nothing is decided yet: bob has until the deadline.
    await expect.poll(() => sql(`SELECT (waited_1 IS NOT NULL) || '|' || (waited_2 IS NOT NULL) FROM tournament_matches WHERE id = '${match.id}'`), { timeout: 10000 })
      .toBe(match.player1_id === ann.id ? 'true|false' : 'false|true');
    expect((await bracketOf(ann, t))[0].status).toBe('pending');
    overdue(t);
    await expect.poll(async () => (await bracketOf(ann, t))[0].status, { timeout: 20000 }).toBe('completed');
    expect((await bracketOf(ann, t))[0]).toMatchObject({ winner_id: ann.id, decided_by: 'no_show' });
    expect((await ann.call('GET', `/tournaments/${t}`)).body.status).toBe('completed');
  });

  test("cards: a device's cards brought into a free account cannot be sold, so they cannot be gathered into another", async ({ browser }) => {
    const [main, alt] = [await account(), await account()];
    giveCredits(main, 100);
    // A forged device collection, taken into a throwaway account: a Legendary and an Epic.
    const imported = await alt.call('POST', '/migrate/import', { cards: ['OL-001', 'DC-001'] });
    expect(imported.status, imported.text).toBe(200);
    expect(imported.body.imported.sort()).toEqual(['DC-001', 'OL-001']);
    for (const card of ['OL-001', 'DC-001']) {
      const listed = await alt.call('POST', '/marketplace/list', { card_id: card, listing_type: 'sale', price_credits: 1 });
      expect([listed.status, listed.text], card).toEqual([400, 'Cards brought over from a device cannot be sold']);
    }
    expect(Number(sql(`SELECT COUNT(*) FROM card_listings WHERE seller_id = '${alt.id}'`))).toBe(0);
    expect(await held(main)).toEqual([]);
    // The account that brought them still holds them, and may field them itself.
    expect((await held(alt)).sort()).toEqual(['DC-001', 'OL-001']);
    const room = (await alt.call('POST', '/multiplayer/create-private')).body;
    const s = await seat(browser, alt);
    try {
      await s.send({ type: 'join_room', room_id: room.room_id, deck: ['OL-001', 'DC-001', 'SM-001'], lang: 'en' });
      expect((await s.next('room_joined')).room_id).toBe(room.room_id);
    } finally {
      await s.close();
    }
    // They earn no account achievement: with them the account would hold five different cards.
    const achieved = ((await alt.call('GET', '/stats/achievements')).body as any[]).map((a) => a.achievement_id);
    expect(achieved).not.toContain('card-collector');
    expect((await alt.call('GET', '/stats')).body.unique_cards, 'they are held all the same').toBe(5);
  });

  test('market: the last copy of a card seated in a room cannot be listed until its match is over', async ({ browser }) => {
    const [ann, bob] = [await account(), await account()];
    giveCard(ann, 'DC-001');
    const deck = ['DC-001', 'MO-001', 'CA-001'];
    const room = (await ann.call('POST', '/multiplayer/create-private')).body;
    const a = await seat(browser, ann);
    const b = await seat(browser, bob);
    try {
      await a.send({ type: 'join_room', room_id: room.room_id, deck, lang: 'en' });
      await a.next('room_joined');
      // Seated, waiting for a friend: the card may still take the stage.
      const listed = await ann.call('POST', '/marketplace/list', { card_id: 'DC-001', listing_type: 'sale', price_credits: 10 });
      expect([listed.status, listed.text]).toEqual([409, 'This card is in a match']);
      await b.send({ type: 'join_room', room_id: room.room_id, deck: STARTER, lang: 'en' });
      await a.next('match_start');
      expect((await ann.call('POST', '/marketplace/list', { card_id: 'DC-001', listing_type: 'sale', price_credits: 10 })).status, 'playing').toBe(409);
      await a.send({ type: 'forfeit' });
      await b.next('match_complete');
    } finally {
      await a.close();
      await b.close();
    }
    const after = await ann.call('POST', '/marketplace/list', { card_id: 'DC-001', listing_type: 'sale', price_credits: 10 });
    expect(after.status, `the match is over: ${after.text}`).toBe(200);
  });
});

test.describe('the pages keep to the server', () => {
  test('signed in, the playground opens packs on the server and shows the balance; nothing goes into the device', async ({ browser }) => {
    const ann = await account();
    giveCredits(ann, 60);
    const user = (await ann.call('GET', '/auth/me')).body.user;
    const context = await browser.newContext({
      baseURL: E2E.webOrigin,
      storageState: { cookies: [], origins: [{ origin: E2E.webOrigin, localStorage: [
        { name: 'inspired-mile-age-verified', value: 'adult' },
        { name: 'inspired-mile-onboarding-done', value: '1' },
        // What the page keeps after a sign-in (src/lib/storage-backend.ts).
        { name: 'inspired-mile-storage-mode', value: 'server' },
        { name: 'inspired-mile-user', value: JSON.stringify(user) },
        // Today's daily bonus already asked for on this device, so the balance stays what the test set.
        { name: 'inspired-mile-daily-bonus', value: `${user.id}:${new Date().toISOString().slice(0, 10)}` },
      ] }] },
    });
    await context.addCookies([{ name: 'im_token', value: ann.token, url: E2E.webOrigin }]);
    try {
      const page = await context.newPage();
      await page.goto('/playground');
      await expect(page.locator('#stat-credits')).toHaveText('60');
      await expect(page.locator('#buy-packs')).toBeVisible();
      await expect(page.locator('#starter-badge')).toHaveAttribute('data-i18n', 'pg.free');

      await page.click('#starter-pack-btn');
      await expect(page.locator('#reveal-modal')).toBeVisible();
      await expect(page.locator('#reveal-cards > *')).toHaveCount(3);
      expect((await held(ann)).length, 'the server opened the starter pack').toBe(3);
      await page.click('#reveal-close');
      await expect(page.locator('#starter-badge')).toHaveAttribute('data-i18n', 'pg.claimed');

      await page.click('.buy-pack-btn[data-tier="standard"]');
      await expect(page.locator('#reveal-cards > *')).toHaveCount(3);
      await expect(page.locator('#stat-credits')).toHaveText('10');
      expect((await held(ann)).length).toBe(6);
      expect(await credits(ann)).toBe(10);
      await page.click('#reveal-close');
      // Ten credits do not buy a 50-credit pack: the server says so, and nothing changes.
      await page.click('.buy-pack-btn[data-tier="standard"]');
      await expect(page.locator('#achievement-toasts')).toContainText('You do not have enough credits.');
      expect((await held(ann)).length).toBe(6);

      // The device's own collection was not touched.
      const device = await page.evaluate(() => JSON.parse(localStorage.getItem('inspired-mile-inventory') ?? '{"cards":[]}').cards.length);
      expect(device).toBe(0);
    } finally {
      await context.close();
    }
  });
});

test.describe('the pages keep to the server (second check)', () => {
  /** A browser signed in as this account, past the age gate as `gate`. */
  async function signedIn(browser: Browser, who: Account, gate: string) {
    const user = (await who.call('GET', '/auth/me')).body.user;
    const context = await browser.newContext({
      baseURL: E2E.webOrigin,
      storageState: { cookies: [], origins: [{ origin: E2E.webOrigin, localStorage: [
        { name: 'inspired-mile-age-verified', value: gate },
        { name: 'inspired-mile-onboarding-done', value: '1' },
        { name: 'inspired-mile-storage-mode', value: 'server' },
        { name: 'inspired-mile-user', value: JSON.stringify(user) },
        { name: 'inspired-mile-daily-bonus', value: `${user.id}:${new Date().toISOString().slice(0, 10)}` },
      ] }] },
    });
    await context.addCookies([{ name: 'im_token', value: who.token, url: E2E.webOrigin }]);
    return { context, user };
  }

  test('a teen account is shown no market: no link to it, and the page says it is for adults and asks the server nothing', async ({ browser }) => {
    const [adult, teen] = [await account(), await account('teen')];
    const asTeen = await signedIn(browser, teen, 'adult');
    expect(asTeen.user.age_tier, 'the server says what the account is').toBe('teen');
    try {
      const page = await asTeen.context.newPage();
      const marketCalls: string[] = [];
      page.on('request', (r) => { if (/\/api\/v1\/(marketplace|referral)/.test(r.url())) marketCalls.push(r.url()); });
      await page.goto('/');
      await expect(page.locator('#user-badge')).toBeVisible();
      // Signed in, the account's tier decides, not this browser's gate (which says adult here).
      await expect(page.locator('[data-adults-only]')).toHaveCount(3);
      for (const link of await page.locator('[data-adults-only]').all()) await expect(link).toBeHidden();
      await page.goto('/marketplace');
      await expect(page.locator('#market-adults-only')).toBeVisible();
      await expect(page.locator('#market-adults-only')).toHaveText('The market is for adult accounts only.');
      await expect(page.locator('#market-body')).toBeHidden();
      await page.waitForTimeout(500);
      expect(marketCalls).toEqual([]);
    } finally {
      await asTeen.context.close();
    }
    // The same pages for an adult account.
    const asAdult = await signedIn(browser, adult, 'adult');
    try {
      const page = await asAdult.context.newPage();
      await page.goto('/marketplace');
      await expect(page.locator('#market-body')).toBeVisible();
      await expect(page.locator('#market-adults-only')).toBeHidden();
      await expect(page.locator('#tab-sell')).toHaveText('Sell');
      await expect(page.locator('footer [data-adults-only]')).toBeVisible();
    } finally {
      await asAdult.context.close();
    }
  });

  test('the tournaments page shows how many players have registered', async ({ browser }) => {
    const ann = await account();
    const name = `E2E count ${unique()}`;
    // Far in the future, so it is listed first and nobody's scheduler starts it.
    const made = await ann.call('POST', '/tournaments/create', { name, starts_at: new Date(Date.now() + 30 * 86400000).toISOString(), max_players: 8 });
    expect(made.status, made.text).toBe(200);
    expect((await ann.call('POST', `/tournaments/${made.body.id}/register`)).status).toBe(200);
    // The list is for signed-in players (the route is a protected one).
    const asAnn = await signedIn(browser, ann, 'adult');
    try {
      const page = await asAnn.context.newPage();
      await page.goto('/tournaments');
      const row = page.locator('#tournament-list > div', { hasText: name });
      // Until 2026-11-19 the page read entry_count, which the API never sent: "Players: 0 of 8".
      await expect(row).toContainText('Players: 1 of 8');
    } finally {
      await asAnn.context.close();
    }
  });
});

function zeroStats() {
  return { battle_wins: 0, total_battles: 0, total_rounds: 0, highest_score: 0, trivia_correct: 0, trivia_perfect: 0, challenges_completed: 0, unique_cards: 0, total_cards: 0, packs_opened: 0 };
}
