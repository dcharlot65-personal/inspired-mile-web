import { test, expect } from '@playwright/test';

/**
 * Production smoke test. Run with PROD_URL=https://sonnetman.inspiredmile.com.
 * Visits every page in a real browser and fails on a page error, a failed or
 * empty same-origin response, or a broken image.
 */

const PAGES = [
  '/', '/battle', '/collection', '/playground', '/classroom', '/multiplayer',
  '/marketplace', '/tournaments', '/story', '/season', '/profile', '/world-map',
  '/viewer', '/vr', '/theatre', '/about', '/privacy', '/terms',
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('inspired-mile-age-verified', 'adult'));
});

for (const path of PAGES) {
  test(`page ${path} renders cleanly`, async ({ page, baseURL }) => {
    const origin = new URL(baseURL!).origin;
    const problems: string[] = [];
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      // The browser logs the signed-out 401 itself; the response handler below judges statuses.
      if (m.type() === 'error' && !m.text().includes('status of 401')) problems.push(`console: ${m.text()}`);
    });
    page.on('requestfailed', (r) => problems.push(`failed: ${r.url()} ${r.failure()?.errorText}`));
    page.on('response', (r) => {
      if (!r.url().startsWith(origin)) return;
      // 401 from the API is the signed-out answer, not a fault.
      if (r.status() >= 400 && !(r.status() === 401 && r.url().includes('/api/'))) {
        problems.push(`http ${r.status()}: ${r.url()}`);
      }
    });

    const res = await page.goto(path, { waitUntil: 'networkidle' });
    expect(res?.status()).toBe(200);
    await expect(page.locator('nav')).toBeVisible();
    await expect(page.locator('footer')).toBeVisible();
    await expect(page.locator('#age-gate')).toBeHidden();

    const broken = await page.evaluate(() =>
      Array.from(document.images)
        .filter((i) => i.complete && i.naturalWidth === 0 && i.currentSrc)
        .map((i) => i.currentSrc));
    for (const b of broken) problems.push(`broken image: ${b}`);

    expect(problems, problems.join('\n')).toEqual([]);
  });
}

test('API health answers through the public domain', async ({ request }) => {
  const res = await request.get('/api/v1/health');
  expect(res.status()).toBe(200);
  expect(await res.text()).toBe('ok');
});

test('age gate blocks a first-time visitor', async ({ browser, baseURL }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(baseURL! + '/');
  await expect(page.locator('#age-gate')).toBeVisible();
  await ctx.close();
});

// The Japanese analyser's dictionary is the largest thing the duel loads (17.8 MB: files emitted
// as assets, and the smallest inlined in the analyser's chunk). Only the dev server is used by the
// other browser tests, so this one checks that the built site serves the dictionary and that
// loadSound reads it: every file is served, and the loader, which unzips and parses each, reports
// no failure. With one file removed from dist/ it fails (checked 2026-11-16: a 404, and the loader
// saying so).
test('a Japanese duel loads its analyser and dictionary from the built site', async ({ page }) => {
  test.setTimeout(180_000);
  const deck = { name: 'Test deck', characters: ['DC-001', 'MO-001', 'CA-001'], relics: ['RL-001'], potions: ['PT-002'] };
  await page.addInitScript((d) => {
    localStorage.setItem('inspired-mile-decks', JSON.stringify([d]));
    localStorage.setItem('inspired-mile-active-deck', d.name);
  }, deck);
  const files: Array<{ url: string; status: number; bytes: number }> = [];
  const failures: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && m.text().includes('[verse]')) failures.push(m.text());
  });
  page.on('response', (r) => {
    // base.dat.gz in dev; base.dat.<hash>.gz (or -<hash>) when built.
    if (!/\/[a-z_]+\.dat[^/]*\.gz(\?|$)/.test(r.url())) return;
    // Neither body() (Chromium keeps no body this large) nor sizes() (negative for these fetches)
    // gives the size here; the header is reported, and the loader itself proves the file whole:
    // it unzips and parses every one, and says so on the console if it cannot.
    files.push({ url: r.url(), status: r.status(), bytes: Number(r.headers()['content-length'] ?? -1) });
  });
  await page.goto('/battle?seed=11&brain=rules&lang=ja');
  await expect(page.locator('#start-duel')).toBeEnabled();
  await page.click('#start-duel');
  // The page waits for the language's sound data before it builds the duel.
  await expect(page.locator('#battle-arena')).toBeVisible({ timeout: 150_000 });
  console.log(`SOUND-PROD ${JSON.stringify(files.map((f) => ({ file: f.url.split('/').pop(), status: f.status, bytes: f.bytes })))}`);
  expect(failures).toEqual([]);
  expect(files.length).toBeGreaterThan(0);
  for (const f of files) expect([f.url, f.status]).toEqual([f.url, 200]);
});
