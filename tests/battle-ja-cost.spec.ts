import { test, expect, type Browser, type Page } from '@playwright/test';

/**
 * What a Japanese duel costs a phone: bytes over the wire and the wait for the opponent's first
 * verse, on a built site, with the network and the CPU throttled the way Chrome's DevTools does
 * it (the "Fast 4G" preset: 9 Mbit/s down, 1.5 up, 60 ms; the CPU four times slower). Each case
 * is a first visit (a fresh browser context, the service worker blocked), so nothing comes from a
 * cache. Measurement only: it runs when BYTES_URL names a built site
 * (`npm run build && npx astro preview --port <port>`), and prints MEASURE lines.
 *
 *   BYTES_URL=http://localhost:<port> npx playwright test tests/battle-ja-cost.spec.ts
 *
 * The cases: the player picks the language and starts at once; the player picks it and starts ten
 * seconds later (the battle page starts loading a language's data when it is picked).
 */
const BASE = process.env.BYTES_URL ?? '';
const NETWORK = { offline: false, latency: 60, downloadThroughput: (9_000 * 1024) / 8, uploadThroughput: (1_500 * 1024) / 8 };
const CPU = 4;

test.skip(!BASE, 'measurement only: set BYTES_URL to a built site');

async function phone(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => localStorage.setItem('inspired-mile-age-verified', 'adult'));
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', NETWORK);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  return page;
}

for (const lang of ['ja', 'en']) {
  for (const wait of [0, 10_000]) {
    test(`${lang}: bytes and the wait for the first verse on a throttled phone, starting ${wait / 1000} s after picking the language`, async ({ browser }) => {
      test.setTimeout(10 * 60 * 1000);
      const page = await phone(browser);
      const done: Array<Promise<{ url: string; bytes: number }>> = [];
      page.on('requestfinished', (r) => done.push(r.sizes().then((s) => ({ url: r.url(), bytes: s.responseBodySize + s.responseHeadersSize })).catch(() => ({ url: r.url(), bytes: 0 }))));
      await page.goto(`${BASE}/battle?seed=7&brain=rules`, { waitUntil: 'load', timeout: 300_000 });
      await expect(page.locator('#start-duel')).toBeEnabled({ timeout: 300_000 });
      const pageBytes = (await Promise.all(done)).reduce((n, r) => n + r.bytes, 0);
      await page.selectOption('#language', lang);
      if (wait) await page.waitForTimeout(wait);
      const t0 = Date.now();
      await page.click('#start-duel');
      await expect(page.locator('#opponent-verse')).toHaveAttribute('data-source', /written|model/, { timeout: 300_000 });
      const firstVerseMs = Date.now() - t0;
      await page.waitForLoadState('networkidle', { timeout: 300_000 });
      const all = await Promise.all(done);
      const dict = all.filter((r) => /\.dat(\.gz)?/.test(new URL(r.url).pathname) && !/\.js$/.test(new URL(r.url).pathname));
      const out = {
        lang,
        startAfterPickMs: wait,
        firstVerseMs,
        transferBytes: all.reduce((n, r) => n + r.bytes, 0),
        pageBytes,
        dictionaryResponses: dict.length,
        dictionaryBytes: dict.reduce((n, r) => n + r.bytes, 0),
        responses: all.length,
      };
      console.log(`MEASURE battle-ja-cost ${JSON.stringify(out)}`);
      expect(firstVerseMs).toBeGreaterThan(0);
      await page.context().close();
    });
  }
}
