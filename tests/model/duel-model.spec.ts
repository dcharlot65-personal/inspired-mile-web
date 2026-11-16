import { test, expect } from '@playwright/test';
import { allowedEntry } from '../third-party-allowlist';

/**
 * A duel against each real model, in a browser with WebGPU. What is asserted is
 * that the model loads, writes the opponent's verse itself, and judges; what is
 * printed (load time, the verses, the verdict) is for a person to read, since
 * verse quality cannot be asserted.
 */
const TIERS = (process.env.TIERS ?? 'lite,standard,grand').split(',');
const LABEL: Record<string, RegExp> = { lite: /LFM2\.5 350M/, standard: /LFM3 1\.7B/, grand: /Gemma 4 E2B/ };

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('inspired-mile-age-verified', 'adult'));
});

for (const tier of TIERS) {
  test(`${tier}: the model loads, writes the opening verse and judges the round`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    // Every request to another origin while a real model loads and plays. Only the model's
    // own files may leave the site: the runtime's WebAssembly must come from this origin.
    const own = new URL(test.info().project.use.baseURL!).origin;
    const foreign = new Set<string>();
    const runtime = new Set<string>();
    page.on('request', (r) => {
      const url = r.url();
      if (/^(data|blob):/.test(url)) return;
      if (!url.startsWith(`${own}/`)) foreign.add(url.split('?')[0]);
      else if (new URL(url).pathname.startsWith('/ort/')) runtime.add(new URL(url).pathname);
    });

    expect(await page.goto('/about').then(() => page.evaluate(async () => !!(await (navigator as any).gpu?.requestAdapter()))), 'this browser must have WebGPU').toBe(true);

    const t0 = Date.now();
    await page.goto(`/battle?seed=11&brain=${tier}`);
    await expect(page.locator('#start-duel')).toBeEnabled({ timeout: 12 * 60 * 1000 });
    await expect(page.locator('#brain-status')).toContainText(LABEL[tier]);
    const loadSeconds = Math.round((Date.now() - t0) / 1000);

    const t1 = Date.now();
    await page.click('#start-duel');
    const verse = page.locator('#opponent-verse');
    await expect(verse).toHaveAttribute('data-source', /model|written/, { timeout: 3 * 60 * 1000 });
    const opening = await verse.innerText();
    const writeSeconds = Math.round((Date.now() - t1) / 1000);
    // The phone-tier model only judges; the two larger ones must write the verse themselves.
    expect(await verse.getAttribute('data-source')).toBe(tier === 'lite' ? 'written' : 'model');
    expect(opening.trim().length).toBeGreaterThan(10);

    await page.click('[data-char-id]:not(.pointer-events-none)');
    await page.fill('#verse-input', 'Who dares to stand upon my stage?\nI put the question to thy rage');
    const t2 = Date.now();
    await page.click('#submit-verse');
    await expect(page.locator('#verdict')).toBeVisible({ timeout: 3 * 60 * 1000 });
    const judgeSeconds = Math.round((Date.now() - t2) / 1000);
    await expect(page.locator('#verdict')).toContainText(/Judged by .* on this device/);
    await expect(page.locator('#verdict')).toContainText(LABEL[tier]);

    console.log(`\n[${tier}] load ${loadSeconds}s | opening verse ${writeSeconds}s | judging ${judgeSeconds}s`);
    console.log(`[${tier}] form: ${await page.locator('#form-name').innerText()} | opponent: ${await page.locator('#opponent-name').innerText()}`);
    console.log(`[${tier}] opening verse:\n${opening}`);
    console.log(`[${tier}] verdict: ${(await page.locator('#verdict').innerText()).replace(/\n+/g, ' | ').slice(0, 700)}`);
    expect(errors, errors.join('\n')).toEqual([]);

    const unlisted = [...foreign].filter((url) => !allowedEntry(url, ['page-load', 'on-use']));
    console.log(`[${tier}] other origins asked: ${[...new Set([...foreign].map((u) => new URL(u).host))].join(', ')} | runtime: ${[...runtime].join(', ')}`);
    expect(unlisted, 'requests to other origins that tests/third-party-allowlist.ts does not name').toEqual([]);
    expect([...foreign].join('\n')).not.toMatch(/jsdelivr|unpkg|cdnjs/);
    expect([...runtime].some((path) => path.endsWith('.wasm')), `the runtime's WebAssembly came from this site (saw ${[...runtime].join(', ')})`).toBe(true);
  });
}
