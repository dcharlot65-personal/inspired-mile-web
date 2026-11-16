import { test, expect, type Page } from '@playwright/test';

/**
 * The game as an installed web app: storage protection after a model download, install
 * guidance before the first download or sign-in, and the screen wake lock (src/lib/pwa.ts).
 *
 * What is real here and what is not:
 *   - The page code is real, including brain.ts loadBrain. The model is not: the test
 *     browser has no WebGPU, so navigator.gpu and the Transformers.js module are stubbed
 *     and "a model loaded" means loadBrain's own success path ran.
 *   - navigator.storage and navigator.wakeLock are replaced by counters, because what a
 *     headless browser answers to persist() or does with a wake lock proves nothing about
 *     a phone. These tests prove the game asks at the right moments and shows the answer.
 *   - "Installed" is emulated by making (display-mode: standalone) match.
 * Not covered by any of this: what iOS Safari, a Quest or a Vision Pro actually does.
 */

// The stubbed module has to be the one the page imports, so the service worker (which
// would be between the page and the route below) is left out of these tests.
test.use({ serviceWorkers: 'block' });

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1';

/** Stands in for @huggingface/transformers: a pipeline that loads at once, or refuses. */
const TRANSFORMERS_STUB = `
export async function pipeline(task, id, opts) {
  if (globalThis.__modelFails) throw new Error('stub: the model does not load');
  opts?.progress_callback?.({ status: 'progress', file: 'model.onnx', loaded: 295e6, total: 295e6 });
  const generator = async () => [{ generated_text: [{ role: 'assistant', content: 'stub verse' }] }];
  generator.tokenizer = {};
  generator.dispose = async () => {};
  return generator;
}
export class TextStreamer {}
// loadTransformers() (src/lib/model-runtime.ts) refuses a library without these settings.
export const env = { backends: { onnx: { wasm: {} } } };
`;

interface StorageMock {
  /** What persist() answers. */
  grant: boolean;
  modelFails?: boolean;
}

/** A browser that "has WebGPU", a countable navigator.storage, and a stub model. */
async function mockModelAndStorage(page: Page, mock: StorageMock) {
  await page.addInitScript((m) => {
    (globalThis as any).__modelFails = !!m.modelFails;
    Object.defineProperty(Navigator.prototype, 'gpu', {
      configurable: true,
      get: () => ({ requestAdapter: async () => ({ features: new Set(['shader-f16']) }) }),
    });
    const state = { persistCalls: 0, persisted: false };
    (window as any).__storage = state;
    const fake = {
      persist: async () => {
        state.persistCalls++;
        state.persisted = m.grant;
        return m.grant;
      },
      persisted: async () => state.persisted,
      estimate: async () => ({ usage: 1_090_000_000, quota: 60_000_000_000 }),
    };
    Object.defineProperty(Navigator.prototype, 'storage', { configurable: true, get: () => fake });
  }, mock);
  await page.route(/huggingface[_/]transformers/, (route) => route.fulfill({ contentType: 'text/javascript', body: TRANSFORMERS_STUB }));
}

const persistCalls = (page: Page) => page.evaluate(() => (window as any).__storage.persistCalls as number);

/** Make the page believe it runs as an installed app. */
async function emulateStandalone(page: Page) {
  await page.addInitScript(() => {
    const real = window.matchMedia.bind(window);
    window.matchMedia = (query: string) =>
      query.includes('display-mode: standalone')
        ? ({ matches: true, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false } as unknown as MediaQueryList)
        : real(query);
  });
}

/** Fire the event Chromium fires when the page can be installed. */
async function fireInstallable(page: Page) {
  await page.evaluate(() => {
    const e = new Event('beforeinstallprompt', { cancelable: true }) as any;
    e.prompt = () => {
      (window as any).__prompted = ((window as any).__prompted ?? 0) + 1;
      return Promise.resolve();
    };
    e.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(e);
    (window as any).__defaultPrevented = e.defaultPrevented;
  });
}

/** initPwa has run and made its decision. */
const pwaReady = (page: Page) => expect(page.locator('html')).toHaveAttribute('data-pwa', /tab|standalone/);

test.describe('Persistent storage', () => {
  test('after a model loads, storage.persist is requested and a granted answer is shown as kept', async ({ page }) => {
    await mockModelAndStorage(page, { grant: true });
    await page.goto('/battle?brain=lite');
    await expect(page.locator('#brain-status')).toContainText('LFM2.5 350M is loaded');
    await expect.poll(() => persistCalls(page)).toBe(1);
    const note = page.locator('#storage-note');
    await expect(note).toBeVisible();
    await expect(note).toHaveAttribute('data-state', 'kept');
    await expect(note).toContainText('kept on this device');
    await expect(note).toContainText('1.1 GB');
    await expect(note).not.toContainText('may clear');
    // The answer is recorded for later visits.
    const recorded = await page.evaluate(() => JSON.parse(localStorage.getItem('inspired-mile-storage-protection')!));
    expect(recorded).toMatchObject({ supported: true, persisted: true, model: true });
    // Play was never held up by it.
    await expect(page.locator('#start-duel')).toBeEnabled();
  });

  test('a refused answer is shown as "your browser may clear this", and play goes on', async ({ page }) => {
    await mockModelAndStorage(page, { grant: false });
    await page.goto('/battle?brain=lite');
    await expect(page.locator('#brain-status')).toContainText('LFM2.5 350M is loaded');
    await expect.poll(() => persistCalls(page)).toBe(1);
    const note = page.locator('#storage-note');
    await expect(note).toHaveAttribute('data-state', 'at-risk');
    await expect(note).toContainText('your browser may clear this');
    await expect(note).not.toContainText('kept on this device');
    await expect(page.locator('#start-duel')).toBeEnabled();
  });

  test('a model that fails to load asks for nothing and shows no note', async ({ page }) => {
    await mockModelAndStorage(page, { grant: true, modelFails: true });
    await page.goto('/battle?brain=lite');
    await expect(page.locator('#brain-status')).toContainText('could not start');
    expect(await persistCalls(page)).toBe(0);
    await expect(page.locator('#storage-note')).toBeHidden();
    await expect(page.locator('#start-duel')).toBeEnabled();
  });

  test('without a model there is no note: nothing was downloaded', async ({ page }) => {
    await mockModelAndStorage(page, { grant: true });
    await page.goto('/battle?brain=rules');
    await expect(page.locator('#start-duel')).toBeEnabled();
    await pwaReady(page);
    expect(await persistCalls(page)).toBe(0);
    await expect(page.locator('#storage-note')).toBeHidden();
  });

  test('running installed, storage.persist is requested on arrival', async ({ page }) => {
    await mockModelAndStorage(page, { grant: true });
    await emulateStandalone(page);
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-pwa', 'standalone');
    await expect.poll(() => persistCalls(page)).toBe(1);
  });

  test('a browser with no storage API still loads the model and plays', async ({ page }) => {
    await mockModelAndStorage(page, { grant: true });
    await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'storage', { configurable: true, get: () => undefined }));
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/battle?brain=lite');
    await expect(page.locator('#brain-status')).toContainText('LFM2.5 350M is loaded');
    await expect(page.locator('#storage-note')).toContainText('your browser may clear this');
    await expect(page.locator('#start-duel')).toBeEnabled();
    expect(errors, errors.join('\n')).toEqual([]);
  });
});

test.describe('Install guidance', () => {
  test('a desktop tab that cannot install shows nothing', async ({ page }) => {
    await page.goto('/');
    await pwaReady(page);
    await expect(page.locator('#pwa-install')).toHaveCount(0);
  });

  test('in a tab, the browser offering an install shows the prompt, and Install opens the browser dialog', async ({ page }) => {
    await page.goto('/');
    await pwaReady(page);
    await expect(page.locator('#pwa-install')).toHaveCount(0);
    await fireInstallable(page);
    const box = page.locator('#pwa-install');
    await expect(box).toBeVisible();
    await expect(box).toHaveAttribute('data-mode', 'prompt');
    // The browser's own mini-bar is held back in favour of ours.
    expect(await page.evaluate(() => (window as any).__defaultPrevented)).toBe(true);
    await page.click('#pwa-install-accept');
    expect(await page.evaluate(() => (window as any).__prompted)).toBe(1);
    await expect(box).toHaveCount(0);
  });

  test('installed (standalone), nothing shows even when the browser offers an install', async ({ page }) => {
    await emulateStandalone(page);
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-pwa', 'standalone');
    await fireInstallable(page);
    await expect(page.locator('#pwa-install')).toHaveCount(0);
  });

  test('dismissed, it does not come back: not on the next offer, not on the next page', async ({ page }) => {
    await page.goto('/');
    await pwaReady(page);
    await fireInstallable(page);
    await expect(page.locator('#pwa-install')).toBeVisible();
    await page.click('#pwa-install-dismiss');
    await expect(page.locator('#pwa-install')).toHaveCount(0);
    await fireInstallable(page);
    await expect(page.locator('#pwa-install')).toHaveCount(0);
    await page.goto('/battle?brain=rules');
    await pwaReady(page);
    await fireInstallable(page);
    await expect(page.locator('#pwa-install')).toHaveCount(0);
  });

  test.describe('on an iPhone', () => {
    test.use({ userAgent: IPHONE_UA, hasTouch: true, viewport: { width: 390, height: 844 } });

    test('a Safari tab gets the two steps, before any sign-in or download', async ({ page }) => {
      await page.goto('/battle?brain=rules');
      const box = page.locator('#pwa-install');
      await expect(box).toBeVisible();
      await expect(box).toHaveAttribute('data-mode', 'ios');
      await expect(box.locator('ol li')).toHaveText(['Tap the Share button.', 'Choose “Add to Home Screen”.']);
      // There is no install dialog on iOS, so no Install button.
      await expect(page.locator('#pwa-install-accept')).toHaveCount(0);
      // Nobody is signed in, and no model has been downloaded.
      await expect(page.locator('#auth-btn')).toBeVisible();
      expect(await page.evaluate(() => localStorage.getItem('inspired-mile-storage-protection'))).toBeNull();
      // It does not cover the whole screen, and the page under it still zooms.
      const size = await box.boundingBox();
      expect(size!.height).toBeLessThan(844 / 2);
      expect(await page.locator('meta[name="viewport"]').getAttribute('content')).not.toMatch(/user-scalable|maximum-scale/);
    });

    test('the Home Screen app shows nothing', async ({ page }) => {
      await emulateStandalone(page);
      await page.goto('/battle?brain=rules');
      await expect(page.locator('html')).toHaveAttribute('data-pwa', 'standalone');
      await expect(page.locator('#pwa-install')).toHaveCount(0);
    });

    test('navigator.standalone alone (older iOS) also counts as installed', async ({ page }) => {
      await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'standalone', { configurable: true, get: () => true }));
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('data-pwa', 'standalone');
      await expect(page.locator('#pwa-install')).toHaveCount(0);
    });

    test('dismissed, it stays away after a reload', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('#pwa-install')).toBeVisible();
      await page.click('#pwa-install-dismiss');
      await expect(page.locator('#pwa-install')).toHaveCount(0);
      await page.reload();
      await pwaReady(page);
      await expect(page.locator('#pwa-install')).toHaveCount(0);
    });
  });
});

/** Replace navigator.wakeLock with one that counts, and let the test hide the page. */
async function mockWakeLock(page: Page) {
  await page.addInitScript(() => {
    const state = { requests: [] as string[], releases: 0, active: 0, hidden: false };
    (window as any).__wake = state;
    Object.defineProperty(Navigator.prototype, 'wakeLock', {
      configurable: true,
      get: () => ({
        request: async (type: string) => {
          state.requests.push(type);
          state.active++;
          let released = false;
          return {
            get released() {
              return released;
            },
            release: async () => {
              if (released) return;
              released = true;
              state.releases++;
              state.active--;
            },
            addEventListener() {},
          };
        },
      }),
    });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (state.hidden ? 'hidden' : 'visible') });
    (window as any).__setHidden = (hidden: boolean) => {
      state.hidden = hidden;
      document.dispatchEvent(new Event('visibilitychange'));
    };
  });
}

const wake = (page: Page) => page.evaluate(() => {
  const w = (window as any).__wake;
  return { requests: w.requests.length, type: w.requests[0] as string | undefined, releases: w.releases, active: w.active };
});

const DECK = { name: 'Test deck', characters: ['DC-001', 'MO-001', 'CA-001'], relics: ['RL-001'], potions: ['PT-002'] };
const VERSE = 'Who dares to stand upon my stage?\nI put the question to thy rage';

test.describe('Screen wake lock', () => {
  test('a duel takes the lock when it starts, across a hidden page, and lets it go when it ends', async ({ page }) => {
    await mockWakeLock(page);
    await page.addInitScript((deck) => {
      localStorage.setItem('inspired-mile-decks', JSON.stringify([deck]));
      localStorage.setItem('inspired-mile-active-deck', deck.name);
    }, DECK);
    await page.goto('/battle?seed=11&brain=rules');
    await expect(page.locator('#start-duel')).toBeEnabled();
    // Setting up a duel is not a duel.
    expect(await wake(page)).toMatchObject({ requests: 0, active: 0 });

    await page.click('#start-duel');
    await expect(page.locator('#battle-arena')).toBeVisible();
    await expect.poll(() => wake(page)).toMatchObject({ requests: 1, type: 'screen', active: 1, releases: 0 });

    // Hidden: let go. Back: take it again.
    await page.evaluate(() => (window as any).__setHidden(true));
    await expect.poll(() => wake(page)).toMatchObject({ requests: 1, active: 0, releases: 1 });
    await page.evaluate(() => (window as any).__setHidden(false));
    await expect.poll(() => wake(page)).toMatchObject({ requests: 2, active: 1, releases: 1 });

    // Play the match out.
    await expect(page.locator('#opponent-verse')).not.toHaveText('…');
    for (const id of DECK.characters) {
      await page.click(`[data-char-id="${id}"]`);
      await page.fill('#verse-input', VERSE);
      await page.click('#submit-verse');
      await expect(page.locator('#verdict')).toBeVisible();
      // Still on stage between rounds.
      expect((await wake(page)).active).toBe(1);
      if ((await page.locator('#next-round').innerText()) === 'See the result') break;
      await page.click('#next-round');
      await expect(page.locator('#opponent-verse')).not.toHaveText('…');
    }
    await page.click('#next-round');
    await expect(page.locator('#verdict')).toHaveAttribute('data-match', /player|opponent/);
    await expect.poll(() => wake(page)).toMatchObject({ requests: 2, active: 0, releases: 2 });

    // Coming back to a finished duel does not take it again.
    await page.evaluate(() => (window as any).__setHidden(true));
    await page.evaluate(() => (window as any).__setHidden(false));
    expect(await wake(page)).toMatchObject({ requests: 2, active: 0 });

    // A new duel does.
    await page.click('#duel-again');
    await expect.poll(() => wake(page)).toMatchObject({ requests: 3, active: 1 });
  });

  test('the Theatre holds the lock while a duel is on stage and lets it go at the end', async ({ page }) => {
    await mockWakeLock(page);
    await page.goto('/theatre?seed=11&brain=rules');
    await page.waitForFunction(() => (window as any).__theatre?.session?.phase === 'player-turn');
    await expect.poll(() => wake(page)).toMatchObject({ requests: 1, type: 'screen', active: 1 });

    for (let round = 0; round < 3; round++) {
      const finished = await page.evaluate(async ({ round, verse }) => {
        const t = (window as any).__theatre;
        await t.act({ type: 'character', id: t.session.duel.player.characters[round] });
        t.session.setVerse(verse);
        await t.act({ type: 'submit' });
        const lockedAtVerdict = (window as any).__wake.active;
        await t.act({ type: 'next' });
        return { phase: t.session.phase as string, lockedAtVerdict };
      }, { round, verse: VERSE });
      expect(finished.lockedAtVerdict).toBe(1);
      if (finished.phase === 'finished') break;
      await page.waitForFunction(() => (window as any).__theatre.session.phase === 'player-turn');
    }
    expect(await page.evaluate(() => (window as any).__theatre.session.phase)).toBe('finished');
    await expect.poll(() => wake(page)).toMatchObject({ active: 0, releases: 1 });
  });

  test('a browser with no wake lock plays a duel without an error', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'wakeLock', { configurable: true, get: () => undefined }));
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/battle?seed=11&brain=rules');
    await expect(page.locator('#start-duel')).toBeEnabled();
    await page.click('#start-duel');
    await expect(page.locator('#opponent-verse')).not.toHaveText('…');
    await expect(page.locator('#battle-arena')).toBeVisible();
    expect(errors, errors.join('\n')).toEqual([]);
  });
});

test.describe('Manifest', () => {
  test('names this game, starts at its root, and every icon it lists is served', async ({ page, request }) => {
    await page.goto('/');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    const res = await request.get(href!);
    expect(res.status()).toBe(200);
    const m = await res.json();
    expect(m.short_name).toBe('Sonnet Man');
    expect(m.name).toContain('Sonnet Man');
    expect(m).toMatchObject({ start_url: '/', scope: '/', display: 'standalone' });
    // The bar above the installed app is the page's own background, as the meta tag says.
    expect(m.theme_color.toLowerCase()).toBe((await page.locator('meta[name="theme-color"]').getAttribute('content'))!.toLowerCase());
    expect(m.icons.some((i: any) => i.purpose === 'maskable')).toBe(true);
    expect(m.icons.some((i: any) => i.sizes === '192x192')).toBe(true);
    expect(m.icons.some((i: any) => i.sizes === '512x512' && i.purpose !== 'maskable')).toBe(true);
    for (const icon of m.icons) {
      const img = await request.get(icon.src);
      expect(img.status(), icon.src).toBe(200);
      expect(img.headers()['content-type'], icon.src).toContain(icon.type);
    }
    for (const s of m.shortcuts ?? []) expect((await request.get(s.url)).status(), s.url).toBe(200);
  });
});
