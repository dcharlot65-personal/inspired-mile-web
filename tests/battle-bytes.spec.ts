import { test, expect, type Browser, type Page } from '@playwright/test';

/**
 * The English pronunciation table (pron-en, about 0.5 MB compressed) is fetched only when an
 * English duel needs it: never for a visitor who does not start a duel, nor for a duel in
 * another language. The review of 2026-11-16 found /battle fetching it on every visit.
 *
 * Each case also prints what the page received (MEASURE ...): the body bytes of every response,
 * each case in a browser context of its own so nothing comes from another case's cache. Set
 * BYTES_URL to a built site (`npm run build && npx astro preview --port <port>`,
 * BYTES_URL=http://localhost:<port>) for the files a visitor gets; against the dev server the
 * numbers are the unbundled sources.
 */
const BASE = process.env.BYTES_URL ?? '';

/** Every response the page receives, and (once awaited) the body bytes of each. */
function bytes(page: Page) {
  const urls: string[] = [];
  const sizes: Array<Promise<[string, number]>> = [];
  page.on('response', (r) => {
    urls.push(r.url());
    sizes.push(r.body().then((b) => [r.url(), b.length] as [string, number]).catch(() => [r.url(), 0] as [string, number]));
  });
  return {
    urls,
    measure: async () => {
      const all = await Promise.all(sizes);
      const largest = [...all].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([u, n]) => [new URL(u).pathname.split('/').pop() || u, n]);
      return { bytes: all.reduce((t, [, n]) => t + n, 0), responses: all.length, largest };
    },
  };
}

async function fresh(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  await ctx.addInitScript(() => localStorage.setItem('inspired-mile-age-verified', 'adult'));
  return ctx.newPage();
}

async function duel(page: Page, lang: string) {
  await page.goto(`${BASE}/battle?seed=7&brain=rules`, { waitUntil: 'networkidle' });
  await expect(page.locator('#start-duel')).toBeEnabled();
  await page.selectOption('#language', lang);
  await page.click('#start-duel');
  await expect(page.locator('#opponent-verse')).toHaveAttribute('data-source', /written|model/, { timeout: 60_000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
}

test('a visitor who never starts a duel does not fetch the English table', async ({ browser }) => {
  const page = await fresh(browser);
  const seen = bytes(page);
  await page.goto(`${BASE}/battle?brain=rules`, { waitUntil: 'networkidle' });
  await expect(page.locator('#start-duel')).toBeEnabled();
  await page.waitForTimeout(2000);
  console.log(`MEASURE battle-bytes no-duel ${JSON.stringify(await seen.measure())}`);
  expect(seen.urls.filter((u) => /pron-en/.test(u))).toEqual([]);
});

test('a Japanese duel does not fetch the English table', async ({ browser }) => {
  const page = await fresh(browser);
  const seen = bytes(page);
  await duel(page, 'ja');
  console.log(`MEASURE battle-bytes ja-duel ${JSON.stringify(await seen.measure())}`);
  expect(seen.urls.filter((u) => /pron-en/.test(u))).toEqual([]);
});

test('an English duel fetches it', async ({ browser }) => {
  const page = await fresh(browser);
  const seen = bytes(page);
  await duel(page, 'en');
  console.log(`MEASURE battle-bytes en-duel ${JSON.stringify(await seen.measure())}`);
  expect(seen.urls.filter((u) => /pron-en/.test(u)).length).toBeGreaterThan(0);
});
