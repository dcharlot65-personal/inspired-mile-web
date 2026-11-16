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
