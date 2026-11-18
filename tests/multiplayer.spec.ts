import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import http from 'node:http';
import { E2E } from './e2e-env';
import { auditRound, type MatchStart, type RoundView, type ServerEvent } from '../src/lib/multiplayer-client';
import { onlineCraft, previewCraft, type OnlineRoundPlan, type OnlineSide } from '../src/lib/multiplayer-rules';
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

/**
 * A signed-in player on the multiplayer page. `cards` are put in the account's record of its
 * cards first (the server lets an account field the starter characters and those it holds).
 */
async function newPlayer(browser: Browser, storage: Array<{ name: string; value: string }> = [], cards: string[] = []): Promise<Player> {
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
  // A loaded build host's Postgres can take several seconds over a sign-up.
  await expect(page.locator('#auth-recovery-nudge')).toBeVisible({ timeout: 20000 });
  const me = await page.evaluate(async () => (await fetch('/api/v1/auth/me', { credentials: 'include' })).status);
  expect(me, 'the new account is signed in').toBe(200);
  for (const card_id of cards) {
    const added = await context.request.post('/api/v1/inventory/add', { data: { card_id, source: 'e2e' } });
    expect(added.status(), `the account is given ${card_id}`).toBe(200);
  }
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

/**
 * The verse with a zero-width space and a combining accent pasted in somewhere, at the first
 * place where that makes the text as typed score differently from the text the page sends
 * (cleanVerse composes the accent only on a second pass). A page that previewed the textarea
 * itself, instead of the settled verse it sends, would show the wrong craft for it. Null if
 * no such place exists in this verse under this form.
 */
const PASTE = '\u200b\u0301';
function pastedVariant(plan: OnlineRoundPlan, side: Omit<OnlineSide, 'verse'>, verse: string): string | null {
  const points = Array.from(verse);
  for (let at = 1; at < points.length; at++) {
    const pasted = [...points.slice(0, at), PASTE, ...points.slice(at)].join('');
    if (onlineCraft(plan, { ...side, verse: pasted }).craft !== previewCraft(plan, { ...side, verse: pasted }).score.craft) return pasted;
  }
  return null;
}

/**
 * A page's own raw connection to the game server (one per page), and everything it received:
 * for tests about the socket itself rather than the page.
 */
const raw = {
  /** Open it; true once open, false if the server refused or closed it first. */
  open: (page: Page) => page.evaluate(() => new Promise<boolean>((resolve) => {
    const w = window as unknown as { mp: { ws: WebSocket; got: unknown[]; closed: boolean } };
    const ws = new WebSocket(`${location.origin.replace(/^http/, 'ws')}/api/v1/multiplayer/ws`);
    w.mp = { ws, got: [], closed: false };
    ws.onmessage = (m) => w.mp.got.push(JSON.parse(m.data));
    ws.onopen = () => resolve(true);
    ws.onclose = () => { w.mp.closed = true; resolve(false); };
  })),
  send: (page: Page, message: unknown) => page.evaluate((m) => (window as unknown as { mp: { ws: WebSocket } }).mp.ws.send(typeof m === 'string' ? m : JSON.stringify(m)), message),
  got: (page: Page) => page.evaluate(() => (window as unknown as { mp: { got: ServerEvent[] } }).mp.got),
  closed: (page: Page) => page.evaluate(() => (window as unknown as { mp: { closed: boolean } }).mp.closed),
  /** The `count`-th event of this type, waiting for it. */
  async next<T extends ServerEvent['type']>(page: Page, type: T, count = 1) {
    let found: ServerEvent[] = [];
    await expect.poll(async () => { found = (await raw.got(page)).filter((e) => e.type === type); return found.length; }, { message: `waiting for ${type}`, timeout: 15000 }).toBeGreaterThanOrEqual(count);
    return found[count - 1] as Extract<ServerEvent, { type: T }>;
  },
};

/** The session cookie of a player's browser, to talk to the API as that player from here. */
async function cookieOf(player: Player): Promise<string> {
  const cookie = (await player.context.cookies()).find((c) => c.name === 'im_token');
  expect(cookie, 'the player is signed in').toBeTruthy();
  return `im_token=${cookie!.value}`;
}

/**
 * A quick-match request on a connection of its own, straight to the API (`via: 'api'`) or
 * through the dev server's proxy (`'web'`), that can be dropped the way a closed tab or a lost
 * network drops it.
 */
function waitInQueue(cookie: string, ip: string, via: 'api' | 'web') {
  let answer = '';
  const req = http.request({
    host: via === 'api' ? '127.0.0.1' : 'localhost',
    port: via === 'api' ? E2E.apiPort : E2E.webPort,
    path: '/api/v1/multiplayer/queue',
    method: 'POST',
    headers: { Cookie: cookie, 'CF-Connecting-IP': ip, 'Content-Length': '0' },
  });
  req.on('response', (r) => {
    let body = '';
    r.on('data', (c) => { body += String(c); });
    r.on('end', () => { answer = `${r.statusCode} ${body}`; });
  });
  req.on('error', () => { /* dropped on purpose */ });
  req.end();
  return { answer: () => answer, drop: () => req.destroy() };
}

/**
 * Ask for a quick match straight from the API and give up after `ms`: the status, or 'still
 * waiting'. A request given up also leaves the queue, as the page's Cancel does, so it never
 * stands in the way of the next step of a test.
 */
async function askFor(cookie: string, ip: string, ms: number): Promise<string> {
  const queue = `http://127.0.0.1:${E2E.apiPort}/api/v1/multiplayer/queue`;
  const headers = { Cookie: cookie, 'CF-Connecting-IP': ip };
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), ms);
  try {
    const r = await fetch(queue, { method: 'POST', headers, signal: stop.signal });
    return `${r.status} ${(await r.json()).status}`;
  } catch {
    await fetch(queue, { method: 'DELETE', headers });
    return 'still waiting';
  } finally {
    clearTimeout(timer);
  }
}

const roomsOf = async (cookie: string, ip: string) =>
  (await fetch(`http://127.0.0.1:${E2E.apiPort}/api/v1/multiplayer/rooms`, { headers: { Cookie: cookie, 'CF-Connecting-IP': ip } })).json();

test.describe('Online duel', () => {
  test('two signed-in players play a whole match; both see the same server scores, equal to the preview', async ({ browser }) => {
    test.setTimeout(180000);
    // Bob brings a deck of his own, with two of the Verona Court (the Riposte) in it.
    const bobDeck = { name: 'E2E deck', characters: ['DC-001', 'VC-001', 'VC-002', 'UW-001'], relics: [], potions: [] };
    const ann = await newPlayer(browser);
    const bob = await newPlayer(browser, [
      { name: 'inspired-mile-decks', value: JSON.stringify([bobDeck]) },
      { name: 'inspired-mile-active-deck', value: bobDeck.name },
    ], bobDeck.characters);
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
      let pastedChecked = false;
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
        const previewed: string[] = [];
        for (const [who, verse, char] of [[ann, annVerse, annChar], [bob, bobVerse, bobChar]] as const) {
          await expect(who.page.locator('#mp-send-btn')).toBeDisabled();
          await who.page.locator(`#mp-hand [data-char-id="${char}"]`).click();
          if (who === ann && (round === 0 || !pastedChecked)) {
            // Pasted text first: a zero-width space and an accent after a letter, which one
            // cleaning leaves apart and a second composes. Where this form scores that text
            // cleaned once differently, put it there.
            const rules: OnlineRoundPlan = { index: plan.index, formId: plan.form_id, acrostic: plan.acrostic };
            const side = { charId: char, deck: startAnn.you.deck, previousOpponentVerse: round > 0 ? seenAnn[round - 1].opponent.verse : undefined };
            const sensitive = pastedVariant(rules, side, verse);
            const pasted = sensitive ?? verse.replace(/([a-z])/i, `$1${PASTE}`);
            const want = previewCraft(rules, { ...side, verse: pasted });
            expect(want.verse, 'the pasted text is not what is sent').not.toBe(pasted);
            await who.page.locator('#mp-input').fill(pasted);
            const live = who.page.locator('#mp-live-craft');
            // Under any form: the page previews the settled text it will send, not the textarea's.
            await expect(live, `round ${round + 1}: the text a pasted verse is previewed as`).toHaveAttribute('data-verse', want.verse);
            await expect(live, `round ${round + 1}: the preview of a pasted verse`).toHaveText(String(want.score.craft));
            if (sensitive) pastedChecked = true;
          }
          await who.page.locator('#mp-input').fill(verse);
          await expect(who.page.locator('#mp-live-checks li').first()).toHaveAttribute('data-met', /true|false/);
          previews.push(Number(await who.page.locator('#mp-live-craft').textContent()));
          previewed.push((await who.page.locator('#mp-live-craft').getAttribute('data-verse')) ?? '(none)');
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

        // 2. Each page sent the text its preview scored, and the server's craft is the number it showed.
        const lastSent = (p: Player) => [...p.sent].reverse().find((m) => m.type === 'submit_verse')?.text;
        expect([lastSent(ann), lastSent(bob)], `round ${round + 1}: sent, against previewed`).toEqual(previewed);
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
      // Whether a pasted verse was found that only a settled preview gets right. If cleanVerse
      // ever becomes idempotent there is none, and that check had nothing to tell apart.
      test.info().annotations.push({ type: 'pasted-preview', description: pastedChecked ? 'craft checked on a form that scores it differently' : 'text checked; no form here scores it differently' });
      console.log(`pasted-preview: ${pastedChecked ? 'craft and text checked' : 'text checked; no sensitive form drawn'}`);

      // Nothing a browser sent was a score.
      for (const message of [...ann.sent, ...bob.sent]) {
        expect(['join_room', 'submit_verse']).toContain(message.type);
        const allowed = message.type === 'join_room' ? ['type', 'room_id', 'deck', 'lang'] : ['type', 'round', 'char_id', 'text'];
        expect(Object.keys(message).sort()).toEqual([...allowed].sort());
        if (message.type === 'join_room') expect(message.lang).toBe('en');
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

  test('a dropped connection keeps the verse and the character; a reload takes the seat back; leaving warns', async ({ browser }) => {
    test.setTimeout(150000);
    // Every socket the page opens is kept, so the test can drop one as a network blip would.
    const keepSockets = (context: BrowserContext) => context.addInitScript(() => {
      const Real = window.WebSocket;
      const all: WebSocket[] = [];
      (window as unknown as { __sockets: WebSocket[] }).__sockets = all;
      class Kept extends Real {
        constructor(url: string | URL, protocols?: string | string[]) {
          super(url, protocols);
          all.push(this);
        }
      }
      (window as unknown as { WebSocket: typeof WebSocket }).WebSocket = Kept as unknown as typeof WebSocket;
    });
    const ann = await newPlayer(browser);
    const bob = await newPlayer(browser);
    await keepSockets(ann.context);
    const warns = (page: Page) => page.evaluate(() => {
      const e = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(e);
      return e.defaultPrevented;
    });
    try {
      // The init script applies from the next page load.
      await ann.page.goto('/multiplayer');
      await expect(ann.page.locator('#mp-signin-note')).toBeHidden();
      expect(await warns(ann.page), 'no warning in the lobby').toBe(false);
      await ann.page.locator('#create-private-btn').click();
      await expect(ann.page.locator('#mp-invite-link')).toHaveValue(/room=/);
      await bob.page.goto(await ann.page.locator('#mp-invite-link').inputValue());
      await bob.page.locator('#mp-accept-btn').click();
      await expect(ann.page.locator('#mp-round-label')).toHaveText('Round 1 of 3', { timeout: 20000 });
      expect(await warns(ann.page), 'leaving mid-match warns').toBe(true);

      const start = (await waitForEvent(ann, 'match_start')) as MatchStart;
      const verse = verseFor(start.rounds[0]);
      const card = start.you.deck[1];
      await ann.page.locator(`#mp-hand [data-char-id="${card}"]`).click();
      await ann.page.locator('#mp-input').fill(verse);
      await expect(ann.page.locator('#mp-send-btn')).toBeEnabled();

      // 1. A blip: the socket closes; the client reconnects by itself and the server sends the match again.
      const startsBefore = events(ann, 'match_start').length;
      await ann.page.evaluate(() => (window as unknown as { __sockets: WebSocket[] }).__sockets.at(-1)!.close());
      await expect.poll(() => events(ann, 'match_start').length, { timeout: 20000 }).toBeGreaterThan(startsBefore);
      await expect.poll(() => events(ann, 'round_start').length, { timeout: 20000 }).toBeGreaterThan(1);
      await expect(ann.page.locator('#mp-input'), 'the verse typed before the blip').toHaveValue(verse);
      await expect(ann.page.locator(`#mp-hand [data-char-id="${card}"]`), 'the character chosen before the blip').toHaveAttribute('aria-pressed', 'true');
      await expect(ann.page.locator('#mp-send-btn')).toBeEnabled();

      // 1b. The page is put in the back/forward cache and shown again (the events a browser
      // sends; Chromium here does not cache this page, Safari or Firefox may): it takes its seat
      // again, with what was written.
      const socketsBefore = await ann.page.evaluate(() => (window as unknown as { __sockets: WebSocket[] }).__sockets.length);
      const startsBeforeCache = events(ann, 'match_start').length;
      await ann.page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
      await expect.poll(() => ann.page.evaluate(() => (window as unknown as { __sockets: WebSocket[] }).__sockets.at(-1)!.readyState), { message: 'the old socket is closed', timeout: 10000 }).toBe(3);
      await ann.page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
      await expect.poll(() => events(ann, 'match_start').length, { message: 'the restored page took its seat again', timeout: 20000 }).toBeGreaterThan(startsBeforeCache);
      expect(await ann.page.evaluate(() => (window as unknown as { __sockets: WebSocket[] }).__sockets.length)).toBe(socketsBefore + 1);
      await expect(ann.page.locator('#mp-input'), 'the verse typed before the page was put away').toHaveValue(verse);
      await expect(ann.page.locator(`#mp-hand [data-char-id="${card}"]`)).toHaveAttribute('aria-pressed', 'true');
      await expect(ann.page.locator('#mp-send-btn')).toBeEnabled();

      // 2. A reload: the page takes its seat back within the grace, with the verse and the character.
      // (Leaving mid-match asks first; the reload says yes.)
      const backBefore = events(bob, 'opponent_reconnected').length;
      ann.page.once('dialog', (d) => void d.accept());
      await ann.page.reload();
      await expect(ann.page.locator('#mp-arena')).toBeVisible({ timeout: 20000 });
      await expect(ann.page.locator('#mp-round-label')).toHaveText('Round 1 of 3');
      await expect(ann.page.locator('#mp-input'), 'the verse typed before the reload').toHaveValue(verse);
      await expect(ann.page.locator(`#mp-hand [data-char-id="${card}"]`)).toHaveAttribute('aria-pressed', 'true');
      await expect.poll(() => events(bob, 'opponent_reconnected').length, { message: 'Bob is told Ann is back', timeout: 20000 }).toBeGreaterThan(backBefore);

      // 3. A new tab, with nothing remembered: the lobby offers the way back to the duel.
      const other = await ann.context.newPage();
      await other.goto('/multiplayer');
      await expect(other.locator('#mp-resume')).toBeVisible({ timeout: 15000 });
      await other.close();

      // The match goes on: both submit, and the round is scored from Ann's kept verse and card.
      await ann.page.locator('#mp-send-btn').click();
      await bob.page.locator('#mp-hand [data-char-id]').first().click();
      await bob.page.locator('#mp-input').fill('The sun is up above the quiet hills\nThe day is here and I am glad of it');
      await bob.page.locator('#mp-send-btn').click();
      const result = (await waitForEvent(bob, 'round_result')) as RoundView;
      expect([result.opponent.verse, result.opponent.char_id]).toEqual([verse, card]);
      // Over, nothing more to lose: no warning.
      bob.page.once('dialog', (d) => void d.accept());
      await bob.page.locator('#mp-forfeit-btn').click();
      await expect(ann.page.locator('#mp-match-result')).toBeVisible({ timeout: 15000 });
      expect(await warns(ann.page), 'no warning once the match is over').toBe(false);
    } finally {
      await ann.context.close();
      await bob.context.close();
    }
  });

  test('a player in the queue who has reached the room limit is told so, and the next player is not refused for it', async ({ browser }) => {
    test.setTimeout(150000);
    const ann = await newPlayer(browser);
    const bob = await newPlayer(browser);
    const cy = await newPlayer(browser);
    try {
      const ask = (p: Player) => p.context.request.post('/api/v1/multiplayer/queue', { timeout: 60000 });
      // Ann and Bob are paired twice and never connect: Ann holds two rooms.
      for (let k = 0; k < 2; k++) {
        const annAsks = ask(ann);
        await ann.page.waitForTimeout(1000);
        expect((await (await ask(bob)).json()).status).toBe('matched');
        expect((await (await annAsks).json()).status).toBe('matched');
      }
      // Ann asks again (two rooms: allowed) and waits; meanwhile she opens a private room (three).
      const annWaits = ask(ann);
      await ann.page.waitForTimeout(1500);
      expect((await ann.context.request.post('/api/v1/multiplayer/create-private')).status()).toBe(200);
      expect(await (await ann.context.request.get('/api/v1/multiplayer/rooms')).json()).toHaveLength(3);
      // Cy holds no room. He is not refused for Ann's rooms: he waits, and Ann is told why she was not paired.
      const cyAsks = ask(cy);
      const annAnswer = await annWaits;
      expect(annAnswer.status(), 'Ann is refused at once').toBe(429);
      expect(await annAnswer.text()).toContain('You already have duels open');
      const cyAnswer = await cyAsks;
      const cyText = await cyAnswer.text();
      expect(cyAnswer.status(), `Cy was answered: ${cyText}`).toBe(200);
      expect(JSON.parse(cyText).status).toBe('timeout');
      expect(await (await cy.context.request.get('/api/v1/multiplayer/rooms')).json()).toEqual([]);
    } finally {
      await ann.context.close();
      await bob.context.close();
      await cy.context.close();
    }
  });

  test('quick match gives up after its time limit and says so', async ({ browser }) => {
    test.setTimeout(150000);
    const ann = await newPlayer(browser);
    try {
      // Nobody else is looking. The clock is moved past the limit while the first request waits.
      await ann.page.clock.install();
      await ann.page.goto('/multiplayer');
      await expect(ann.page.locator('#mp-signin-note')).toBeHidden();
      await ann.page.locator('#find-match-btn').click();
      await expect(ann.page.locator('#queue-status')).toBeVisible();
      await ann.page.clock.fastForward('03:30');
      const error = ann.page.locator('#match-error');
      await expect(error).toBeVisible({ timeout: 60000 });
      await expect(error).toHaveAttribute('data-reason', 'queue-timeout');
      await expect(error).toContainText('Nobody else looked for a duel');
      await expect(ann.page.locator('#find-match-btn')).toBeVisible();
      await expect(ann.page.locator('#queue-status')).toBeHidden();
    } finally {
      await ann.context.close();
    }
  });

  test('the socket itself: no session no socket, a sent score is ignored, twice is refused, too big is cut off, a dropped player can return', async ({ browser }) => {
    test.setTimeout(120000);
    const deckA = ['DC-001', 'MO-001', 'CA-001'];
    const deckB = ['MO-002', 'CA-002', 'DC-002'];
    // Ann holds Hamlet (Romeo and Juliet are starter characters); Bob holds his three.
    const ann = await newPlayer(browser, [], ['DC-001']);
    const bob = await newPlayer(browser, [], deckB);
    const stranger = await browser.newContext({ baseURL: E2E.webOrigin });
    try {
      const { open, send, got, closed, next } = raw;

      // Not signed in: the handshake is refused.
      const outsider = await stranger.newPage();
      await outsider.goto('/about');
      expect(await open(outsider), 'a socket without a session').toBe(false);

      const room = await (await ann.context.request.post('/api/v1/multiplayer/create-private')).json();
      // Another player's rooms are not listed to Bob, and Ann's is listed to her.
      expect(await (await bob.context.request.get('/api/v1/multiplayer/rooms')).json()).toEqual([]);
      expect(await (await ann.context.request.get('/api/v1/multiplayer/rooms')).json()).toEqual([{ id: room.room_id, state: 'waiting', player_count: 1 }]);

      expect(await open(ann.page)).toBe(true);
      expect(await open(bob.page)).toBe(true);

      // A deck that is not three to five different characters is refused.
      await send(bob.page, { type: 'join_room', room_id: room.room_id, deck: ['MO-002', 'MO-002', 'CA-002'] });
      expect((await next(bob.page, 'error')).code).toBe('bad_deck');
      // A character the account does not hold is refused, and so is a duel in another language.
      await send(bob.page, { type: 'join_room', room_id: room.room_id, deck: ['MO-002', 'CA-002', 'VC-001'] });
      const notHeld = await next(bob.page, 'error', 2);
      expect([notHeld.code, notHeld.message]).toEqual(['card_not_held', expect.stringContaining('Escalus')]);
      await send(bob.page, { type: 'join_room', room_id: room.room_id, deck: deckB, lang: 'fr' });
      expect((await next(bob.page, 'error', 3)).code).toBe('language_not_offered');
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
      expect((await next(bob.page, 'error', 4)).code).toBe('bad_message');
      await send(bob.page, { type: 'submit_verse', round: 0, char_id: 'MO-002', text: 'ab '.repeat(700) });
      expect((await next(bob.page, 'error', 5)).code).toBe('verse_too_long');
      await send(bob.page, { type: 'submit_verse', round: 0, char_id: 'MO-002', text: 'What the fuck is this' });
      expect((await next(bob.page, 'error', 6)).code).toBe('content_rejected');
      await send(bob.page, { type: 'submit_verse', round: 0, char_id: 'DC-001', text: 'Not my card\nBut I try' });
      expect((await next(bob.page, 'error', 7)).code).toBe('not_in_deck');
      // A character newer than the server's Unicode tables: refused, not scored differently from the preview.
      await send(bob.page, { type: 'submit_verse', round: 0, char_id: 'MO-002', text: 'A plain line\nAnd one \u0378 more' });
      expect((await next(bob.page, 'error', 8)).code).toBe('unknown_character');
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

  // The socket's session is checked at the handshake. Signing out (here, or on every device)
  // ends the session on the server, and must end a game connection opened before it too.
  test('signing out closes a game connection opened before: at once if it sends, within the check if it only listens', async ({ browser }) => {
    test.setTimeout(150000);
    const { open, send, got, closed, next } = raw;
    // The starter characters: no account needs a card for them.
    const deck = ['SM-001', 'MO-001', 'CA-001'];
    const ann = await newPlayer(browser);
    const bob = await newPlayer(browser);
    const signOut = (page: Page, everywhere: boolean) => page.evaluate(async (all) => (await fetch(`/api/v1/auth/logout${all ? '/all' : ''}`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    })).status, everywhere);
    try {
      const room = await (await ann.context.request.post('/api/v1/multiplayer/create-private')).json();
      expect(await open(ann.page)).toBe(true);
      expect(await open(bob.page)).toBe(true);
      await send(ann.page, { type: 'join_room', room_id: room.room_id, deck });
      await send(bob.page, { type: 'join_room', room_id: room.room_id, deck });
      const start = (await next(ann.page, 'match_start')) as MatchStart;
      await next(bob.page, 'match_start');

      // Ann signs out on every device. Her connection is still open; the first thing it sends
      // after that is not played, and the server closes it. (A connection takes a live answer as
      // good for handlers.rs SESSION_FRESH_FOR, 1 s: what it sends within a second of its last
      // check is not asked about again. Her last check was her join.)
      expect(await signOut(ann.page, true)).toBe(200);
      await ann.page.waitForTimeout(1200);
      await send(ann.page, { type: 'submit_verse', round: 0, char_id: deck[0], text: verseFor(start.rounds[0]) });
      const bye = await next(ann.page, 'error');
      expect([bye.code, bye.message]).toEqual(['signed_out', expect.stringContaining('signed out')]);
      await expect.poll(() => closed(ann.page), { message: "Ann's connection is closed", timeout: 10000 }).toBe(true);
      expect((await got(ann.page)).some((e) => e.type === 'verse_accepted'), 'the verse sent after signing out was not played').toBe(false);
      expect((await got(bob.page)).some((e) => e.type === 'opponent_submitted'), 'Bob was not told of a verse').toBe(false);
      expect((await next(bob.page, 'opponent_disconnected')).grace_seconds).toBeGreaterThan(0);

      // Bob signs out of this browser. His connection sends nothing; the server's own check
      // (handlers.rs SESSION_CHECK_EVERY, 15 s) closes it.
      const signedOutAt = Date.now();
      expect(await signOut(bob.page, false)).toBe(200);
      await expect.poll(() => closed(bob.page), { message: "Bob's quiet connection is closed", timeout: 30000 }).toBe(true);
      expect(Date.now() - signedOutAt, 'closed within the check period, plus a margin').toBeLessThan(25000);
      expect((await got(bob.page)).filter((e) => e.type === 'error').map((e) => (e as { code: string }).code)).toContain('signed_out');
      expect((await got(bob.page)).some((e) => e.type === 'match_complete'), 'closed by the check, not by the end of the match').toBe(false);
      // And a new connection is refused at the handshake.
      expect(await open(bob.page)).toBe(false);
    } finally {
      await ann.context.close();
      await bob.context.close();
    }
  });

  // The integration checker's blocker (probe P1, 2026-11-17): every request runs to its end
  // (backend/src/request_task.rs), so a quick-match request whose client had gone kept its place
  // in the queue for the whole wait, and the next player was paired with nobody.
  test('a player whose quick-match request was dropped is not paired with the next player, straight or through the proxy', async ({ browser }) => {
    test.setTimeout(150000);
    const ann = await newPlayer(browser);
    const bob = await newPlayer(browser);
    try {
      const [annCookie, bobCookie] = [await cookieOf(ann), await cookieOf(bob)];
      const [annIp, bobIp] = [uniqueIp(), uniqueIp()];
      for (const via of ['api', 'web'] as const) {
        // Ann asks, waits, and her connection goes (a closed tab, a lost network).
        const annWaits = waitInQueue(annCookie, annIp, via);
        await new Promise((r) => setTimeout(r, 1500));
        expect(annWaits.answer(), `Ann is waiting (${via})`).toBe('');
        annWaits.drop();
        await new Promise((r) => setTimeout(r, 1500));
        // Bob asks: nobody is waiting.
        expect(await askFor(bobCookie, bobIp, 6000), `Bob was paired with a dropped request (${via})`).toBe('still waiting');
        expect(await roomsOf(annCookie, annIp), `no room was opened for Ann (${via})`).toEqual([]);
        expect(await roomsOf(bobCookie, bobIp)).toEqual([]);
      }
      // A request that stays is paired (the test can see a pairing).
      const annStays = waitInQueue(annCookie, annIp, 'web');
      await new Promise((r) => setTimeout(r, 1500));
      expect(await askFor(bobCookie, bobIp, 6000)).toBe('200 matched');
      await expect.poll(() => annStays.answer(), { timeout: 5000 }).toMatch(/^200 .*"matched"/);
    } finally {
      await ann.context.close();
      await bob.context.close();
    }
  });

  test('leaving the page while waiting for a quick match leaves the queue', async ({ browser }) => {
    test.setTimeout(150000);
    const ann = await newPlayer(browser);
    const bob = await newPlayer(browser);
    try {
      const bobCookie = await cookieOf(bob);
      const bobIp = uniqueIp();
      await ann.page.locator('#find-match-btn').click();
      await expect(ann.page.locator('#queue-status')).toBeVisible();
      await ann.page.waitForTimeout(1500);
      // Ann goes to another page of the site.
      await ann.page.goto('/about');
      await ann.page.waitForTimeout(1500);
      expect(await askFor(bobCookie, bobIp, 6000), 'Bob was paired with a page that had been left').toBe('still waiting');
      expect(await (await ann.context.request.get('/api/v1/multiplayer/rooms')).json()).toEqual([]);
      // Back on the page, Ann asks again and is paired with Bob (the test can see a pairing).
      await ann.page.goto('/multiplayer');
      await expect(ann.page.locator('#mp-signin-note')).toBeHidden();
      await ann.page.locator('#find-match-btn').click();
      await expect(ann.page.locator('#queue-status')).toBeVisible();
      await ann.page.waitForTimeout(1500);
      expect(await askFor(bobCookie, bobIp, 6000)).toBe('200 matched');
      await expect(ann.page.locator('#mp-waiting')).toBeVisible({ timeout: 15000 });
    } finally {
      await ann.context.close();
      await bob.context.close();
    }
  });

  // The checker's concern: the session is checked when a quick-match request starts, and a
  // player who then signs out (here or on every device) stayed matchable for the whole wait.
  test('a player who signs out while waiting for a quick match is not paired with the next player', async ({ browser }) => {
    test.setTimeout(150000);
    const ann = await newPlayer(browser);
    const bob = await newPlayer(browser);
    const cy = await newPlayer(browser);
    try {
      const [annCookie, bobCookie, cyCookie] = [await cookieOf(ann), await cookieOf(bob), await cookieOf(cy)];
      const [annIp, bobIp, cyIp] = [uniqueIp(), uniqueIp(), uniqueIp()];
      const annWaits = waitInQueue(annCookie, annIp, 'api');
      await new Promise((r) => setTimeout(r, 1500));
      expect(annWaits.answer(), 'Ann is waiting').toBe('');
      // Ann signs out on every device (from another device: her request is still open).
      const out = await fetch(`http://127.0.0.1:${E2E.apiPort}/api/v1/auth/logout/all`, {
        method: 'POST', headers: { Cookie: annCookie, 'CF-Connecting-IP': annIp, 'Content-Type': 'application/json' },
      });
      expect(out.status).toBe(200);
      expect((await fetch(`http://127.0.0.1:${E2E.apiPort}/api/v1/multiplayer/rooms`, { headers: { Cookie: annCookie } })).status, 'Ann is signed out').toBe(401);
      // Bob asks: the only player waiting is signed out.
      expect(await askFor(bobCookie, bobIp, 6000), 'Bob was paired with a signed-out player').toBe('still waiting');
      expect(await roomsOf(bobCookie, bobIp)).toEqual([]);
      annWaits.drop();
      // A player who is signed in is paired with him (the test can see a pairing).
      const cyWaits = waitInQueue(cyCookie, cyIp, 'api');
      await new Promise((r) => setTimeout(r, 1500));
      expect(await askFor(bobCookie, bobIp, 6000)).toBe('200 matched');
      await expect.poll(() => cyWaits.answer(), { timeout: 5000 }).toMatch(/^200 .*"matched"/);
    } finally {
      await ann.context.close();
      await bob.context.close();
      await cy.context.close();
    }
  });

  // The page's side of a sign-out mid-match (multiplayer.astro, the 'signed_out' error): the
  // duel ends on that page, the seat and the draft are let go, and nothing reconnects.
  test('signing out elsewhere mid-match: the page says so, lets the seat and the draft go, and does not reconnect', async ({ browser }) => {
    test.setTimeout(150000);
    const ann = await newPlayer(browser);
    const bob = await newPlayer(browser);
    try {
      await ann.page.locator('#create-private-btn').click();
      await expect(ann.page.locator('#mp-invite-link')).toHaveValue(/room=/);
      await bob.page.goto(await ann.page.locator('#mp-invite-link').inputValue());
      await bob.page.locator('#mp-accept-btn').click();
      await expect(ann.page.locator('#mp-round-label')).toHaveText('Round 1 of 3', { timeout: 20000 });
      const start = (await waitForEvent(ann, 'match_start')) as MatchStart;
      await ann.page.locator(`#mp-hand [data-char-id="${start.you.deck[0]}"]`).click();
      await ann.page.locator('#mp-input').fill(verseFor(start.rounds[0]));
      const stored = (key: string) => ann.page.evaluate((k) => sessionStorage.getItem(k), key);
      expect(await stored('inspired-mile-mp-seat'), 'the tab holds its seat').not.toBeNull();
      expect(await stored('inspired-mile-mp-draft'), 'and its draft').not.toBeNull();
      let sockets = 0;
      ann.page.on('websocket', (ws) => { if (ws.url().includes('/multiplayer/ws')) sockets += 1; });

      // Ann signs out on every device, from another tab. The duel's page sends nothing: the
      // server's own check (handlers.rs SESSION_CHECK_EVERY, 15 s) closes its connection.
      const other = await ann.context.newPage();
      await other.goto('/about');
      expect(await other.evaluate(async () => (await fetch('/api/v1/auth/logout/all', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } })).status)).toBe(200);
      await other.close();

      await expect(ann.page.locator('#mp-arena')).toHaveAttribute('data-closed', 'signed_out', { timeout: 30000 });
      await expect(ann.page.locator('#mp-notice')).toBeVisible();
      await expect(ann.page.locator('#mp-notice')).toContainText('You are signed out');
      await expect(ann.page.locator('#mp-move-panel')).toBeHidden();
      await expect(ann.page.locator('#mp-forfeit-btn')).toBeHidden();
      expect(await stored('inspired-mile-mp-seat'), 'the seat is let go').toBeNull();
      expect(await stored('inspired-mile-mp-draft'), 'the draft is let go').toBeNull();
      // No new connection: signed_out is final for the client.
      await ann.page.waitForTimeout(5000);
      expect(sockets, 'the page tried to reconnect').toBe(0);
      expect((await waitForEvent(bob, 'opponent_disconnected')).grace_seconds).toBeGreaterThan(0);
    } finally {
      await ann.context.close();
      await bob.context.close();
    }
  });

  test('a connection that sends more than its share of messages is closed', async ({ browser }) => {
    const { open, next, closed } = raw;
    const ann = await newPlayer(browser);
    try {
      expect(await open(ann.page)).toBe(true);
      // Thirty messages in ten seconds are answered (handlers.rs MESSAGES_PER_WINDOW); the
      // thirty-first closes the connection.
      await ann.page.evaluate(() => {
        const ws = (window as unknown as { mp: { ws: WebSocket } }).mp.ws;
        for (let i = 0; i < 31; i++) ws.send('not a message');
      });
      expect((await next(ann.page, 'error', 30)).code).toBe('bad_message');
      expect((await next(ann.page, 'error', 31)).code).toBe('too_many_messages');
      await expect.poll(() => closed(ann.page), { message: 'the connection is closed', timeout: 10000 }).toBe(true);
    } finally {
      await ann.context.close();
    }
  });
});
