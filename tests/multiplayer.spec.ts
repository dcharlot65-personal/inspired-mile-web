import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { E2E } from './e2e-env';
import { auditRound, type MatchStart, type RoundView, type ServerEvent } from '../src/lib/multiplayer-client';
import PRON from '../src/lib/verse/pron-en';
import { installPronunciation } from '../src/lib/verse/pronounce';
import { isStopWord, wordSpan, wordsOf } from '../src/lib/verse/text';

// This process recomputes each round with the TypeScript rules, as the page does; like the
// page, and like the server, it needs the pronunciation table for that.
installPronunciation(PRON);

/**
 * Online play, end to end: two browsers, each signed in with its own passkey on the real
 * API and a real Postgres (tests/start-backend.sh), play a whole match over the real
 * WebSocket.
 *
 * What is held to account:
 *   - the server's scores are the same for both players (each sees the other's mirrored);
 *   - they equal what the page showed the player before submitting (the live craft);
 *   - they equal the TypeScript rules, recomputed here in the test process from the
 *     frames the server sent (auditRound), not only by the page;
 *   - the page shows the server's numbers, read off the WebSocket frames;
 *   - nothing either browser sent contains a score.
 *
 * Nothing is mocked.
 */

const AGE_KEY = 'inspired-mile-age-verified';

function uniqueIp(): string {
  const n = () => 1 + Math.floor(Math.random() * 253);
  return `10.${n()}.${n()}.${n()}`;
}

/** Verses that keep each form, so the scores are not all nought. */
const KEEPS: Record<string, string> = {
  // A rhyme English spelling hides (go / flow): kept only where rhyme is decided by sound.
  couplet: 'I do not know which way to go\nThe river runs, the waters flow',
  'quatrain-aabb': 'The silver moon is bright\nIt fills the empty night\nUpon the restless sea\nIt calls again to me',
  'quatrain-abab': 'The silver moon is bright\nUpon the restless sea\nIt fills the empty night\nAnd calls again to me',
  tercet: 'I take the midnight stage\nThe crowd is loud tonight\nI feed my rising rage',
  anaphora: 'Never fear the gathering dark\nNever yield the golden crown\nNever kneel to passing fools',
  crescendo: 'I rise\nI rise again\nI rise again and louder still tonight',
  haiku: 'An old silent pond\nA frog jumps into the pond\nSplash silence again',
  'heroic-couplet': 'Who dares to stand upon my midnight stage\nI put the question to thy empty rage',
};

/** A line for each letter an acrostic can ask for. */
const LINE_FOR: Record<string, string> = {
  a: 'And answer every whispered doubt', b: 'Bold I come before the court', d: 'Down they fall like winter rain',
  e: 'Every candle gutters out', f: 'Fortune favours those who dare', g: 'Golden crowns are heavy things',
  i: 'In the silence I begin', k: 'Kings have fallen for a word', l: 'Lanterns swing above the stage',
  m: 'Midnight gathers at the gate', n: 'Never doubt the turning tide', o: 'Over rooftops goes the moon',
  p: 'Players whisper in the wings', r: 'Rhymes like drums begin to beat', s: 'Silver tongues can cut like steel',
  t: 'Thunder answers every boast', w: 'Winter waits behind the door', y: 'Yonder breaks the morning light',
};

function verseFor(plan: { form_id: string; acrostic: string | null }): string {
  if (plan.form_id === 'acrostic') return [...(plan.acrostic ?? '')].map((c) => LINE_FOR[c] ?? `${c.toUpperCase()}lways another line`).join('\n');
  const verse = KEEPS[plan.form_id];
  if (!verse) throw new Error(`no test verse for the form ${plan.form_id}; add one to KEEPS`);
  return verse;
}

interface Player {
  context: BrowserContext;
  page: Page;
  /** Every event the server sent this browser, oldest first. */
  received: ServerEvent[];
  /** Every message this browser sent. */
  sent: Array<Record<string, unknown>>;
}

async function newPlayer(browser: Browser, storage: Array<{ name: string; value: string }> = []): Promise<Player> {
  const context = await browser.newContext({
    baseURL: E2E.webOrigin,
    extraHTTPHeaders: { 'CF-Connecting-IP': uniqueIp() },
    storageState: { cookies: [], origins: [{ origin: E2E.webOrigin, localStorage: [{ name: AGE_KEY, value: 'adult' }, ...storage] }] },
  });
  const page = await context.newPage();
  const player: Player = { context, page, received: [], sent: [] };
  page.on('websocket', (ws) => {
    if (!ws.url().includes('/api/v1/multiplayer/ws')) return;
    ws.on('framereceived', (f) => { if (typeof f.payload === 'string') player.received.push(JSON.parse(f.payload)); });
    ws.on('framesent', (f) => {
      if (typeof f.payload !== 'string') return;
      // One test sends something that is not JSON on purpose.
      try { player.sent.push(JSON.parse(f.payload)); } catch { player.sent.push({ type: 'not-json', raw: f.payload }); }
    });
  });

  // An account with a passkey alone, as tests/auth.spec.ts creates one.
  await page.goto('/multiplayer');
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
  await page.locator('#auth-btn').click();
  await page.locator('#auth-create-btn').click();
  await expect(page.locator('#auth-step-create')).toBeVisible();
  await page.locator('#auth-create-confirm').click();
  await expect(page.locator('#auth-recovery-nudge')).toBeVisible();
  const me = await page.evaluate(async () => (await fetch('/api/v1/auth/me', { credentials: 'include' })).status);
  expect(me, 'the new account is signed in').toBe(200);
  // A fresh page: the sign-in panel is closed and the lobby knows who we are.
  await page.goto('/multiplayer');
  await expect(page.locator('#mp-signin-note')).toBeHidden();
  return player;
}

function events<T extends ServerEvent['type']>(player: Player, type: T): Array<Extract<ServerEvent, { type: T }>> {
  return player.received.filter((e): e is Extract<ServerEvent, { type: T }> => e.type === type);
}

async function waitForEvent<T extends ServerEvent['type']>(player: Player, type: T, count = 1) {
  await expect.poll(() => events(player, type).length, { message: `waiting for ${count} ${type} event(s)`, timeout: 15000 }).toBeGreaterThanOrEqual(count);
  return events(player, type)[count - 1];
}

/** The numbers the page shows for a decided round. */
async function shown(page: Page, round: number) {
  const box = page.locator(`[data-round-result="${round}"]`);
  await expect(box).toBeVisible({ timeout: 15000 });
  const n = async (name: string) => Number(await box.getAttribute(name));
  return {
    youCraft: await n('data-you-craft'), youJudge: await n('data-you-judge'), youTotal: await n('data-you-total'),
    opponentCraft: await n('data-opponent-craft'), opponentJudge: await n('data-opponent-judge'), opponentTotal: await n('data-opponent-total'),
    winner: await box.getAttribute('data-winner'), audit: await box.getAttribute('data-audit'),
  };
}

const mirrored = (w: string | null) => (w === 'you' ? 'opponent' : w === 'opponent' ? 'you' : w);

test.describe('Online duel', () => {
  test('two signed-in players play a whole match; both see the same server scores, equal to the preview', async ({ browser }) => {
    test.setTimeout(180000);
    // Bob brings a deck of his own, with two of the Verona Court (the Riposte) in it.
    const bobDeck = { name: 'E2E deck', characters: ['DC-001', 'VC-001', 'VC-002', 'UW-001'], relics: [], potions: [] };
    const ann = await newPlayer(browser);
    const bob = await newPlayer(browser, [
      { name: 'inspired-mile-decks', value: JSON.stringify([bobDeck]) },
      { name: 'inspired-mile-active-deck', value: bobDeck.name },
    ]);
    try {
      // Ann opens a room; Bob follows her link.
      await ann.page.locator('#create-private-btn').click();
      await expect(ann.page.locator('#mp-invite-link')).toHaveValue(/\/multiplayer\?room=[0-9a-f-]{36}$/);
      const link = await ann.page.locator('#mp-invite-link').inputValue();
      await bob.page.goto(link);
      await expect(bob.page.locator('#mp-deck-name')).toHaveText('E2E deck');
      await bob.page.locator('#mp-accept-btn').click();

      await expect(ann.page.locator('#mp-arena')).toBeVisible({ timeout: 15000 });
      await expect(bob.page.locator('#mp-arena')).toBeVisible({ timeout: 15000 });
      const startAnn = (await waitForEvent(ann, 'match_start')) as MatchStart;
      const startBob = (await waitForEvent(bob, 'match_start')) as MatchStart;

      // The server chose the seed and the forms, and told both the same.
      expect(startAnn.seed).toBe(startBob.seed);
      expect(startAnn.rounds).toEqual(startBob.rounds);
      expect(startAnn.rounds).toHaveLength(3);
      expect(new Set(startAnn.rounds.map((r) => r.form_id)).size).toBe(3);
      expect([startAnn.seat, startBob.seat].sort()).toEqual([0, 1]);
      expect(startBob.you.deck).toEqual(bobDeck.characters);
      expect(startAnn.opponent.deck).toEqual(bobDeck.characters);
      expect(startAnn.you.deck).toHaveLength(3);
      // Both pages scored with the pronunciation table, as the server does.
      expect(await ann.page.locator('#mp-arena').getAttribute('data-pronunciation')).toBeNull();
      expect(await bob.page.locator('#mp-arena').getAttribute('data-pronunciation')).toBeNull();
      await expect(ann.page.locator('#mp-arena')).toHaveAttribute('data-seed-check', 'ok');
      await expect(bob.page.locator('#mp-arena')).toHaveAttribute('data-seed-check', 'ok');

      const seenAnn: RoundView[] = [];
      const seenBob: RoundView[] = [];
      let anyCraft = 0;
      let round = 0;
      for (; round < 3; round++) {
        const plan = startAnn.rounds[round];
        await expect(ann.page.locator('#mp-round-label')).toHaveText(`Round ${round + 1} of 3`, { timeout: 15000 });
        await expect(bob.page.locator('#mp-round-label')).toHaveText(`Round ${round + 1} of 3`, { timeout: 15000 });

        // Ann keeps the form. Bob writes two plain lines and, from round two, throws back a
        // word of Ann's last verse (his Verona Court characters fight with the Riposte).
        const annVerse = verseFor(plan);
        // A word worth throwing back: five letters or more, and not one of the little words.
        const thrown = round > 0 ? (wordsOf(seenBob[round - 1].opponent.verse).find((w) => wordSpan(w) >= 5 && !isStopWord(w)) ?? 'nothing') : '';
        const bobVerse = round > 0 ? `Thy ${thrown} is a candle in the wind\nI hand thy ${thrown} back to thee` : 'The sun is up above the quiet hills\nThe day is here and I am glad of it';
        const annChar = startAnn.you.deck[round];
        const bobChar = bobDeck.characters[round];

        const previews: number[] = [];
        for (const [who, verse, char] of [[ann, annVerse, annChar], [bob, bobVerse, bobChar]] as const) {
          await expect(who.page.locator('#mp-send-btn')).toBeDisabled();
          await who.page.locator(`#mp-hand [data-char-id="${char}"]`).click();
          await who.page.locator('#mp-input').fill(verse);
          await expect(who.page.locator('#mp-live-checks li').first()).toHaveAttribute('data-met', /true|false/);
          previews.push(Number(await who.page.locator('#mp-live-craft').textContent()));
          await expect(who.page.locator('#mp-send-btn')).toBeEnabled();
        }
        await ann.page.locator('#mp-send-btn').click();
        await expect(ann.page.locator('#mp-hint')).toContainText('Your verse is in');
        // Bob is told Ann has submitted, and is shown nothing of her verse.
        await expect(bob.page.locator('#mp-hint')).toContainText('Your opponent has submitted');
        expect(await bob.page.locator('#mp-results').innerText()).not.toContain(annVerse.split('\n')[0]);
        await bob.page.locator('#mp-send-btn').click();

        const fromAnn = await shown(ann.page, round);
        const fromBob = await shown(bob.page, round);
        const frameAnn = (await waitForEvent(ann, 'round_result', round + 1)) as RoundView;
        const frameBob = (await waitForEvent(bob, 'round_result', round + 1)) as RoundView;

        // 1. Both players were sent the same scores, each from their own side.
        expect(frameAnn.you).toEqual(frameBob.opponent);
        expect(frameAnn.opponent).toEqual(frameBob.you);
        expect(frameAnn.winner).toBe(mirrored(frameBob.winner));
        expect(frameAnn.you.verse).toBe(annVerse);
        expect(frameBob.you.verse).toBe(bobVerse);
        expect(frameAnn.you.total).toBe(frameAnn.you.score.craft + frameAnn.you.judge);
        expect(frameAnn.you.judge + frameAnn.opponent.judge).toBe(24);

        // 2. The server's craft is the number each page showed before the verse was sent.
        expect(frameAnn.you.score.craft, `round ${round + 1}: Ann's craft, server against preview`).toBe(previews[0]);
        expect(frameBob.you.score.craft, `round ${round + 1}: Bob's craft, server against preview`).toBe(previews[1]);

        // 3. The pages show the server's numbers, not their own.
        for (const [page, frame] of [[fromAnn, frameAnn], [fromBob, frameBob]] as const) {
          expect(page).toEqual({
            youCraft: frame.you.score.craft, youJudge: frame.you.judge, youTotal: frame.you.total,
            opponentCraft: frame.opponent.score.craft, opponentJudge: frame.opponent.judge, opponentTotal: frame.opponent.total,
            winner: frame.winner, audit: 'ok',
          });
        }

        // 4. And they are exactly the rules', recomputed here from the frames alone.
        expect(auditRound(startAnn, seenAnn, frameAnn), `round ${round + 1}, Ann's seat`).toEqual([]);
        expect(auditRound(startBob, seenBob, frameBob), `round ${round + 1}, Bob's seat`).toEqual([]);

        if (round > 0) {
          // Bob's riposte answered Ann's verse from the round before, on the server as in his preview.
          expect(frameBob.you.score.device, `round ${round + 1}: Bob threw "${thrown}" back`).toEqual({ id: 'riposte', met: true });
        }

        seenAnn.push(frameAnn);
        seenBob.push(frameBob);
        anyCraft += frameAnn.you.score.craft;
        // Two rounds to one side ends a best of three.
        if (Math.max(frameAnn.rounds_won.you, frameAnn.rounds_won.opponent) >= 2) break;
      }

      // The match ends for both, the same way.
      const doneAnn = await waitForEvent(ann, 'match_complete');
      const doneBob = await waitForEvent(bob, 'match_complete');
      expect(doneAnn.winner).toBe(mirrored(doneBob.winner));
      expect(doneAnn.rounds_won).toEqual({ you: doneBob.rounds_won.opponent, opponent: doneBob.rounds_won.you });
      expect(doneAnn.totals).toEqual({ you: doneBob.totals.opponent, opponent: doneBob.totals.you });
      expect(doneAnn.totals.you).toBe(seenAnn.reduce((s, r) => s + r.you.total, 0));
      expect(['rounds', 'points']).toContain(doneAnn.reason);
      // Best of three: over once somebody has two rounds, never past three.
      expect(seenAnn.length).toBeGreaterThanOrEqual(2);
      expect(seenAnn.length).toBeLessThanOrEqual(3);
      if (seenAnn.length === 2) expect(Math.max(doneAnn.rounds_won.you, doneAnn.rounds_won.opponent)).toBe(2);
      for (const [who, done] of [[ann, doneAnn], [bob, doneBob]] as const) {
        const box = who.page.locator('#mp-match-result');
        await expect(box).toBeVisible();
        await expect(box).toHaveAttribute('data-winner', done.winner);
        await expect(box).toHaveAttribute('data-total-you', String(done.totals.you));
        await expect(box).toHaveAttribute('data-total-opponent', String(done.totals.opponent));
        await expect(who.page.locator('#mp-move-panel')).toBeHidden();
      }
      // The verses Ann wrote keep their forms: a server and a preview that both answered
      // nought to everything would have agreed with each other all the way here.
      expect(anyCraft, "Ann's craft over the match").toBeGreaterThan(0);

      // Nothing a browser sent was a score.
      for (const message of [...ann.sent, ...bob.sent]) {
        expect(['join_room', 'submit_verse']).toContain(message.type);
        const allowed = message.type === 'join_room' ? ['type', 'room_id', 'deck'] : ['type', 'round', 'char_id', 'text'];
        expect(Object.keys(message).sort()).toEqual([...allowed].sort());
      }
    } finally {
      await ann.context.close();
      await bob.context.close();
    }
  });

  test('quick match pairs two players into one room, and a forfeit ends it for both', async ({ browser }) => {
    test.setTimeout(120000);
    const ann = await newPlayer(browser);
    const bob = await newPlayer(browser);
    try {
      await ann.page.locator('#find-match-btn').click();
      await expect(ann.page.locator('#queue-status')).toBeVisible();
      await bob.page.locator('#find-match-btn').click();
      await expect(ann.page.locator('#mp-arena')).toBeVisible({ timeout: 20000 });
      await expect(bob.page.locator('#mp-arena')).toBeVisible({ timeout: 20000 });
      const startAnn = (await waitForEvent(ann, 'match_start')) as MatchStart;
      const startBob = (await waitForEvent(bob, 'match_start')) as MatchStart;
      // One room, one plan, one seat each, and each is the other's opponent.
      expect(startAnn.room_id).toBe(startBob.room_id);
      expect(startAnn.seed).toBe(startBob.seed);
      expect(startAnn.rounds).toEqual(startBob.rounds);
      expect([startAnn.seat, startBob.seat].sort()).toEqual([0, 1]);
      expect(startAnn.opponent.username).toBe(startBob.you.username);
      expect(startAnn.you.username).not.toBe(startBob.you.username);
      await expect(ann.page.locator('#mp-opponent-name')).toHaveText(startBob.you.username);

      // Bob forfeits, and says yes when asked.
      bob.page.once('dialog', (d) => void d.accept());
      await bob.page.locator('#mp-forfeit-btn').click();
      for (const [who, winner] of [[ann, 'you'], [bob, 'opponent']] as const) {
        const box = who.page.locator('#mp-match-result');
        await expect(box).toBeVisible({ timeout: 15000 });
        await expect(box).toHaveAttribute('data-winner', winner);
        await expect(box).toHaveAttribute('data-reason', 'forfeit');
        await expect(who.page.locator('#mp-move-panel')).toBeHidden();
      }
    } finally {
      await ann.context.close();
      await bob.context.close();
    }
  });

  test('the socket itself: no session no socket, a sent score is ignored, twice is refused, too big is cut off, a dropped player can return', async ({ browser }) => {
    test.setTimeout(120000);
    const ann = await newPlayer(browser);
    const bob = await newPlayer(browser);
    const stranger = await browser.newContext({ baseURL: E2E.webOrigin });
    try {
      // A page that keeps one raw connection and everything it received.
      const open = (page: Page) => page.evaluate(() => new Promise<boolean>((resolve) => {
        const w = window as unknown as { mp: { ws: WebSocket; got: unknown[]; closed: boolean } };
        const ws = new WebSocket(`${location.origin.replace(/^http/, 'ws')}/api/v1/multiplayer/ws`);
        w.mp = { ws, got: [], closed: false };
        ws.onmessage = (m) => w.mp.got.push(JSON.parse(m.data));
        ws.onopen = () => resolve(true);
        ws.onclose = () => { w.mp.closed = true; resolve(false); };
      }));
      const send = (page: Page, message: unknown) => page.evaluate((m) => (window as unknown as { mp: { ws: WebSocket } }).mp.ws.send(typeof m === 'string' ? m : JSON.stringify(m)), message);
      const got = (page: Page) => page.evaluate(() => (window as unknown as { mp: { got: ServerEvent[] } }).mp.got);
      const closed = (page: Page) => page.evaluate(() => (window as unknown as { mp: { closed: boolean } }).mp.closed);
      const next = async <T extends ServerEvent['type']>(page: Page, type: T, count = 1) => {
        let found: ServerEvent[] = [];
        await expect.poll(async () => { found = (await got(page)).filter((e) => e.type === type); return found.length; }, { message: `waiting for ${type}`, timeout: 15000 }).toBeGreaterThanOrEqual(count);
        return found[count - 1] as Extract<ServerEvent, { type: T }>;
      };

      // Not signed in: the handshake is refused.
      const outsider = await stranger.newPage();
      await outsider.goto('/about');
      expect(await open(outsider), 'a socket without a session').toBe(false);

      const room = await (await ann.context.request.post('/api/v1/multiplayer/create-private')).json();
      // Another player's rooms are not listed to Bob, and Ann's is listed to her.
      expect(await (await bob.context.request.get('/api/v1/multiplayer/rooms')).json()).toEqual([]);
      expect(await (await ann.context.request.get('/api/v1/multiplayer/rooms')).json()).toEqual([{ id: room.room_id, state: 'waiting', player_count: 1 }]);

      const deckA = ['DC-001', 'MO-001', 'CA-001'];
      const deckB = ['MO-002', 'CA-002', 'DC-002'];
      expect(await open(ann.page)).toBe(true);
      expect(await open(bob.page)).toBe(true);

      // A deck that is not three to five different characters is refused.
      await send(bob.page, { type: 'join_room', room_id: room.room_id, deck: ['DC-001', 'DC-001', 'RL-001'] });
      expect((await next(bob.page, 'error')).code).toBe('bad_deck');
      await send(ann.page, { type: 'join_room', room_id: room.room_id, deck: deckA });
      await send(bob.page, { type: 'join_room', room_id: room.room_id, deck: deckB });
      const startAnn = (await next(ann.page, 'match_start')) as MatchStart;
      const startBob = (await next(bob.page, 'match_start')) as MatchStart;
      const plan = startAnn.rounds[0];

      // Ann sends a verse with scores attached, then tries to replace it.
      const annVerse = verseFor(plan);
      await send(ann.page, { type: 'submit_verse', round: 0, char_id: 'DC-001', text: annVerse, score: 9999, craft: 9999, judge: 24, total: 9999, winner: 'you', player_wins: true });
      await next(ann.page, 'verse_accepted');
      await send(ann.page, { type: 'submit_verse', round: 0, char_id: 'MO-001', text: 'A second verse\nThat must not count' });
      expect((await next(ann.page, 'error')).code).toBe('already_submitted');

      // Bob: not JSON, a verse over the limit, a foul one, a card he does not hold. None is taken.
      await send(bob.page, 'this is not json');
      expect((await next(bob.page, 'error', 2)).code).toBe('bad_message');
      await send(bob.page, { type: 'submit_verse', round: 0, char_id: 'MO-002', text: 'ab '.repeat(700) });
      expect((await next(bob.page, 'error', 3)).code).toBe('verse_too_long');
      await send(bob.page, { type: 'submit_verse', round: 0, char_id: 'MO-002', text: 'What the fuck is this' });
      expect((await next(bob.page, 'error', 4)).code).toBe('content_rejected');
      await send(bob.page, { type: 'submit_verse', round: 0, char_id: 'DC-001', text: 'Not my card\nBut I try' });
      expect((await next(bob.page, 'error', 5)).code).toBe('not_in_deck');
      expect((await got(ann.page)).some((e) => e.type === 'round_result'), 'no round was scored from refused verses').toBe(false);

      // A message far over the size limit: the server hangs up rather than read it.
      await send(bob.page, { type: 'submit_verse', round: 0, char_id: 'MO-002', text: 'x'.repeat(100000) });
      await expect.poll(() => closed(bob.page), { message: "Bob's connection is closed", timeout: 15000 }).toBe(true);
      expect((await next(ann.page, 'opponent_disconnected')).grace_seconds).toBeGreaterThan(0);

      // Bob comes back on a new connection and is given the match as it stands.
      expect(await open(bob.page)).toBe(true);
      await send(bob.page, { type: 'join_room', room_id: room.room_id, deck: [] });
      const again = (await next(bob.page, 'match_start')) as MatchStart;
      expect({ seat: again.seat, seed: again.seed, deck: again.you.deck }).toEqual({ seat: startBob.seat, seed: startBob.seed, deck: deckB });
      const resumed = await next(bob.page, 'round_start');
      expect({ round: resumed.round, submitted: resumed.submitted, opponent_submitted: resumed.opponent_submitted }).toEqual({ round: 0, submitted: false, opponent_submitted: true });
      await next(ann.page, 'opponent_reconnected');

      const bobVerse = 'The sun is up above the quiet hills\nThe day is here and I am glad of it';
      await send(bob.page, { type: 'submit_verse', round: 0, char_id: 'MO-002', text: `  ${bobVerse.replace('\n', '​\r\n\n')}  ` });
      const resultAnn = (await next(ann.page, 'round_result')) as RoundView;
      const resultBob = (await next(bob.page, 'round_result')) as RoundView;

      // Ann's first verse was the one scored, by the rules, whatever she claimed.
      expect(resultAnn.you.verse).toBe(annVerse);
      expect(resultAnn.you.char_id).toBe('DC-001');
      expect(resultAnn.you.total).toBeLessThan(100);
      expect(resultAnn.you).toEqual(resultBob.opponent);
      // Bob's verse was cleaned before it was scored or shown.
      expect(resultBob.you.verse).toBe(bobVerse);
      expect(auditRound(startAnn, [], resultAnn)).toEqual([]);
      expect(auditRound(again, [], resultBob)).toEqual([]);

      // Ann forfeits: the match is Bob's, and both are told.
      await send(ann.page, { type: 'forfeit' });
      expect(await next(bob.page, 'match_complete')).toMatchObject({ winner: 'you', reason: 'forfeit' });
      expect(await next(ann.page, 'match_complete')).toMatchObject({ winner: 'opponent', reason: 'forfeit' });
    } finally {
      await ann.context.close();
      await bob.context.close();
      await stranger.close();
    }
  });
});
