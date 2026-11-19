import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * The credits page (src/pages/credits.astro) is named in the footer of every page and on /about, in the
 * interface's language; it is English like the privacy policy; and the notices it points to are served.
 */

const PAGES_DIR = fileURLToPath(new URL('../src/pages', import.meta.url));
const PAGES = fs.readdirSync(PAGES_DIR)
  .filter((f) => f.endsWith('.astro'))
  .map((f) => (f === 'index.astro' ? '/' : `/${f.replace(/\.astro$/, '')}`));
const LOCALES = ['en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'ru', 'ar', 'hi', 'zh', 'ja', 'ko', 'vi', 'th', 'id'] as const;

test('the list of pages includes the credits page', () => {
  expect(PAGES).toEqual(expect.arrayContaining(['/', '/battle', '/credits', '/about', '/privacy']));
});

for (const path of PAGES) {
  test(`${path}: the footer links to the credits page`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('footer a[href="/credits"]').first()).toBeVisible();
    expect(await page.locator('footer a[href="/credits"]').count()).toBeGreaterThanOrEqual(2);
  });
}

test('/about links to the credits page', async ({ page }) => {
  await page.goto('/about');
  await expect(page.locator('main a[href="/credits"]#about-credits')).toBeVisible();
});

for (const l of LOCALES) {
  test(`${l}: the link reads in the interface language, and the page itself stays English`, async ({ page }) => {
    const s = (await import(`../src/i18n/locales/${l}.ts`)).default as Record<string, string>;
    await page.addInitScript((code) => localStorage.setItem('inspired-mile-locale', code), l);
    await page.goto('/credits');
    await expect(page.locator('html')).toHaveAttribute('lang', l);
    await expect(page.locator('footer a[href="/credits"]').first()).toHaveText(s['footer.credits']);
    await expect(page.locator('section[lang="en"] h1')).toHaveText('Credits and Licenses');
  });
}

test('the credits page names the duties its sources carry', async ({ page }) => {
  await page.goto('/credits');
  const body = page.locator('section[lang="en"]');
  for (const w of ['CC BY-SA 4.0', 'Nara Institute of Science and Technology', 'Carnegie Mellon University', 'SCOWL', 'US$10,000,000', 'Gemma Terms of Use', 'cynicmusic.com', 'pixelsphere.org']) {
    await expect(body).toContainText(w);
  }
  // The CMU notice in full, as the shipped table carries it.
  await expect(page.locator('#notice-cmu + p + pre')).toContainText('Redistributions in binary form must reproduce the above copyright notice');
});

test('the notices the page points to are served', async ({ request }) => {
  const naist = await request.get('/licenses/mecab-ipadic-NOTICE.txt');
  expect(naist.status()).toBe(200);
  expect(await naist.text()).toContain('Nara Institute of Science');
  const ofl = await request.get('/fonts/OFL.txt');
  expect(ofl.status()).toBe(200);
  expect(await ofl.text()).toContain('SIL OPEN FONT LICENSE Version 1.1');
});
