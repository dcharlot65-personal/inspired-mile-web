import { test, expect, type Browser, type Page } from '@playwright/test';

/**
 * The English pronunciation table (pron-en, about 0.5 MB compressed) is fetched only when an
 * English duel needs it: never for a first visitor who leaves the duel's settings alone, nor for a
 * duel in another language. The review of 2026-11-16 found /battle fetching it on every visit. A
 * visitor about to duel gets it ahead of the start (battle.astro warm()): one who touches the duel's
 * settings, and a returning player whose duel language is stored, once the page is idle.
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
    measure: async (name?: string) => {
      const all = await Promise.all(sizes);
      const largest = [...all].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([u, n]) => [new URL(u).pathname.split('/').pop() || u, n]);
      // BYTES_OUT: every path and its body bytes, for working out what they weigh compressed (scripts/compressed-bytes.mjs).
      if (name && process.env.BYTES_OUT) {
        const fs = await import('node:fs');
        fs.mkdirSync(process.env.BYTES_OUT, { recursive: true });
        fs.writeFileSync(`${process.env.BYTES_OUT}/${name}.json`, JSON.stringify(all.map(([u, n]) => [new URL(u).pathname, n])));
      }
      return { bytes: all.reduce((t, [, n]) => t + n, 0), responses: all.length, largest };
    },
  };
}

async function fresh(browser: Browser, duelLang?: string): Promise<Page> {
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  await ctx.addInitScript(() => localStorage.setItem('inspired-mile-age-verified', 'adult'));
  if (duelLang) await ctx.addInitScript((l) => localStorage.setItem('inspired-mile-duel-lang', l), duelLang);
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
  console.log(`MEASURE battle-bytes no-duel ${JSON.stringify(await seen.measure('no-duel'))}`);
  expect(seen.urls.filter((u) => /pron-en/.test(u))).toEqual([]);
});

test('a Japanese duel does not fetch the English table', async ({ browser }) => {
  const page = await fresh(browser);
  const seen = bytes(page);
  await duel(page, 'ja');
  console.log(`MEASURE battle-bytes ja-duel ${JSON.stringify(await seen.measure('ja-duel'))}`);
  expect(seen.urls.filter((u) => /pron-en/.test(u))).toEqual([]);
});

test('an English duel fetches it', async ({ browser }) => {
  const page = await fresh(browser);
  const seen = bytes(page);
  await duel(page, 'en');
  console.log(`MEASURE battle-bytes en-duel ${JSON.stringify(await seen.measure('en-duel'))}`);
  expect(seen.urls.filter((u) => /pron-en/.test(u)).length).toBeGreaterThan(0);
});

test('a first visitor who touches the duel\'s settings gets the English table before the start', async ({ browser }) => {
  const page = await fresh(browser);
  const seen = bytes(page);
  await page.goto(`${BASE}/battle?brain=rules`, { waitUntil: 'networkidle' });
  await expect(page.locator('#start-duel')).toBeEnabled();
  await page.waitForTimeout(1000);
  expect(seen.urls.filter((u) => /pron-en/.test(u))).toEqual([]);
  await page.locator('#difficulty').focus();
  await expect.poll(() => seen.urls.filter((u) => /pron-en/.test(u)).length, { timeout: 30_000 }).toBeGreaterThan(0);
});

test('a returning player whose duel language is stored gets its data once the page is idle, and no other', async ({ browser }) => {
  for (const [lang, want, not] of [['en', /pron-en/, /\.dat\.gz/], ['ja', /\.dat\.gz/, /pron-en/]] as const) {
    const page = await fresh(browser, lang);
    const seen = bytes(page);
    await page.goto(`${BASE}/battle?brain=rules`, { waitUntil: 'load' });
    await expect.poll(() => seen.urls.filter((u) => want.test(u)).length, { timeout: 60_000 }).toBeGreaterThan(0);
    await page.waitForLoadState('networkidle');
    expect([lang, seen.urls.filter((u) => not.test(u))]).toEqual([lang, []]);
    await page.context().close();
  }
});
