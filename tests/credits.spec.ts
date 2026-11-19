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
  // The CMU notice in full, as the shipped table carries it, and SCOWL's whole Copyright file after it, with the
  // notices of the works SCOWL is made from.
  const notice = page.locator('#notice-cmu + p + pre');
  await expect(notice).toContainText('Redistributions in binary form must reproduce the above copyright notice');
  for (const w of ['as any of the copyrights mentioned below:', 'Copyright 2016 by Benjamin Titze', 'Copyright 1993, Geoff Kuenning', 'WordNet 1.6 Copyright 1997 by Princeton University.']) await expect(notice).toContainText(w);
});

test('the notices the page points to are served', async ({ request }) => {
  const naist = await request.get('/licenses/mecab-ipadic-NOTICE.txt');
  expect(naist.status()).toBe(200);
  expect(await naist.text()).toContain('Nara Institute of Science');
  const ofl = await request.get('/fonts/OFL.txt');
  expect(ofl.status()).toBe(200);
  expect(await ofl.text()).toContain('SIL OPEN FONT LICENSE Version 1.1');
  // The notices of every package and work the build ships (scripts/third-party-notices.mjs), and ONNX Runtime's.
  const notices = await request.get('/licenses/THIRD-PARTY-NOTICES.txt');
  expect(notices.status()).toBe(200);
  const text = await notices.text();
  for (const w of ['PART 1. SOFTWARE PACKAGES', 'Copyright (c) 2001, Dr Martin Porter', 'UNICODE LICENSE V3', 'Copyright (c) 2020 Matthew Miller']) expect(text).toContain(w);
  // three.js's files from others (fflate, ktx-parse, zstddec with Zstandard, meshoptimizer), and SCOWL's whole file.
  for (const w of ['Copyright (c) 2023 Arjun Barrett', 'Copyright (c) 2020 Don McCurdy', 'For Zstandard software', 'Copyright (c) 2016-2025 Arseny Kapoulkine', 'Copyright 1993, Geoff Kuenning']) expect(text).toContain(w);
  const scowl = await request.get('/licenses/SCOWL-Copyright.txt');
  expect(scowl.status()).toBe(200);
  expect(await scowl.text()).toContain('as any of the copyrights mentioned below:');
  for (const v of ['1.22', '1.31']) {
    const ort = await request.get(`/licenses/onnxruntime-${v}-ThirdPartyNotices.txt`);
    expect(ort.status()).toBe(200);
  }
});

test('the credits page links the notices file, and says which packages each library entry covers', async ({ page }) => {
  await page.goto('/credits');
  await expect(page.locator('a#third-party-notices')).toHaveAttribute('href', '/licenses/THIRD-PARTY-NOTICES.txt');
  const lit = page.locator('[data-packages~="lit-html@3.3.2"]');
  await expect(lit).toContainText('Lit 3');
  await expect(lit).toContainText('lit-html@3.3.2, lit-element@4.2.2, @lit/reactive-element@2.1.2');
  // Files three.js carries from others are named by their file licenses (data-files), which the build checks too.
  const libs = page.locator('[data-files~="fflate"]');
  await expect(libs).toHaveAttribute('data-files', 'fflate ktx-parse zstddec meshoptimizer');
  await expect(libs).toContainText('Zstandard');
});

test('at phone width the credits page does not scroll sideways, Packages lines included', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/credits');
  await expect(page.locator('[data-packages~="onnxruntime-web@1.31.0-dev.20260914-8d85527a0"]')).toBeVisible();
  const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(scroll).toBeLessThanOrEqual(client);
  // The longest package name stays inside its entry.
  const entry = await page.locator('[data-packages~="onnxruntime-web@1.31.0-dev.20260914-8d85527a0"]').boundingBox();
  const line = await page.locator('[data-packages~="onnxruntime-web@1.31.0-dev.20260914-8d85527a0"] dd.font-mono').boundingBox();
  expect(line!.x + line!.width).toBeLessThanOrEqual(entry!.x + entry!.width + 0.5);
});
