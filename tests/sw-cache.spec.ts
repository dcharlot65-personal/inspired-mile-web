import { test, expect, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { E2E } from './e2e-env';

/**
 * The service worker and a signed-in player (public/sw.js, src/lib/pwa.ts forgetUserCaches).
 *
 * Real throughout: the real worker, registered by the page and in control of it; the real
 * API on a real Postgres; a real account made with an emailed code (DEV_EMAIL_LOG), so
 * /api/v1/auth/me answers with an email address; the browser's real Cache Storage, read
 * back entry by entry and body by body.
 *
 * One thing is planted: before sign-out, entries of the kind the previous worker (v2)
 * stored are written into the cache by hand, to prove sign-out removes them.
 *
 * Not covered: Safari's and Firefox's Cache Storage (this runs in Chromium), and a
 * production build's /_astro files (the dev server has none).
 */

const API_LOG = path.join(E2E.workDir, 'api.log');

function loggedCodes(email: string): string[] {
  if (!existsSync(API_LOG)) return [];
  const re = new RegExp(`DEV_EMAIL_LOG sign-in code for ${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} is (\\d{6})`, 'g');
  return [...readFileSync(API_LOG, 'utf8').matchAll(re)].map((m) => m[1]);
}

async function signInByEmail(page: Page, email: string) {
  await page.locator('#auth-btn').click();
  await page.locator('#auth-email-btn').click();
  await page.locator('#auth-email-input').fill(email);
  await page.locator('#auth-email-send').click();
  await expect(page.locator('#auth-step-code')).toBeVisible();
  let codes: string[] = [];
  await expect.poll(() => (codes = loggedCodes(email)).length, { message: `a code for ${email} in ${API_LOG}`, timeout: 10000 }).toBeGreaterThan(0);
  await page.locator('#auth-code-input').fill(codes[codes.length - 1]);
  await page.locator('#auth-code-verify').click();
  await expect(page.locator('#user-badge')).toBeVisible();
}

/** The page is loaded, and the worker has it. */
async function underWorker(page: Page) {
  await page.waitForLoadState('load');
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 15000 });
}

interface Entry { cache: string; url: string; body: string }

/** Everything in Cache Storage: every cache, every entry, and every non-media body as text. */
function cacheStorage(page: Page): Promise<Entry[]> {
  return page.evaluate(async () => {
    const out: { cache: string; url: string; body: string }[] = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        const response = await cache.match(request);
        const type = response?.headers.get('content-type') ?? '';
        const body = response && !/^(image|audio|video|font)\//.test(type) ? await response.text() : '';
        out.push({ cache: name, url: request.url, body });
      }
    }
    return out;
  });
}

function userSpecific(entries: Entry[], needles: string[]): string[] {
  return entries
    .filter((e) => new URL(e.url).pathname.startsWith('/api') || new URL(e.url).search !== '' || needles.some((n) => e.body.includes(n)))
    .map((e) => `${e.cache} ${e.url}`);
}

test.beforeEach(async ({ context }) => {
  // Each test its own client address, so the API's per-address limits cannot trip.
  const n = () => 1 + Math.floor(Math.random() * 253);
  await context.setExtraHTTPHeaders({ 'CF-Connecting-IP': `10.${n()}.${n()}.${n()}` });
});

test('signed in, then signed out: nothing user-specific is in Cache Storage at either point', async ({ page }) => {
  // A sign-in and six page loads; the first test of a run also waits for the dev server's
  // first compile of each page.
  test.setTimeout(90_000);
  const email = `swcache-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}@example.test`;
  await page.goto('/');
  await underWorker(page);
  await signInByEmail(page, email);

  // Use the site signed in, under the worker: pages that ask the API who this is.
  for (const url of ['/battle?brain=rules', '/collection', '/']) {
    await page.goto(url);
    await underWorker(page);
    await expect(page.locator('#user-badge')).toBeVisible();
  }
  // The API answers through this page with the account, email address included...
  const meBody = await page.evaluate(async () => {
    const calls = ['/api/v1/auth/me', '/api/v1/auth/passkeys', '/api/v1/auth/methods'];
    const answers = await Promise.all(calls.map((u) => fetch(u, { credentials: 'include' }).then((r) => r.text())));
    return answers[0];
  });
  expect(meBody).toContain(email);
  const user = JSON.parse(meBody).user;
  const needles = [email, user.id, user.username].filter((s) => typeof s === 'string' && s.length >= 6);
  expect(needles).toContain(email);

  // ...the worker did keep things (so an empty cache is not what passes this test)...
  await expect.poll(async () => (await cacheStorage(page)).map((e) => new URL(e.url).pathname)).toEqual(expect.arrayContaining(['/', '/battle', '/collection', '/offline.html']));
  const signedIn = await cacheStorage(page);
  expect(signedIn.find((e) => new URL(e.url).pathname === '/battle')!.body).toContain('<html');
  // ...and none of it is the player's.
  expect(userSpecific(signedIn, needles)).toEqual([]);

  // What the previous worker left on a player's device: plant it, to see sign-out remove it.
  await page.evaluate(async (body) => {
    const json = () => new Response(body, { headers: { 'content-type': 'application/json' } });
    await (await caches.open('inspired-mile-v3')).put('/api/v1/auth/me', json());
    await (await caches.open('inspired-mile-v3')).put('/api/v1/inventory?page=1', json());
    await (await caches.open('inspired-mile-v2')).put('/api/v1/auth/me', json());
    // Not the worker's cache: must be left alone (a downloaded model lives in one like it).
    await (await caches.open('transformers-cache')).put('/planted-model-file', new Response('weights'));
  }, meBody);
  expect(userSpecific(await cacheStorage(page), needles)).toHaveLength(3);

  // Sign out.
  if (await page.locator('#auth-dropdown').isHidden()) await page.locator('#user-badge').click();
  await page.locator('#auth-logout-btn').click();
  await expect(page.locator('#auth-btn')).toBeVisible();
  expect((await page.evaluate(() => fetch('/api/v1/auth/me', { credentials: 'include' }).then((r) => r.status)))).toBe(401);

  const signedOut = await cacheStorage(page);
  expect(userSpecific(signedOut, needles)).toEqual([]);
  // The static copies and the other cache are still there.
  const kept = signedOut.map((e) => `${e.cache} ${new URL(e.url).pathname}`);
  expect(kept).toEqual(expect.arrayContaining(['inspired-mile-v3 /battle', 'inspired-mile-v3 /offline.html', 'transformers-cache /planted-model-file']));

  // And it stays that way after the signed-out player goes on using the site.
  await page.goto('/battle?brain=rules');
  await underWorker(page);
  await expect(page.locator('#start-duel')).toBeEnabled();
  expect(userSpecific(await cacheStorage(page), needles)).toEqual([]);
});

test('signed out on every device: the account\'s data leaves Cache Storage too', async ({ page }) => {
  test.setTimeout(90_000);
  const email = `swall-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}@example.test`;
  await page.goto('/');
  await underWorker(page);
  await signInByEmail(page, email);
  const meBody = await page.evaluate(() => fetch('/api/v1/auth/me', { credentials: 'include' }).then((r) => r.text()));
  expect(meBody).toContain(email);
  const user = JSON.parse(meBody).user;
  const needles = [email, user.id, user.username].filter((s) => typeof s === 'string' && s.length >= 6);

  // What an older worker kept of this player, as in the test above.
  await page.evaluate(async (body) => {
    const json = () => new Response(body, { headers: { 'content-type': 'application/json' } });
    await (await caches.open('inspired-mile-v3')).put('/api/v1/auth/me', json());
    await (await caches.open('inspired-mile-v3')).put('/api/v1/auth/passkeys', json());
  }, meBody);
  expect(userSpecific(await cacheStorage(page), needles)).toHaveLength(2);

  // "Sign out on every device" (not the plain sign-out).
  if (await page.locator('#auth-dropdown').isHidden()) await page.locator('#user-badge').click();
  await page.locator('#auth-logout-all-btn').click();
  await expect(page.locator('#auth-btn')).toBeVisible();
  expect(await page.evaluate(() => fetch('/api/v1/auth/me', { credentials: 'include' }).then((r) => r.status))).toBe(401);
  expect(userSpecific(await cacheStorage(page), needles)).toEqual([]);
});

test('a page comes from the network, not from the copy the worker holds', async ({ page }) => {
  // The first visit installs the worker; the second is the first one it sees.
  await page.goto('/');
  await underWorker(page);
  await page.goto('/about');
  await expect.poll(async () => (await cacheStorage(page)).some((e) => new URL(e.url).pathname === '/about')).toBe(true);
  // An older deploy's page, sitting in the cache.
  await page.evaluate(async () => {
    await (await caches.open('inspired-mile-v3')).put('/about', new Response('<!doctype html><title>stale</title><body id="stale">an old deploy</body>', { headers: { 'content-type': 'text/html' } }));
  });
  await page.goto('/about');
  await expect(page.locator('#stale')).toHaveCount(0);
  await expect(page.locator('#auth-btn')).toBeVisible();
  // Offline, the copy is what is left (by now refreshed from the network again).
  await expect.poll(async () => (await cacheStorage(page)).find((e) => new URL(e.url).pathname === '/about')?.body.includes('an old deploy')).toBe(false);
});
