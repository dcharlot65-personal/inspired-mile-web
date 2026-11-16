import { chromium } from '@playwright/test';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { E2E } from './e2e-env';

/**
 * Open every page once before the tests start.
 *
 * The dev server compiles a page, and every script it imports, the first time a browser
 * asks for it. With one worker per spec file all starting at once on a cold server, the
 * first tests spent 15 to 26 of their 30 seconds waiting for that (measured on main,
 * 2026-11-16), and one more spec file was enough to push three of them over. Compiling
 * here, before any test's clock starts, takes the server's cold start out of the tests.
 *
 * It also absorbs the page reload the dev server forces the first time it meets a
 * dependency it has not pre-bundled.
 */
export default async function warmUp(): Promise<void> {
  if (process.env.PROD_URL) return;
  const pagesDir = fileURLToPath(new URL('../src/pages', import.meta.url));
  const paths = fs.readdirSync(pagesDir)
    .filter((f) => f.endsWith('.astro'))
    .map((f) => (f === 'index.astro' ? '/' : `/${f.replace(/\.astro$/, '')}`));

  const started = Date.now();
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      serviceWorkers: 'block',
      storageState: { cookies: [], origins: [{ origin: E2E.webOrigin, localStorage: [{ name: 'inspired-mile-age-verified', value: 'adult' }] }] },
    });
    // Nothing here needs another origin.
    await context.route((url) => !url.href.startsWith(`${E2E.webOrigin}/`), (route) => route.abort());
    const page = await context.newPage();
    for (const path of paths) {
      try {
        await page.goto(E2E.webOrigin + path, { waitUntil: 'load', timeout: 120000 });
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      } catch (err) {
        // A page that cannot load is for the tests to report, not the warm-up.
        console.warn(`[warm-up] ${path}: ${String(err).split('\n')[0]}`);
      }
    }
  } finally {
    await browser.close();
  }
  console.log(`[warm-up] ${paths.length} pages compiled in ${Math.round((Date.now() - started) / 1000)}s`);
}
