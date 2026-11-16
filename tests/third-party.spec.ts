import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { E2E } from './e2e-env';
import { allowedEntry, THIRD_PARTY_ALLOWLIST } from './third-party-allowlist';

/**
 * What the site asks other origins for.
 *
 * The privacy policy says which other companies a visitor's browser talks to, and that
 * the list is complete. These tests hold the site to it: every request to another origin
 * is recorded and compared with tests/third-party-allowlist.ts, and anything not listed
 * fails.
 *
 * Requests to other origins are stopped before they leave (except model downloads in the
 * two tests that need a real model), so a run does not depend on those services.
 *
 * Service workers are blocked here: Playwright cannot see or stop a request that a
 * service worker has taken over, and this site's worker takes over every .js and .css
 * request. With it blocked, every request is the page's own and is seen.
 */

test.use({ serviceWorkers: 'block' });

const AGE_KEY = 'inspired-mile-age-verified';
const PAGES_DIR = fileURLToPath(new URL('../src/pages', import.meta.url));
const IWER = fileURLToPath(new URL('../node_modules/iwer/build/iwer.min.js', import.meta.url));

/** Every page of the site, from the source tree, so a new page is covered without editing this file. */
const PAGES = fs.readdirSync(PAGES_DIR)
  .filter((f) => f.endsWith('.astro'))
  .map((f) => (f === 'index.astro' ? '/' : `/${f.replace(/\.astro$/, '')}`))
  .sort();

const OWN_ORIGINS = [E2E.webOrigin, E2E.webNoEmailOrigin];

function isForeign(url: string): boolean {
  if (/^(data|blob|about|chrome-extension):/.test(url)) return false;
  return !OWN_ORIGINS.some((origin) => url === origin || url.startsWith(`${origin}/`) || url.startsWith(origin.replace(/^http/, 'ws') + '/'));
}

interface Watch {
  /** Every request (and WebSocket) to another origin, in order. */
  foreign: string[];
}

/** Record every request to another origin. Those not in `letThrough` are stopped. */
async function watchForeign(context: BrowserContext, letThrough: (url: string) => boolean = () => false): Promise<Watch> {
  const watch: Watch = { foreign: [] };
  await context.route((url) => isForeign(url.href), async (route) => {
    const url = route.request().url();
    watch.foreign.push(url);
    if (letThrough(url)) await route.continue();
    else await route.abort();
  });
  // Routes do not cover WebSockets.
  context.on('page', (page) => page.on('websocket', (ws) => { if (isForeign(ws.url())) watch.foreign.push(ws.url()); }));
  return watch;
}

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(400);
}

function ageState(value: string | null) {
  return {
    cookies: [],
    origins: value === null ? [] : [{ origin: E2E.webOrigin, localStorage: [{ name: AGE_KEY, value }] }],
  };
}

/** Load every page in one age-gate state; return what each asked other origins for. */
async function loadEveryPage(context: BrowserContext): Promise<Map<string, string[]>> {
  const watch = await watchForeign(context);
  const page = await context.newPage();
  const seen = new Map<string, string[]>();
  for (const path of PAGES) {
    watch.foreign.length = 0;
    const response = await page.goto(path, { waitUntil: 'load' });
    expect(response?.status(), `${path} loads`).toBe(200);
    await settle(page);
    seen.set(path, [...watch.foreign]);
  }
  return seen;
}

test.describe('Requests to other origins', () => {
  test('the list of pages is read from the source tree', () => {
    // If this finds nothing, every test below passes without checking anything.
    expect(PAGES.length).toBeGreaterThanOrEqual(18);
    expect(PAGES).toEqual(expect.arrayContaining(['/', '/battle', '/privacy', '/viewer', '/vr', '/multiplayer']));
  });

  for (const state of ['adult', 'teen-consented']) {
    test(`age gate cleared (${state}): every page asks only for what the allowlist names`, async ({ browser }) => {
      test.setTimeout(6 * 60 * 1000);
      const context = await browser.newContext({ storageState: ageState(state), serviceWorkers: 'block' });
      const seen = await loadEveryPage(context);
      await context.close();

      const unlisted: string[] = [];
      for (const [path, urls] of seen) {
        for (const url of urls) if (!allowedEntry(url, ['page-load'])) unlisted.push(`${path} -> ${url}`);
        // The recorder must be able to see a request, or an empty list means nothing:
        // past the gate, every page loads the analytics script.
        expect(urls, `${path} loads the analytics script once the gate is cleared`).toContain('https://plausible.io/js/script.js');
      }
      expect(unlisted, 'requests to other origins that tests/third-party-allowlist.ts does not list').toEqual([]);
    });
  }

  for (const [label, value] of [['not yet answered', null], ['blocked (under 13)', 'blocked']] as const) {
    test(`age gate ${label}: no page asks another origin for anything`, async ({ browser }) => {
      test.setTimeout(6 * 60 * 1000);
      const context = await browser.newContext({ storageState: ageState(value), serviceWorkers: 'block' });
      const seen = await loadEveryPage(context);
      await context.close();
      const any = [...seen].flatMap(([path, urls]) => urls.map((url) => `${path} -> ${url}`));
      expect(any, 'a visitor who has not passed the age gate must not be reported to anyone').toEqual([]);
    });
  }

  test('analytics starts when the gate is passed, and never for an under-13 answer', async ({ browser }) => {
    const year = new Date().getFullYear();
    async function answer(page: Page, birthYear: number) {
      await expect(page.locator('#age-gate')).toBeVisible();
      await page.selectOption('#age-month', '1');
      await page.selectOption('#age-day', '1');
      await page.selectOption('#age-year', String(birthYear));
      await page.click('#age-gate-submit');
    }

    // An adult: nothing before the answer, the script after it.
    const adult = await browser.newContext({ storageState: ageState(null), serviceWorkers: 'block' });
    const adultWatch = await watchForeign(adult);
    const adultPage = await adult.newPage();
    await adultPage.goto('/');
    await settle(adultPage);
    expect(adultWatch.foreign, 'before the gate is answered').toEqual([]);
    await answer(adultPage, year - 30);
    await expect(adultPage.locator('#age-gate')).toBeHidden();
    await expect.poll(() => adultWatch.foreign).toEqual(['https://plausible.io/js/script.js']);
    await adult.close();

    // A teen: nothing until the consent box is ticked and confirmed.
    const teen = await browser.newContext({ storageState: ageState(null), serviceWorkers: 'block' });
    const teenWatch = await watchForeign(teen);
    const teenPage = await teen.newPage();
    await teenPage.goto('/');
    await answer(teenPage, year - 15);
    await expect(teenPage.locator('#age-gate-teen')).toBeVisible();
    await settle(teenPage);
    expect(teenWatch.foreign, 'a teen who has not confirmed consent').toEqual([]);
    await teenPage.check('#parental-consent');
    await teenPage.click('#teen-continue');
    await expect(teenPage.locator('#age-gate')).toBeHidden();
    await expect.poll(() => teenWatch.foreign).toEqual(['https://plausible.io/js/script.js']);
    await teen.close();

    // Under 13: blocked, and nothing is requested then or on the next page, legal pages included.
    const child = await browser.newContext({ storageState: ageState(null), serviceWorkers: 'block' });
    const childWatch = await watchForeign(child);
    const childPage = await child.newPage();
    await childPage.goto('/');
    await answer(childPage, year - 10);
    await expect(childPage.locator('#age-gate-minor')).toBeVisible();
    expect(await childPage.evaluate((key) => localStorage.getItem(key), AGE_KEY)).toBe('blocked');
    for (const path of ['/battle', '/privacy']) {
      await childPage.goto(path);
      await settle(childPage);
    }
    expect(childWatch.foreign, 'a visitor who said they are under 13').toEqual([]);
    await child.close();
  });

  test('the 3D viewer is the bundled model-viewer, with its decoders on this site', async ({ context, page }) => {
    const watch = await watchForeign(context);
    test.setTimeout(90000);
    await page.goto('/viewer');
    // Retried as a whole: the first time the dev server meets model-viewer it rebuilds its
    // dependency cache and reloads the page, which puts the viewer back in its first mode.
    await expect(async () => {
      await page.selectOption('#card-select', 'SM-001');
      await page.click('#mode-glb');
      await page.waitForFunction(() => !!customElements.get('model-viewer') && !!document.querySelector('#glb-container model-viewer'), undefined, { timeout: 8000 });
    }).toPass({ timeout: 45000 });
    // The bundled component really draws the card's model.
    await page.waitForFunction(() => (document.querySelector('#glb-container model-viewer') as any)?.loaded === true, undefined, { timeout: 30000 });
    const locations = await page.evaluate(() => {
      const el = customElements.get('model-viewer') as any;
      return { draco: el.dracoDecoderLocation as string, ktx2: el.ktx2TranscoderLocation as string, lottie: el.lottieLoaderLocation as string };
    });
    expect(locations.draco).toMatch(/^\/vendor\/three-[\d.]+\/draco\/$/);
    expect(locations.ktx2).toMatch(/^\/vendor\/three-[\d.]+\/basis\/$/);
    expect(locations.lottie).toMatch(/^\//);
    // The decoders really are served from there.
    for (const file of [`${locations.draco}draco_decoder.wasm`, `${locations.draco}draco_wasm_wrapper.js`, `${locations.ktx2}basis_transcoder.wasm`]) {
      const response = await page.request.get(file);
      expect(response.status(), file).toBe(200);
      expect(Number(response.headers()['content-length']), `${file} is not an empty file`).toBeGreaterThan(10000);
    }
    await settle(page);
    expect(watch.foreign.filter((url) => !allowedEntry(url, ['page-load'])), 'requests to other origins').toEqual([]);
    expect(watch.foreign.join('\n')).not.toMatch(/google|gstatic/);
  });

  test('the VR gallery in an emulated Quest 3 session fetches nothing from Babylon\'s servers', async ({ context, page }) => {
    await page.addInitScript({ path: IWER });
    await page.addInitScript(() => {
      const { XRDevice, metaQuest3 } = (window as any).IWER;
      // Chromium's own navigator.xr reports no headset; remove it so the emulator is seen (see theatre.spec.ts).
      delete (Navigator.prototype as any).xr;
      const device = new XRDevice(metaQuest3);
      device.installRuntime();
      const xr = (navigator as any).xr;
      const request = xr.requestSession.bind(xr);
      xr.requestSession = async (...args: unknown[]) => {
        const session = await request(...args);
        (window as any).__xrSession = session;
        return session;
      };
    });
    const watch = await watchForeign(context);
    await page.goto('/vr');
    const enter = page.locator('.babylonVRicon');
    await expect(enter).toBeVisible({ timeout: 20000 });
    await settle(page);
    // Count only what the headset session itself asks for.
    watch.foreign.length = 0;
    await enter.click();
    await page.waitForFunction(() => !!(window as any).__xrSession, undefined, { timeout: 20000 });
    // Controllers and hands are attached over the first frames of a session; that is when
    // Babylon's defaults go to controllers.babylonjs.com and assets.babylonjs.com.
    await page.waitForTimeout(5000);
    expect(await page.evaluate(() => (window as any).__xrSession.inputSources.length), 'the emulated headset has controllers').toBeGreaterThan(0);
    expect(watch.foreign, 'requests to other origins during the headset session').toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The model runtime. These two load a real model (about 80 MB each from the Hugging Face
// hub), because the runtime's WebAssembly is only fetched once a model is being started.
// E2E_NO_DOWNLOADS=1 skips them.
// ---------------------------------------------------------------------------

/** Run a module's loader in the page. Vite may reload the page once when it first meets a dependency. */
async function loadInPage(page: Page, modulePath: string, fn: string): Promise<boolean> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await page.evaluate(async ([path, name]) => {
        const mod = await import(/* @vite-ignore */ path);
        return (await mod[name]()) === true;
      }, [modulePath, fn]);
    } catch (err) {
      if (attempt >= 2 || !/context was destroyed|navigation|Failed to fetch dynamically imported module/i.test(String(err))) throw err;
      await page.waitForLoadState('load');
      await page.waitForTimeout(1000);
    }
  }
}

test.describe('The model runtime comes from this site', () => {
  test.skip(!!process.env.E2E_NO_DOWNLOADS, 'E2E_NO_DOWNLOADS is set: these download real models');
  test.setTimeout(10 * 60 * 1000);

  for (const [what, modulePath, fn, runtime] of [
    ['the ear (Whisper)', '/src/lib/ear.ts', 'loadEar', /^\/ort\/[^/]+\/ort-wasm-simd-threaded\.asyncify\.(wasm|mjs)$/],
    ['the voice (Kokoro)', '/src/lib/thespian-voice.ts', 'loadVoice', /^\/ort\/[^/]+\/ort-wasm-simd-threaded\.jsep\.(wasm|mjs)$/],
  ] as const) {
    test(`loading ${what} asks jsDelivr for nothing: only model files leave the site`, async ({ context, page }) => {
      // Model downloads go through; anything else to another origin is stopped and recorded.
      const watch = await watchForeign(context, (url) => !!allowedEntry(url, ['on-use']));
      const runtimeFiles: Array<{ path: string; status: number }> = [];
      page.on('response', (r) => {
        const url = new URL(r.url());
        if (!isForeign(r.url()) && url.pathname.startsWith('/ort/')) runtimeFiles.push({ path: url.pathname, status: r.status() });
      });

      await page.goto('/about');
      expect(await loadInPage(page, modulePath, fn), `${fn}() succeeds`).toBe(true);

      const unlisted = watch.foreign.filter((url) => !allowedEntry(url, ['page-load', 'on-use']));
      expect(unlisted, 'requests to other origins that the allowlist does not name').toEqual([]);
      expect(watch.foreign.join('\n')).not.toMatch(/jsdelivr|unpkg|cdnjs/);
      // The model itself did come from the hub: the load was real.
      expect(watch.foreign.some((url) => url.startsWith('https://huggingface.co/')), 'the model was downloaded from the hub').toBe(true);
      // And the runtime came from this site.
      const wasm = runtimeFiles.filter((f) => f.path.endsWith('.wasm'));
      expect(wasm.length, `the runtime's WebAssembly was requested from this site (saw ${JSON.stringify(runtimeFiles)})`).toBeGreaterThan(0);
      for (const file of runtimeFiles) {
        expect(file.path).toMatch(runtime);
        expect([200, 206, 304], `${file.path} is served`).toContain(file.status);
      }
    });
  }
});

test('the allowlist has a reason and a source for every entry', () => {
  for (const entry of THIRD_PARTY_ALLOWLIST) {
    expect(entry.reason.length, entry.name).toBeGreaterThan(20);
    expect(entry.source.length, entry.name).toBeGreaterThan(5);
  }
});
