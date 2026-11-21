import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { E2E } from './e2e-env';
import { GRACE_PERIOD } from '../src/scripts/tamper-guard';

/**
 * The tamper guard (src/scripts/tamper-guard.ts, on every page) puts a red "This page may have been modified"
 * bar over the page when something is injected into it. It waits GRACE_PERIOD after load before it looks, so a
 * test that reads a page sooner never sees what a visitor sees a moment later. Until 2026-11-19 its link audit
 * held every link to a fixed list of hosts, and the credits page (every license's publisher) and the privacy
 * policy (each company it names) showed the bar to every visitor. These tests wait past the grace period on every
 * page, and check that the guard still catches a link that was added or changed after the page loaded.
 */

const PAGES_DIR = fileURLToPath(new URL('../src/pages', import.meta.url));
/** Every page of the site, from the source tree, so a new page is covered without editing this file. */
const PAGES = fs.readdirSync(PAGES_DIR)
  .filter((f) => f.endsWith('.astro'))
  .map((f) => (f === 'index.astro' ? '/' : `/${f.replace(/\.astro$/, '')}`))
  .sort();

const OWN = [E2E.webOrigin, E2E.webNoEmailOrigin];
const BANNER = '#tamper-guard-warning';
/** Past the guard's first look: it audits the links once GRACE_PERIOD has passed, then every 30 s. */
const PAST_GRACE = GRACE_PERIOD + 1500;

test.beforeEach(async ({ context }) => {
  // Nothing leaves for another origin (the analytics script, a font): the guard reads the page, not them.
  await context.route((url) => !OWN.some((o) => url.href === o || url.href.startsWith(`${o}/`)), (route) => route.abort());
});

/** The page, loaded, with the guard's script run (module scripts run before DOMContentLoaded). */
async function open(page: Page, path: string) {
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(response?.status(), `${path} loads`).toBe(200);
}

test('the list of pages is read from the source tree', () => {
  expect(PAGES.length).toBeGreaterThanOrEqual(19);
  expect(PAGES).toEqual(expect.arrayContaining(['/', '/battle', '/credits', '/privacy', '/terms', '/about']));
});

/**
 * English, and Arabic: in another language a page redraws its translated text on the client (src/components/T.astro),
 * and with it any link inside that text, which the guard then sees as a link the page did not arrive with.
 */
const LOCALES = ['en', 'ar'] as const;

for (const l of LOCALES) for (const path of PAGES) {
  test(`${l} ${path}: no tamper warning once the guard has looked, and the guard is watching`, async ({ page }) => {
    await page.addInitScript((code) => localStorage.setItem('inspired-mile-locale', code), l);
    // The grace period starts when the guard's script runs, before DOMContentLoaded.
    await open(page, path);
    await expect(page.locator('html'), `${path} is shown in ${l}`).toHaveAttribute('lang', l);
    await page.waitForTimeout(PAST_GRACE);
    const warning = await page.locator(BANNER).allTextContents();
    expect(warning, `${path} shows the tamper warning to a visitor`).toEqual([]);
    // The guard has started (its observer and its first link audit start together): an injected frame is caught.
    await page.evaluate(() => document.body.append(document.createElement('iframe')));
    await expect(page.locator(BANNER), `${path}: the guard was running`).toBeVisible({ timeout: 5000 });
  });
}

test.describe('the guard still catches links it did not arrive with', () => {
  // The audit runs at GRACE_PERIOD and every 30 s after: a change that lands just after the first one is seen at the next.
  test.setTimeout(90_000);

  test('a link added after load, to a host not on its list', async ({ page }) => {
    await open(page, '/credits');
    await page.evaluate(() => {
      const a = document.createElement('a');
      a.href = 'https://attacker.example/licenses';
      a.textContent = 'license';
      document.querySelector('main')!.append(a);
    });
    await expect(page.locator(BANNER)).toBeVisible({ timeout: 40_000 });
    await expect(page.locator(BANNER)).toContainText('This page may have been modified');
  });

  test('a link the page was served with, sent somewhere else after load', async ({ page }) => {
    await open(page, '/credits');
    const moved = await page.evaluate(() => {
      const a = document.querySelector<HTMLAnchorElement>('main a[href^="https://creativecommons.org/"]');
      if (!a) return false;
      a.href = 'https://attacker.example/by-sa';
      return true;
    });
    expect(moved, 'the credits page links CC BY-SA').toBe(true);
    await expect(page.locator(BANNER)).toBeVisible({ timeout: 40_000 });
  });

  test('a link added after load to this site or a listed host is left alone', async ({ page }) => {
    await open(page, '/credits');
    await page.evaluate(() => {
      for (const href of ['/terms', 'https://github.com/', 'mailto:contact@voyagetracable.com']) {
        const a = document.createElement('a');
        a.href = href;
        a.textContent = href;
        document.querySelector('main')!.append(a);
      }
    });
    await page.waitForTimeout(PAST_GRACE);
    await expect(page.locator(BANNER)).toHaveCount(0);
  });
});
